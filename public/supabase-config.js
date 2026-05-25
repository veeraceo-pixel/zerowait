/* ============================================================
   skipQs – Supabase Configuration
   Replace these placeholder values with your own from:
   https://app.supabase.com → Project Settings → API

   IMPORTANT: This file is the single source of truth for your
   Supabase credentials. The anon key is safe to ship in a
   browser bundle (it is designed to be public), but:

     1. NEVER commit a real service_role key here.
     2. Rotate the anon key if you ever accidentally expose the
        service_role key, or if you see unexpected DB activity.
     3. Your primary protection is Row Level Security (RLS) on
        every table — review your Supabase RLS policies regularly.

   api.js reads these globals so credentials live in one place only.
   ============================================================ */

// ── Set your own credentials below ───────────────────────────────────────────
// ⚠️  NEVER commit real keys to a public repository.
// For production: use your build tool (Netlify/Vercel env vars, GitHub Actions
// secrets) to inject __SUPABASE_URL__ and __SUPABASE_ANON_KEY__ at build time.
// Locally: replace the placeholder strings directly, but keep the file in .gitignore.
const SUPABASE_URL      = typeof __SUPABASE_URL__      !== 'undefined' ? __SUPABASE_URL__      : 'YOUR_SUPABASE_URL_HERE';
const SUPABASE_ANON_KEY = typeof __SUPABASE_ANON_KEY__ !== 'undefined' ? __SUPABASE_ANON_KEY__ : 'YOUR_SUPABASE_ANON_KEY_HERE';

if (SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY_HERE') {
  console.warn('[skipQs] ⚠️  supabase-config.js has not been configured with real credentials.');
}

// Initialise the single shared Supabase client (reused by api.js via window.sb)
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Convenience exports
window.sb   = _supabase;
window.auth = _supabase.auth;
