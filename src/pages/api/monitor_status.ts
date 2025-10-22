import { supabaseServerClient } from './supabase_server_client.ts';

/**
 * monitor_status.ts
 * Fetches recent notifications and attempts to fetch cron job run details for monitoring.
 */

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    // 1. Fetch recent notifications (last 20)
    const { data: notifications, error: notifError } = await supabaseServerClient
      .from('notifications')
      .select('id, status, scheduled_at, sent_at, attempts_count, last_error, subscription_id')
      .order('created_at', { ascending: false })
      .limit(20);

    if (notifError) {
      console.error('Error fetching notifications for monitor:', notifError);
      // Continue even if notifications fail, as cron status might still be available
    }

    // 2. Fetch cron job run details (requires service role access and pg_cron extension)
    let cronRuns = [];
    let cronError = null;
    
    try {
        // Note: Accessing pg_cron tables requires elevated privileges, which the service key should have.
        const { data, error } = await supabaseServerClient.rpc('get_cron_job_run_details');
        
        if (error) {
            cronError = error.message;
            console.warn('Could not fetch cron job details (may require specific permissions/setup):', cronError);
        } else {
            cronRuns = data;
        }
    } catch (e) {
        cronError = String(e);
        console.warn('Exception fetching cron job details:', e);
    }

    return res.status(200).json({ 
      ok: true, 
      notifications: notifications || [],
      notifications_error: notifError?.message || null,
      cron_runs: cronRuns,
      cron_error: cronError,
    });

  } catch (err: any) {
    console.error('monitor_status handler error', err);
    return res.status(500).json({ error: 'Internal Server Error', details: String(err) });
  }
}