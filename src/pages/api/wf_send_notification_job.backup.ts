import { supabaseServerClient } from './supabase_server_client';
import fetch from 'node-fetch';
import { DateTime as _DateTime } from 'luxon';

const NOTIFY_ENDPOINT = process.env.NOTIFY_SH_ENDPOINT || '';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { notification_id } = req.body || {};
    if (!notification_id) return res.status(400).json({ error: 'notification_id required' });

    const { data: notif, error: qErr } = await supabaseServerClient
      .from('notifications')
      .select('*, subscriptions(*)')
      .eq('id', notification_id)
      .single();

    if (qErr) {
      console.error('notification query error', qErr);
      return res.status(500).json({ error: 'Failed to load notification', details: qErr.message });
    }
    if (!notif) return res.status(404).json({ error: 'notification not found' });
    if (notif.status === 'sent') return res.status(200).json({ ok: true, note: 'already sent' });

    if (!NOTIFY_ENDPOINT) {
      console.error('NO NOTIFY_ENDPOINT configured.');
      return res.status(500).json({ error: 'Notification endpoint not configured' });
    }

    const payload = {
      to: notif.payload_json?.to || null,
      subject: notif.payload_json?.title || '',
      body: notif.payload_json?.body || '',
      text: (notif.payload_json?.body && String(notif.payload_json.body)) || (notif.payload_json?.title && String(notif.payload_json.title)) || '',
      meta: { subscription_id: notif.subscription_id, notification_id: notif.id }
    };

    let resp;
    try {
      resp = await fetch(NOTIFY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e:any) {
      await supabaseServerClient.from('notifications').update({ status: 'failed', last_error: String(e) }).eq('id', notif.id);
      return res.status(500).json({ error: 'Notify request failed', details: String(e) });
    }

    if (resp.ok) {
      await supabaseServerClient.from('notifications').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', notif.id);
      return res.status(200).json({ ok: true });
    } else {
      const text = await resp.text();
      await supabaseServerClient.from('notifications').update({ status: 'failed', last_error: `http_${resp.status}: ${text}` }).eq('id', notif.id);
      return res.status(500).json({ error: 'notify returned non-200', status: resp.status, body: text });
    }
  } catch (err:any) {
    console.error('wf_send_notification_job error', err);
    return res.status(500).json({ error: String(err) });
  }
}