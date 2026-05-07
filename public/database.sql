-- ============================================================
-- skipQs — database.sql
-- Run all statements in the Supabase SQL Editor
-- ============================================================

-- 1. Add email column to providers (if it doesn't exist)
ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS email text;

-- 2. Add service_duration column to queues (default 15 mins)
ALTER TABLE queues
  ADD COLUMN IF NOT EXISTS service_duration integer DEFAULT 15;

-- 3. Prevent a user from joining more than one active queue at a time
--    (Drop first if you need to re-create cleanly)
ALTER TABLE queues
  ADD CONSTRAINT one_active_queue_per_user
  UNIQUE (user_id, status);

-- ============================================================
-- Optional: index for faster lookups on active queues
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_queues_user_status
  ON queues (user_id, status);

CREATE INDEX IF NOT EXISTS idx_queues_provider_status
  ON queues (provider_id, status);
