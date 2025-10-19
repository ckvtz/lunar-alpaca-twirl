import { createClient } from '@supabase/supabase-js';

// NOTE: In a server environment, we typically use the Service Role Key for privileged operations.
// We assume SUPABASE_KEY holds the Service Role Key.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase environment variables for server functions.');
  // Fallbacks are provided for local testing, but production requires actual secrets.
}

export const supabaseServerClient = createClient(
  SUPABASE_URL || 'http://localhost:54321', 
  SUPABASE_SERVICE_ROLE_KEY || 'dummy_key', 
  {
    auth: {
      persistSession: false,
    },
  }
);