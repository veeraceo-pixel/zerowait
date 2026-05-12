-- ================================================================
-- skipQs  –  Database Schema Patch v2
-- Run this in your Supabase SQL editor:
-- https://supabase.com/dashboard/project/idcrplpiokodcanjfolf/sql/new
-- ================================================================

-- ── 1. providers table fixes ──────────────────────────────────────

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS is_hospital  BOOLEAN   DEFAULT false;

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS description  TEXT;

UPDATE public.providers
  SET is_hospital = true
  WHERE category = 'Hospital' AND (is_hospital IS NULL OR is_hospital = false);

-- ── 2. departments table (create if missing) ──────────────────────

CREATE TABLE IF NOT EXISTS public.departments (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id    UUID        NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  icon           TEXT        DEFAULT '🏥',
  wait_minutes   INTEGER     DEFAULT 15,
  capacity       INTEGER     DEFAULT 2,
  display_order  INTEGER     DEFAULT 0,
  is_open        BOOLEAN     DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Enable realtime on departments so wait-time updates push live
ALTER TABLE public.departments REPLICA IDENTITY FULL;

-- ── 3. queues table fixes ─────────────────────────────────────────

ALTER TABLE public.queues
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- ── 4. Row Level Security for departments ─────────────────────────

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Anyone can read departments
DROP POLICY IF EXISTS "departments_read" ON public.departments;
CREATE POLICY "departments_read"
  ON public.departments FOR SELECT
  USING (true);

-- Only the provider owner can insert/update/delete
DROP POLICY IF EXISTS "departments_write" ON public.departments;
CREATE POLICY "departments_write"
  ON public.departments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.providers
      WHERE providers.id = departments.provider_id
        AND providers.user_id = auth.uid()
    )
  );

-- ── 5. Indexes ────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_providers_is_hospital  ON public.providers(is_hospital);
CREATE INDEX IF NOT EXISTS idx_providers_category     ON public.providers(category);
CREATE INDEX IF NOT EXISTS idx_providers_user_id      ON public.providers(user_id);
CREATE INDEX IF NOT EXISTS idx_departments_provider   ON public.departments(provider_id);
CREATE INDEX IF NOT EXISTS idx_departments_open       ON public.departments(is_open);
CREATE INDEX IF NOT EXISTS idx_queues_provider        ON public.queues(provider_id);
CREATE INDEX IF NOT EXISTS idx_queues_user            ON public.queues(user_id);
CREATE INDEX IF NOT EXISTS idx_queues_status          ON public.queues(status);
CREATE INDEX IF NOT EXISTS idx_queues_department      ON public.queues(department_id);

-- ── 6. Verify ─────────────────────────────────────────────────────

SELECT
  'providers' AS tbl,
  COUNT(*) AS rows,
  COUNT(description) AS has_description,
  COUNT(CASE WHEN is_hospital THEN 1 END) AS hospitals
FROM public.providers

UNION ALL

SELECT
  'departments' AS tbl,
  COUNT(*) AS rows,
  NULL,
  NULL
FROM public.departments

UNION ALL

SELECT
  'queues' AS tbl,
  COUNT(*) AS rows,
  COUNT(department_id) AS has_dept,
  NULL
FROM public.queues;
