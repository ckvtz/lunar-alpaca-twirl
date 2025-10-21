import { supabaseServerClient } from './supabase_server_client.ts';
import { DateTime } from 'luxon';

/**
 * action_update_subscription.ts
 * Validates payload, updates subscription, and writes audit_logs.
 */

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const payload = req.body || {};
    const required = ['id', 'user_id', 'name', 'next_payment_date', 'billing_cycle', 'renewal_price', 'currency', 'notification_mode'];
    for (const f of required) if (!payload[f]) return res.status(400).json({ error: `Missing required field ${f}` });

    const subscriptionId = payload.id;
    const userId = payload.user_id;

    // 1. Fetch old data for audit logging
    const { data: oldSub, error: fetchErr } = await supabaseServerClient
      .from('subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('created_by', userId)
      .single();

    if (fetchErr || !oldSub) {
      console.error('Subscription fetch error or not found/owned:', fetchErr);
      return res.status(404).json({ error: 'Subscription not found or unauthorized.' });
    }

    // 2. Prepare update row
    const updateRow: any = {
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
      timezone: payload.timezone || 'UTC',
      valid_until: payload.valid_until || null,
      reminder_offset: payload.reminder_offset || null,
      notification_mode: payload.notification_mode,
      // user_id and created_at should not be updated here
    };

    // 3. Update subscription
    const { data: updatedSub, error: updateErr } = await supabaseServerClient
      .from('subscriptions')
      .update(updateRow)
      .eq('id', subscriptionId)
      .select('*')
      .single();

    if (updateErr) {
      console.error('Subscription update error:', updateErr);
      return res.status(500).json({ error: 'Failed to update subscription', details: updateErr.message || updateErr });
    }

    // 4. Write audit log
    await supabaseServerClient.from('audit_logs').insert([{
      user_id: userId,
      action: 'update',
      entity_type: 'subscription',
      entity_id: subscriptionId,
      diff_json: { before: oldSub, after: updateRow },
      created_at: new Date().toISOString()
    }]);

    // 5. Re-schedule notification (simple approach: delete old, create new pending)
    // Delete existing pending notifications for this subscription
    await supabaseServerClient
      .from('notifications')
      .delete()
      .eq('subscription_id', subscriptionId)
      .eq('status', 'pending');

    // Create a new pending notification based on updated data (logic copied from action_create_subscription)
    let scheduled = updatedSub.next_payment_date;
    if (updatedSub.reminder_offset) {
      const dt = DateTime.fromISO(updatedSub.next_payment_date, { zone: updatedSub.timezone || 'UTC' });
      if (updatedSub.reminder_offset === '15m') scheduled = dt.minus({ minutes: 15 }).toUTC().toISO();
      else if (updatedSub.reminder_offset === '1h') scheduled = dt.minus({ hours: 1 }).toUTC().toISO();
      else if (updatedSub.reminder_offset === '1d') scheduled = dt.minus({ days: 1 }).toUTC().toISO();
      else if (updatedSub.reminder_offset === '1w') scheduled = dt.minus({ weeks: 1 }).toUTC().toISO();
    }

    const notifRow = {
      subscription_id: updatedSub.id,
      scheduled_at: scheduled,
      status: 'pending',
      payload_json: {
        to: userId,
        title: `Subscription renewal — ${updatedSub.name}`,
        body: `${updatedSub.name} renews on ${updatedSub.next_payment_date}`,
        subscription_id: updatedSub.id,
        user_id: userId
      },
      created_at: new Date().toISOString()
    };

    await supabaseServerClient.from('notifications').insert([notifRow]);


    return res.status(200).json({ ok: true, subscription: updatedSub });
  } catch (err:any) {
    console.error('action_update_subscription error', err);
    return res.status(500).json({ error: String(err) });
  }
}