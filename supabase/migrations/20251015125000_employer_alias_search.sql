-- Prompt 3C — API & Search Updates
-- Goal: Allow API + UI search to leverage aliases
-- Creates RPC for alias-aware employer search with match highlighting

-- 1. Create search function that includes aliases in results
CREATE OR REPLACE FUNCTION public.search_employers_with_aliases(
  p_query text,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0,
  p_include_aliases boolean DEFAULT true,
  p_alias_match_mode text DEFAULT 'any' -- 'any', 'authoritative', 'canonical'
) RETURNS TABLE (
  id uuid,
  name text,
  abn text,
  employer_type public.employer_type,
  website text,
  email text,
  phone text,
  estimated_worker_count int,
  incolink_id text,
  bci_company_id text,
  enterprise_agreement_status boolean,
  -- Alias information
  aliases jsonb,
  match_type text, -- 'canonical_name', 'alias', 'external_id', 'abn'
  match_details jsonb,
  search_score numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_query_lower text;
  v_query_normalized text;
BEGIN
  -- Normalize query
  v_query_lower := LOWER(TRIM(p_query));
  v_query_normalized := public.normalize_employer_name(v_query_lower);

  RETURN QUERY
  WITH employer_aliases_grouped AS (
    -- Group all aliases per employer
    SELECT
      ea.employer_id,
      jsonb_agg(
        jsonb_build_object(
          'id', ea.id,
          'alias', ea.alias,
          'alias_normalized', ea.alias_normalized,
          'is_authoritative', ea.is_authoritative,
          'source_system', ea.source_system,
          'source_identifier', ea.source_identifier,
          'collected_at', ea.collected_at
        ) ORDER BY ea.is_authoritative DESC, ea.collected_at DESC
      ) as aliases_json,
      -- Check if any alias matches
      bool_or(
        CASE
          WHEN p_include_aliases THEN
            CASE
              WHEN p_alias_match_mode = 'authoritative' THEN
                ea.is_authoritative AND (
                  LOWER(ea.alias) LIKE '%' || v_query_lower || '%'
                  OR ea.alias_normalized LIKE '%' || v_query_normalized || '%'
                )
              WHEN p_alias_match_mode = 'canonical' THEN
                ea.is_authoritative AND LOWER(ea.alias) = v_query_lower
              ELSE -- 'any'
                LOWER(ea.alias) LIKE '%' || v_query_lower || '%'
                OR ea.alias_normalized LIKE '%' || v_query_normalized || '%'
            END
          ELSE false
        END
      ) as has_alias_match,
      -- Get best matching alias for scoring
      (
        SELECT ea2.alias
        FROM public.employer_aliases ea2
        WHERE ea2.employer_id = ea.employer_id
          AND (
            LOWER(ea2.alias) LIKE '%' || v_query_lower || '%'
            OR ea2.alias_normalized LIKE '%' || v_query_normalized || '%'
          )
        ORDER BY 
          CASE WHEN LOWER(ea2.alias) = v_query_lower THEN 1 ELSE 2 END,
          ea2.is_authoritative DESC,
          ea2.collected_at DESC
        LIMIT 1
      ) as best_matching_alias
    FROM public.employer_aliases ea
    GROUP BY ea.employer_id
  ),
  matched_employers AS (
    SELECT
      e.id,
      e.name,
      e.abn,
      e.employer_type,
      e.website,
      e.email,
      e.phone,
      e.estimated_worker_count,
      e.incolink_id,
      e.bci_company_id,
      e.enterprise_agreement_status,
      -- Alias data
      COALESCE(eag.aliases_json, '[]'::jsonb) as aliases,
      -- Determine match type and score
      CASE
        WHEN LOWER(e.name) = v_query_lower THEN 'canonical_name'
        WHEN e.bci_company_id IS NOT NULL AND LOWER(e.bci_company_id) = v_query_lower THEN 'external_id'
        WHEN e.incolink_id IS NOT NULL AND LOWER(e.incolink_id) = v_query_lower THEN 'external_id'
        WHEN e.abn IS NOT NULL AND e.abn = v_query_lower THEN 'abn'
        WHEN LOWER(e.name) LIKE '%' || v_query_lower || '%' THEN 'canonical_name'
        WHEN eag.has_alias_match THEN 'alias'
        ELSE 'no_match'
      END as match_type,
      -- Match details for highlighting
      jsonb_build_object(
        'canonical_name', e.name,
        'matched_alias', eag.best_matching_alias,
        'query', p_query,
        'external_id_match', CASE
          WHEN e.bci_company_id IS NOT NULL AND LOWER(e.bci_company_id) = v_query_lower THEN 'bci'
          WHEN e.incolink_id IS NOT NULL AND LOWER(e.incolink_id) = v_query_lower THEN 'incolink'
          ELSE null
        END
      ) as match_details,
      -- Search score for ranking
      CASE
        WHEN LOWER(e.name) = v_query_lower THEN 100
        WHEN e.bci_company_id IS NOT NULL AND LOWER(e.bci_company_id) = v_query_lower THEN 95
        WHEN e.incolink_id IS NOT NULL AND LOWER(e.incolink_id) = v_query_lower THEN 95
        WHEN e.abn IS NOT NULL AND e.abn = v_query_lower THEN 90
        WHEN LOWER(e.name) LIKE v_query_lower || '%' THEN 85
        WHEN eag.best_matching_alias IS NOT NULL AND LOWER(eag.best_matching_alias) = v_query_lower THEN 80
        WHEN LOWER(e.name) LIKE '%' || v_query_lower || '%' THEN 70
        WHEN eag.has_alias_match THEN 60
        ELSE 0
      END as search_score
    FROM public.employers e
    LEFT JOIN employer_aliases_grouped eag ON eag.employer_id = e.id
    WHERE
      -- Match on canonical name
      LOWER(e.name) LIKE '%' || v_query_lower || '%'
      -- Or external IDs
      OR (e.bci_company_id IS NOT NULL AND LOWER(e.bci_company_id) = v_query_lower)
      OR (e.incolink_id IS NOT NULL AND LOWER(e.incolink_id) = v_query_lower)
      -- Or ABN
      OR (e.abn IS NOT NULL AND e.abn = v_query_lower)
      -- Or aliases (if enabled)
      OR (p_include_aliases AND eag.has_alias_match)
  )
  SELECT
    me.id,
    me.name,
    me.abn,
    me.employer_type,
    me.website,
    me.email,
    me.phone,
    me.estimated_worker_count,
    me.incolink_id,
    me.bci_company_id,
    me.enterprise_agreement_status,
    me.aliases,
    me.match_type,
    me.match_details,
    me.search_score
  FROM matched_employers me
  WHERE me.match_type != 'no_match'
  ORDER BY me.search_score DESC, me.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION public.search_employers_with_aliases 
  IS 'Searches employers by name, aliases, external IDs (BCI, Incolink), and ABN with relevance scoring';

-- 2. Grant execute permission
GRANT EXECUTE ON FUNCTION public.search_employers_with_aliases TO authenticated;

-- 3. Create helper function to get aliases for a specific employer (useful for detail views)
CREATE OR REPLACE FUNCTION public.get_employer_aliases(
  p_employer_id uuid
) RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', ea.id,
        'alias', ea.alias,
        'alias_normalized', ea.alias_normalized,
        'is_authoritative', ea.is_authoritative,
        'source_system', ea.source_system,
        'source_identifier', ea.source_identifier,
        'collected_at', ea.collected_at,
        'collected_by', ea.collected_by,
        'notes', ea.notes,
        'created_at', ea.created_at
      ) ORDER BY ea.is_authoritative DESC, ea.collected_at DESC, ea.created_at DESC
    ),
    '[]'::jsonb
  )
  FROM public.employer_aliases ea
  WHERE ea.employer_id = p_employer_id;
$$;

COMMENT ON FUNCTION public.get_employer_aliases 
  IS 'Returns all aliases for a specific employer as JSON array';

GRANT EXECUTE ON FUNCTION public.get_employer_aliases TO authenticated;

-- 4. Create index to optimize alias search
CREATE INDEX IF NOT EXISTS idx_employer_aliases_alias_lower 
  ON public.employer_aliases(LOWER(alias));

CREATE INDEX IF NOT EXISTS idx_employer_aliases_normalized_pattern 
  ON public.employer_aliases(alias_normalized text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_employers_name_lower 
  ON public.employers(LOWER(name));

CREATE INDEX IF NOT EXISTS idx_employers_bci_company_id_lower 
  ON public.employers(LOWER(bci_company_id)) 
  WHERE bci_company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employers_incolink_id_lower 
  ON public.employers(LOWER(incolink_id)) 
  WHERE incolink_id IS NOT NULL;

-- 5. Create view for quick alias statistics (useful for analytics)
CREATE OR REPLACE VIEW public.employer_alias_stats AS
SELECT
  e.id as employer_id,
  e.name as employer_name,
  COUNT(ea.id) as total_aliases,
  COUNT(ea.id) FILTER (WHERE ea.is_authoritative) as authoritative_aliases,
  jsonb_agg(DISTINCT ea.source_system ORDER BY ea.source_system) 
    FILTER (WHERE ea.source_system IS NOT NULL) as source_systems,
  MAX(ea.collected_at) as latest_alias_collected,
  MIN(ea.collected_at) as earliest_alias_collected
FROM public.employers e
LEFT JOIN public.employer_aliases ea ON ea.employer_id = e.id
GROUP BY e.id, e.name;

COMMENT ON VIEW public.employer_alias_stats 
  IS 'Statistics about aliases per employer for analytics and monitoring';

GRANT SELECT ON public.employer_alias_stats TO authenticated;

