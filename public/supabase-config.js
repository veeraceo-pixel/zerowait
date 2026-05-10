/* ============================================================
   skipQs – Supabase Configuration
   Replace these values with your own from:
   https://app.supabase.com → Project Settings → API
   ============================================================ */

const SUPABASE_URL      = 'https://idcrplpiokodcanjfolf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ygbeTEvM5TdJKRND4GM5dQ_YPGYQI8e';

// Initialise the Supabase client (loaded via CDN in each HTML file)
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Convenience exports
window.sb   = _supabase;
window.auth = _supabase.auth;
