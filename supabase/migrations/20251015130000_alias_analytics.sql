-- Prompt 3D — Analytics & Reporting
-- Goal: Provide visibility into alias usage and outstanding canonical reviews
-- Creates views and functions for alias metrics, conflicts, and promotions

-- 1. Daily alias metrics view
CREATE OR REPLACE VIEW public.alias_metrics_summary AS
SELECT
  -- Overall counts
  COUNT(DISTINCT ea.id) as total_aliases,
  COUNT(DISTINCT ea.employer_id) as employers_with_aliases,
  COUNT(DISTINCT ea.id) FILTER (WHERE ea.is_authoritative) as authoritative_aliases,
  
  -- By source system
  COUNT(DISTINCT ea.id) FILTER (WHERE ea.source_system = 'bci') as bci_aliases,
  COUNT(DISTINCT ea.id) FILTER (WHERE ea.source_system = 'incolink') as incolink_aliases,
  COUNT(DISTINCT ea.id) FILTER (WHERE ea.source_system = 'fwc') as fwc_aliases,
  COUNT(DISTINCT ea.id) FILTER (WHERE ea.source_system = 'eba') as eba_aliases,
  COUNT(DISTINCT ea.id) FILTER (WHERE ea.source_system = 'manual') as manual_aliases,
  COUNT(DISTINCT ea.id) FILTER (WHERE ea.source_system = 'pending_import') as pending_import_aliases,
  COUNT(DISTINCT ea.id) FILTER (WHERE ea.source_system = 'legacy_migration') as legacy_aliases,
  
  -- Recent activity (last 7 days)
  COUNT(DISTINCT ea.id) FILTER (WHERE ea.created_at >= NOW() - INTERVAL '7 days') as aliases_last_7_days,
  COUNT(DISTINCT ea.id) FILTER (WHERE ea.created_at >= NOW() - INTERVAL '30 days') as aliases_last_30_days,
  
  -- Audit metrics
  (SELECT COUNT(*) FROM public.employer_canonical_audit WHERE action = 'promote') as total_promotions,
  (SELECT COUNT(*) FROM public.employer_canonical_audit WHERE action = 'reject') as total_rejections,
  (SELECT COUNT(*) FROM public.employer_canonical_audit WHERE action = 'defer') as total_deferrals,
  (SELECT COUNT(*) FROM public.employer_canonical_audit WHERE decided_at >= NOW() - INTERVAL '7 days') as decisions_last_7_days,
  (SELECT COUNT(*) FROM public.employer_canonical_audit WHERE decided_at >= NOW() - INTERVAL '30 days') as decisions_last_30_days,
  
  -- Timestamps
  MIN(ea.created_at) as earliest_alias_created,
  MAX(ea.created_at) as latest_alias_created,
  NOW() as computed_at
FROM public.employer_aliases ea;

COMMENT ON VIEW public.alias_metrics_summary 
  IS 'Summary metrics for alias usage, source systems, and canonical promotion activity';

-- 2. Time series metrics (daily aggregation)
CREATE OR REPLACE VIEW public.alias_metrics_daily AS
WITH daily_counts AS (
  SELECT
    DATE(ea.created_at) as metric_date,
    COALESCE(ea.source_system, 'unknown') as source_system,
    COUNT(ea.id) as count_for_source
  FROM public.employer_aliases ea
  WHERE ea.created_at >= NOW() - INTERVAL '90 days'
  GROUP BY DATE(ea.created_at), COALESCE(ea.source_system, 'unknown')
)
SELECT
  metric_date,
  SUM(count_for_source) as aliases_created,
  (
    SELECT COUNT(DISTINCT ea2.id)
    FROM public.employer_aliases ea2
    WHERE DATE(ea2.created_at) = dc.metric_date
    AND ea2.is_authoritative = true
  ) as authoritative_created,
  (
    SELECT COUNT(DISTINCT ea2.employer_id)
    FROM public.employer_aliases ea2
    WHERE DATE(ea2.created_at) = dc.metric_date
  ) as employers_affected,
  COUNT(DISTINCT dc.source_system) as source_systems_active,
  jsonb_object_agg(dc.source_system, dc.count_for_source) as by_source_system
FROM daily_counts dc
GROUP BY metric_date
ORDER BY metric_date DESC;

COMMENT ON VIEW public.alias_metrics_daily 
  IS 'Daily time series of alias creation activity for trending analysis';

-- 3. Canonical promotion metrics
CREATE OR REPLACE VIEW public.canonical_review_metrics AS
SELECT
  -- Pending reviews (from canonical_promotion_queue)
  (SELECT COUNT(*) FROM public.canonical_promotion_queue) as pending_reviews,
  (SELECT COUNT(*) FROM public.canonical_promotion_queue WHERE priority >= 10) as high_priority_reviews,
  (SELECT COUNT(*) FROM public.canonical_promotion_queue WHERE priority >= 5 AND priority < 10) as medium_priority_reviews,
  (SELECT COUNT(*) FROM public.canonical_promotion_queue WHERE previous_decision = 'defer') as previously_deferred,
  
  -- Decision metrics
  (SELECT COUNT(*) FROM public.employer_canonical_audit WHERE action = 'promote' AND decided_at >= NOW() - INTERVAL '7 days') as promotions_last_7_days,
  (SELECT COUNT(*) FROM public.employer_canonical_audit WHERE action = 'reject' AND decided_at >= NOW() - INTERVAL '7 days') as rejections_last_7_days,
  (SELECT COUNT(*) FROM public.employer_canonical_audit WHERE action = 'defer' AND decided_at >= NOW() - INTERVAL '7 days') as deferrals_last_7_days,
  
  -- Resolution latency (for authoritative aliases that were promoted)
  (
    SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (eca.decided_at - ea.collected_at)) / 3600)
    FROM public.employer_canonical_audit eca
    JOIN public.employer_aliases ea ON ea.id = eca.alias_id
    WHERE eca.action = 'promote'
      AND ea.is_authoritative = true
      AND ea.collected_at IS NOT NULL
      AND eca.decided_at >= NOW() - INTERVAL '30 days'
  ) as median_resolution_hours,
  
  -- Computed timestamp
  NOW() as computed_at;

COMMENT ON VIEW public.canonical_review_metrics 
  IS 'Metrics for canonical promotion queue and decision activity';

-- 4. Alias conflict backlog view
CREATE OR REPLACE VIEW public.alias_conflict_backlog AS
SELECT
  cpq.alias_id,
  cpq.employer_id,
  cpq.proposed_name,
  cpq.current_canonical_name,
  cpq.priority,
  cpq.is_authoritative,
  cpq.source_system,
  cpq.collected_at,
  cpq.conflict_warnings,
  jsonb_array_length(COALESCE(cpq.conflict_warnings, '[]'::jsonb)) as conflict_count,
  CASE
    WHEN cpq.alias_created_at >= NOW() - INTERVAL '24 hours' THEN '<24h'
    WHEN cpq.alias_created_at >= NOW() - INTERVAL '3 days' THEN '1-3d'
    WHEN cpq.alias_created_at >= NOW() - INTERVAL '7 days' THEN '3-7d'
    WHEN cpq.alias_created_at >= NOW() - INTERVAL '30 days' THEN '1-4w'
    ELSE '>30d'
  END as age_bucket,
  EXTRACT(EPOCH FROM (NOW() - cpq.alias_created_at)) / 3600 as hours_in_queue
FROM public.canonical_promotion_queue cpq
WHERE jsonb_array_length(COALESCE(cpq.conflict_warnings, '[]'::jsonb)) > 0
ORDER BY cpq.priority DESC, cpq.alias_created_at ASC;

COMMENT ON VIEW public.alias_conflict_backlog 
  IS 'Canonical promotion queue items with conflicts requiring review';

-- 5. Source system breakdown
CREATE OR REPLACE VIEW public.alias_source_system_stats AS
SELECT
  COALESCE(ea.source_system, 'unknown') as source_system,
  COUNT(DISTINCT ea.id) as total_aliases,
  COUNT(DISTINCT ea.id) FILTER (WHERE ea.is_authoritative) as authoritative_count,
  COUNT(DISTINCT ea.employer_id) as employer_count,
  MIN(ea.collected_at) as earliest_collected,
  MAX(ea.collected_at) as latest_collected,
  COUNT(DISTINCT ea.id) FILTER (WHERE ea.created_at >= NOW() - INTERVAL '7 days') as new_last_7_days,
  COUNT(DISTINCT ea.id) FILTER (WHERE ea.created_at >= NOW() - INTERVAL '30 days') as new_last_30_days,
  -- Average aliases per employer for this source
  ROUND(COUNT(DISTINCT ea.id)::numeric / NULLIF(COUNT(DISTINCT ea.employer_id), 0), 2) as avg_aliases_per_employer
FROM public.employer_aliases ea
GROUP BY COALESCE(ea.source_system, 'unknown')
ORDER BY total_aliases DESC;

COMMENT ON VIEW public.alias_source_system_stats 
  IS 'Breakdown of alias statistics by source system';

-- 6. Employer alias coverage
CREATE OR REPLACE VIEW public.employer_alias_coverage AS
SELECT
  -- Total employers
  (SELECT COUNT(*) FROM public.employers) as total_employers,
  
  -- Employers with aliases
  COUNT(DISTINCT ea.employer_id) as employers_with_aliases,
  
  -- Coverage percentage
  ROUND(
    (COUNT(DISTINCT ea.employer_id)::numeric / NULLIF((SELECT COUNT(*) FROM public.employers), 0)) * 100,
    2
  ) as coverage_percentage,
  
  -- Employers with authoritative aliases
  COUNT(DISTINCT ea.employer_id) FILTER (WHERE ea.is_authoritative) as employers_with_authoritative,
  
  -- Employers with external IDs but no aliases
  (
    SELECT COUNT(*)
    FROM public.employers e
    LEFT JOIN public.employer_aliases ea ON ea.employer_id = e.id
    WHERE (e.bci_company_id IS NOT NULL OR e.incolink_id IS NOT NULL)
      AND ea.id IS NULL
  ) as employers_with_external_id_no_aliases,
  
  NOW() as computed_at
FROM public.employer_aliases ea;

COMMENT ON VIEW public.employer_alias_coverage 
  IS 'Metrics on alias coverage across employer base';

-- 7. RPC function to get metrics for a specific date range
CREATE OR REPLACE FUNCTION public.get_alias_metrics_range(
  p_start_date date DEFAULT (NOW() - INTERVAL '30 days')::date,
  p_end_date date DEFAULT NOW()::date
) RETURNS TABLE (
  metric_date date,
  aliases_created bigint,
  authoritative_created bigint,
  employers_affected bigint,
  promotions bigint,
  rejections bigint,
  deferrals bigint,
  by_source_system jsonb
)
LANGUAGE sql
STABLE
AS $$
  WITH source_daily AS (
    -- First, count by date and source
    SELECT
      DATE(ea.created_at) as metric_date,
      COALESCE(ea.source_system, 'unknown') as source_system,
      COUNT(ea.id) as count_for_source
    FROM public.employer_aliases ea
    WHERE DATE(ea.created_at) BETWEEN p_start_date AND p_end_date
    GROUP BY DATE(ea.created_at), COALESCE(ea.source_system, 'unknown')
  ),
  alias_daily AS (
    -- Then aggregate by date
    SELECT
      metric_date,
      SUM(count_for_source) as aliases_created,
      (
        SELECT COUNT(DISTINCT ea2.id)
        FROM public.employer_aliases ea2
        WHERE DATE(ea2.created_at) = sd.metric_date
        AND ea2.is_authoritative = true
      ) as authoritative_created,
      (
        SELECT COUNT(DISTINCT ea2.employer_id)
        FROM public.employer_aliases ea2
        WHERE DATE(ea2.created_at) = sd.metric_date
      ) as employers_affected,
      jsonb_object_agg(sd.source_system, sd.count_for_source) as by_source_system
    FROM source_daily sd
    GROUP BY metric_date
  ),
  audit_daily AS (
    SELECT
      DATE(eca.decided_at) as metric_date,
      COUNT(*) FILTER (WHERE eca.action = 'promote') as promotions,
      COUNT(*) FILTER (WHERE eca.action = 'reject') as rejections,
      COUNT(*) FILTER (WHERE eca.action = 'defer') as deferrals
    FROM public.employer_canonical_audit eca
    WHERE DATE(eca.decided_at) BETWEEN p_start_date AND p_end_date
    GROUP BY DATE(eca.decided_at)
  )
  SELECT
    COALESCE(ad.metric_date, aud.metric_date) as metric_date,
    COALESCE(ad.aliases_created, 0) as aliases_created,
    COALESCE(ad.authoritative_created, 0) as authoritative_created,
    COALESCE(ad.employers_affected, 0) as employers_affected,
    COALESCE(aud.promotions, 0) as promotions,
    COALESCE(aud.rejections, 0) as rejections,
    COALESCE(aud.deferrals, 0) as deferrals,
    COALESCE(ad.by_source_system, '{}'::jsonb) as by_source_system
  FROM alias_daily ad
  FULL OUTER JOIN audit_daily aud ON ad.metric_date = aud.metric_date
  ORDER BY metric_date DESC;
$$;

COMMENT ON FUNCTION public.get_alias_metrics_range 
  IS 'Returns daily metrics for aliases and canonical decisions within a date range';

-- 8. Grant permissions
GRANT SELECT ON public.alias_metrics_summary TO authenticated;
GRANT SELECT ON public.alias_metrics_daily TO authenticated;
GRANT SELECT ON public.canonical_review_metrics TO authenticated;
GRANT SELECT ON public.alias_conflict_backlog TO authenticated;
GRANT SELECT ON public.alias_source_system_stats TO authenticated;
GRANT SELECT ON public.employer_alias_coverage TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_alias_metrics_range TO authenticated;

