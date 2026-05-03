-- ============================================================
--  skipQs – Supabase Schema
--  Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension (already enabled by default on Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------
-- 1. USERS (public profile, mirrors auth.users)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- 2. PROVIDERS (businesses)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.providers (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name     TEXT NOT NULL,
  address           TEXT,
  phone             TEXT,
  lat               DOUBLE PRECISION,
  lng               DOUBLE PRECISION,
  category          TEXT,
  capacity          INT NOT NULL DEFAULT 1,
  is_open           BOOLEAN NOT NULL DEFAULT TRUE,
  current_wait_mins INT NOT NULL DEFAULT 0,
  people_in_line    INT NOT NULL DEFAULT 0,
  menu_image_url    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sync         TIMESTAMPTZ
);

-- ---------------------------------------------------------------
-- 3. SERVICES (sub-table of providers)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.services (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  duration    INT NOT NULL DEFAULT 15,   -- minutes
  price       NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- 4. QUEUES (customer queue entries)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.queues (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id       UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  business_name     TEXT,
  customer_name     TEXT NOT NULL,
  customer_phone    TEXT,
  selected_service  TEXT,
  service_duration  INT NOT NULL DEFAULT 15,
  status            TEXT NOT NULL DEFAULT 'waiting', -- waiting | serving | completed
  joined_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  served_at         TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  completed_date    DATE,
  estimated_time    TIMESTAMPTZ
);

-- ---------------------------------------------------------------
-- Row-Level Security (RLS)
-- ---------------------------------------------------------------

ALTER TABLE public.users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queues    ENABLE ROW LEVEL SECURITY;

-- Users: read own row, insert own row
CREATE POLICY "users_select_own"  ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_insert_own"  ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update_own"  ON public.users FOR UPDATE USING (auth.uid() = id);

-- Providers: anyone can read (for nearby/join), only owner can write
CREATE POLICY "providers_select_all"   ON public.providers FOR SELECT USING (TRUE);
CREATE POLICY "providers_insert_own"   ON public.providers FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "providers_update_own"   ON public.providers FOR UPDATE USING (auth.uid() = id);

-- Services: anyone can read, only provider owner can write
CREATE POLICY "services_select_all"    ON public.services FOR SELECT USING (TRUE);
CREATE POLICY "services_insert_own"    ON public.services FOR INSERT
  WITH CHECK (auth.uid() = provider_id);
CREATE POLICY "services_update_own"    ON public.services FOR UPDATE
  USING (auth.uid() = provider_id);
CREATE POLICY "services_delete_own"    ON public.services FOR DELETE
  USING (auth.uid() = provider_id);

-- Queues: provider sees their own queue; customer sees their own entries
CREATE POLICY "queues_select_customer" ON public.queues FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "queues_select_provider" ON public.queues FOR SELECT
  USING (auth.uid() = provider_id);
CREATE POLICY "queues_insert_customer" ON public.queues FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "queues_update_provider" ON public.queues FOR UPDATE
  USING (auth.uid() = provider_id);

-- ---------------------------------------------------------------
-- Realtime: enable publications so onSnapshot-style listeners work
-- ---------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.queues;
ALTER PUBLICATION supabase_realtime ADD TABLE public.providers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.services;

-- ---------------------------------------------------------------
-- Storage: create bucket for menu images
-- Run separately in Storage tab or via this SQL:
-- ---------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('menus', 'menus', TRUE)
ON CONFLICT DO NOTHING;

CREATE POLICY "menus_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'menus' AND auth.role() = 'authenticated');
CREATE POLICY "menus_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'menus');

-- ---------------------------------------------------------------
-- Places Cache (OSM/Overpass results — replaces Firestore cache)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.places_cache (
  cache_key    TEXT PRIMARY KEY,
  service_type TEXT,
  results      JSONB,
  expires_at   TIMESTAMPTZ
);
ALTER TABLE public.places_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "places_cache_all" ON public.places_cache FOR ALL USING (TRUE) WITH CHECK (TRUE);
