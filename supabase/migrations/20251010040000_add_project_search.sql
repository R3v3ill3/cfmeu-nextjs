-- Migration: Add Project Search Function
-- Creates search_all_projects function for project search functionality

CREATE OR REPLACE FUNCTION public.search_all_projects(search_query text)
 RETURNS TABLE(id uuid, project_name text, project_address text, project_number text, builder text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.project_name,
    p.project_address,
    p.project_number,
    p.builder
  FROM projects p
  WHERE
    p.project_name ILIKE '%' || search_query || '%'
    OR p.project_address ILIKE '%' || search_query || '%'
    OR p.project_number ILIKE '%' || search_query || '%'
    OR p.builder ILIKE '%' || search_query || '%'
  ORDER BY
    -- Prioritize exact/prefix matches
    CASE
      WHEN p.project_name ILIKE search_query THEN 1
      WHEN p.project_name ILIKE search_query || '%' THEN 2
      WHEN p.project_name ILIKE '%' || search_query || '%' THEN 3
      ELSE 4
    END,
    p.project_name
  LIMIT 50;
END;
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.search_all_projects(text) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.search_all_projects(text) IS 'Search projects by name, address, project number, or builder name. Returns up to 50 results prioritized by match quality.';

