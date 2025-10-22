import { createClient } from '@supabase/supabase-js';

// Supabase Project Details
const PROJECT_URL = "https://gtsyopcogzuegvakpdky.supabase.co";
const SUPABASE_URL = process.env.SUPABASE_URL || PROJECT_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_KEY environment variable for server functions. Server functions will likely fail.');
}

export const supabaseServerClient = createClient(
  SUPABASE_URL, 
  SUPABASE_SERVICE_ROLE_KEY || 'dummy_key', // Using dummy key if missing, but this will cause auth errors
  {
    auth: {
      persistSession: false,
    },
  }
);