-- ============================================================
-- skipQs — Auto No-Show Detection (Database Level)
-- Run in Supabase SQL Editor
-- Marks customers as no-show when:
--   1. Their estimated_time has passed by 2× their service duration
--   2. They are still in 'waiting' status
-- This runs even when the provider dashboard is closed.
-- ============================================================

-- 1. Enable pg_cron extension (needed for scheduled jobs)
-- Note: on Supabase free tier, pg_cron may need to be enabled via
-- Dashboard → Database → Extensions → search "cron" → enable
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create the no-show detection function
CREATE OR REPLACE FUNCTION public.auto_mark_no_shows()
RETURNS void AS $$
DECLARE
  no_show_count INT;
  grace_minutes INT := 2; -- grace multiplier: mark no-show after 2x service_duration past estimated_time
BEGIN
  -- Case A: estimated_time is set — mark no-show if we're > grace_minutes * service_duration past it
  UPDATE public.queues
  SET
    status       = 'no_show',
    completed_at = NOW()
  WHERE
    status           = 'waiting'
    AND estimated_time IS NOT NULL
    AND estimated_time < NOW() - (grace_minutes * service_duration * INTERVAL '1 minute');

  -- Case B: estimated_time is NULL (e.g. first person in queue, or legacy entry)
  -- Fall back to using joined_at + a reasonable max wait (2 hours)
  UPDATE public.queues
  SET
    status       = 'no_show',
    completed_at = NOW()
  WHERE
    status           = 'waiting'
    AND estimated_time IS NULL
    AND joined_at < NOW() - INTERVAL '2 hours';

  GET DIAGNOSTICS no_show_count = ROW_COUNT;

  IF no_show_count > 0 THEN
    RAISE NOTICE 'Auto no-show: % entries marked', no_show_count;
    -- The trg_recalculate_positions trigger fires automatically on each
    -- status UPDATE above, so no manual position recalculation is needed here.
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Schedule it to run every 5 minutes
-- (Remove any existing job first to avoid duplicates)
SELECT cron.unschedule('skipqs-auto-noshow') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'skipqs-auto-noshow'
);

SELECT cron.schedule(
  'skipqs-auto-noshow',
  '*/5 * * * *',  -- every 5 minutes
  'SELECT public.auto_mark_no_shows();'
);

-- 4. Test it manually right now (safe - only marks genuinely overdue entries)
SELECT public.auto_mark_no_shows();

-- 5. Verify the job is scheduled
SELECT jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'skipqs-auto-noshow';

-- ── pg_cron NOT available? Use this JS fallback instead ──────────
-- If you're on Supabase free tier and pg_cron isn't enabled,
-- add this to your provider-dashboard.html <script> block.
-- It polls every 5 minutes while the dashboard is open.
--
-- (function startNoShowPoller() {
--   async function runNoShow() {
--     await sb.rpc('auto_mark_no_shows');
--   }
--   runNoShow(); // run immediately on load
--   setInterval(runNoShow, 5 * 60 * 1000); // then every 5 min
-- })();
-- ─────────────────────────────────────────────────────────────────

-- 6. Add no_show to history queries (so providers can see who was no-shows)
-- Check current history section loads no_show entries
-- The dashboard history query already includes 'completed' - 
-- no_show will show up as a separate status in history with a red badge
