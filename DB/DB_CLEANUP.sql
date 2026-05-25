-- ================================================================
-- skipQs  –  Database Cleanup Script
-- Run this in your Supabase SQL editor to remove test/fake data:
-- https://supabase.com/dashboard/project/idcrplpiokodcanjfolf/sql/new
-- ================================================================
-- ⚠️  READ BEFORE RUNNING:
--    This deletes providers (and their departments + queues via CASCADE)
--    where the data looks like test/demo entries.
--    Review the SELECT first, then uncomment the DELETE.
-- ================================================================

-- ── Step 1: PREVIEW what will be deleted ──────────────────────
-- Run this first to check you're happy with the list:

SELECT
  id,
  business_name,
  category,
  address,
  email,
  created_at
FROM public.providers
WHERE
  -- Fake/short addresses (less than 5 chars, or no spaces = not a real address)
  (LENGTH(TRIM(address)) < 5 OR address NOT LIKE '% %')
  OR
  -- Business names that are clearly test accounts
  LOWER(TRIM(business_name)) IN ('veera','test','demo','asdf','aaa','bbb','xxx','hello','hi')
  OR
  -- Providers with no departments at all
  id NOT IN (SELECT DISTINCT provider_id FROM public.departments)
ORDER BY created_at DESC;


-- ── Step 2: DELETE (uncomment when ready) ─────────────────────
-- This deletes providers matching the same criteria.
-- Departments and queues will be CASCADE deleted automatically.

/*
DELETE FROM public.providers
WHERE
  (LENGTH(TRIM(address)) < 5 OR address NOT LIKE '% %')
  OR
  LOWER(TRIM(business_name)) IN ('veera','test','demo','asdf','aaa','bbb','xxx','hello','hi')
  OR
  id NOT IN (SELECT DISTINCT provider_id FROM public.departments);
*/


-- ── Step 3: Verify cleanup ─────────────────────────────────────

SELECT
  p.id,
  p.business_name,
  p.category,
  p.address,
  COUNT(d.id) AS dept_count
FROM public.providers p
LEFT JOIN public.departments d ON d.provider_id = p.id
GROUP BY p.id, p.business_name, p.category, p.address
ORDER BY dept_count ASC, p.created_at DESC;
