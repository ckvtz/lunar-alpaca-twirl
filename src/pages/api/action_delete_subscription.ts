import { supabaseServerClient } from './supabase_server_client.ts';

/**
 * action_delete_subscription.ts
 * Deletes a subscription, associated notifications, and writes an audit log.
 */

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const payload = req.body || {};
    const required = ['id', 'user_id'];
    for (const f of required) if (!payload[f]) return res.status(400).json({ error: `Missing required field: ${f}` });

    const subscriptionId = payload.id;
    const userId = payload.user_id;

    // 1. Fetch subscription details before deletion for audit logging
    const { data: oldSub, error: fetchErr } = await supabaseServerClient
      .from('subscriptions')
      .select('name')
      .eq('id', subscriptionId)
      .eq('created_by', userId) // Ensure user owns the subscription
      .single();

    if (fetchErr || !oldSub) {
      console.error('Subscription fetch error or not found/owned:', fetchErr);
      return res.status(404).json({ error: 'Subscription not found or unauthorized.' });
    }

    // 2. Delete associated notifications (optional, but good cleanup)
    // Note: Deleting the subscription should cascade delete notifications if foreign key is set up correctly, 
    // but explicitly deleting ensures cleanup regardless of cascade settings on 'notifications' table.
    await supabaseServerClient
      .from('notifications')
      .delete()
      .eq('subscription_id', subscriptionId);

    // 3. Delete subscription (RLS ensures only the owner can delete)
    const { error: deleteErr } = await supabaseServerClient
      .from('subscriptions')
      .delete()
      .eq('id', subscriptionId);

    if (deleteErr) {
      console.error('Subscription deletion error:', deleteErr);
      return res.status(500).json({ error: 'Failed to delete subscription', details: deleteErr.message || deleteErr });
    }

    // 4. Write audit log
    await supabaseServerClient.from('audit_logs').insert([{
      user_id: userId,
      action: 'delete',
      entity_type: 'subscription',
      entity_id: subscriptionId,
      diff_json: { before: oldSub, after: null },
      created_at: new Date().toISOString()
    }]);

    return res.status(200).json({ ok: true, message: 'Subscription deleted successfully' });
  } catch (err:any) {
    console.error('action_delete_subscription error', err);
    return res.status(500).json({ error: 'Internal Server Error', details: String(err) });
  }
}