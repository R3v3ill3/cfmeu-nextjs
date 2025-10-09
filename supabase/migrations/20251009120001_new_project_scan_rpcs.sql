-- Migration: New Project from Scan RPCs (F-012)
-- Creates RPCs for automated project creation from mapping sheet scans
-- Removes need for service-role key in new-from-scan route

-- ==========================================
-- 1. Assign Contractor Role RPC
-- ==========================================

CREATE OR REPLACE FUNCTION assign_contractor_role(
  p_project_id uuid,
  p_employer_id uuid,
  p_role_code text,
  p_company_name text,
  p_is_primary boolean DEFAULT false,
  p_source text DEFAULT 'manual',
  p_match_confidence numeric DEFAULT 1.0,
  p_match_notes text DEFAULT null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role_type_id uuid;
  v_assignment_id uuid;
BEGIN
  -- Get contractor role type ID from code
  SELECT id INTO v_role_type_id
  FROM contractor_role_types
  WHERE code = p_role_code
  LIMIT 1;

  IF v_role_type_id IS NULL THEN
    RAISE EXCEPTION 'Invalid contractor role code: %', p_role_code;
  END IF;

  -- Insert project assignment
  INSERT INTO project_assignments (
    project_id,
    employer_id,
    assignment_type,
    contractor_role_type_id,
    source,
    match_status,
    match_confidence,
    match_notes
  ) VALUES (
    p_project_id,
    p_employer_id,
    'contractor_role',
    v_role_type_id,
    p_source,
    'confirmed',
    p_match_confidence,
    p_match_notes
  )
  RETURNING id INTO v_assignment_id;

  RETURN v_assignment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION assign_contractor_role(uuid, uuid, text, text, boolean, text, numeric, text) TO authenticated;

-- ==========================================
-- 2. Create Project from Scan RPC
-- ==========================================

CREATE OR REPLACE FUNCTION create_project_from_scan(
  p_user_id uuid,
  p_scan_id uuid,
  p_project_data jsonb,
  p_contacts jsonb DEFAULT '[]'::jsonb,
  p_subcontractors jsonb DEFAULT '[]'::jsonb,
  p_employer_creations jsonb DEFAULT '[]'::jsonb
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

  -- Start transaction (implicit in function with exception handling)
  BEGIN
    -- 1. Create project
    INSERT INTO projects (
      name,
      value,
      proposed_start_date,
      proposed_finish_date,
      roe_email,
      project_type,
      state_funding,
      federal_funding
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
      p_project_data->>'project_type',
      COALESCE((p_project_data->>'state_funding')::numeric, 0),
      COALESCE((p_project_data->>'federal_funding')::numeric, 0)
    )
    RETURNING id INTO v_project_id;

    -- 2. Create main job site if address provided
    v_address := COALESCE(
      p_project_data->>'address',
      v_scan_record.extracted_data->'project'->>'address'
    );

    IF v_address IS NOT NULL THEN
      INSERT INTO job_sites (
        project_id,
        name,
        is_main_site,
        location,
        full_address
      ) VALUES (
        v_project_id,
        COALESCE(p_project_data->>'name', 'Main Site'),
        true,
        v_address,
        v_address
      )
      RETURNING id INTO v_job_site_id;

      -- Link job site to project
      UPDATE projects
      SET main_job_site_id = v_job_site_id
      WHERE id = v_project_id;
    END IF;

    -- 3. Handle builder assignment
    IF p_project_data ? 'builder' AND p_project_data->'builder' IS NOT NULL THEN
      v_builder_id := (p_project_data->'builder'->>'matchedEmployerId')::uuid;

      -- Create new employer if requested
      IF v_builder_id IS NULL AND (p_project_data->'builder'->>'createNew')::boolean THEN
        INSERT INTO employers (
          name,
          employer_type,
          website,
          notes
        ) VALUES (
          p_project_data->'builder'->'newEmployerData'->>'name',
          p_project_data->'builder'->'newEmployerData'->>'employer_type',
          p_project_data->'builder'->'newEmployerData'->>'website',
          p_project_data->'builder'->'newEmployerData'->>'notes'
        )
        RETURNING id INTO v_builder_id;
      END IF;

      -- Assign builder role
      IF v_builder_id IS NOT NULL THEN
        PERFORM assign_contractor_role(
          v_project_id,
          v_builder_id,
          'builder',
          p_project_data->'builder'->>'displayName',
          true,
          'scanned_mapping_sheet',
          COALESCE((p_project_data->'builder'->>'matchConfidence')::numeric, 1.0),
          p_project_data->'builder'->>'matchNotes'
        );

        -- Update project builder_id
        UPDATE projects
        SET builder_id = v_builder_id
        WHERE id = v_project_id;
      END IF;
    END IF;

    -- 4. Create site contacts
    IF v_job_site_id IS NOT NULL THEN
      FOR v_contact IN SELECT * FROM jsonb_array_elements(p_contacts)
      LOOP
        INSERT INTO site_contacts (
          job_site_id,
          role,
          name,
          email,
          phone
        ) VALUES (
          v_job_site_id,
          v_contact->>'role',
          v_contact->>'name',
          NULLIF(v_contact->>'email', ''),
          NULLIF(v_contact->>'phone', '')
        );
      END LOOP;
    END IF;

    -- 5. Create subcontractor assignments
    FOR v_subcontractor IN SELECT * FROM jsonb_array_elements(p_subcontractors)
    LOOP
      v_employer_id := (v_subcontractor->'matchedEmployer'->>'id')::uuid;

      IF v_employer_id IS NULL THEN
        CONTINUE;
      END IF;

      -- Get trade type ID if provided
      v_trade_type_id := NULL;
      IF v_subcontractor ? 'trade_type_code' THEN
        SELECT id INTO v_trade_type_id
        FROM trade_types
        WHERE code = v_subcontractor->>'trade_type_code'
        LIMIT 1;
      END IF;

      -- Insert project assignment
      INSERT INTO project_assignments (
        project_id,
        employer_id,
        assignment_type,
        trade_type_id,
        source,
        match_status,
        match_confidence,
        match_notes
      ) VALUES (
        v_project_id,
        v_employer_id,
        'trade_work',
        v_trade_type_id,
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

    -- Return success
    RETURN jsonb_build_object(
      'success', true,
      'projectId', v_project_id,
      'jobSiteId', v_job_site_id
    );

  EXCEPTION
    WHEN OTHERS THEN
      -- Transaction will auto-rollback on exception
      RETURN jsonb_build_object(
        'error', SQLERRM,
        'status', 500
      );
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION create_project_from_scan(uuid, uuid, jsonb, jsonb, jsonb, jsonb) TO authenticated;

-- ==========================================
-- 3. Comments
-- ==========================================

COMMENT ON FUNCTION assign_contractor_role(uuid, uuid, text, text, boolean, text, numeric, text) IS
  'Assigns a contractor role to a project. Used internally by project creation workflows.';

COMMENT ON FUNCTION create_project_from_scan(uuid, uuid, jsonb, jsonb, jsonb, jsonb) IS
  'Creates a complete project from a mapping sheet scan, including job sites, contacts, and subcontractor assignments. Handles all operations in a transaction.';
