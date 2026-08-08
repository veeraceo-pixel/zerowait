-- ================================================================
-- skipQs — Guest tracking link: keep working past "completed"
-- Run ONCE in Supabase SQL Editor.
--
-- WHY THIS EXISTS:
--   queues.tracking_token already gets a random UUID on every insert
--   (DEFAULT uuid_generate_v4(), added in RUN_ALL_FIXES.sql) and
--   patient-track.html already knows how to look a queue entry up by
--   that token with no login required — it just wasn't wired into the
--   regular customer join flow (business-detail.html / join-queue.html),
--   only the hospital "staff adds a patient" flow.
--
--   The existing SELECT policy only allows anonymous reads while
--   status IN ('waiting','serving'). That means once a guest's ticket
--   is marked completed / cancelled / no_show, their tracking link
--   goes dead (RLS blocks the read) instead of showing "All done!".
--   This patch extends the policy so a guest's own row (user_id IS
--   NULL) stays readable via its tracking_token regardless of status.
--   Logged-in users are unaffected — their rows are already covered
--   by `auth.uid() = user_id`.
-- ================================================================

DROP POLICY IF EXISTS "queues_select_customer" ON public.queues;

CREATE POLICY "queues_select_customer" ON public.queues FOR SELECT USING (
  auth.uid() = user_id
  OR public.user_owns_provider(provider_id)
  OR status IN ('waiting', 'serving')
  OR (user_id IS NULL AND tracking_token IS NOT NULL)
);

-- ── Verify ──────────────────────────────────────────────────────
SELECT polname, pg_get_expr(polqual, polrelid) AS using_expr
FROM pg_policy
WHERE polrelid = 'public.queues'::regclass AND polname = 'queues_select_customer';
