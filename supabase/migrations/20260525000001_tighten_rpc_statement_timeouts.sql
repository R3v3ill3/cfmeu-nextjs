-- Apply per-function statement_timeout to the slow / unbounded RPCs surfaced by
-- the multi-agent connection-stability review (P0-5).
--
-- These RPCs are reachable from the UI without any client-side or DB-side
-- timeout. Under load (especially the patch-overlap trigger contention on
-- bulk imports), they can run for minutes and silently exhaust Vercel's
-- function budget. Capping at the function level surfaces a clean error
-- (`canceling statement due to statement timeout`) that the client can map
-- to a user-visible toast.
--
-- Budgets chosen to be generous enough for normal use (<2000 sites today)
-- while still smaller than the 30s Vercel default function timeout.
--
-- See docs/CONNECTION_STABILITY_REMEDIATION_PLAN.md P0-5.

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT n.nspname AS schema, p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args, t.timeout_ms
    FROM (VALUES
      -- Spatial re-evaluation: surveyed at ~<2000 job sites; budget 25s.
      ('public', 'reevaluate_patch_assignments', 25000),
      -- Dashboard / materialised view refreshes: kept conservative.
      ('public', 'refresh_all_materialized_views', 25000),
      ('public', 'refresh_employer_related_views', 25000),
      ('public', 'refresh_worker_related_views', 25000),
      ('public', 'refresh_project_related_views', 25000),
      ('public', 'refresh_site_visit_related_views', 25000),
      ('public', 'refresh_employers_search_view_logged', 25000),
      -- Rating calculations: have looped over many employers in past timeouts.
      ('public', 'calculate_final_employer_rating', 15000),
      ('public', 'calculate_project_compliance_rating', 15000),
      -- Conflict / search heuristics: kept tighter to fail fast.
      ('public', 'detect_employer_conflicts_detailed', 10000),
      ('public', 'search_employers_with_aliases', 8000)
    ) AS t(schema, name, timeout_ms)
    JOIN pg_proc p ON p.proname = t.name
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = t.schema
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET statement_timeout TO %L',
      rec.schema, rec.name, rec.args, rec.timeout_ms::text || 'ms'
    );
    RAISE NOTICE 'Set statement_timeout=% on %.%(%)', rec.timeout_ms, rec.schema, rec.name, rec.args;
  END LOOP;
END $$;
