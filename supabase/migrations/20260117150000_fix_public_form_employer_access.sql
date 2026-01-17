-- ============================================================================
-- Fix get_public_form_reference_data to properly access employers
-- ============================================================================
-- Issue: RLS on employers table blocks the query when called via anon role
-- in the shared mapping sheet flow. The function is SECURITY DEFINER but
-- lacks the proper search_path setting used by other working functions.
--
-- Root cause: The employers table has RLS policies only for 'authenticated' users:
--   CREATE POLICY "employers_select" ON "public"."employers" 
--   FOR SELECT TO "authenticated" USING ("public"."can_access_employer"("id"));
--
-- Solution: Add SET "search_path" TO 'public' and STABLE hint to match the
-- pattern from other working SECURITY DEFINER functions like get_project_for_scan_review.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_public_form_reference_data(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET "search_path" TO 'public'
AS $$
DECLARE
  v_validation RECORD;
  v_employers jsonb;
  v_contractor_role_types jsonb;
BEGIN
  -- Validate token
  SELECT * INTO v_validation
  FROM validate_public_token(p_token)
  LIMIT 1;

  IF NOT v_validation.valid THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Query employers (SECURITY DEFINER + search_path ensures RLS bypass)
  -- Only include active employers for the search dropdown
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'enterprise_agreement_status', enterprise_agreement_status
      )
    ),
    '[]'::jsonb
  )
  INTO v_employers
  FROM (
    SELECT id, name, enterprise_agreement_status
    FROM employers
    WHERE is_active = true OR is_active IS NULL
    ORDER BY name
    LIMIT 1000
  ) e;

  -- Query contractor role types
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'code', code,
        'name', name
      )
    ),
    '[]'::jsonb
  )
  INTO v_contractor_role_types
  FROM contractor_role_types
  ORDER BY name;

  RETURN jsonb_build_object(
    'employers', v_employers,
    'contractorRoleTypes', v_contractor_role_types
  );
END;
$$;

-- Ensure anon role can execute this function
GRANT EXECUTE ON FUNCTION get_public_form_reference_data(text) TO anon;

COMMENT ON FUNCTION get_public_form_reference_data(text) IS 
  'Fetches employer and contractor role type reference data for public forms. Uses SECURITY DEFINER with proper search_path to bypass RLS when called from public/anon context.';
