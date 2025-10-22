import { supabaseServerClient } from './supabase_server_client.ts';
import { DateTime } from 'luxon';
import notificationWorker from './wf_send_notification_job.ts';

/**
 * Utility function to simulate an internal request to the worker handler.
 */
function simulateWorkerCall(notificationId: string) {
    // Mock request and response objects for internal handler call
    const mockReq = {
        method: 'POST',
        body: { notification_id: notificationId }
    };
    const mockRes = {
        status: (code: number) => ({
            json: (data: any) => ({ code, data })
        })
    };
    // Call the worker handler directly
    return notificationWorker(mockReq, mockRes);
}

/**
 * Checks for subscriptions whose next_payment_date is in the past and advances them
 * based on their billing cycle.
 */
async function handleSubscriptionRenewal() {
    // We check against the current UTC time.
    const now = DateTime.now().toUTC().toISO();
    
    // 1. Find subscriptions that are past due (next_payment_date < now)
    // Note: next_payment_date is stored as YYYY-MM-DD. When comparing, we treat it as midnight UTC for simplicity 
    // unless we explicitly load it with the subscription's timezone.
    const { data: overdueSubs, error: queryError } = await supabaseServerClient
        .from('subscriptions')
        .select('id, next_payment_date, billing_cycle, timezone, created_by, name, reminder_offset')
        .lte('next_payment_date', now)
        .limit(50); // Process in batches

    if (queryError) {
        console.error('Error querying overdue subscriptions:', queryError);
        return { renewedCount: 0, error: queryError.message };
    }

    if (!overdueSubs || overdueSubs.length === 0) {
        return { renewedCount: 0 };
    }

    console.log(`Found ${overdueSubs.length} subscriptions overdue for renewal.`);

    let renewedCount = 0;
    
    for (const sub of overdueSubs) {
        try {
            const subTimezone = sub.timezone || 'UTC';
            
            // Load the payment date using the subscription's timezone
            let currentPaymentDate = DateTime.fromISO(sub.next_payment_date, { zone: subTimezone });
            
            // If the date is invalid (e.g., due to DST issues or bad data), skip or handle gracefully
            if (!currentPaymentDate.isValid) {
                console.error(`Invalid date for subscription ${sub.id}: ${sub.next_payment_date} in zone ${subTimezone}`);
                continue;
            }

            let nextPaymentDate = currentPaymentDate;
            
            // Calculate the next payment date until it is in the future (relative to the subscription's timezone)
            while (nextPaymentDate <= DateTime.now().setZone(subTimezone)) {
                if (sub.billing_cycle === 'monthly') {
                    nextPaymentDate = nextPaymentDate.plus({ months: 1 });
                } else if (sub.billing_cycle === 'quarterly') {
                    nextPaymentDate = nextPaymentDate.plus({ months: 3 });
                } else if (sub.billing_cycle === 'annually') {
                    nextPaymentDate = nextPaymentDate.plus({ years: 1 });
                } else if (sub.billing_cycle === 'weekly') {
                    nextPaymentDate = nextPaymentDate.plus({ weeks: 1 });
                } else {
                    console.warn(`Unknown billing cycle for subscription ${sub.id}: ${sub.billing_cycle}`);
                    break; 
                }
            }

            const newNextPaymentDate = nextPaymentDate.toISODate(); // YYYY-MM-DD format

            // 2. Update the subscription with the new next_payment_date
            const { error: updateError } = await supabaseServerClient
                .from('subscriptions')
                .update({ 
                    next_payment_date: newNextPaymentDate,
                    updated_at: new Date().toISOString()
                })
                .eq('id', sub.id);

            if (updateError) {
                console.error(`Failed to renew subscription ${sub.id}:`, updateError);
                continue;
            }
            
            // 3. Write audit log for renewal
            await supabaseServerClient.from('audit_logs').insert([{
                user_id: sub.created_by,
                action: 'auto_renew',
                entity_type: 'subscription',
                entity_id: sub.id,
                diff_json: { 
                    old_date: sub.next_payment_date, 
                    new_date: newNextPaymentDate,
                    name: sub.name
                },
                created_at: new Date().toISOString()
            }]);

            // 4. Create a new pending notification for the newly scheduled date
            let scheduledDt = DateTime.fromISO(newNextPaymentDate, { zone: subTimezone });
            
            if (sub.reminder_offset && sub.reminder_offset !== 'none') {
                if (sub.reminder_offset === '15m') scheduledDt = scheduledDt.minus({ minutes: 15 });
                else if (sub.reminder_offset === '1h') scheduledDt = scheduledDt.minus({ hours: 1 });
                else if (sub.reminder_offset === '1d') scheduledDt = scheduledDt.minus({ days: 1 });
                else if (sub.reminder_offset === '1w') scheduledDt = scheduledDt.minus({ weeks: 1 });
            }
            
            const scheduled = scheduledDt.toUTC().toISO();

            const notifRow = {
                subscription_id: sub.id,
                scheduled_at: scheduled,
                status: 'pending',
                payload_json: {
                    to: sub.created_by,
                    title: `Subscription renewal — ${sub.name}`,
                    body: `${sub.name} renews on ${newNextPaymentDate} (${subTimezone})`,
                    subscription_id: sub.id,
                    user_id: sub.created_by
                },
                created_at: new Date().toISOString(),
                next_attempt_at: scheduled,
            };

            // Delete any existing pending notifications for this subscription before inserting the new one
            await supabaseServerClient
                .from('notifications')
                .delete()
                .eq('subscription_id', sub.id)
                .eq('status', 'pending');

            await supabaseServerClient.from('notifications').insert([notifRow]);

            renewedCount++;
        } catch (e) {
            console.error(`Renewal processing error for subscription ${sub.id}:`, e);
        }
    }

    return { renewedCount };
}


/**
 * Handler: GET /api/wf_notification_dispatcher
 * Queries pending notifications and dispatches them to the worker.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Run Renewal Logic first
    const renewalResult = await handleSubscriptionRenewal();
    console.log(`Renewal complete. Renewed ${renewalResult.renewedCount} subscriptions.`);

    const now = DateTime.now().toUTC().toISO();

    // 2. Query pending notifications ready for processing
    // We check if next_attempt_at is less than or equal to now.
    const { data: notifications, error: queryError } = await supabaseServerClient
      .from('notifications')
      .select('id')
      .eq('status', 'pending')
      .lte('next_attempt_at', now)
      .limit(100); // Limit batch size

    if (queryError) {
      console.error('Error querying pending notifications:', queryError);
      return res.status(500).json({ error: 'Database query failed', details: queryError.message });
    }

    if (!notifications || notifications.length === 0) {
      return res.status(200).json({ ok: true, message: 'No pending notifications found.', renewed: renewalResult.renewedCount });
    }

    console.log(`Found ${notifications.length} notifications to dispatch.`);

    // 3. Dispatch each notification to the worker
    const results = await Promise.all(notifications.map(n => simulateWorkerCall(n.id)));

    return res.status(200).json({ 
      ok: true, 
      message: `Dispatched ${notifications.length} notifications.`,
      renewed: renewalResult.renewedCount,
      results: results.map(r => r.data)
    });

  } catch (e) {
    console.error('General error in wf_notification_dispatcher:', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}