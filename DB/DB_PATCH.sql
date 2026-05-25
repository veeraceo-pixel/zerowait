-- ================================================================
-- skipQs  –  Database Schema Patch v3 (consolidated)
-- Run this in your Supabase SQL editor:
-- https://supabase.com/dashboard/project/_your_project_/sql/new
--
-- FIX: Previous v2 patch was missing several columns defined in
-- database.sql (description, avg_consult_minutes, display_order,
-- updated_at, the touch_updated_at trigger) causing schema drift
-- between the two files. This patch is now the canonical migration
-- and replaces DB_PATCH.sql v2. Run database.sql first on a fresh
-- project, or run this patch on an existing one.
-- ================================================================

-- ── 1. providers table fixes ──────────────────────────────────────

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS is_hospital  BOOLEAN DEFAULT false;

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS description  TEXT;

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS email        TEXT;

UPDATE public.providers
  SET is_hospital = true
  WHERE category = 'Hospital' AND (is_hospital IS NULL OR is_hospital = false);

-- ── 2. departments table (full canonical definition) ──────────────
-- FIX: Adds missing columns from database.sql v1:
--   description, avg_consult_minutes, display_order, updated_at

CREATE TABLE IF NOT EXISTS public.departments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id         UUID        NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  name                TEXT        NOT NULL,
  description         TEXT,
  icon                TEXT        DEFAULT '🏥',
  wait_minutes        INTEGER     DEFAULT 0,
  capacity            INTEGER     DEFAULT 1,
  avg_consult_minutes INTEGER     DEFAULT 15,
  display_order       INTEGER     DEFAULT 0,
  is_open             BOOLEAN     DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Add any missing columns to an already-existing departments table
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS description         TEXT;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS avg_consult_minutes INTEGER DEFAULT 15;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS display_order       INTEGER DEFAULT 0;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT now();

-- Auto-touch updated_at on every UPDATE
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_departments_touch ON public.departments;
CREATE TRIGGER trg_departments_touch
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Enable realtime so wait-time updates push live
ALTER TABLE public.departments REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.departments';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ── 3. queues table fixes ─────────────────────────────────────────

ALTER TABLE public.queues
  ADD COLUMN IF NOT EXISTS service_duration INTEGER DEFAULT 15;

ALTER TABLE public.queues
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- ── 4. Queue uniqueness constraint (FIX) ─────────────────────────
-- FIX: UNIQUE(user_id, status) from the old migration was broken —
-- it limited users to a single 'completed' queue entry for all time,
-- making re-joining a queue after completion fail with a unique violation.
--
-- Replace with a partial unique index that only covers active statuses.

ALTER TABLE public.queues
  DROP CONSTRAINT IF EXISTS one_active_queue_per_user;

DROP INDEX IF EXISTS public.idx_one_active_queue_per_user;
CREATE UNIQUE INDEX idx_one_active_queue_per_user
  ON public.queues (user_id)
  WHERE status IN ('waiting', 'serving');

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
CREATE INDEX IF NOT EXISTS idx_queues_dept_status     ON public.queues(department_id, status);
CREATE INDEX IF NOT EXISTS idx_queues_user_status     ON public.queues(user_id, status);
CREATE INDEX IF NOT EXISTS idx_queues_provider_status ON public.queues(provider_id, status);

-- ── 6. Row Level Security for departments ─────────────────────────

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "departments_read"  ON public.departments;
CREATE POLICY "departments_read"
  ON public.departments FOR SELECT
  USING (true);

-- Separate write policies per operation for clarity (replaces the broad "ALL" policy)
DROP POLICY IF EXISTS "departments_write" ON public.departments;

DROP POLICY IF EXISTS "departments_insert_owner" ON public.departments;
CREATE POLICY "departments_insert_owner"
  ON public.departments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers
      WHERE providers.id = departments.provider_id
        AND providers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "departments_update_owner" ON public.departments;
CREATE POLICY "departments_update_owner"
  ON public.departments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.providers
      WHERE providers.id = departments.provider_id
        AND providers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "departments_delete_owner" ON public.departments;
CREATE POLICY "departments_delete_owner"
  ON public.departments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.providers
      WHERE providers.id = departments.provider_id
        AND providers.user_id = auth.uid()
    )
  );

-- ── 7. Verify ─────────────────────────────────────────────────────

SELECT
  'providers'   AS tbl,
  COUNT(*)      AS rows,
  COUNT(description)                            AS has_description,
  COUNT(CASE WHEN is_hospital THEN 1 END)       AS hospitals
FROM public.providers

UNION ALL

SELECT
  'departments' AS tbl,
  COUNT(*)      AS rows,
  COUNT(description)                            AS has_description,
  NULL
FROM public.departments

UNION ALL

SELECT
  'queues'      AS tbl,
  COUNT(*)      AS rows,
  COUNT(department_id)                          AS has_dept,
  NULL
FROM public.queues;
