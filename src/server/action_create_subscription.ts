import { supabaseServerClient } from './supabase_server_client';

/**
 * Handles the creation of a new subscription entry and logs the action.
 * Expects a POST request with subscription details in the body, including 'created_by' (user_id).
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const subscriptionData = req.body;
    const { created_by: user_id, ...insertData } = subscriptionData;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing required field: created_by (user_id)' });
    }

    // 1. Insert into 'subscriptions' table
    const { data: subscription, error: subscriptionError } = await supabaseServerClient
      .from('subscriptions')
      .insert([{ ...insertData, user_id }])
      .select('id')
      .single();

    if (subscriptionError) {
      console.error('Subscription insertion error:', subscriptionError);
      return res.status(500).json({ error: 'Failed to create subscription', details: subscriptionError.message });
    }

    const subscription_id = subscription.id;

    // 2. Create entry in 'audit_logs' table
    const auditLogData = {
      user_id: user_id,
      event_type: 'create_subscription',
      event_data: { subscription_id, data: subscriptionData },
    };

    const { error: auditError } = await supabaseServerClient
      .from('audit_logs')
      .insert([auditLogData]);

    if (auditError) {
      // Log audit failure but proceed with success response for the main action
      console.error('Audit log insertion failed:', auditError);
    }

    // 3. Return success response
    return res.status(200).json({ 
      ok: true, 
      message: 'Subscription created successfully', 
      subscription_id 
    });

  } catch (e) {
    console.error('General error in action_create_subscription:', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}