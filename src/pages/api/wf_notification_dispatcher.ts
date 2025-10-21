import { supabaseServerClient } from './supabase_server_client.ts';
import { DateTime } from 'luxon';
import notificationWorker from './wf_send_notification_job.ts';

/**
 * Utility function to simulate an internal request to the worker handler.
 */
function simulateWorkerCall(notificationId: string) {
    // Mock request and response objects for internal handler call
    const mockReq = {
        method: 'POST',
        body: { notification_id: notificationId }
    };
    const mockRes = {
        status: (code: number) => ({
            json: (data: any) => ({ code, data })
        })
    };
    // Call the worker handler directly
    return notificationWorker(mockReq, mockRes);
}

/**
 * Handler: GET /api/wf_notification_dispatcher
 * Queries pending notifications and dispatches them to the worker.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const now = DateTime.now().toUTC().toISO();

    // 1. Query pending notifications ready for processing
    // We check if next_attempt_at is less than or equal to now.
    const { data: notifications, error: queryError } = await supabaseServerClient
      .from('notifications')
      .select('id')
      .eq('status', 'pending')
      .lte('next_attempt_at', now)
      .limit(100); // Limit batch size

    if (queryError) {
      console.error('Error querying pending notifications:', queryError);
      return res.status(500).json({ error: 'Database query failed', details: queryError.message });
    }

    if (!notifications || notifications.length === 0) {
      return res.status(200).json({ ok: true, message: 'No pending notifications found.' });
    }

    console.log(`Found ${notifications.length} notifications to dispatch.`);

    // 2. Dispatch each notification to the worker
    const results = await Promise.all(notifications.map(n => simulateWorkerCall(n.id)));

    return res.status(200).json({ 
      ok: true, 
      message: `Dispatched ${notifications.length} notifications.`,
      results: results.map(r => r.data)
    });

  } catch (e) {
    console.error('General error in wf_notification_dispatcher:', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}