-- ============================================================
-- DEPRECATED — use RUN_ALL_FIXES.sql instead (superset of this file)
-- skipQs — Guest Queue Join Fix
-- ============================================================

-- 1. Make user_id nullable so guests can join without an account
ALTER TABLE public.queues 
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. Update the FK to allow null
ALTER TABLE public.queues
  DROP CONSTRAINT IF EXISTS queues_user_id_fkey;

ALTER TABLE public.queues
  ADD CONSTRAINT queues_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

-- 3. Fix the partial unique index - only apply to non-null user_ids
DROP INDEX IF EXISTS idx_one_active_queue_per_user;
CREATE UNIQUE INDEX idx_one_active_queue_per_user
  ON public.queues (user_id)
  WHERE status IN ('waiting', 'serving') AND user_id IS NOT NULL;

-- 4. Allow anonymous/guest inserts (user_id can be null)
DROP POLICY IF EXISTS "queues_insert_customer" ON public.queues;
CREATE POLICY "queues_insert_customer" ON public.queues
  FOR INSERT WITH CHECK (
    user_id IS NULL OR auth.uid() = user_id
  );

-- 5. Allow guests to select their queue by queue ID (for live tracking)
DROP POLICY IF EXISTS "queues_select_customer" ON public.queues;
CREATE POLICY "queues_select_customer" ON public.queues
  FOR SELECT USING (
    auth.uid() = user_id        -- logged-in customer
    OR auth.uid() = provider_id -- provider sees their queue
    OR user_id IS NULL          -- guest entries visible to provider
  );

-- 6. Verify
SELECT 
  column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'queues' AND column_name = 'user_id';
