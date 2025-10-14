-- RPC function to check for duplicate or similar project names
-- Used during scan review to prevent creating duplicate projects

CREATE OR REPLACE FUNCTION check_duplicate_project_names(
  p_project_name TEXT,
  p_exclude_project_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exact_matches JSONB;
  v_fuzzy_matches JSONB;
  v_normalized_name TEXT;
BEGIN
  -- Normalize the input name for comparison
  v_normalized_name := LOWER(TRIM(p_project_name));

  -- Find exact matches (case-insensitive, trimmed)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'approval_status', p.approval_status,
      'value', p.value,
      'address', COALESCE(js.full_address, js.location),
      'builder_name', e.name,
      'created_at', p.created_at,
      'match_type', 'exact'
    ) ORDER BY
      -- Prioritize active and pending projects
      CASE
        WHEN p.approval_status = 'active' THEN 1
        WHEN p.approval_status = 'pending' THEN 2
        ELSE 3
      END,
      p.created_at DESC
  ), '[]'::jsonb)
  INTO v_exact_matches
  FROM projects p
  LEFT JOIN job_sites js ON js.id = p.main_job_site_id
  LEFT JOIN employers e ON e.id = p.builder_id
  WHERE LOWER(TRIM(p.name)) = v_normalized_name
    AND (p_exclude_project_id IS NULL OR p.id != p_exclude_project_id)
    AND p.approval_status IN ('active', 'pending')  -- Only show active/pending
  LIMIT 10;

  -- If no exact matches, find fuzzy matches using similarity
  IF jsonb_array_length(v_exact_matches) = 0 THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'approval_status', p.approval_status,
        'value', p.value,
        'address', COALESCE(js.full_address, js.location),
        'builder_name', e.name,
        'created_at', p.created_at,
        'match_type', 'fuzzy',
        'similarity_score', similarity(LOWER(TRIM(p.name)), v_normalized_name)
      ) ORDER BY
        similarity(LOWER(TRIM(p.name)), v_normalized_name) DESC,
        CASE
          WHEN p.approval_status = 'active' THEN 1
          WHEN p.approval_status = 'pending' THEN 2
          ELSE 3
        END,
        p.created_at DESC
    ), '[]'::jsonb)
    INTO v_fuzzy_matches
    FROM projects p
    LEFT JOIN job_sites js ON js.id = p.main_job_site_id
    LEFT JOIN employers e ON e.id = p.builder_id
    WHERE similarity(LOWER(TRIM(p.name)), v_normalized_name) > 0.3  -- 30% similarity threshold
      AND (p_exclude_project_id IS NULL OR p.id != p_exclude_project_id)
      AND p.approval_status IN ('active', 'pending')
    LIMIT 10;
  ELSE
    v_fuzzy_matches := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'has_exact_matches', jsonb_array_length(v_exact_matches) > 0,
    'has_fuzzy_matches', jsonb_array_length(v_fuzzy_matches) > 0,
    'exact_matches', v_exact_matches,
    'fuzzy_matches', v_fuzzy_matches,
    'searched_name', p_project_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_duplicate_project_names(TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION check_duplicate_project_names(TEXT, UUID) IS
  'Checks for duplicate or similar project names. Returns exact matches first, then fuzzy matches if no exact match found. Used to prevent duplicate project creation during scan import.';
