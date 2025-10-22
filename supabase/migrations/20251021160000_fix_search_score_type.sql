-- Fix search_score type mismatch
-- Column 19 (search_score) was returning integer but function expects numeric
-- Change all score literals to decimal format (100.0 instead of 100)

DROP FUNCTION IF EXISTS public.search_employers_with_aliases(text, int, int, boolean, text);

CREATE OR REPLACE FUNCTION public.search_employers_with_aliases(
  p_query text,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0,
  p_include_aliases boolean DEFAULT true,
  p_alias_match_mode text DEFAULT 'any'
) RETURNS TABLE (
  id uuid,
  name text,
  abn text,
  employer_type public.employer_type,
  website text,
  email text,
  phone text,
  address_line_1 text,
  suburb text,
  state text,
  postcode text,
  estimated_worker_count int,
  incolink_id text,
  bci_company_id text,
  enterprise_agreement_status boolean,
  aliases jsonb,
  match_type text,
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
  v_query_lower := LOWER(TRIM(p_query));
  v_query_normalized := public.normalize_employer_name(v_query_lower);

  RETURN QUERY
  WITH employer_aliases_grouped AS (
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
              ELSE
                LOWER(ea.alias) LIKE '%' || v_query_lower || '%'
                OR ea.alias_normalized LIKE '%' || v_query_normalized || '%'
            END
          ELSE false
        END
      ) as has_alias_match,
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
      e.address_line_1,
      e.suburb,
      e.state,
      e.postcode,
      e.estimated_worker_count,
      e.incolink_id,
      e.bci_company_id,
      e.enterprise_agreement_status,
      COALESCE(eag.aliases_json, '[]'::jsonb) as aliases,
      CASE
        WHEN LOWER(e.name) = v_query_lower THEN 'canonical_name'
        WHEN e.bci_company_id IS NOT NULL AND LOWER(e.bci_company_id) = v_query_lower THEN 'external_id'
        WHEN e.incolink_id IS NOT NULL AND LOWER(e.incolink_id) = v_query_lower THEN 'external_id'
        WHEN e.abn IS NOT NULL AND e.abn = v_query_lower THEN 'abn'
        WHEN LOWER(e.name) LIKE '%' || v_query_lower || '%' THEN 'canonical_name'
        WHEN eag.has_alias_match THEN 'alias'
        ELSE 'no_match'
      END as match_type,
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
      -- FIX: Cast all score values to numeric explicitly using ::numeric
      CASE
        WHEN LOWER(e.name) = v_query_lower THEN 100.0
        WHEN public.normalize_employer_name(e.name) = v_query_normalized THEN 98.0
        WHEN e.bci_company_id IS NOT NULL AND LOWER(e.bci_company_id) = v_query_lower THEN 95.0
        WHEN e.incolink_id IS NOT NULL AND LOWER(e.incolink_id) = v_query_lower THEN 95.0
        WHEN e.abn IS NOT NULL AND e.abn = v_query_lower THEN 90.0
        WHEN LOWER(e.name) LIKE v_query_lower || '%' THEN 85.0
        WHEN public.normalize_employer_name(e.name) LIKE v_query_normalized || '%' THEN 83.0
        WHEN eag.best_matching_alias IS NOT NULL AND LOWER(eag.best_matching_alias) = v_query_lower THEN 80.0
        WHEN LOWER(e.name) LIKE '%' || v_query_lower || '%' THEN 70.0
        WHEN public.normalize_employer_name(e.name) LIKE '%' || v_query_normalized || '%' THEN 68.0
        WHEN eag.has_alias_match THEN 60.0
        ELSE 0.0
      END as search_score
    FROM public.employers e
    LEFT JOIN employer_aliases_grouped eag ON eag.employer_id = e.id
    WHERE
      LOWER(e.name) LIKE '%' || v_query_lower || '%'
      OR public.normalize_employer_name(e.name) LIKE '%' || v_query_normalized || '%'
      OR (e.bci_company_id IS NOT NULL AND LOWER(e.bci_company_id) = v_query_lower)
      OR (e.incolink_id IS NOT NULL AND LOWER(e.incolink_id) = v_query_lower)
      OR (e.abn IS NOT NULL AND e.abn = v_query_lower)
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
    me.address_line_1,
    me.suburb,
    me.state,
    me.postcode,
    me.estimated_worker_count,
    me.incolink_id,
    me.bci_company_id,
    me.enterprise_agreement_status,
    me.aliases,
    me.match_type,
    me.match_details,
    me.search_score
  FROM matched_employers me
  WHERE me.match_type != 'no_match' OR me.search_score > 0.0
  ORDER BY me.search_score DESC, me.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION public.search_employers_with_aliases
  IS 'Searches employers by name, aliases, external IDs (BCI, Incolink), and ABN with relevance scoring. Returns numeric search_score.';

GRANT EXECUTE ON FUNCTION public.search_employers_with_aliases TO authenticated;
