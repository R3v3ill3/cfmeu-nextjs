-- ---------------------------------------------------------------------------
-- Benchmark script for calculate_organizing_universe_metrics
-- ---------------------------------------------------------------------------
-- Usage (psql):
--   \i sql/explain_organizing_metrics.sql
--
-- Prerequisites:
--   * Run from a session authenticated as service_role (or using Supabase SQL IDE)
--   * Replace the sample UUIDs with real patch / user ids that reflect prod usage
--   * This script REQUIRES authentication - cannot be run via PostgREST/anon key
--
-- NOTE: run each block twice and compare the second (warm cache) result before
--       and after the migration to measure improvements.
--
-- ERROR: If you see "Authentication required" error:
--   This script must be run with service_role credentials in Supabase SQL Editor
--   or via direct database connection, not through the API/PostgREST

-- Baseline: admin without patch filters (replicates dashboard landing experience)
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT *
FROM calculate_organizing_universe_metrics(
  NULL,
  NULL,
  NULL,
  'active',
  NULL,
  '00000000-0000-0000-0000-000000000000', -- replace with admin user id
  'admin'
);

-- Organiser scoped to a specific set of patches
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT *
FROM calculate_organizing_universe_metrics(
  ARRAY[
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
  ]::uuid[],
  NULL,
  NULL,
  'active',
  NULL,
  '00000000-0000-0000-0000-000000000003', -- organiser id
  'organiser'
);

-- Tier & stage filtered view (mirrors the dashboard filter controls)
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT *
FROM calculate_organizing_universe_metrics(
  NULL,
  'tier_1',
  'construction',
  'active',
  NULL,
  '00000000-0000-0000-0000-000000000000', -- admin user id
  'admin'
);



