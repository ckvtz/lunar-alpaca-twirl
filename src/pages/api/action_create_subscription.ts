import { supabaseServerClient } from './supabase_server_client.ts';
import { DateTime } from 'luxon';

/**
 * action_create_subscription.ts
 * Validates payload, inserts into subscriptions, writes audit_logs, creates a pending notification.
 */

// Helper to fetch user timezone
async function getUserTimezone(userId: string): Promise<string> {
    const { data, error } = await supabaseServerClient
        .from('profiles')
        .select('timezone')
        .eq('id', userId)
        .limit(1)
        .single();
    
    if (error || !data?.timezone) {
        console.warn(`Could not fetch timezone for user ${userId}. Defaulting to UTC.`);
        return 'UTC';
    }
    return data.timezone;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const payload = req.body || {};
    const required = ['name','next_payment_date','billing_cycle','renewal_price','currency','notification_mode','created_by'];
    for (const f of required) if (!payload[f]) return res.status(400).json({ error: `Missing field ${f}` });

    const userId = payload.created_by;
    const userTimezone = await getUserTimezone(userId);

    // normalize fields
    const row:any = {
      name: payload.name,
      logo_url: payload.logo_url || null,
      service_url: payload.service_url || null,
      category: payload.category || null,
      next_payment_date: payload.next_payment_date,
      billing_cycle: payload.billing_cycle,
      renewal_price: payload.renewal_price,
      currency: payload.currency,
      payment_method: payload.payment_method || null,
      notes: payload.notes || null,
      timezone: userTimezone, // Use user's timezone
      valid_until: payload.valid_until || null,
      reminder_offset: payload.reminder_offset || null,
      notification_mode: payload.notification_mode,
      user_id: userId,
      created_at: new Date().toISOString()
    };

    // insert subscription
    const { data: createdSub, error: insErr } = await supabaseServerClient
      .from('subscriptions')
      .insert(row)
      .select('*')
      .single();

    if (insErr) {
      console.error('insert subscription error', insErr);
      return res.status(500).json({ error: 'Failed to insert subscription', details: insErr.message || insErr });
    }

    // write audit log
    await supabaseServerClient.from('audit_logs').insert([{
      user_id: userId,
      action: 'create',
      entity_type: 'subscription',
      entity_id: createdSub.id,
      diff_json: { before: null, after: row },
      created_at: new Date().toISOString()
    }]);

    // create a single notification scheduled at next_payment_date (or with offset if provided)
    // Use the subscription's timezone for calculation
    const subTimezone = createdSub.timezone || 'UTC';
    let scheduledDt = DateTime.fromISO(createdSub.next_payment_date, { zone: subTimezone });
    
    if (payload.reminder_offset && payload.reminder_offset !== 'none') {
      // support a few offsets: '15m','1h','1d','1w'
      if (payload.reminder_offset === '15m') scheduledDt = scheduledDt.minus({ minutes: 15 });
      else if (payload.reminder_offset === '1h') scheduledDt = scheduledDt.minus({ hours: 1 });
      else if (payload.reminder_offset === '1d') scheduledDt = scheduledDt.minus({ days: 1 });
      else if (payload.reminder_offset === '1w') scheduledDt = scheduledDt.minus({ weeks: 1 });
    }
    
    // Convert final scheduled time to UTC ISO string for storage
    const scheduled = scheduledDt.toUTC().toISO();


    const notifRow = {
      subscription_id: createdSub.id,
      scheduled_at: scheduled,
      status: 'pending',
      payload_json: {
        to: userId,
        title: `Subscription renewal — ${createdSub.name}`,
        body: `${createdSub.name} renews on ${createdSub.next_payment_date} (${subTimezone})`,
        subscription_id: createdSub.id,
        user_id: userId
      },
      created_at: new Date().toISOString(),
      next_attempt_at: scheduled, // Initial attempt time is the scheduled time
    };

    await supabaseServerClient.from('notifications').insert([notifRow]);

    return res.status(201).json({ ok: true, subscription: createdSub });
  } catch (err:any) {
    console.error('action_create_subscription error', err);
    return res.status(500).json({ error: String(err) });
  }
}