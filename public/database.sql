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

-- ============================================================
-- 2. DEPARTMENTS — new table for hospital departments
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id    uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  name           text NOT NULL,
  description    text,
  icon           text DEFAULT '🏥',
  is_open        boolean DEFAULT true,
  wait_minutes   integer DEFAULT 0,        -- staff-set live wait time
  capacity       integer DEFAULT 1,         -- how many patients seen at once
  avg_consult_minutes integer DEFAULT 15,   -- typical visit duration
  display_order  integer DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
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

-- ============================================================
-- 3. QUEUES — link queue entries to departments
-- ============================================================
ALTER TABLE queues
  ADD COLUMN IF NOT EXISTS service_duration integer DEFAULT 15;

ALTER TABLE queues
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_queues_department_status
  ON queues (department_id, status);

-- One active queue per user (drop & recreate if it exists)
ALTER TABLE queues
  DROP CONSTRAINT IF EXISTS one_active_queue_per_user;
ALTER TABLE queues
  ADD CONSTRAINT one_active_queue_per_user
  UNIQUE (user_id, status);

CREATE INDEX IF NOT EXISTS idx_queues_user_status
  ON queues (user_id, status);
CREATE INDEX IF NOT EXISTS idx_queues_provider_status
  ON queues (provider_id, status);

-- ============================================================
-- 4. ROW-LEVEL SECURITY (departments)
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
-- 5. REALTIME — make departments broadcast changes
-- ============================================================
-- Run once; safe to ignore "already exists" notice
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE departments';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
