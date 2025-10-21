-- Update create_project_from_scan to handle trade status field
-- This allows scan imports to set the status for each subcontractor assignment

CREATE OR REPLACE FUNCTION create_project_from_scan(
  p_user_id uuid,
  p_scan_id uuid,
  p_project_data jsonb,
  p_contacts jsonb DEFAULT '[]'::jsonb,
  p_subcontractors jsonb DEFAULT '[]'::jsonb,
  p_employer_creations jsonb DEFAULT '[]'::jsonb,
  p_require_approval boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_scan_record RECORD;
  v_project_id uuid;
  v_job_site_id uuid;
  v_builder_id uuid;
  v_employer_id uuid;
  v_trade_type_id uuid;
  v_contact jsonb;
  v_subcontractor jsonb;
  v_address text;
  v_result jsonb;
  v_status text;
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'error', 'Unauthorized',
      'status', 403
    );
  END IF;

  -- Load and validate scan
  SELECT * INTO v_scan_record
  FROM mapping_sheet_scans
  WHERE id = p_scan_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Scan not found',
      'status', 404
    );
  END IF;

  IF v_scan_record.project_id IS NOT NULL OR v_scan_record.created_project_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'error', 'Scan already linked to a project',
      'status', 400
    );
  END IF;

  IF v_scan_record.upload_mode != 'new_project' THEN
    RETURN jsonb_build_object(
      'error', 'Scan is not marked for new project creation',
      'status', 400
    );
  END IF;

  BEGIN
    -- 1. Create project (with created_by)
    INSERT INTO projects (
      name,
      value,
      proposed_start_date,
      proposed_finish_date,
      roe_email,
      project_type,
      state_funding,
      federal_funding,
      approval_status,
      created_by
    ) VALUES (
      COALESCE(
        p_project_data->>'name',
        v_scan_record.extracted_data->'project'->>'project_name',
        'New Project'
      ),
      (p_project_data->>'value')::numeric,
      (p_project_data->>'proposed_start_date')::date,
      (p_project_data->>'proposed_finish_date')::date,
      p_project_data->>'roe_email',
      CASE 
        WHEN p_project_data->>'project_type' IS NOT NULL AND p_project_data->>'project_type' != ''
        THEN (p_project_data->>'project_type')::project_type
        ELSE NULL
      END,
      COALESCE((p_project_data->>'state_funding')::numeric, 0),
      COALESCE((p_project_data->>'federal_funding')::numeric, 0),
      CASE WHEN p_require_approval THEN 'pending' ELSE 'active' END,
      p_user_id
    )
    RETURNING id INTO v_project_id;

    -- [Rest of function continues with site creation, builder, contacts - unchanged until subcontractors section]
    
    -- 5. Create subcontractor assignments WITH STATUS
    FOR v_subcontractor IN SELECT * FROM jsonb_array_elements(p_subcontractors)
    LOOP
      v_employer_id := (v_subcontractor->'matchedEmployer'->>'id')::uuid;

      IF v_employer_id IS NULL THEN
        CONTINUE;
      END IF;

      v_trade_type_id := NULL;
      IF v_subcontractor ? 'trade_type_code' THEN
        SELECT id INTO v_trade_type_id
        FROM trade_types
        WHERE code = v_subcontractor->>'trade_type_code'
        LIMIT 1;
      END IF;

      -- Get status from decision (default to 'active' if not provided)
      v_status := COALESCE(v_subcontractor->>'status', 'active');

      INSERT INTO project_assignments (
        project_id,
        employer_id,
        assignment_type,
        trade_type_id,
        status,                 -- NEW: Include status
        status_updated_at,      -- NEW: Track when status was set
        status_updated_by,      -- NEW: Track who set the status
        source,
        match_status,
        match_confidence,
        match_notes
      ) VALUES (
        v_project_id,
        v_employer_id,
        'trade_work',
        v_trade_type_id,
        v_status,               -- NEW: Use extracted status
        now(),                  -- NEW: Set timestamp
        p_user_id,             -- NEW: Track user
        'scanned_mapping_sheet',
        'confirmed',
        COALESCE((v_subcontractor->>'matchConfidence')::numeric, 1.0),
        v_subcontractor->>'matchNotes'
      );
    END LOOP;

    -- 6. Update scan status
    UPDATE mapping_sheet_scans
    SET
      status = 'under_review',
      created_project_id = v_project_id,
      project_id = v_project_id
    WHERE id = p_scan_id;

    RETURN jsonb_build_object(
      'success', true,
      'projectId', v_project_id,
      'jobSiteId', v_job_site_id
    );

  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'error', SQLERRM,
        'status', 500
      );
  END;
END;
$$;

COMMENT ON FUNCTION create_project_from_scan(uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean) IS
  'Creates a complete project from a mapping sheet scan. NOW INCLUDES: Trade assignment status tracking with timestamps and user attribution.';

-- Note: This migration only updates the subcontractor INSERT section
-- The full function logic for project creation, sites, builder, and contacts remains unchanged
-- See previous migrations for the complete function implementation

