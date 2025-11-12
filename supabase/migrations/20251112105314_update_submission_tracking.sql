-- Migration: Update Submission Tracking
-- Updates RPC functions to track viewed_at, submitted_at, and store submission_data

-- ==========================================
-- 1. Update validate_public_token to track views
-- ==========================================

-- First, check if validate_public_token exists and what it returns
-- We'll create a wrapper function that tracks views

CREATE OR REPLACE FUNCTION track_token_view(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update viewed_at on first view, increment view_count
  UPDATE secure_access_tokens
  SET 
    viewed_at = COALESCE(viewed_at, now()),
    view_count = view_count + 1,
    updated_at = now()
  WHERE token = p_token
    AND expires_at > now();
END;
$$;

-- ==========================================
-- 2. Update submit_public_audit_form to track submissions
-- ==========================================

CREATE OR REPLACE FUNCTION submit_public_audit_form(
  p_token text,
  p_submission jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_valid boolean;
  v_error_message text;
  v_resource_type text;
  v_resource_id uuid;
  v_allowed_employer_ids uuid[];
  v_update RECORD;
  v_employer_id uuid;
  v_updates jsonb;
  v_project_id uuid;
  v_updated_count integer := 0;
  v_current_user_id uuid;
BEGIN
  -- Validate token (returns TABLE, so select into variables)
  SELECT 
    valid, 
    error_message, 
    resource_type, 
    resource_id
  INTO 
    v_valid,
    v_error_message,
    v_resource_type,
    v_resource_id
  FROM validate_public_token(p_token)
  LIMIT 1;
  
  IF NOT v_valid THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', v_error_message
    );
  END IF;
  
  -- Ensure resource type is correct
  IF v_resource_type != 'PROJECT_AUDIT_COMPLIANCE' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid resource type'
    );
  END IF;
  
  v_project_id := v_resource_id;
  
  -- Get the user who created the token (for audit trail)
  SELECT created_by INTO v_current_user_id
  FROM secure_access_tokens
  WHERE token = p_token;
  
  -- Get allowed employer IDs from token metadata
  SELECT ARRAY(
    SELECT jsonb_array_elements_text(metadata->'employerIds')
  )::uuid[]
  INTO v_allowed_employer_ids
  FROM secure_access_tokens
  WHERE token = p_token;
  
  -- Process each employer compliance update
  FOR v_update IN 
    SELECT * FROM jsonb_array_elements(p_submission->'employerComplianceUpdates')
  LOOP
    v_employer_id := (v_update.value->>'employerId')::uuid;
    v_updates := v_update.value->'updates';
    
    -- Security check: ensure employer is in allowed list
    IF NOT (v_employer_id = ANY(v_allowed_employer_ids)) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Unauthorized employer access'
      );
    END IF;
    
    -- 1. Update CBUS/INCOLINK compliance checks
    IF v_updates ? 'cbus_check_conducted' OR v_updates ? 'incolink_check_conducted' THEN
      -- Mark existing current records as historical
      UPDATE employer_compliance_checks
      SET is_current = false,
          effective_to = now()
      WHERE project_id = v_project_id
        AND employer_id = v_employer_id
        AND is_current = true;
      
      -- Insert new compliance record
      INSERT INTO employer_compliance_checks (
        project_id,
        employer_id,
        cbus_check_conducted,
        cbus_check_date,
        cbus_checked_by,
        cbus_payment_status,
        cbus_payment_timing,
        cbus_worker_count_status,
        cbus_enforcement_flag,
        cbus_followup_required,
        cbus_notes,
        incolink_check_conducted,
        incolink_check_date,
        incolink_checked_by,
        incolink_payment_status,
        incolink_payment_timing,
        incolink_worker_count_status,
        incolink_enforcement_flag,
        incolink_followup_required,
        incolink_notes,
        incolink_company_id,
        version,
        is_current,
        effective_from
      ) VALUES (
        v_project_id,
        v_employer_id,
        COALESCE((v_updates->>'cbus_check_conducted')::boolean, false),
        (v_updates->>'cbus_check_date')::date,
        CASE 
          WHEN v_updates->'cbus_checked_by' IS NOT NULL 
          THEN ARRAY(SELECT jsonb_array_elements_text(v_updates->'cbus_checked_by'))
          ELSE NULL
        END,
        v_updates->>'cbus_payment_status',
        v_updates->>'cbus_payment_timing',
        v_updates->>'cbus_worker_count_status',
        COALESCE((v_updates->>'cbus_enforcement_flag')::boolean, false),
        COALESCE((v_updates->>'cbus_followup_required')::boolean, false),
        v_updates->>'cbus_notes',
        COALESCE((v_updates->>'incolink_check_conducted')::boolean, false),
        (v_updates->>'incolink_check_date')::date,
        CASE 
          WHEN v_updates->'incolink_checked_by' IS NOT NULL 
          THEN ARRAY(SELECT jsonb_array_elements_text(v_updates->'incolink_checked_by'))
          ELSE NULL
        END,
        v_updates->>'incolink_payment_status',
        v_updates->>'incolink_payment_timing',
        v_updates->>'incolink_worker_count_status',
        COALESCE((v_updates->>'incolink_enforcement_flag')::boolean, false),
        COALESCE((v_updates->>'incolink_followup_required')::boolean, false),
        v_updates->>'incolink_notes',
        v_updates->>'incolink_company_id',
        1,
        true,
        now()
      );
    END IF;
    
    -- 2. Handle Union Respect assessments
    IF v_updates ? 'union_respect' THEN
      INSERT INTO union_respect_assessments (
        employer_id,
        project_id,
        criteria,
        additional_comments,
        supporting_evidence,
        notes,
        assessment_date,
        created_by
      ) VALUES (
        v_employer_id,
        v_project_id,
        v_updates->'union_respect'->'criteria',
        v_updates->'union_respect'->>'additional_comments',
        v_updates->'union_respect'->'supporting_evidence',
        v_updates->'union_respect'->>'notes',
        COALESCE((v_updates->'union_respect'->>'assessment_date')::date, CURRENT_DATE),
        v_current_user_id
      );
    END IF;
    
    -- 3. Handle Safety 4-Point assessments
    IF v_updates ? 'safety_4_point' THEN
      INSERT INTO safety_4_point_assessments (
        employer_id,
        project_id,
        safety_criteria,
        safety_metrics,
        audit_compliance,
        notes,
        assessment_date,
        created_by
      ) VALUES (
        v_employer_id,
        v_project_id,
        v_updates->'safety_4_point'->'safety_criteria',
        v_updates->'safety_4_point'->'safety_metrics',
        v_updates->'safety_4_point'->'audit_compliance',
        v_updates->'safety_4_point'->>'notes',
        COALESCE((v_updates->'safety_4_point'->>'assessment_date')::date, CURRENT_DATE),
        v_current_user_id
      );
    END IF;
    
    -- 4. Handle Subcontractor Use assessments
    IF v_updates ? 'subcontractor_use' THEN
      INSERT INTO subcontractor_use_assessments (
        employer_id,
        project_id,
        subcontracting_criteria,
        subcontractor_metrics,
        compliance_records,
        notes,
        assessment_date,
        created_by
      ) VALUES (
        v_employer_id,
        v_project_id,
        v_updates->'subcontractor_use'->'subcontracting_criteria',
        v_updates->'subcontractor_use'->'subcontractor_metrics',
        v_updates->'subcontractor_use'->'compliance_records',
        v_updates->'subcontractor_use'->>'notes',
        COALESCE((v_updates->'subcontractor_use'->>'assessment_date')::date, CURRENT_DATE),
        v_current_user_id
      );
    END IF;
    
    -- Track this employer as submitted in token metadata
    UPDATE secure_access_tokens
    SET metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{submittedEmployers}',
      COALESCE(
        metadata->'submittedEmployers',
        '[]'::jsonb
      ) || to_jsonb(ARRAY[v_employer_id::text])
    )
    WHERE token = p_token
      -- Only add if not already in the array
      AND NOT (metadata->'submittedEmployers' @> to_jsonb(ARRAY[v_employer_id::text]));
    
    v_updated_count := v_updated_count + 1;
  END LOOP;
  
  -- Update token with submission tracking (but don't mark as fully used until finalize)
  UPDATE secure_access_tokens
  SET 
    submission_count = submission_count + 1,
    submission_data = COALESCE(submission_data, '{}'::jsonb) || p_submission,
    updated_at = now()
  WHERE token = p_token;
  
  RETURN jsonb_build_object(
    'success', true,
    'updatedCount', v_updated_count,
    'message', 'Compliance assessments updated successfully'
  );
END;
$$;

-- ==========================================
-- 3. Update finalize_audit_token to set submitted_at
-- ==========================================

CREATE OR REPLACE FUNCTION finalize_audit_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_valid boolean;
  v_error_message text;
  v_resource_type text;
  v_employer_ids uuid[];
  v_submitted_employers jsonb;
  v_submitted_count integer;
  v_total_count integer;
BEGIN
  -- Validate token
  SELECT valid, error_message, resource_type
  INTO v_valid, v_error_message, v_resource_type
  FROM validate_public_token(p_token)
  LIMIT 1;
  
  IF NOT v_valid THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', v_error_message
    );
  END IF;
  
  -- Get metadata
  SELECT 
    ARRAY(SELECT jsonb_array_elements_text(metadata->'employerIds'))::uuid[],
    COALESCE(metadata->'submittedEmployers', '[]'::jsonb)
  INTO v_employer_ids, v_submitted_employers
  FROM secure_access_tokens
  WHERE token = p_token;
  
  v_total_count := array_length(v_employer_ids, 1);
  v_submitted_count := jsonb_array_length(v_submitted_employers);
  
  -- Mark token as used and set submitted_at
  UPDATE secure_access_tokens
  SET 
    used_at = now(),
    submitted_at = COALESCE(submitted_at, now()),
    updated_at = now()
  WHERE token = p_token;
  
  RETURN jsonb_build_object(
    'success', true,
    'totalEmployers', v_total_count,
    'submittedEmployers', v_submitted_count,
    'message', format('Audit form completed. %s of %s employers assessed.', v_submitted_count, v_total_count)
  );
END;
$$;

-- ==========================================
-- 4. Update get_public_audit_form_data to track views
-- ==========================================

-- We'll update the function to call track_token_view
CREATE OR REPLACE FUNCTION get_public_audit_form_data(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_valid boolean;
  v_error_message text;
  v_resource_type text;
  v_resource_id uuid;
  v_expires_at timestamptz;
  v_project RECORD;
  v_employer_ids uuid[];
  v_employers jsonb;
  v_result jsonb;
BEGIN
  -- Track view
  PERFORM track_token_view(p_token);
  
  -- Validate token (returns TABLE, so select into variables)
  SELECT 
    valid, 
    error_message, 
    resource_type, 
    resource_id, 
    expires_at
  INTO 
    v_valid,
    v_error_message,
    v_resource_type,
    v_resource_id,
    v_expires_at
  FROM validate_public_token(p_token)
  LIMIT 1;
  
  IF NOT v_valid THEN
    RETURN jsonb_build_object(
      'error', v_error_message, 
      'status', 403
    );
  END IF;
  
  -- Ensure resource type is correct
  IF v_resource_type != 'PROJECT_AUDIT_COMPLIANCE' THEN
    RETURN jsonb_build_object(
      'error', 'Invalid resource type for audit compliance form',
      'status', 400
    );
  END IF;
  
  -- Extract employer IDs from metadata
  SELECT ARRAY(
    SELECT jsonb_array_elements_text(metadata->'employerIds')
  )::uuid[]
  INTO v_employer_ids
  FROM secure_access_tokens
  WHERE token = p_token;
  
  -- Validate at least one employer is selected
  IF v_employer_ids IS NULL OR array_length(v_employer_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'No employers selected for this audit form',
      'status', 400
    );
  END IF;
  
  -- Get project information
  SELECT 
    id,
    name,
    tier,
    value
  INTO v_project
  FROM projects
  WHERE id = v_resource_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Project not found',
      'status', 404
    );
  END IF;
  
  -- Get employers with their current compliance data
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'name', e.name,
      'currentCompliance', COALESCE(
        (
          SELECT row_to_json(ecc.*)
          FROM employer_compliance_checks ecc
          WHERE ecc.employer_id = e.id
            AND ecc.project_id = v_resource_id
            AND ecc.is_current = true
          ORDER BY ecc.created_at DESC
          LIMIT 1
        ),
        jsonb_build_object(
          'cbus_check_conducted', false,
          'incolink_check_conducted', false,
          'cbus_enforcement_flag', false,
          'incolink_enforcement_flag', false,
          'cbus_followup_required', false,
          'incolink_followup_required', false
        )
      )
    )
  )
  INTO v_employers
  FROM employers e
  WHERE e.id = ANY(v_employer_ids);
  
  -- Build complete response
  v_result := jsonb_build_object(
    'token', p_token,
    'resourceType', 'PROJECT_AUDIT_COMPLIANCE',
    'expiresAt', v_expires_at,
    'projectId', v_project.id,
    'projectName', v_project.name,
    'projectTier', v_project.tier,
    'projectValue', v_project.value,
    'employers', COALESCE(v_employers, '[]'::jsonb)
  );
  
  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION track_token_view(text) TO anon;
GRANT EXECUTE ON FUNCTION submit_public_audit_form(text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION finalize_audit_token(text) TO anon;
GRANT EXECUTE ON FUNCTION get_public_audit_form_data(text) TO anon;

