import { supabaseServerClient } from './supabase_server_client.ts';
import { DateTime } from 'luxon';

/**
 * Handler: POST { token: "...", chat_id: "..." }
 * This endpoint is called by the Telegram bot/webhook system to finalize the link.
 * It verifies the token, links the user_id to the chat_id, and deletes the token.
 */
export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { token, chat_id } = req.body || {};
        if (!token || !chat_id) {
            return res.status(400).json({ error: 'Missing token or chat_id' });
        }

        const now = DateTime.now().toUTC().toISO();

        // 1. Verify token and check expiration
        const { data: tokenData, error: tokenError } = await supabaseServerClient
            .from('telegram_link_tokens')
            .select('user_id, expires_at')
            .eq('token', token)
            .gte('expires_at', now) // Token must not be expired
            .limit(1)
            .single();

        if (tokenError || !tokenData) {
            console.warn('Invalid or expired token attempt:', token);
            return res.status(401).json({ ok: false, error: 'Invalid or expired token.' });
        }

        const userId = tokenData.user_id;

        // 2. Upsert the contact into user_contacts table
        const contactData = {
            user_id: userId,
            provider: 'telegram',
            contact_type: 'chat_id',
            contact_id: chat_id,
            created_at: new Date().toISOString(),
        };

        const { error: upsertError } = await supabaseServerClient
            .from('user_contacts')
            .upsert(contactData, { onConflict: 'user_id, provider' });

        if (upsertError) {
            console.error('Contact upsert error:', upsertError);
            return res.status(500).json({ ok: false, error: 'Failed to link contact', details: upsertError.message });
        }

        // 3. Delete the used token
        await supabaseServerClient
            .from('telegram_link_tokens')
            .delete()
            .eq('token', token);

        // 4. Write audit log
        await supabaseServerClient.from('audit_logs').insert([{
            user_id: userId,
            action: 'link_telegram',
            entity_type: 'user_contact',
            entity_id: userId,
            diff_json: { chat_id: chat_id },
            created_at: new Date().toISOString()
        }]);

        return res.status(200).json({ ok: true, message: 'Telegram contact linked successfully.' });

    } catch (err: any) {
        console.error('wf_link_telegram_contact error', err);
        return res.status(500).json({ ok: false, error: 'Internal Server Error', details: String(err) });
    }
}