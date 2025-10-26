-- Performance optimizations for employer alias and EBA quick list features
-- This migration adds indexes and optimizes queries for better performance

-- ============================================================================
-- EMPLOYER ALIAS PERFORMANCE INDEXES
-- ============================================================================

-- Create composite index for efficient employer alias searches with trade filtering
CREATE INDEX IF NOT EXISTS employer_aliases_search_idx
ON public.employer_aliases (alias_normalized, employer_id, is_authoritative, created_at DESC);

-- Create index for alias provenance tracking
CREATE INDEX IF NOT EXISTS employer_aliases_provenance_idx
ON public.employer_aliases (source_system, collected_at DESC, is_authoritative);

-- Create partial index for authoritative aliases (most commonly searched)
CREATE INDEX IF NOT EXISTS employer_aliases_authoritative_idx
ON public.employer_aliases (alias_normalized, employer_id)
WHERE is_authoritative = true;

-- ============================================================================
-- EBA QUICK LIST PERFORMANCE INDEXES
-- ============================================================================

-- Create index for trade-based EBA filtering
-- This enhances the materialized view performance for trade filtering
CREATE INDEX IF NOT EXISTS employers_search_optimized_eba_trade_idx
ON public.employers_search_optimized (enterprise_agreement_status, category_trades_json)
WHERE enterprise_agreement_status = true;

-- Create index for EBA recency scoring
CREATE INDEX IF NOT EXISTS employers_search_optimized_eba_recency_idx
ON public.employers_search_optimized (eba_recency_score DESC, most_recent_eba_date DESC)
WHERE enterprise_agreement_status = true;

-- Create composite index for common EBA quick list query patterns
CREATE INDEX IF NOT EXISTS employers_search_optimized_quick_list_idx
ON public.employers_search_optimized (enterprise_agreement_status, employer_type, project_count DESC)
WHERE enterprise_agreement_status = true;

-- ============================================================================
-- ENHANCED EMPLOYER SEARCH INDEXES
-- ============================================================================

-- Create trigram index for improved fuzzy search performance
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN index for fast text search on employer names
CREATE INDEX IF NOT EXISTS employers_name_trgm_idx
ON public.employers USING gin (name gin_trgm_ops);

-- Create index for employer search optimization view refresh performance
CREATE INDEX IF NOT EXISTS employers_search_optimized_refresh_idx
ON public.employers_search_optimized (view_refreshed_at, enterprise_agreement_status, project_count);

-- ============================================================================
-- ALIAS-AWARE SEARCH OPTIMIZATION
-- ============================================================================

-- Create function to update materialized view efficiently
CREATE OR REPLACE FUNCTION refresh_employers_search_optimized_incremental()
RETURNS void AS $$
DECLARE
    last_refresh timestamptz;
BEGIN
    -- Get the last refresh time
    SELECT COALESCE(MAX(view_refreshed_at), '1970-01-01'::timestamptz)
    INTO last_refresh
    FROM public.employers_search_optimized;

    -- Only refresh if there have been recent changes
    IF EXISTS (
        SELECT 1 FROM (
            SELECT MAX(created_at) as max_created FROM public.employers WHERE created_at > last_refresh
            UNION ALL
            SELECT MAX(updated_at) as max_created FROM public.employers WHERE updated_at > last_refresh
            UNION ALL
            SELECT MAX(created_at) as max_created FROM public.employer_aliases WHERE created_at > last_refresh
            UNION ALL
            SELECT MAX(eba_status_updated_at) as max_created FROM public.employers WHERE eba_status_updated_at > last_refresh
        ) recent_changes
        WHERE max_created > last_refresh
    ) THEN
        -- Refresh the materialized view
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.employers_search_optimized;

        -- Log the refresh
        INSERT INTO public.system_logs (event_type, message, created_at)
        VALUES ('materialized_view_refresh', 'employers_search_optimized refreshed incrementally', NOW())
        ON CONFLICT DO NOTHING;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create optimized RPC function for alias-aware employer search
CREATE OR REPLACE FUNCTION search_employers_with_aliases_optimized(
    p_query text,
    p_limit integer DEFAULT 50,
    p_offset integer DEFAULT 0,
    p_include_aliases boolean DEFAULT true,
    p_alias_match_mode text DEFAULT 'any'
)
RETURNS TABLE (
    id uuid,
    name text,
    employer_type text,
    enterprise_agreement_status boolean,
    eba_status_source text,
    eba_status_updated_at timestamptz,
    estimated_worker_count integer,
    incolink_id text,
    project_count integer,
    most_recent_eba_date timestamptz,
    category_trades_json jsonb,
    search_score real,
    match_type text,
    match_details jsonb,
    aliases jsonb
) AS $$
DECLARE
    normalized_query text;
BEGIN
    -- Normalize the search query
    normalized_query := lower(trim(p_query));

    -- If aliases are included, do enhanced search
    IF p_include_aliases AND length(trim(p_query)) > 0 THEN
        RETURN QUERY
        SELECT
            e.id,
            e.name,
            e.employer_type,
            e.enterprise_agreement_status,
            e.eba_status_source,
            e.eba_status_updated_at,
            e.estimated_worker_count,
            e.incolink_id,
            e.project_count,
            e.most_recent_eba_date,
            e.category_trades_json,
            CASE
                WHEN lower(e.name) = normalized_query THEN 1.0
                WHEN lower(e.name) LIKE normalized_query || '%' THEN 0.9
                WHEN lower(e.name) LIKE '%' || normalized_query || '%' THEN 0.7
                ELSE 0.5
            END as search_score,
            'canonical_name' as match_type,
            jsonb_build_object(
                'canonical_name', e.name,
                'matched_alias', null,
                'query', p_query,
                'external_id_match', null
            ) as match_details,
            '[]'::jsonb as aliases
        FROM public.employers_search_optimized e
        WHERE lower(e.name) LIKE '%' || normalized_query || '%'

        UNION ALL

        SELECT
            e.id,
            e.name,
            e.employer_type,
            e.enterprise_agreement_status,
            e.eba_status_source,
            e.eba_status_updated_at,
            e.estimated_worker_count,
            e.incolink_id,
            e.project_count,
            e.most_recent_eba_date,
            e.category_trades_json,
            CASE
                WHEN ea.alias_normalized = normalized_query THEN 0.95
                WHEN ea.alias_normalized LIKE normalized_query || '%' THEN 0.85
                WHEN ea.alias_normalized LIKE '%' || normalized_query || '%' THEN 0.75
                ELSE 0.6
            END as search_score,
            'alias' as match_type,
            jsonb_build_object(
                'canonical_name', e.name,
                'matched_alias', ea.alias,
                'query', p_query,
                'external_id_match', null
            ) as match_details,
            jsonb_build_object(
                'id', ea.id,
                'alias', ea.alias,
                'is_authoritative', ea.is_authoritative,
                'source_system', ea.source_system
            ) as aliases
        FROM public.employers_search_optimized e
        INNER JOIN public.employer_aliases ea ON e.id = ea.employer_id
        WHERE ea.alias_normalized LIKE '%' || normalized_query || '%'
        AND (p_alias_match_mode = 'any' OR (p_alias_match_mode = 'authoritative' AND ea.is_authoritative = true))

        ORDER BY search_score DESC, name ASC
        LIMIT p_limit
        OFFSET p_offset;
    ELSE
        -- Standard search without aliases
        RETURN QUERY
        SELECT
            e.id,
            e.name,
            e.employer_type,
            e.enterprise_agreement_status,
            e.eba_status_source,
            e.eba_status_updated_at,
            e.estimated_worker_count,
            e.incolink_id,
            e.project_count,
            e.most_recent_eba_date,
            e.category_trades_json,
            1.0 as search_score,
            'canonical_name' as match_type,
            jsonb_build_object(
                'canonical_name', e.name,
                'matched_alias', null,
                'query', p_query,
                'external_id_match', null
            ) as match_details,
            '[]'::jsonb as aliases
        FROM public.employers_search_optimized e
        WHERE (length(trim(p_query)) = 0 OR lower(e.name) LIKE '%' || normalized_query || '%')
        ORDER BY e.name ASC
        LIMIT p_limit
        OFFSET p_offset;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create optimized RPC function for EBA trade filtering
CREATE OR REPLACE FUNCTION get_eba_employers_by_trade_optimized(
    p_trade_type text DEFAULT NULL,
    p_search text DEFAULT NULL,
    p_limit integer DEFAULT 100,
    p_offset integer DEFAULT 0,
    p_include_active_eba_only boolean DEFAULT true
)
RETURNS TABLE (
    id uuid,
    name text,
    employer_type text,
    enterprise_agreement_status boolean,
    eba_status_source text,
    eba_status_updated_at timestamptz,
    estimated_worker_count integer,
    project_count integer,
    most_recent_eba_date timestamptz,
    trade_code text,
    trade_name text
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.name,
        e.employer_type,
        e.enterprise_agreement_status,
        e.eba_status_source,
        e.eba_status_updated_at,
        e.estimated_worker_count,
        e.project_count,
        e.most_recent_eba_date,
        trade.code as trade_code,
        trade.name as trade_name
    FROM public.employers_search_optimized e
    CROSS JOIN LATERAL jsonb_to_recordset(e.category_trades_json) AS trade(code text, name text)
    WHERE (p_include_active_eba_only IS FALSE OR e.enterprise_agreement_status = true)
    AND (p_trade_type IS NULL OR trade.code = p_trade_type)
    AND (p_search IS NULL OR length(trim(p_search)) = 0 OR lower(e.name) LIKE '%' || lower(trim(p_search)) || '%')
    ORDER BY e.most_recent_eba_date DESC NULLS LAST, e.name ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION search_employers_with_aliases_optimized TO authenticated;
GRANT EXECUTE ON FUNCTION get_eba_employers_by_trade_optimized TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_employers_search_optimized_incremental TO authenticated;

-- Create index for system logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.system_logs (
    id uuid primary key default gen_random_uuid(),
    event_type text not null,
    message text,
    created_at timestamptz not null default now(),
    created_by uuid references public.profiles(id)
);

CREATE INDEX IF NOT EXISTS system_logs_event_type_idx ON public.system_logs (event_type, created_at DESC);

-- ============================================================================
-- PERFORMANCE MONITORING VIEWS
-- ============================================================================

-- Create view for monitoring alias performance
CREATE OR REPLACE VIEW public.employer_alias_metrics AS
SELECT
    COUNT(*) as total_aliases,
    COUNT(CASE WHEN is_authoritative = true THEN 1 END) as authoritative_aliases,
    COUNT(DISTINCT employer_id) as employers_with_aliases,
    AVG(LENGTH(alias)) as avg_alias_length,
    MAX(created_at) as most_recent_alias,
    source_system
FROM public.employer_aliases
GROUP BY source_system
ORDER BY total_aliases DESC;

-- Create view for monitoring EBA quick list performance
CREATE OR REPLACE VIEW public.eba_quick_list_metrics AS
SELECT
    COUNT(*) as total_eba_employers,
    COUNT(CASE WHEN enterprise_agreement_status = true THEN 1 END) as active_eba_employers,
    AVG(project_count) as avg_projects_per_employer,
    AVG(estimated_worker_count) as avg_workers_per_employer,
    COUNT(CASE WHEN most_recent_eba_date > NOW() - INTERVAL '1 year' THEN 1 END) as recent_eba_activity
FROM public.employers_search_optimized
WHERE enterprise_agreement_status = true;

-- Grant read permissions to authenticated users
GRANT SELECT ON public.employer_alias_metrics TO authenticated;
GRANT SELECT ON public.eba_quick_list_metrics TO authenticated;

COMMENT ON MATERIALIZED VIEW public.employers_search_optimized IS
'Optimized materialized view for employer search with EBA status, project counts, and trade categories.
Includes performance indexes for trade-based filtering and alias-aware search capabilities.';

COMMENT ON FUNCTION public.search_employers_with_aliases_optimized IS
'Optimized RPC function for employer search with alias support.
Uses materialized view and specialized indexes for fast performance.';

COMMENT ON FUNCTION public.get_eba_employers_by_trade_optimized IS
'Optimized RPC function for EBA employer filtering by trade type.
Leverages materialized view indexes for efficient trade-based queries.';

-- Initial refresh of materialized view
REFRESH MATERIALIZED VIEW CONCURRENTLY public.employers_search_optimized;