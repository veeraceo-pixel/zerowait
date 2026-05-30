/* ============================================================
   skipQs – Supabase Configuration
   ============================================================ */

const SUPABASE_URL      = typeof __SUPABASE_URL__      !== 'undefined' ? __SUPABASE_URL__      : 'https://idcrplpiokodcanjfolf.supabase.co';
const SUPABASE_ANON_KEY = typeof __SUPABASE_ANON_KEY__ !== 'undefined' ? __SUPABASE_ANON_KEY__ : 'sb_publishable_ygbeTEvM5TdJKRND4GM5dQ_YPGYQI8e';

if (SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY_HERE') {
  console.warn('[skipQs] ⚠️  supabase-config.js has not been configured with real credentials.');
}

// Initialise the single shared Supabase client (reused by api.js via window.sb)
const _supabase = window.sb || supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Convenience exports
window.sb   = _supabase;
window.auth = _supabase.auth;
