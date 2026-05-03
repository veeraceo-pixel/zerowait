/* ============================================================
   skipQs – Supabase Configuration
   Replace these values with your own from:
   https://app.supabase.com → Project Settings → API
   ============================================================ */

const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON = 'YOUR_ANON_PUBLIC_KEY';

// Initialise the Supabase client (loaded via CDN in each HTML file)
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// Convenience exports
window.sb   = _supabase;
window.auth = _supabase.auth;
