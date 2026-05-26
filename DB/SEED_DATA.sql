-- ================================================================
-- skipQs  –  Dummy Seed Data for Testing
-- Run this in your Supabase SQL editor at:
--   Supabase Dashboard → SQL Editor → New Query
--
-- HOW IT WORKS:
--   The providers, queues, and users tables have foreign keys to
--   auth.users(id). Demo/seed rows use fake UUIDs that don't exist
--   in auth.users, which would normally cause a 23503 FK violation.
--
--   This script solves that by:
--     1. Inserting lightweight placeholder rows into auth.users
--        (via the identities trick) so the FK is satisfied, OR
--     2. Temporarily setting session_replication_role = 'replica'
--        which disables FK trigger checks for this session only.
--        This is safe — it only affects THIS SQL session.
--        The FK constraints remain in place for all normal app usage.
--
-- ================================================================

-- Insert stub rows into auth.users so FK constraints are satisfied.
-- These are minimal placeholder rows — no real email/password, just enough
-- for the FK to resolve. Supabase does not allow session_replication_role
-- so we must satisfy the FK properly instead.
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, role, aud
)
VALUES
  -- Provider stub users (owners of demo hospitals/businesses)
  ('00000000-0000-0000-0000-000000000001', 'demo-provider-1@skipqs.internal', '', NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000002', 'demo-provider-2@skipqs.internal', '', NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000003', 'demo-provider-3@skipqs.internal', '', NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000004', 'demo-provider-4@skipqs.internal', '', NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000005', 'demo-provider-5@skipqs.internal', '', NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),
  -- Patient stub users (for demo queue entries)
  ('00000000-0000-0000-0000-000000000010', 'demo-patient-1@skipqs.internal', '', NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000011', 'demo-patient-2@skipqs.internal', '', NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000012', 'demo-patient-3@skipqs.internal', '', NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000013', 'demo-patient-4@skipqs.internal', '', NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 1. DEMO PROVIDERS (hospitals & businesses)
-- ────────────────────────────────────────────────────────────────
INSERT INTO public.providers
  (id, user_id, business_name, category, is_hospital, address, lat, lng, phone, is_open)
VALUES
  -- Hospital 1 – Manchester Royal Infirmary (demo)
  ('11111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-000000000001',   -- replace with real user_id
   'Manchester Royal Infirmary (Demo)',
   'Hospital', true,
   'Oxford Road, Manchester, M13 9WL',
   53.4617, -2.2280,
   '+44 161 276 1234',
   true),

  -- Hospital 2 – Leeds General (demo)
  ('22222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-000000000002',   -- replace with real user_id
   'Leeds General Infirmary (Demo)',
   'Hospital', true,
   'Great George St, Leeds, LS1 3EX',
   53.8014, -1.5492,
   '+44 113 243 2799',
   true),

  -- Clinic
  ('33333333-3333-3333-3333-333333333333',
   '00000000-0000-0000-0000-000000000003',
   'City Walk Clinic (Demo)',
   'Clinic', false,
   '12 City Walk, Leeds, LS11 9AT',
   53.7940, -1.5467,
   '+44 113 245 0001',
   true),

  -- Salon
  ('44444444-4444-4444-4444-444444444444',
   '00000000-0000-0000-0000-000000000004',
   'Styles & Co Salon (Demo)',
   'Salon', false,
   '45 Market Street, Manchester, M1 1WR',
   53.4810, -2.2390,
   '+44 161 834 5678',
   true),

  -- Bank
  ('55555555-5555-5555-5555-555555555555',
   '00000000-0000-0000-0000-000000000005',
   'Barclays Bank Manchester (Demo)',
   'Bank', false,
   '51 Mosley Street, Manchester, M2 3AY',
   53.4804, -2.2367,
   '+44 345 734 5345',
   true)

ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────────
-- 2. DEPARTMENTS for Hospital 1
-- ────────────────────────────────────────────────────────────────
INSERT INTO public.departments
  (id, provider_id, name, icon, is_open, wait_minutes, capacity, avg_consult_minutes, display_order)
VALUES
  ('a1000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'A&E Emergency',   '🚨', true,  45, 8, 20, 0),
  ('a1000001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Cardiology',      '❤️', true,  30, 4, 25, 1),
  ('a1000001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Radiology',       '🔬', true,  20, 3, 15, 2),
  ('a1000001-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Paediatrics',     '👶', true,  15, 4, 20, 3),
  ('a1000001-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Orthopaedics',    '🦴', true,  60, 3, 30, 4),
  ('a1000001-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'Neurology',       '🧠', true,  35, 2, 30, 5),
  ('a1000001-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'Maternity',       '🤰', true,  10, 5, 40, 6),
  ('a1000001-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'Pharmacy',        '💊', true,   8, 6, 10, 7),
  ('a1000001-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'Oncology',        '🎗️', true,  50, 2, 45, 8),
  ('a1000001-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'General Surgery', '🔪', false,  0, 3, 35, 9)

ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────────
-- 3. DEPARTMENTS for Hospital 2
-- ────────────────────────────────────────────────────────────────
INSERT INTO public.departments
  (id, provider_id, name, icon, is_open, wait_minutes, capacity, avg_consult_minutes, display_order)
VALUES
  ('a2000001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'A&E Emergency',   '🚨', true,  55, 6, 20, 0),
  ('a2000001-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Cardiology',      '❤️', true,  40, 3, 25, 1),
  ('a2000001-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Radiology',       '🔬', true,  25, 4, 15, 2),
  ('a2000001-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'Paediatrics',     '👶', true,  18, 3, 20, 3),
  ('a2000001-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'Pharmacy',        '💊', true,   5, 8, 10, 4)

ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────────
-- 4. DEPARTMENTS for Clinic
-- ────────────────────────────────────────────────────────────────
INSERT INTO public.departments
  (id, provider_id, name, icon, is_open, wait_minutes, capacity, avg_consult_minutes, display_order)
VALUES
  ('a3000001-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'GP Consultation', '👨‍⚕️', true, 20, 3, 15, 0),
  ('a3000001-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Blood Tests',     '🩸', true,  10, 4, 10, 1),
  ('a3000001-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'Physiotherapy',   '🏃', true,  30, 2, 40, 2)

ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────────
-- 5. DEPARTMENTS for Salon
-- ────────────────────────────────────────────────────────────────
INSERT INTO public.departments
  (id, provider_id, name, icon, is_open, wait_minutes, capacity, avg_consult_minutes, display_order)
VALUES
  ('a4000001-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'Haircut',              '✂️', true, 15, 3, 25, 0),
  ('a4000001-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'Colour & Highlights',  '🎨', true, 45, 2, 90, 1),
  ('a4000001-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', 'Beard Trim',           '🪒', true,  8, 2, 15, 2),
  ('a4000001-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444444', 'Blow Dry',             '💨', true, 20, 2, 30, 3)

ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────────
-- 6. DEPARTMENTS for Bank
-- ────────────────────────────────────────────────────────────────
INSERT INTO public.departments
  (id, provider_id, name, icon, is_open, wait_minutes, capacity, avg_consult_minutes, display_order)
VALUES
  ('a5000001-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 'Counter Service',   '🪙', true, 12, 4, 10, 0),
  ('a5000001-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555', 'Mortgage Advisor',  '🏠', true, 30, 2, 45, 1),
  ('a5000001-0000-0000-0000-000000000003', '55555555-5555-5555-5555-555555555555', 'Business Banking',  '💼', true, 20, 2, 30, 2)

ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────────
-- 7. SAMPLE QUEUE ENTRIES (demo patient flow)
--    Replace user_id values with real patient auth.users UUIDs
-- ────────────────────────────────────────────────────────────────
INSERT INTO public.queues
  (id, user_id, provider_id, department_id, status, service_duration, customer_name, customer_phone, joined_at)
VALUES
  -- A&E queue at Manchester Royal
  ('e0000001-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000010',  -- patient user_id
   '11111111-1111-1111-1111-111111111111',
   'a1000001-0000-0000-0000-000000000001',
   'waiting', 20, 'Test Patient 1', '+44 7700 900001',
   NOW() - INTERVAL '10 minutes'),

  ('e0000001-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000011',
   '11111111-1111-1111-1111-111111111111',
   'a1000001-0000-0000-0000-000000000001',
   'serving', 20, 'Test Patient 2', '+44 7700 900002',
   NOW() - INTERVAL '25 minutes'),

  -- Cardiology queue
  ('e0000001-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000012',
   '11111111-1111-1111-1111-111111111111',
   'a1000001-0000-0000-0000-000000000002',
   'waiting', 25, 'Test Patient 3', '+44 7700 900003',
   NOW() - INTERVAL '5 minutes'),

  -- Salon haircut queue
  ('e0000001-0000-0000-0000-000000000004',
   '00000000-0000-0000-0000-000000000013',
   '44444444-4444-4444-4444-444444444444',
   'a4000001-0000-0000-0000-000000000001',
   'waiting', 25, 'Test Patient 4', '+44 7700 900004',
   NOW() - INTERVAL '2 minutes'),

  -- Completed entry (for history testing)
  ('e0000001-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000010',
   '11111111-1111-1111-1111-111111111111',
   'a1000001-0000-0000-0000-000000000003',
   'completed', 15, 'Test Patient 1', '+44 7700 900001',
   NOW() - INTERVAL '2 hours')

ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────────
-- 8. PLACES CACHE TABLE (required by nearby.html)
--    Run once if this table doesn't exist yet:
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.places_cache (
  cache_key    TEXT PRIMARY KEY,
  service_type TEXT,
  results      JSONB,
  expires_at   TIMESTAMPTZ
);
ALTER TABLE public.places_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "places_cache_all" ON public.places_cache;
CREATE POLICY "places_cache_all"
  ON public.places_cache FOR ALL USING (TRUE) WITH CHECK (TRUE);


-- ────────────────────────────────────────────────────────────────
-- 9. Clean up stub auth users (optional — remove demo rows from auth.users)
--    Leave these in place if you want to log in as demo providers/patients.
--    Uncomment and run only if you want to remove them after seeding:
-- ────────────────────────────────────────────────────────────────
-- DELETE FROM auth.users WHERE email LIKE '%@skipqs.internal';

-- ────────────────────────────────────────────────────────────────
-- 10. VERIFY – run this SELECT to confirm data loaded:
-- ────────────────────────────────────────────────────────────────
/*
SELECT p.business_name, p.category, p.is_open,
       COUNT(d.id) AS dept_count,
       AVG(d.wait_minutes) AS avg_wait
FROM public.providers p
LEFT JOIN public.departments d ON d.provider_id = p.id
GROUP BY p.id
ORDER BY p.business_name;
*/
