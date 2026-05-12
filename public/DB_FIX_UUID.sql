-- ================================================================
-- skipQs – Fix: providers.id must have a DEFAULT uuid
-- Run once in Supabase SQL editor:
-- https://supabase.com/dashboard/project/idcrplpiokodcanjfolf/sql/new
-- ================================================================
-- This ensures the `id` column auto-generates a UUID on every INSERT
-- so registration never fails with "null value in column id".

-- 1. Enable pgcrypto extension (usually already enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Set default UUID on providers.id
ALTER TABLE public.providers
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3. Same fix for departments.id (preventative)
ALTER TABLE public.departments
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 4. Same fix for queues.id (preventative)
ALTER TABLE public.queues
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 5. Verify — all three columns should show a non-empty "column_default"
SELECT table_name, column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('providers', 'departments', 'queues')
  AND column_name = 'id'
ORDER BY table_name;
