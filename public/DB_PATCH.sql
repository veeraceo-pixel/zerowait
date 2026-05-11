-- ================================================================
-- skipQs  –  Database Schema Patch
-- Run this in your Supabase SQL editor ONCE:
-- https://supabase.com/dashboard/project/idcrplpiokodcanjfolf/sql
-- ================================================================

-- 1. Add is_hospital column if it doesn't exist
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS is_hospital BOOLEAN DEFAULT false;

-- 2. Set is_hospital = true for all providers with category = 'Hospital'
UPDATE public.providers
  SET is_hospital = true
  WHERE category = 'Hospital' AND (is_hospital IS NULL OR is_hospital = false);

-- 3. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_providers_is_hospital ON public.providers(is_hospital);
CREATE INDEX IF NOT EXISTS idx_providers_category    ON public.providers(category);
CREATE INDEX IF NOT EXISTS idx_providers_user_id     ON public.providers(user_id);
CREATE INDEX IF NOT EXISTS idx_departments_provider  ON public.departments(provider_id);
CREATE INDEX IF NOT EXISTS idx_queues_provider       ON public.queues(provider_id);
CREATE INDEX IF NOT EXISTS idx_queues_user           ON public.queues(user_id);
CREATE INDEX IF NOT EXISTS idx_queues_status         ON public.queues(status);

-- 4. Verify
SELECT id, business_name, category, is_hospital, is_open
FROM public.providers
ORDER BY category, business_name;
