-- ============================================================
-- skipQs — Enable Realtime INSERT on Queues
-- Run in Supabase SQL Editor
-- Required for "New Order" alerts to fire when customers join
-- ============================================================

-- 1. Make sure queues table has FULL replica identity
--    (needed so INSERT payloads include all column values)
ALTER TABLE public.queues REPLICA IDENTITY FULL;

-- 2. Ensure queues is in the realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.queues;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 3. Verify
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'queues';
