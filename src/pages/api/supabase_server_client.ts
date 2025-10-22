import { createClient } from '@supabase/supabase-js';

// Supabase Project Details
const PROJECT_URL = "https://gtsyopcogzuegvakpdky.supabase.co";
const SUPABASE_URL = process.env.SUPABASE_URL || PROJECT_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_KEY environment variable for API functions. API calls will likely fail.');
}

export const supabaseServerClient = createClient(SUPABASE_URL, SUPABASE_KEY || 'dummy_key', {
  auth: { persistSession: false }
});
export default supabaseServerClient;