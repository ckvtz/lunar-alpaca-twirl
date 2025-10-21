// src/pages/api/wf_send_notification_job.ts
// Telegram-first notification worker endpoint
// Replace the existing file with this to make Telegram primary channel.
//
// IMPORTANT:
// - Ensure TELEGRAM_BOT_TOKEN is set in your environment (export or source .env.local)
// - Ensure supabase_server_client.ts exports supabaseServerClient
//
// Uses node-fetch; keep node-fetch installed (you already added it earlier).

import { supabaseServerClient } from './supabase_server_client.ts';
import fetch from 'node-fetch';

/**
 * Helper: sendMessage via Telegram Bot API
 */
async function sendViaTelegram(chatId: string | number, text: string, opts?: {
  parseMode?: 'MarkdownV2' | 'HTML' | 'Markdown' | 'None',
  disable_web_page_preview?: boolean,
  reply_markup?: any
}) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN not set in environment');
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const body: any = {
    chat_id: String(chatId),
    text: String(text || ''),
    disable_web_page_preview: opts?.disable_web_page_preview ?? true
  };

  if (opts?.parseMode && opts.parseMode !== 'None') body.parse_mode = opts.parseMode;
  if (opts?.reply_markup) body.reply_markup = opts.reply_markup;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const textRes = await res.text();
  return { ok: res.ok, status: res.status, body: textRes };
}

/**
 * Deliver a single notification via Telegram.
 * Resolves chat_id from payload or user_contacts.
 * Updates DB status on success/failure.
 */
async function deliverNotificationViaTelegram(notif: any) {
  try {
    const payload = notif.payload_json || {};
    // Resolve chat_id candidates
    let chatId = payload.chat_id || payload.to || null;

    if (!chatId && payload.user_id) {
      // lookup user_contacts for provider = 'telegram'
      const lookupUserId = payload.user_id;
      const { data: contacts, error: contactErr } = await supabaseServerClient
        .from('user_contacts')
        .select('contact_id')
        .eq('user_id', lookupUserId)
        .eq('provider', 'telegram')
        .limit(1);

      if (!contactErr && contacts && contacts.length > 0) {
        chatId = contacts[0].contact_id;
        console.log('DEBUG: resolved telegram chat_id from user_contacts ->', chatId);
      } else {
        console.log('DEBUG: no telegram mapping found for user', lookupUserId);
      }
    }

    if (!chatId) {
      throw new Error('no_chat_id_resolved');
    }

    // Build message text
    const titlePart = payload.title || payload.subject || '';
    const bodyPart = payload.body || payload.text || '';
    const lines: string[] = [];
    if (titlePart) lines.push(`${titlePart}`);
    if (bodyPart) lines.push(bodyPart);
    // Optionally include clickable link to subscription
    if (payload.meta?.url) lines.push(`Link: ${payload.meta.url}`);
    const messageText = lines.join('\n\n').trim() || 'Subscription reminder';

    // Send with retry/backoff
    const maxAttempts = 3;
    let attempt = 0;
    let lastErr: any = null;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        console.log(`DEBUG: Telegram send attempt ${attempt} -> chatId=${chatId}`);
        const result = await sendViaTelegram(chatId, messageText, { parseMode: 'None', disable_web_page_preview: true });

        if (result.ok) {
          // success -> update notification
          await supabaseServerClient.from('notifications').update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            last_error: null
          }).eq('id', notif.id);

          console.log('INFO: Telegram delivered, notif id ->', notif.id);
          return { ok: true, result };
        } else {
          lastErr = `telegram_${result.status}: ${result.body}`;
          console.warn('WARN: Telegram returned non-ok', lastErr);
          // simple backoff
          await new Promise(r => setTimeout(r, 500 * attempt));
        }
      } catch (sendErr) {
        lastErr = String(sendErr && (sendErr.stack || sendErr.message) || sendErr);
        console.error('ERROR: Telegram send exception', lastErr);
        await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }

    // All attempts failed -> mark notification failed with last error
    await supabaseServerClient.from('notifications').update({
      status: 'failed',
      last_error: lastErr
    }).eq('id', notif.id);

    return { ok: false, error: lastErr };
  } catch (e) {
    const errMsg = (e && e.message) ? e.message : String(e);
    console.error('ERROR delivering via Telegram:', errMsg);
    try {
      await supabaseServerClient.from('notifications').update({
        status: 'failed',
        last_error: `deliver_exception: ${errMsg}`
      }).eq('id', notif.id);
    } catch (dbErr) {
      console.error('ERROR writing failure to DB', dbErr);
    }
    return { ok: false, error: errMsg };
  }
}

/**
 * Handler endpoint: expects POST { notification_id: "<uuid>" }
 * Processes one notification (useful for manual job triggers).
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { notification_id } = req.body || {};

    if (!notification_id) {
      return res.status(400).json({ error: 'Missing notification_id in body' });
    }

    // fetch notification row (and optionally subscriptions for context)
    const { data: rows, error: fetchErr } = await supabaseServerClient
      .from('notifications')
      .select('id, payload_json, status, created_at')
      .eq('id', notification_id)
      .limit(1)
      .single();

    if (fetchErr) {
      console.error('Error fetching notification:', fetchErr);
      return res.status(500).json({ error: 'Failed to fetch notification', details: fetchErr.message || fetchErr });
    }

    const notif = rows;
    if (!notif) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // If already sent, return early
    if (notif.status === 'sent') {
      return res.status(200).json({ ok: true, message: 'Notification already sent', notification_id });
    }

    // Primary path: Telegram
    if (process.env.TELEGRAM_BOT_TOKEN) {
      const tgResult = await deliverNotificationViaTelegram(notif);
      if (tgResult?.ok) {
        return res.status(200).json({ ok: true, message: 'Notification sent via Telegram', notification_id });
      } else {
        // fell through or failed — respond with failure details (and DB updated by the function)
        return res.status(500).json({ error: 'Telegram delivery failed', details: tgResult?.error });
      }
    }

    // If no TELEGRAM_BOT_TOKEN, fail gracefully or implement fallback to other provider here
    console.warn('No TELEGRAM_BOT_TOKEN set - cannot deliver notification via Telegram');
    return res.status(500).json({ error: 'No telegram token configured' });

  } catch (e) {
    console.error('General error in wf_send_notification_job handler:', e);
    return res.status(500).json({ error: 'Internal Server Error', details: (e && e.message) ? e.message : String(e) });
  }
}