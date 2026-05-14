-- ============================================================
-- skipQs — database.sql
-- Run all statements in the Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. PROVIDERS — base table fixes
-- ============================================================
ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS email text;

-- Mark providers that are hospitals (so we can filter them in the UI)
ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS is_hospital boolean DEFAULT false;

ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS description text;

-- Back-fill: any provider whose category is 'Hospital' is a hospital
UPDATE providers
  SET is_hospital = true
  WHERE category = 'Hospital' AND (is_hospital IS NULL OR is_hospital = false);

-- ============================================================
-- 2. DEPARTMENTS — new table for hospital departments
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id         uuid        NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  name                text        NOT NULL,
  description         text,
  icon                text        DEFAULT '🏥',
  is_open             boolean     DEFAULT true,
  wait_minutes        integer     DEFAULT 0,        -- staff-set live wait time
  capacity            integer     DEFAULT 1,         -- how many patients seen at once
  avg_consult_minutes integer     DEFAULT 15,        -- typical visit duration
  display_order       integer     DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_departments_provider
  ON departments (provider_id);

CREATE INDEX IF NOT EXISTS idx_departments_open
  ON departments (provider_id, is_open);

-- Auto-touch updated_at
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_departments_touch ON departments;
CREATE TRIGGER trg_departments_touch
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Enable realtime on departments so wait-time updates push live
ALTER TABLE departments REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE departments';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- ============================================================
-- 3. QUEUES — link queue entries to departments
-- ============================================================
ALTER TABLE queues
  ADD COLUMN IF NOT EXISTS service_duration integer DEFAULT 15;

ALTER TABLE queues
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE SET NULL;

-- ============================================================
-- 4. QUEUE UNIQUENESS CONSTRAINT
-- ============================================================
-- FIX: The previous migration used UNIQUE(user_id, status) which is wrong.
-- Because 'completed' is also a status value, that constraint would allow
-- only ONE completed entry per user ever — any second completion would fail
-- with a unique-violation error.
--
-- The correct approach is a PARTIAL UNIQUE INDEX that only applies to the
-- active statuses ('waiting' and 'serving'), so a user can only be in one
-- active queue at a time, while still accumulating unlimited history.

-- Drop the old broken table constraint if it exists
ALTER TABLE queues
  DROP CONSTRAINT IF EXISTS one_active_queue_per_user;

-- Create a correct partial unique index
DROP INDEX IF EXISTS idx_one_active_queue_per_user;
CREATE UNIQUE INDEX idx_one_active_queue_per_user
  ON queues (user_id)
  WHERE status IN ('waiting', 'serving');

-- Supporting indexes
CREATE INDEX IF NOT EXISTS idx_queues_department_status
  ON queues (department_id, status);

CREATE INDEX IF NOT EXISTS idx_queues_user_status
  ON queues (user_id, status);

CREATE INDEX IF NOT EXISTS idx_queues_provider_status
  ON queues (provider_id, status);

-- ============================================================
-- 5. ADDITIONAL INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_providers_is_hospital ON providers(is_hospital);
CREATE INDEX IF NOT EXISTS idx_providers_category    ON providers(category);
CREATE INDEX IF NOT EXISTS idx_providers_user_id     ON providers(user_id);
CREATE INDEX IF NOT EXISTS idx_departments_open_only ON departments(is_open);
CREATE INDEX IF NOT EXISTS idx_queues_provider       ON queues(provider_id);
CREATE INDEX IF NOT EXISTS idx_queues_user           ON queues(user_id);
CREATE INDEX IF NOT EXISTS idx_queues_status         ON queues(status);
CREATE INDEX IF NOT EXISTS idx_queues_department     ON queues(department_id);

-- ============================================================
-- 6. ROW-LEVEL SECURITY (departments)
-- ============================================================
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- Anyone can read departments
DROP POLICY IF EXISTS "departments_select_all" ON departments;
CREATE POLICY "departments_select_all"
  ON departments FOR SELECT
  USING (true);

-- Only the owning provider (auth.uid() == providers.user_id) can insert
DROP POLICY IF EXISTS "departments_insert_owner" ON departments;
CREATE POLICY "departments_insert_owner"
  ON departments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = departments.provider_id
        AND p.user_id = auth.uid()
    )
  );

-- Only the owning provider can update (e.g. wait_minutes)
DROP POLICY IF EXISTS "departments_update_owner" ON departments;
CREATE POLICY "departments_update_owner"
  ON departments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = departments.provider_id
        AND p.user_id = auth.uid()
    )
  );

-- Only the owning provider can delete
DROP POLICY IF EXISTS "departments_delete_owner" ON departments;
CREATE POLICY "departments_delete_owner"
  ON departments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.id = departments.provider_id
        AND p.user_id = auth.uid()
    )
  );

-- ============================================================
-- 7. VERIFY
-- ============================================================
SELECT
  'providers'   AS tbl,
  COUNT(*)      AS rows,
  COUNT(description)                            AS has_description,
  COUNT(CASE WHEN is_hospital THEN 1 END)       AS hospitals
FROM providers

UNION ALL

SELECT
  'departments' AS tbl,
  COUNT(*)      AS rows,
  NULL,
  NULL
FROM departments

UNION ALL

SELECT
  'queues'      AS tbl,
  COUNT(*)      AS rows,
  COUNT(department_id)                          AS has_dept,
  NULL
FROM queues;
