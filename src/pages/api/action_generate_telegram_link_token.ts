import { supabaseServerClient } from './supabase_server_client.ts';
import { DateTime } from 'luxon';
import * as crypto from 'crypto';

// Generate a short, URL-safe token
function generateToken(length = 12): string {
    return crypto.randomBytes(length).toString('base64url').replace(/=/g, '');
}

/**
 * Handler: POST { user_id: "<uuid>" }
 * Generates a unique token, stores it with an expiration time (1 hour), and returns the token.
 */
export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { user_id } = req.body || {};
        if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

        // 1. Generate token and expiration time (1 hour)
        const token = generateToken(12);
        const expiresAt = DateTime.now().plus({ hours: 1 }).toUTC().toISO();

        // 2. Delete any existing tokens for this user (cleanup)
        // Note: RLS is not active on this table for the client, but we use the service role client here.
        await supabaseServerClient
            .from('telegram_link_tokens')
            .delete()
            .eq('user_id', user_id);

        // 3. Insert new token
        const { error: insertError } = await supabaseServerClient
            .from('telegram_link_tokens')
            .insert([{
                token: token,
                user_id: user_id,
                expires_at: expiresAt,
            }]);

        if (insertError) {
            console.error('Token insertion error:', insertError);
            return res.status(500).json({ error: 'Failed to generate token', details: insertError.message });
        }

        return res.status(200).json({ ok: true, token });

    } catch (err: any) {
        console.error('action_generate_telegram_link_token error', err);
        return res.status(500).json({ error: 'Internal Server Error', details: String(err) });
    }
}