-- ============================================================
-- skipQs — RUN ALL FIXES (run once in Supabase SQL Editor)
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS
-- ============================================================

-- 1. Providers: support business-signup (id ≠ auth.uid(), use user_id)
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Guest queue: nullable user_id
ALTER TABLE public.queues ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.queues DROP CONSTRAINT IF EXISTS queues_user_id_fkey;
ALTER TABLE public.queues
  ADD CONSTRAINT queues_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS served_at TIMESTAMPTZ;
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS completed_date DATE;
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS tracking_token UUID DEFAULT uuid_generate_v4();

-- 3. One active queue per logged-in user only
DROP INDEX IF EXISTS public.idx_one_active_queue_per_user;
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_queue_per_user
  ON public.queues (user_id)
  WHERE status IN ('waiting', 'serving') AND user_id IS NOT NULL;

-- 4. Helper: does current user own this provider row?
CREATE OR REPLACE FUNCTION public.user_owns_provider(p_provider_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.id = p_provider_id
      AND (p.user_id = auth.uid() OR p.id = auth.uid())
  );
$$;

-- 5. Queue RLS — guest join + provider finish + public wait visibility
DROP POLICY IF EXISTS "queues_select_customer" ON public.queues;
DROP POLICY IF EXISTS "queues_select_provider" ON public.queues;
DROP POLICY IF EXISTS "queues_select_active" ON public.queues;
DROP POLICY IF EXISTS "queues_insert_customer" ON public.queues;
DROP POLICY IF EXISTS "queues_update_provider" ON public.queues;
DROP POLICY IF EXISTS "queues_update_customer" ON public.queues;

-- Logged-in customer, provider owner, or anyone reading active rows (position/wait math)
CREATE POLICY "queues_select_customer" ON public.queues FOR SELECT USING (
  auth.uid() = user_id
  OR public.user_owns_provider(provider_id)
  OR status IN ('waiting', 'serving')
);

CREATE POLICY "queues_insert_customer" ON public.queues FOR INSERT WITH CHECK (
  user_id IS NULL OR auth.uid() = user_id
);

CREATE POLICY "queues_update_provider" ON public.queues FOR UPDATE USING (
  public.user_owns_provider(provider_id)
);

CREATE POLICY "queues_update_customer" ON public.queues FOR UPDATE USING (
  auth.uid() = user_id
) WITH CHECK (
  auth.uid() = user_id AND status IN ('waiting', 'serving', 'cancelled')
);

-- 6. Provider / department ownership (business-signup uses user_id)
DROP POLICY IF EXISTS "providers_insert_own" ON public.providers;
DROP POLICY IF EXISTS "providers_update_own" ON public.providers;
CREATE POLICY "providers_insert_own" ON public.providers FOR INSERT WITH CHECK (
  auth.uid() = id OR auth.uid() = user_id
);
CREATE POLICY "providers_update_own" ON public.providers FOR UPDATE USING (
  auth.uid() = id OR auth.uid() = user_id
);

DROP POLICY IF EXISTS "departments_insert_owner" ON public.departments;
DROP POLICY IF EXISTS "departments_update_owner" ON public.departments;
DROP POLICY IF EXISTS "departments_delete_owner" ON public.departments;
CREATE POLICY "departments_insert_owner" ON public.departments FOR INSERT WITH CHECK (
  public.user_owns_provider(provider_id)
);
CREATE POLICY "departments_update_owner" ON public.departments FOR UPDATE USING (
  public.user_owns_provider(provider_id)
);
CREATE POLICY "departments_delete_owner" ON public.departments FOR DELETE USING (
  public.user_owns_provider(provider_id)
);

-- 7. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.queues;
ALTER PUBLICATION supabase_realtime ADD TABLE public.providers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.departments;

SELECT 'skipQs RUN_ALL_FIXES applied OK' AS result;
