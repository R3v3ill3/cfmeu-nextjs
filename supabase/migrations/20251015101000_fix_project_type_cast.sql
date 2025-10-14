-- Ensure create_project_from_scan casts project_type correctly
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
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'error', 'Unauthorized',
      'status', 403
    );
  END IF;

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
        WHEN p_project_data ? 'project_type'
          AND NULLIF(p_project_data->>'project_type', '') IS NOT NULL
        THEN (p_project_data->>'project_type')::project_type
        ELSE NULL
      END,
      COALESCE((p_project_data->>'state_funding')::numeric, 0),
      COALESCE((p_project_data->>'federal_funding')::numeric, 0),
      CASE WHEN p_require_approval THEN 'pending' ELSE 'active' END,
      p_user_id
    )
    RETURNING id INTO v_project_id;

    IF p_require_approval THEN
      INSERT INTO approval_history (
        entity_type,
        entity_id,
        action,
        performed_by,
        previous_status,
        new_status,
        metadata
      ) VALUES (
        'project',
        v_project_id,
        'resubmitted',
        p_user_id,
        NULL,
        'pending',
        jsonb_build_object(
          'scan_id', p_scan_id,
          'source', 'scan_upload'
        )
      );
    END IF;

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
        full_address,
        latitude,
        longitude
      ) VALUES (
        v_project_id,
        COALESCE(p_project_data->>'name', 'Main Site'),
        true,
        v_address,
        v_address,
        (p_project_data->>'latitude')::numeric,
        (p_project_data->>'longitude')::numeric
      )
      RETURNING id INTO v_job_site_id;

      UPDATE projects
      SET main_job_site_id = v_job_site_id
      WHERE id = v_project_id;
    END IF;

    IF p_project_data ? 'builder' AND p_project_data->'builder' IS NOT NULL THEN
      v_builder_id := (p_project_data->'builder'->>'matchedEmployerId')::uuid;

      IF v_builder_id IS NULL AND (p_project_data->'builder'->>'createNew')::boolean THEN
        INSERT INTO employers (
          name,
          employer_type,
          website,
          notes,
          approval_status
        ) VALUES (
          p_project_data->'builder'->'newEmployerData'->>'name',
          p_project_data->'builder'->'newEmployerData'->>'employer_type',
          p_project_data->'builder'->'newEmployerData'->>'website',
          p_project_data->'builder'->'newEmployerData'->>'notes',
          CASE WHEN p_require_approval THEN 'pending' ELSE 'active' END
        )
        RETURNING id INTO v_builder_id;

        IF p_require_approval THEN
          INSERT INTO approval_history (
            entity_type,
            entity_id,
            action,
            performed_by,
            previous_status,
            new_status,
            metadata
          ) VALUES (
            'employer',
            v_builder_id,
            'resubmitted',
            p_user_id,
            NULL,
            'pending',
            jsonb_build_object(
              'scan_id', p_scan_id,
              'project_id', v_project_id,
              'source', 'scan_upload'
            )
          );
        END IF;
      END IF;

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

        UPDATE projects
        SET builder_id = v_builder_id
        WHERE id = v_project_id;
      END IF;
    END IF;

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

GRANT EXECUTE ON FUNCTION create_project_from_scan(uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean) TO authenticated;

COMMENT ON FUNCTION create_project_from_scan(uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean) IS
  'Creates a complete project from a mapping sheet scan. Supports approval workflow. Tracks creator to avoid RLS recursion. Ensures project_type values are cast to enum.';
