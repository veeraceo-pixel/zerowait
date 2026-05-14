-- ============================================================
-- skipQs — Finish Button Fix
-- Run this in Supabase SQL Editor → New Query
-- Fixes: Finish button not working on provider dashboard
-- ============================================================

-- 1. Add missing columns to queues table
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS served_at      TIMESTAMPTZ;
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS completed_at   TIMESTAMPTZ;
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS completed_date DATE;

-- 2. Fix RLS: provider must be able to update queue rows they own
--    This is the most common reason Finish silently fails.
DROP POLICY IF EXISTS "queues_update_provider" ON public.queues;
CREATE POLICY "queues_update_provider" ON public.queues
  FOR UPDATE
  USING (auth.uid() = provider_id);

-- 3. Also ensure customer cancel still works
DROP POLICY IF EXISTS "queues_update_customer" ON public.queues;
CREATE POLICY "queues_update_customer" ON public.queues
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

-- 4. Verify the policies exist
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'queues'
ORDER BY policyname;
