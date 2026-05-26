-- ============================================================
--  skipQs – Supabase Schema (v2 — complete, run fresh or as patch)
--  Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------
-- 1. USERS
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- 2. PROVIDERS
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.providers (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name     TEXT NOT NULL,
  address           TEXT,
  phone             TEXT,
  email             TEXT,
  lat               DOUBLE PRECISION,
  lng               DOUBLE PRECISION,
  category          TEXT,
  capacity          INT NOT NULL DEFAULT 1,
  is_open           BOOLEAN NOT NULL DEFAULT TRUE,
  is_hospital       BOOLEAN DEFAULT FALSE,
  current_wait_mins INT NOT NULL DEFAULT 0,
  people_in_line    INT NOT NULL DEFAULT 0,
  menu_image_url    TEXT,       -- uploaded menu photo URL
  description       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sync         TIMESTAMPTZ
);

-- ---------------------------------------------------------------
-- 3. DEPARTMENTS (sub-units: hospital depts, salon stations, etc.)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.departments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id         UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  icon                TEXT DEFAULT '🏪',
  is_open             BOOLEAN DEFAULT TRUE,
  wait_minutes        INT DEFAULT 0,
  capacity            INT DEFAULT 1,
  avg_consult_minutes INT DEFAULT 15,
  display_order       INT DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_departments_touch ON public.departments;
CREATE TRIGGER trg_departments_touch
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------
-- 4. SERVICES (named services with durations / prices)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.services (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  duration    INT NOT NULL DEFAULT 15,
  price       NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- 5. QUEUES
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.queues (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL allowed for staff-added queue entries
  provider_id       UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  department_id     UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  business_name     TEXT,
  customer_name     TEXT NOT NULL,
  customer_phone    TEXT,
  selected_service  TEXT,
  service_duration  INT NOT NULL DEFAULT 15,
  status            TEXT NOT NULL DEFAULT 'waiting',  -- waiting | serving | completed | cancelled
  joined_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  served_at         TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  completed_date    DATE,
  estimated_time    TIMESTAMPTZ
);

-- ── Partial unique index: only ONE active queue entry per user at a time.
-- Using a partial index (not a table constraint) so completed/cancelled
-- rows accumulate freely without causing unique violations on cancel.
DROP INDEX IF EXISTS public.idx_one_active_queue_per_user;
CREATE UNIQUE INDEX idx_one_active_queue_per_user
  ON public.queues (user_id)
  WHERE status IN ('waiting', 'serving');

-- ── Supporting indexes
CREATE INDEX IF NOT EXISTS idx_queues_provider_status  ON public.queues (provider_id, status);
CREATE INDEX IF NOT EXISTS idx_queues_user_status      ON public.queues (user_id, status);
CREATE INDEX IF NOT EXISTS idx_queues_dept_status      ON public.queues (department_id, status);
CREATE INDEX IF NOT EXISTS idx_departments_provider    ON public.departments (provider_id);
CREATE INDEX IF NOT EXISTS idx_providers_category      ON public.providers (category);
CREATE INDEX IF NOT EXISTS idx_providers_is_hospital   ON public.providers (is_hospital);

-- ---------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------
ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queues       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments  ENABLE ROW LEVEL SECURITY;

-- Users
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_select_own"  ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_insert_own"  ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update_own"  ON public.users FOR UPDATE USING (auth.uid() = id);

-- Providers
DROP POLICY IF EXISTS "providers_select_all" ON public.providers;
DROP POLICY IF EXISTS "providers_insert_own" ON public.providers;
DROP POLICY IF EXISTS "providers_update_own" ON public.providers;
CREATE POLICY "providers_select_all" ON public.providers FOR SELECT USING (TRUE);
CREATE POLICY "providers_insert_own" ON public.providers FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "providers_update_own" ON public.providers FOR UPDATE USING (auth.uid() = id);

-- Services
DROP POLICY IF EXISTS "services_select_all" ON public.services;
DROP POLICY IF EXISTS "services_insert_own" ON public.services;
DROP POLICY IF EXISTS "services_update_own" ON public.services;
DROP POLICY IF EXISTS "services_delete_own" ON public.services;
CREATE POLICY "services_select_all" ON public.services FOR SELECT USING (TRUE);
CREATE POLICY "services_insert_own" ON public.services FOR INSERT WITH CHECK (auth.uid() = provider_id);
CREATE POLICY "services_update_own" ON public.services FOR UPDATE USING (auth.uid() = provider_id);
CREATE POLICY "services_delete_own" ON public.services FOR DELETE USING (auth.uid() = provider_id);

-- Departments: anyone reads, owner writes
DROP POLICY IF EXISTS "departments_select_all"    ON public.departments;
DROP POLICY IF EXISTS "departments_insert_owner"  ON public.departments;
DROP POLICY IF EXISTS "departments_update_owner"  ON public.departments;
DROP POLICY IF EXISTS "departments_delete_owner"  ON public.departments;
CREATE POLICY "departments_select_all"   ON public.departments FOR SELECT USING (TRUE);
CREATE POLICY "departments_insert_owner" ON public.departments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.providers p WHERE p.id = departments.provider_id AND p.id = auth.uid()));
CREATE POLICY "departments_update_owner" ON public.departments FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.providers p WHERE p.id = departments.provider_id AND p.id = auth.uid()));
CREATE POLICY "departments_delete_owner" ON public.departments FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.providers p WHERE p.id = departments.provider_id AND p.id = auth.uid()));

-- Queues
DROP POLICY IF EXISTS "queues_select_customer" ON public.queues;
DROP POLICY IF EXISTS "queues_select_provider" ON public.queues;
DROP POLICY IF EXISTS "queues_insert_customer" ON public.queues;
DROP POLICY IF EXISTS "queues_update_provider" ON public.queues;
DROP POLICY IF EXISTS "queues_update_customer" ON public.queues;

-- Customers and providers both read their own rows
CREATE POLICY "queues_select_customer" ON public.queues FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "queues_select_provider" ON public.queues FOR SELECT USING (auth.uid() = provider_id);

-- Customers insert their own rows
CREATE POLICY "queues_insert_customer" ON public.queues FOR INSERT WITH CHECK (auth.uid() = user_id);

-- FIX: Providers update their queue (start serving, complete)
CREATE POLICY "queues_update_provider" ON public.queues FOR UPDATE USING (auth.uid() = provider_id);

-- FIX: Customers can update their OWN queue row — needed for cancellation.
-- Without this policy, calling .update({status:'cancelled'}) from dashboard.html
-- silently fails (0 rows updated) because RLS blocks the write.
-- We restrict what can be changed: only status→cancelled is allowed from the
-- customer side; providers use their own policy for serving/completed.
CREATE POLICY "queues_update_customer" ON public.queues FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

-- ---------------------------------------------------------------
-- Realtime publications
-- ---------------------------------------------------------------
-- Safely add tables to Realtime publication — ignore if already a member (42710)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.queues;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.providers;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.services;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.departments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.departments REPLICA IDENTITY FULL;

-- ---------------------------------------------------------------
-- Storage: menu image bucket
-- ---------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('menus', 'menus', TRUE)
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "menus_insert" ON storage.objects;
DROP POLICY IF EXISTS "menus_select" ON storage.objects;
CREATE POLICY "menus_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'menus' AND auth.role() = 'authenticated');
CREATE POLICY "menus_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'menus');

-- ---------------------------------------------------------------
-- Places cache
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.places_cache (
  cache_key    TEXT PRIMARY KEY,
  service_type TEXT,
  results      JSONB,
  expires_at   TIMESTAMPTZ
);
ALTER TABLE public.places_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "places_cache_all" ON public.places_cache;
CREATE POLICY "places_cache_all" ON public.places_cache FOR ALL USING (TRUE) WITH CHECK (TRUE);
