import { supabaseServerClient } from './supabase_server_client';
import { DateTime } from 'luxon';

// NOTE: The user needs to set NOTIFY_SH_ENDPOINT in their environment secrets.
const NOTIFY_ENDPOINT = process.env.NOTIFY_SH_ENDPOINT;

/**
 * Workflow function to query pending notifications and send them.
 */
export default async function handler(_req: any, res: any) {
  
  if (!NOTIFY_ENDPOINT) {
    console.error('NOTIFY_SH_ENDPOINT environment variable is not set.');
    return res.status(500).json({ error: 'Notification endpoint not configured.' });
  }

  try {
    // Get current time in ISO format for database comparison
    const now = DateTime.now().toISO();

    // 1. Query pending notifications scheduled up to now
    const { data: notifications, error: queryError } = await supabaseServerClient
      .from('notifications')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now);

    if (queryError) {
      console.error('Error querying pending notifications:', queryError);
      return res.status(500).json({ error: 'Database query failed', details: queryError.message });
    }

    if (!notifications || notifications.length === 0) {
      return res.status(200).json({ ok: true, message: 'No pending notifications found.' });
    }

    console.log(`Found ${notifications.length} notifications to process.`);

    const results = await Promise.all(notifications.map(async (notification) => {
      const notificationId = notification.id;
      
      try {
        // 2. Send notification (POST to NOTIFY_SH_ENDPOINT)
        const response = await fetch(NOTIFY_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(notification.message_payload),
        });

        const sent_at = DateTime.now().toISO();

        if (response.ok) {
          // 3a. Update status to 'sent'
          const { error: updateError } = await supabaseServerClient
            .from('notifications')
            .update({ status: 'sent', sent_at: sent_at, last_error: null })
            .eq('id', notificationId);

          if (updateError) {
            console.error(`Failed to update notification ${notificationId} status to sent:`, updateError);
          }
          return { id: notificationId, status: 'sent' };
        } else {
          // 3b. Log failure
          const errorText = `External API failed with status ${response.status}`;
          const { error: updateError } = await supabaseServerClient
            .from('notifications')
            .update({ status: 'failed', last_error: errorText })
            .eq('id', notificationId);

          if (updateError) {
            console.error(`Failed to update notification ${notificationId} status to failed:`, updateError);
          }
          return { id: notificationId, status: 'failed', error: errorText };
        }
      } catch (fetchError) {
        // 3c. Log network/fetch failure
        const errorText = `Fetch error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`;
        console.error(`Error processing notification ${notificationId}:`, errorText);
        
        const { error: updateError } = await supabaseServerClient
          .from('notifications')
          .update({ status: 'failed', last_error: errorText })
          .eq('id', notificationId);

        if (updateError) {
          console.error(`Failed to update notification ${notificationId} status to failed after fetch error:`, updateError);
        }
        return { id: notificationId, status: 'failed', error: errorText };
      }
    }));

    return res.status(200).json({ 
      ok: true, 
      message: `Processed ${notifications.length} notifications.`,
      results 
    });

  } catch (e) {
    console.error('General error in wf_send_notification_job:', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}