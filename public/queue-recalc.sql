-- ================================================================
-- skipQs — Queue Position Recalculation Trigger
-- Run in Supabase SQL Editor ONCE.
--
-- WHY THIS EXISTS:
--   computeEtaMinutes() in api.js is a snapshot taken at join time.
--   When a user cancels, completes, or is marked no-show, every
--   waiting user behind them still sees their original ETA forever.
--   This trigger fires after any such status change and recalculates
--   position + estimated_time for ALL remaining 'waiting' entries
--   in the same provider + department queue.
--
-- WHAT IT FIXES:
--   Bug #1  — Wait time never reduces when someone cancels/no-shows
--   Bug #7  — Users with NULL estimated_time never get recalculated
--   Bug #8  — No cascade logic after 'cancelled' status
--   Bug #20 — No position recalculation trigger anywhere in schema
-- ================================================================

-- ── 1. The recalculation function ─────────────────────────────
CREATE OR REPLACE FUNCTION public.recalculate_queue_positions()
RETURNS trigger AS $$
DECLARE
  v_capacity INT;
BEGIN
  -- Only act when status changes to a terminal state
  IF NEW.status NOT IN ('cancelled', 'no_show', 'completed') THEN
    RETURN NEW;
  END IF;

  -- Skip if status didn't actually change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Look up capacity for this department (default 1)
  SELECT COALESCE(capacity, 1)
    INTO v_capacity
    FROM public.departments
   WHERE id = NEW.department_id
   LIMIT 1;

  IF v_capacity IS NULL THEN
    v_capacity := 1;
  END IF;

  -- Re-rank all still-waiting entries in this provider + department queue
  -- ordered by their original join time, then recompute estimated_time.
  UPDATE public.queues AS q
  SET
    position       = sub.new_pos,
    estimated_time = NOW() + (
      -- With capacity > 1: CEIL(pos / capacity) slots before you × duration
      CEIL(sub.new_pos::NUMERIC / v_capacity)
      * COALESCE(q.service_duration, 15)
      * INTERVAL '1 minute'
    )
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY joined_at ASC) AS new_pos
    FROM public.queues
    WHERE provider_id   = NEW.provider_id
      AND (
        -- Match on department_id when present, or fall back to provider-wide
        (NEW.department_id IS NOT NULL AND department_id = NEW.department_id)
        OR
        (NEW.department_id IS NULL     AND department_id IS NULL)
      )
      AND status = 'waiting'
  ) sub
  WHERE q.id = sub.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 2. Drop old trigger if it exists, then recreate ───────────
DROP TRIGGER IF EXISTS trg_recalculate_positions ON public.queues;

CREATE TRIGGER trg_recalculate_positions
  AFTER UPDATE OF status ON public.queues
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_queue_positions();

-- ── 3. Verify ─────────────────────────────────────────────────
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trg_recalculate_positions';
