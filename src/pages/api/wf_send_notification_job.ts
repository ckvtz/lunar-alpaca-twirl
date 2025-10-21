import { supabaseServerClient } from './supabase_server_client.ts';
import fetch from 'node-fetch';
import { DateTime } from 'luxon';

/**
 * send message via Telegram Bot API
 */
async function sendViaTelegram(chatId: string | number, text: string) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN not set');
  }
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body = {
    chat_id: String(chatId),
    text: String(text || ''),
    disable_web_page_preview: true
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const raw = await resp.text();
  return { ok: resp.ok, status: resp.status, body: raw };
}

/**
 * Resolve a telegram chat id from the notification row payload_json
 * - prefer payload_json.chat_id or payload_json.to
 * - fallback: lookup user_contacts where provider='telegram' for payload_json.user_id
 */
async function resolveChatId(payload_json: any) {
  if (!payload_json) return null;
  if (payload_json.chat_id) return payload_json.chat_id;
  if (payload_json.to) return payload_json.to;
  if (payload_json.user_id) {
    const lookupUserId = payload_json.user_id;
    const { data: contacts, error } = await supabaseServerClient
      .from('user_contacts')
      .select('contact_id')
      .eq('user_id', lookupUserId)
      .eq('provider', 'telegram')
      .limit(1);
    if (!error && contacts && contacts.length > 0) {
      return contacts[0].contact_id;
    }
  }
  return null;
}

/**
 * Handler: POST { notification_id: "<uuid>" }
 * Will attempt to deliver via Telegram (if TELEGRAM_BOT_TOKEN set).
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { notification_id } = req.body || {};
    if (!notification_id) {
      return res.status(400).json({ error: 'notification_id required' });
    }

    // fetch the notification row
    const { data: notif, error: fetchErr } = await supabaseServerClient
      .from('notifications')
      .select('id, payload_json, status, attempts_count, max_attempts, next_attempt_at')
      .eq('id', notification_id)
      .single();

    if (fetchErr) {
      console.error('Failed to fetch notification', fetchErr);
      return res.status(500).json({ error: 'Failed to fetch notification', details: String(fetchErr) });
    }

    if (!notif) return res.status(404).json({ error: 'Notification not found' });

    if (notif.status === 'sent') {
      return res.status(200).json({ ok: true, message: 'Notification already sent', notification_id });
    }
    
    // Check if it's time to attempt delivery based on next_attempt_at
    const now = DateTime.now().toUTC();
    const nextAttemptDt = notif.next_attempt_at ? DateTime.fromISO(notif.next_attempt_at, { zone: 'utc' }) : now;

    if (nextAttemptDt > now) {
        // This notification is scheduled for a future retry/attempt
        return res.status(200).json({ ok: true, message: 'Notification scheduled for future attempt', notification_id });
    }

    // Primary: Telegram
    if (process.env.TELEGRAM_BOT_TOKEN) {
      const payload = notif.payload_json || {};
      const chatId = await resolveChatId(payload);
      
      const currentAttempts = notif.attempts_count || 0;
      const maxAttempts = notif.max_attempts || 5;

      if (!chatId) {
        // Permanent failure: Cannot resolve recipient
        await supabaseServerClient.from('notifications').update({
          status: 'failed',
          last_error: 'no_chat_id_resolved',
          attempts_count: currentAttempts + 1,
        }).eq('id', notif.id);
        return res.status(500).json({ error: 'no chat id resolved' });
      }

      // construct message text
      const title = payload.title || payload.subject || '';
      const body = payload.body || payload.text || '';
      const lines: string[] = [];
      if (title) lines.push(title);
      if (body) lines.push(body);
      if (payload.meta?.url) lines.push(`Link: ${payload.meta.url}`);
      const messageText = lines.join('\n\n').trim() || 'Subscription reminder';

      // attempt send
      try {
        const tg = await sendViaTelegram(chatId, messageText);
        
        if (tg.ok) {
          // SUCCESS
          await supabaseServerClient.from('notifications').update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            last_error: null,
            attempts_count: currentAttempts + 1,
          }).eq('id', notif.id);

          return res.status(200).json({ ok: true, method: 'telegram', notification_id });
        } else {
          // FAILURE - Apply backoff
          const bodyStr = tg.body || '';
          const errText = `http_${tg.status}: ${bodyStr}`;
          
          const nextAttempts = currentAttempts + 1;
          let newStatus = 'pending';
          let nextAttemptAt = null;
          let lastError = errText;

          if (nextAttempts >= maxAttempts) {
              newStatus = 'failed'; // Permanently failed
              lastError = `Max attempts (${maxAttempts}) reached. Last error: ${lastError}`;
          } else {
              // Exponential backoff: 2^attempts minutes (starting at 1 minute for attempt 1)
              const backoffMinutes = Math.pow(2, nextAttempts);
              const nextDt = DateTime.now().plus({ minutes: backoffMinutes });
              nextAttemptAt = nextDt.toUTC().toISO();
              lastError = `Attempt ${nextAttempts}/${maxAttempts} failed. Retrying in ${backoffMinutes} minutes. Error: ${lastError}`;
          }

          await supabaseServerClient.from('notifications').update({
            status: newStatus,
            attempts_count: nextAttempts,
            next_attempt_at: nextAttemptAt,
            last_error: lastError
          }).eq('id', notif.id);

          return res.status(500).json({ error: 'Telegram delivery failed (retrying)', status: tg.status, body: bodyStr });
        }
      } catch (sendErr: any) {
        // NETWORK/EXCEPTION FAILURE - Apply backoff
        const msg = String(sendErr && (sendErr.message || sendErr));
        console.error('Telegram send exception', sendErr);
        
        const nextAttempts = currentAttempts + 1;
        let newStatus = 'pending';
        let nextAttemptAt = null;
        let lastError = `send_exception: ${msg}`;
        
        if (nextAttempts >= maxAttempts) {
            newStatus = 'failed'; // Permanently failed
            lastError = `Max attempts (${maxAttempts}) reached. Last error: ${lastError}`;
        } else {
            // Exponential backoff: 2^attempts minutes
            const backoffMinutes = Math.pow(2, nextAttempts);
            const nextDt = DateTime.now().plus({ minutes: backoffMinutes });
            nextAttemptAt = nextDt.toUTC().toISO();
            lastError = `Attempt ${nextAttempts}/${maxAttempts} failed. Retrying in ${backoffMinutes} minutes. Error: ${lastError}`;
        }

        await supabaseServerClient.from('notifications').update({
          status: newStatus,
          attempts_count: nextAttempts,
          next_attempt_at: nextAttemptAt,
          last_error: lastError
        }).eq('id', notif.id);
        
        return res.status(500).json({ error: 'Telegram send exception (retrying)', details: msg });
      }
    }

    // fallback if TELEGRAM_BOT_TOKEN not configured
    return res.status(500).json({ error: 'No TELEGRAM_BOT_TOKEN configured' });
  } catch (err: any) {
    console.error('wf_send_notification_job handler error', err);
    return res.status(500).json({ error: 'Internal Server Error', details: String(err) });
  }
}