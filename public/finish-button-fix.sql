-- ============================================================
-- skipQs — Finish Button Fix (use RUN_ALL_FIXES.sql instead)
-- Kept for reference — provider UPDATE now uses user_owns_provider()
-- ============================================================

ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS served_at      TIMESTAMPTZ;
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS completed_at   TIMESTAMPTZ;
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS completed_date DATE;

DROP POLICY IF EXISTS "queues_update_provider" ON public.queues;
CREATE POLICY "queues_update_provider" ON public.queues
  FOR UPDATE
  USING (public.user_owns_provider(provider_id));

DROP POLICY IF EXISTS "queues_update_customer" ON public.queues;
CREATE POLICY "queues_update_customer" ON public.queues
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND status IN ('waiting', 'serving', 'cancelled'));
