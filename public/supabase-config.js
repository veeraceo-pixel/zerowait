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

const SUPABASE_URL      = 'https://idcrplpiokodcanjfolf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ygbeTEvM5TdJKRND4GM5dQ_YPGYQI8e';

// Initialise the Supabase client (loaded via CDN in each HTML file)
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Convenience exports
window.sb   = _supabase;
window.auth = _supabase.auth;
