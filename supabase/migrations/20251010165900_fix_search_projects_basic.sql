-- Fix missing search_projects_basic RPC function
-- This ensures the function exists even if the original migration failed

-- Enable extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Recreate the quick search view
CREATE OR REPLACE VIEW public.projects_quick_search AS
SELECT
  p.id,
  p.name,
  COALESCE(js.full_address, js.location) AS full_address,
  e.name AS builder_name,
  to_tsvector('simple', unaccent(coalesce(p.name, ''))) ||
  to_tsvector('simple', unaccent(coalesce(js.full_address, ''))) ||
  to_tsvector('simple', unaccent(coalesce(e.name, ''))) AS search_vector
FROM projects p
LEFT JOIN job_sites js ON js.id = p.main_job_site_id
LEFT JOIN employers e ON e.id = p.builder_id
WHERE p.approval_status != 'pending';  -- Exclude pending approval projects from search

GRANT SELECT ON public.projects_quick_search TO authenticated;

COMMENT ON VIEW public.projects_quick_search IS 'Simplified project search (name/address/builder) for mapping sheet scan quick matching. Excludes pending approval projects.';

-- Recreate the RPC function with ILIKE pattern matching (consistent with projects page search)
CREATE OR REPLACE FUNCTION search_projects_basic(p_query TEXT, p_limit INT DEFAULT 20)
RETURNS TABLE(
  id UUID,
  name TEXT,
  full_address TEXT,
  builder_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT q.id, q.name, q.full_address, q.builder_name
  FROM public.projects_quick_search q
  WHERE (
    p_query IS NULL
    OR p_query = ''
    OR unaccent(q.name) ILIKE ('%' || unaccent(p_query) || '%')
    OR unaccent(COALESCE(q.full_address, '')) ILIKE ('%' || unaccent(p_query) || '%')
    OR unaccent(COALESCE(q.builder_name, '')) ILIKE ('%' || unaccent(p_query) || '%')
  )
  ORDER BY
    -- Exact matches first
    CASE WHEN unaccent(q.name) ILIKE unaccent(p_query) THEN 0 ELSE 1 END,
    -- Then by similarity to name
    similarity(unaccent(q.name), unaccent(p_query)) DESC NULLS LAST,
    -- Finally alphabetically
    q.name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION search_projects_basic(TEXT, INT) TO authenticated;

COMMENT ON FUNCTION search_projects_basic(TEXT, INT) IS 'Quick project search for mapping sheet scan matching using ILIKE pattern matching (consistent with main projects page search). Searches across name, address, and builder.';
