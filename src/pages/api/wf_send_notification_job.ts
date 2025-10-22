import { supabaseServerClient } from './supabase_server_client.ts';
import fetch from 'node-fetch';
import { DateTime } from 'luxon';

// NOTE: We assume EMAIL_API_ENDPOINT is set for production email delivery.
const EMAIL_API_ENDPOINT = process.env.EMAIL_API_ENDPOINT;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * send message via Telegram Bot API
 */
async function sendViaTelegram(chatId: string | number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN not set in environment.');
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body = {
    chat_id: String(chatId),
    text: String(text || ''),
    parse_mode: 'MarkdownV2', // Use MarkdownV2 for better formatting control
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
 * send message via Email API endpoint or use a mock if not configured.
 */
async function sendViaEmail(toEmail: string, subject: string, body: string) {
  const payload = {
    to: toEmail,
    subject: subject,
    body: body,
  };

  if (!EMAIL_API_ENDPOINT) {
    // MOCK IMPLEMENTATION for development/testing
    console.log('--- MOCK EMAIL SENT ---');
    console.log(`TO: ${toEmail}`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`BODY: ${body.substring(0, 100)}...`);
    console.log('-----------------------');
    return { ok: true, status: 200, body: 'Mock email sent successfully.' };
  }
  
  // Production implementation: call external email service API
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
  if (payload_json.to && typeof payload_json.to === 'string' && payload_json.to.startsWith('tg_')) return payload_json.to.substring(3);
  
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
    // Use the 'users' table in the public schema which mirrors auth.users data.
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
 * Helper to escape MarkdownV2 special characters for Telegram.
 */
function escapeMarkdownV2(text: string): string {
    // List of characters to escape: _ * [ ] ( ) ~ ` > # + - = | { } . !
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
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
      .select('id, payload_json, status, attempts_count, max_attempts, next_attempt_at, subscriptions(notification_mode, name, service_url)')
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
    
    const payload = notif.payload_json || {};
    const currentAttempts = notif.attempts_count || 0;
    const maxAttempts = notif.max_attempts || 5;
    
    // Check if it's time to attempt delivery based on next_attempt_at
    const now = DateTime.now().toUTC();
    const nextAttemptDt = notif.next_attempt_at ? DateTime.fromISO(notif.next_attempt_at, { zone: 'utc' }) : now;

    if (nextAttemptDt > now) {
        // This notification is scheduled for a future retry/attempt
        return res.status(200).json({ ok: true, message: 'Notification scheduled for future attempt', notification_id });
    }

    // FIX: Access the first element of the subscriptions array and default to 'telegram'
    const subscriptionDetails = (notif.subscriptions as any)?.[0];
    const notificationMode = subscriptionDetails?.notification_mode || 'telegram'; 
    const subscriptionName = subscriptionDetails?.name || 'Subscription';
    const serviceUrl = subscriptionDetails?.service_url || null;

    // construct message text
    const title = payload.title || `Renewal Reminder: ${subscriptionName}`;
    const body = payload.body || 'Your subscription is due soon.';
    
    // Prepare Telegram message using MarkdownV2 escaping
    const escapedTitle = escapeMarkdownV2(title);
    const escapedBody = escapeMarkdownV2(body);
    
    const lines: string[] = [];
    lines.push(`*${escapedTitle}*`);
    lines.push(escapedBody);
    
    if (serviceUrl) {
        // Telegram requires links to be formatted as [Text](URL)
        const urlText = escapeMarkdownV2(serviceUrl);
        lines.push(`[View Service](${urlText})`);
    }
    
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
                // Email body doesn't need MarkdownV2 escaping
                const email = await sendViaEmail(userEmail, title, body); 
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