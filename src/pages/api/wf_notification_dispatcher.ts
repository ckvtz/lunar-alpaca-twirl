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
    const now = DateTime.now().toUTC().toISO();
    
    // 1. Find subscriptions that are past due (next_payment_date < now)
    const { data: overdueSubs, error: queryError } = await supabaseServerClient
        .from('subscriptions')
        .select('id, next_payment_date, billing_cycle, timezone, created_by, name')
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
            const currentPaymentDate = DateTime.fromISO(sub.next_payment_date, { zone: sub.timezone || 'UTC' });
            let nextPaymentDate = currentPaymentDate;
            
            // Calculate the next payment date until it is in the future
            while (nextPaymentDate <= DateTime.now()) {
                if (sub.billing_cycle === 'monthly') {
                    nextPaymentDate = nextPaymentDate.plus({ months: 1 });
                } else if (sub.billing_cycle === 'quarterly') {
                    nextPaymentDate = nextPaymentDate.plus({ months: 3 });
                } else if (sub.billing_cycle === 'annually') {
                    nextPaymentDate = nextPaymentDate.plus({ years: 1 });
                } else if (sub.billing_cycle === 'weekly') {
                    nextPaymentDate = nextPaymentDate.plus({ weeks: 1 });
                } else {
                    // Should not happen if schema is respected
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
                    updated_at: new Date().toISOString() // Assuming updated_at column exists (standard practice)
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