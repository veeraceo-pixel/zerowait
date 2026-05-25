-- ============================================================
-- skipQs — Hospital Queue Verification
-- Run this in your Supabase SQL Editor AFTER database.sql
-- and DB_PATCH.sql
-- ============================================================

-- ─── 1. New columns on queues ────────────────────────────────────────────────

-- Unique token for staff-added patients — used in the tracking URL
-- Generated client-side as a UUID (crypto.randomUUID())
ALTER TABLE public.queues
  ADD COLUMN IF NOT EXISTS tracking_token text;

-- Marks entries added by reception staff (not self-joined by patient)
ALTER TABLE public.queues
  ADD COLUMN IF NOT EXISTS added_by_staff boolean DEFAULT false;

-- Unique index on token (NULLs are allowed — only staff-added rows have one)
CREATE UNIQUE INDEX IF NOT EXISTS idx_queues_tracking_token
  ON public.queues (tracking_token)
  WHERE tracking_token IS NOT NULL;

-- ─── 2. Make sure RLS is ON for queues ───────────────────────────────────────
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;

-- ─── 3. SELECT policies ──────────────────────────────────────────────────────

-- Drop ALL pre-existing select policies so we can cleanly replace them
DROP POLICY IF EXISTS "queues_select_own"       ON public.queues;
DROP POLICY IF EXISTS "queues_select_staff"     ON public.queues;  -- was missing, caused 42710
DROP POLICY IF EXISTS "queues_select_by_token"  ON public.queues;
DROP POLICY IF EXISTS "queues_select_all"       ON public.queues;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.queues;

-- Authenticated users can always see their own queue entries
CREATE POLICY "queues_select_own"
  ON public.queues FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Hospital staff (provider owners) can see ALL entries for their hospital
CREATE POLICY "queues_select_staff"
  ON public.queues FOR SELECT
  TO authenticated
  USING (
    provider_id IN (
      SELECT id FROM public.providers WHERE user_id = auth.uid()
    )
  );

-- Anyone (including anon — the patient's browser before login) can read
-- a queue entry when they know the tracking token.
-- The token is a UUID (2^122 combinations) — practically unguessable.
-- The patient-track.html page always filters WHERE tracking_token = :token
-- so a raw table scan would require guessing a UUID.
CREATE POLICY "queues_select_by_token"
  ON public.queues FOR SELECT
  TO anon, authenticated
  USING (tracking_token IS NOT NULL);

-- ─── 4. INSERT policies ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "queues_insert_own"   ON public.queues;
DROP POLICY IF EXISTS "queues_insert_staff" ON public.queues;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.queues;

-- Non-hospital venues: patients insert their own record (salons, gyms, etc.)
CREATE POLICY "queues_insert_own"
  ON public.queues FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Hospital reception staff insert records on behalf of patients.
-- staff rows have user_id = NULL (no patient account required).
CREATE POLICY "queues_insert_staff"
  ON public.queues FOR INSERT
  TO authenticated
  WITH CHECK (
    provider_id IN (
      SELECT id FROM public.providers WHERE user_id = auth.uid()
    )
  );

-- ─── 5. UPDATE policies ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "queues_update_own"   ON public.queues;
DROP POLICY IF EXISTS "queues_update_staff" ON public.queues;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.queues;

-- Patients can update their own entries
CREATE POLICY "queues_update_own"
  ON public.queues FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Staff can update entries for their hospital (e.g. mark serving / completed)
CREATE POLICY "queues_update_staff"
  ON public.queues FOR UPDATE
  TO authenticated
  USING (
    provider_id IN (
      SELECT id FROM public.providers WHERE user_id = auth.uid()
    )
  );

-- ─── 6. DELETE policies ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "queues_delete_own"   ON public.queues;
DROP POLICY IF EXISTS "queues_delete_staff" ON public.queues;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.queues;

-- Patients can remove themselves
CREATE POLICY "queues_delete_own"
  ON public.queues FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Staff can remove entries for their hospital
CREATE POLICY "queues_delete_staff"
  ON public.queues FOR DELETE
  TO authenticated
  USING (
    provider_id IN (
      SELECT id FROM public.providers WHERE user_id = auth.uid()
    )
  );

-- ─── 7. Enable Realtime on queues (if not already) ───────────────────────────

ALTER TABLE public.queues REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.queues';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- ─── 8. Verify ───────────────────────────────────────────────────────────────
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'queues'
  AND column_name IN ('tracking_token', 'added_by_staff')
ORDER BY column_name;
