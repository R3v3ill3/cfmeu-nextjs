-- ============================================================================
-- FIX AMBIGUOUS COLUMN REFERENCE IN get_employer_merge_impact
-- Purpose: Fix "column reference 'employer_id' is ambiguous" error
-- Issue: Function RETURNS TABLE defines employer_id as output variable,
--        causing ambiguity with table column references in subqueries
-- ============================================================================

-- Drop and recreate function with fully qualified column names
DROP FUNCTION IF EXISTS get_employer_merge_impact(uuid[]);

CREATE OR REPLACE FUNCTION get_employer_merge_impact(p_employer_ids uuid[])
RETURNS TABLE(
  employer_id uuid,
  employer_name text,
  worker_placements_count integer,
  project_roles_count integer,
  project_trades_count integer,
  site_trades_count integer,
  eba_records_count integer,
  site_visits_count integer,
  trade_capabilities_count integer,
  aliases_count integer,
  builder_projects_count integer
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id as employer_id,
    e.name as employer_name,
    COALESCE(wp.count, 0)::INTEGER as worker_placements_count,
    COALESCE(per.count, 0)::INTEGER as project_roles_count,
    COALESCE(pct.count, 0)::INTEGER as project_trades_count,
    COALESCE(sct.count, 0)::INTEGER as site_trades_count,
    COALESCE(eba.count, 0)::INTEGER as eba_records_count,
    COALESCE(sv.count, 0)::INTEGER as site_visits_count,
    COALESCE(tc.count, 0)::INTEGER as trade_capabilities_count,
    COALESCE(ea.count, 0)::INTEGER as aliases_count,
    COALESCE(bp.count, 0)::INTEGER as builder_projects_count
  FROM employers e
  LEFT JOIN (
    SELECT wp_inner.employer_id, COUNT(*) as count
    FROM worker_placements wp_inner
    WHERE wp_inner.employer_id = ANY(p_employer_ids)
    GROUP BY wp_inner.employer_id
  ) wp ON e.id = wp.employer_id
  LEFT JOIN (
    SELECT per_inner.employer_id, COUNT(*) as count
    FROM project_employer_roles per_inner
    WHERE per_inner.employer_id = ANY(p_employer_ids)
    GROUP BY per_inner.employer_id
  ) per ON e.id = per.employer_id
  LEFT JOIN (
    SELECT pct_inner.employer_id, COUNT(*) as count
    FROM project_contractor_trades pct_inner
    WHERE pct_inner.employer_id = ANY(p_employer_ids)
    GROUP BY pct_inner.employer_id
  ) pct ON e.id = pct.employer_id
  LEFT JOIN (
    SELECT sct_inner.employer_id, COUNT(*) as count
    FROM site_contractor_trades sct_inner
    WHERE sct_inner.employer_id = ANY(p_employer_ids)
    GROUP BY sct_inner.employer_id
  ) sct ON e.id = sct.employer_id
  LEFT JOIN (
    SELECT eba_inner.employer_id, COUNT(*) as count
    FROM company_eba_records eba_inner
    WHERE eba_inner.employer_id = ANY(p_employer_ids)
    GROUP BY eba_inner.employer_id
  ) eba ON e.id = eba.employer_id
  LEFT JOIN (
    SELECT sv_inner.employer_id, COUNT(*) as count
    FROM site_visit sv_inner
    WHERE sv_inner.employer_id = ANY(p_employer_ids)
    GROUP BY sv_inner.employer_id
  ) sv ON e.id = sv.employer_id
  LEFT JOIN (
    SELECT tc_inner.employer_id, COUNT(*) as count
    FROM contractor_trade_capabilities tc_inner
    WHERE tc_inner.employer_id = ANY(p_employer_ids)
    GROUP BY tc_inner.employer_id
  ) tc ON e.id = tc.employer_id
  LEFT JOIN (
    SELECT ea_inner.employer_id, COUNT(*) as count
    FROM employer_aliases ea_inner
    WHERE ea_inner.employer_id = ANY(p_employer_ids)
    GROUP BY ea_inner.employer_id
  ) ea ON e.id = ea.employer_id
  LEFT JOIN (
    SELECT bp_inner.builder_id as employer_id, COUNT(*) as count
    FROM projects bp_inner
    WHERE bp_inner.builder_id = ANY(p_employer_ids)
    GROUP BY bp_inner.builder_id
  ) bp ON e.id = bp.employer_id
  WHERE e.id = ANY(p_employer_ids)
  ORDER BY e.name;
END;
$$;

COMMENT ON FUNCTION get_employer_merge_impact(uuid[]) IS
  'Returns impact analysis for employer merge operations. Fixed ambiguous column references by qualifying all table aliases.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $verification$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fixed get_employer_merge_impact Function';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '  ✅ Qualified all employer_id references with table aliases';
  RAISE NOTICE '  ✅ Added _inner suffix to subquery aliases to avoid conflicts';
  RAISE NOTICE '  ✅ Dropped and recreated function to ensure clean state';
  RAISE NOTICE '';
  RAISE NOTICE 'This fixes the "column reference employer_id is ambiguous" error';
  RAISE NOTICE 'that was preventing the Employers Data Management page from loading.';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $verification$;
