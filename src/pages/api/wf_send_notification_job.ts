import { supabaseServerClient } from './supabase_server_client.ts';
import fetch from 'node-fetch';
import { DateTime } from 'luxon';

// NOTE: We assume EMAIL_API_ENDPOINT is set for production email delivery.
const EMAIL_API_ENDPOINT = process.env.EMAIL_API_ENDPOINT;

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
 * send message via Email API endpoint
 */
async function sendViaEmail(toEmail: string, subject: string, body: string) {
  if (!EMAIL_API_ENDPOINT) {
    throw new Error('EMAIL_API_ENDPOINT not set');
  }
  
  // This is a placeholder for calling an external email service API
  const payload = {
    to: toEmail,
    subject: subject,
    body: body,
    // Add any necessary API keys/secrets here if not handled by the environment
  };

  const resp = await fetch(EMAIL_API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const raw = await resp.text();
  return { ok: resp.ok, status: resp.status, body: raw };
}


/**
 * Resolve a telegram chat id from the notification row payload_json
 * - prefer payload_json.chat_id or payload_json.to
 * - fallback: lookup user_contacts where provider='telegram' for payload_json.user_id
 */
async function resolveTelegramChatId(payload_json: any) {
  if (!payload_json) return null;
  if (payload_json.chat_id) return payload_json.chat_id;
  if (payload_json.to && typeof payload_json.to === 'string' && payload_json.to.startsWith('tg_')) return payload_json.to.substring(3); // Simple prefix check if 'to' is used for Telegram
  
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
 * Resolve the user's email address.
 */
async function resolveUserEmail(userId: string) {
    // We need to fetch the user's email from the auth.users table.
    // Since we cannot directly query auth.users from the public schema, 
    // we rely on the fact that the user's email is often available in the JWT claims 
    // or we can use a custom RPC/function if needed. 
    // For simplicity and security, we will assume the user's email is stored in the 'profiles' table 
    // or we fetch it via a privileged query if necessary.
    
    // NOTE: The 'users' table in the public schema seems to mirror auth.users data. Let's use that.
    const { data: user, error } = await supabaseServerClient
        .from('users')
        .select('email')
        .eq('id', userId)
        .limit(1)
        .single();

    if (error) {
        console.error('Failed to fetch user email:', error);
        return null;
    }
    return user?.email || null;
}


/**
 * Handler: POST { notification_id: "<uuid>" }
 * Will attempt to deliver via Telegram or Email based on subscription settings.
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

    // fetch the notification row and associated subscription data
    const { data: notif, error: fetchErr } = await supabaseServerClient
      .from('notifications')
      .select('id, payload_json, status, attempts_count, max_attempts, next_attempt_at, subscriptions(notification_mode)')
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

    const payload = notif.payload_json || {};
    const currentAttempts = notif.attempts_count || 0;
    const maxAttempts = notif.max_attempts || 5;
    // FIX: Access the first element of the subscriptions array
    const notificationMode = (notif.subscriptions as any)?.[0]?.notification_mode || 'telegram'; // Default to telegram

    // construct message text
    const title = payload.title || payload.subject || 'Subscription Reminder';
    const body = payload.body || payload.text || 'Your subscription is due soon.';
    const lines: string[] = [];
    if (title) lines.push(title);
    if (body) lines.push(body);
    if (payload.meta?.url) lines.push(`Link: ${payload.meta.url}`);
    const messageText = lines.join('\n\n').trim();
    
    let deliveryResult: { ok: boolean, method: string, error?: string, status?: number, body?: string } = { ok: false, method: 'none' };
    let recipientResolved = true;

    if (notificationMode === 'telegram') {
        const chatId = await resolveTelegramChatId(payload);
        if (chatId) {
            try {
                const tg = await sendViaTelegram(chatId, messageText);
                deliveryResult = { ok: tg.ok, method: 'telegram', status: tg.status, body: tg.body };
            } catch (e: any) {
                deliveryResult = { ok: false, method: 'telegram', error: `send_exception: ${e.message || String(e)}` };
            }
        } else {
            recipientResolved = false;
            deliveryResult = { ok: false, method: 'telegram', error: 'no_chat_id_resolved' };
        }
    } else if (notificationMode === 'email') {
        const userId = payload.user_id;
        const userEmail = userId ? await resolveUserEmail(userId) : null;

        if (userEmail) {
            try {
                const email = await sendViaEmail(userEmail, title, messageText);
                deliveryResult = { ok: email.ok, method: 'email', status: email.status, body: email.body };
            } catch (e: any) {
                deliveryResult = { ok: false, method: 'email', error: `send_exception: ${e.message || String(e)}` };
            }
        } else {
            recipientResolved = false;
            deliveryResult = { ok: false, method: 'email', error: 'no_email_resolved' };
        }
    }

    if (deliveryResult.ok) {
        // SUCCESS
        await supabaseServerClient.from('notifications').update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            last_error: null,
            attempts_count: currentAttempts + 1,
        }).eq('id', notif.id);

        return res.status(200).json({ ok: true, method: deliveryResult.method, notification_id });
    } else {
        // FAILURE - Apply backoff
        const errText = deliveryResult.error || `http_${deliveryResult.status}: ${deliveryResult.body}`;
        
        const nextAttempts = currentAttempts + 1;
        let newStatus = 'pending';
        let nextAttemptAt = null;
        let lastError = errText;

        if (!recipientResolved || nextAttempts >= maxAttempts) {
            newStatus = 'failed'; // Permanently failed if recipient not resolved or max attempts reached
            lastError = `Max attempts (${maxAttempts}) reached or recipient unresolved. Last error: ${lastError}`;
        } else {
            // Exponential backoff: 2^attempts minutes (starting at 1 minute for attempt 1)
            const backoffMinutes = Math.pow(2, nextAttempts);
            const nextDt = DateTime.now().plus({ minutes: backoffMinutes });
            nextAttemptAt = nextDt.toUTC().toISO();
            lastError = `Attempt ${nextAttempts}/${maxAttempts} failed via ${deliveryResult.method}. Retrying in ${backoffMinutes} minutes. Error: ${lastError}`;
        }

        await supabaseServerClient.from('notifications').update({
            status: newStatus,
            attempts_count: nextAttempts,
            next_attempt_at: nextAttemptAt,
            last_error: lastError
        }).eq('id', notif.id);

        return res.status(500).json({ error: `${deliveryResult.method} delivery failed (retrying)`, details: errText });
    }

  } catch (err: any) {
    console.error('wf_send_notification_job handler error', err);
    return res.status(500).json({ error: 'Internal Server Error', details: String(err) });
  }
}