import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
console.log('DEBUG: supabase_server_client SUPABASE_URL=', process.env.SUPABASE_URL);
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_KEY in environment. Set them before running the server.');
}

export const supabaseServerClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});
export default supabaseServerClient;
