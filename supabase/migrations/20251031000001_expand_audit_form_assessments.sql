-- Expand Audit & Compliance Public Forms to Include All Track 1 Assessments
-- This adds Union Respect, Safety 4-Point, and Subcontractor Use assessments to the public form

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
  
  -- Get employers with ALL their current Track 1 assessment data
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'name', e.name,
      'currentCompliance', COALESCE(
        (
          SELECT to_jsonb(ecc.*)
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
      ),
      'currentUnionRespect', (
        SELECT jsonb_build_object(
          'criteria', jsonb_build_object(
            'right_of_entry', ura.right_of_entry_rating,
            'delegate_accommodation', ura.delegate_accommodation_rating,
            'access_to_information', ura.access_to_information_rating,
            'access_to_inductions', ura.access_to_inductions_rating,
            'eba_status', ura.eba_status_rating
          ),
          'overall_score', ura.overall_union_respect_rating,
          'notes', ura.notes,
          'assessment_date', ura.assessment_date
        )
        FROM union_respect_assessments_4point ura
        WHERE ura.employer_id = e.id
          AND ura.project_id = v_resource_id
        ORDER BY ura.assessment_date DESC
        LIMIT 1
      ),
      'currentSafety', (
        SELECT jsonb_build_object(
          'safety_criteria', jsonb_build_object(
            'safety_management_systems', sa.hsr_respect_rating,
            'incident_reporting', sa.safety_incidents_rating,
            'site_safety_culture', sa.general_safety_rating,
            'risk_assessment_processes', sa.general_safety_rating,
            'emergency_preparedness', sa.general_safety_rating,
            'worker_safety_training', sa.hsr_respect_rating
          ),
          'safety_metrics', jsonb_build_object(
            'lost_time_injuries', 0,
            'near_misses', 0,
            'safety_breaches', 0
          ),
          'overall_safety_score', sa.overall_safety_rating,
          'notes', sa.notes,
          'assessment_date', sa.assessment_date
        )
        FROM safety_assessments_4point sa
        WHERE sa.employer_id = e.id
          AND sa.project_id = v_resource_id
        ORDER BY sa.assessment_date DESC
        LIMIT 1
      ),
      'currentSubcontractor', (
        SELECT jsonb_build_object(
          'subcontracting_criteria', jsonb_build_object(
            'subcontractor_usage', sca.usage_rating,
            'payment_terms', sca.usage_rating,
            'treatment_of_subbies', sca.usage_rating
          ),
          'subcontractor_metrics', jsonb_build_object(
            'active_subcontractors', sca.subcontractor_count
          ),
          'notes', sca.notes,
          'assessment_date', sca.assessment_date
        )
        FROM subcontractor_assessments_4point sca
        WHERE sca.employer_id = e.id
          AND sca.project_id = v_resource_id
        ORDER BY sca.assessment_date DESC
        LIMIT 1
      )
    )
  )
  INTO v_employers
  FROM employers e
  WHERE e.id = ANY(v_employer_ids);
  
  -- Get submitted employers from metadata
  DECLARE v_submitted_employers jsonb;
  SELECT COALESCE(metadata->'submittedEmployers', '[]'::jsonb)
  INTO v_submitted_employers
  FROM secure_access_tokens
  WHERE token = p_token;

  -- Build complete response
  v_result := jsonb_build_object(
    'token', p_token,
    'resourceType', 'PROJECT_AUDIT_COMPLIANCE',
    'expiresAt', v_expires_at,
    'projectId', v_project.id,
    'projectName', v_project.name,
    'projectTier', v_project.tier,
    'projectValue', v_project.value,
    'employers', COALESCE(v_employers, '[]'::jsonb),
    'submittedEmployers', v_submitted_employers
  );
  
  RETURN v_result;
END;
$$;

-- Update submit function to handle all Track 1 assessments
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
        effective_from,
        updated_by
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
        now(),
        v_current_user_id
      );
    END IF;
    
    -- 2. Update Union Respect Assessment (if provided)
    IF v_updates ? 'unionRespect' THEN
      INSERT INTO union_respect_assessments_4point (
        project_id,
        employer_id,
        right_of_entry_rating,
        delegate_accommodation_rating,
        access_to_information_rating,
        access_to_inductions_rating,
        eba_status_rating,
        overall_union_respect_rating,
        confidence_level,
        notes,
        assessment_date,
        assessor_id
      ) VALUES (
        v_project_id,
        v_employer_id,
        COALESCE((v_updates->'unionRespect'->'criteria'->>'right_of_entry')::integer, 3),
        COALESCE((v_updates->'unionRespect'->'criteria'->>'delegate_accommodation')::integer, 3),
        COALESCE((v_updates->'unionRespect'->'criteria'->>'access_to_information')::integer, 3),
        COALESCE((v_updates->'unionRespect'->'criteria'->>'access_to_inductions')::integer, 3),
        COALESCE((v_updates->'unionRespect'->'criteria'->>'eba_status')::integer, 3),
        COALESCE((v_updates->'unionRespect'->>'overall_score')::integer, 3),
        'medium',
        v_updates->'unionRespect'->>'notes',
        COALESCE((v_updates->'unionRespect'->>'assessment_date')::date, CURRENT_DATE),
        v_current_user_id
      );
    END IF;
    
    -- 3. Update Safety 4-Point Assessment (if provided)
    IF v_updates ? 'safety' THEN
      INSERT INTO safety_assessments_4point (
        project_id,
        employer_id,
        hsr_respect_rating,
        general_safety_rating,
        safety_incidents_rating,
        overall_safety_rating,
        confidence_level,
        notes,
        assessment_date,
        assessor_id
      ) VALUES (
        v_project_id,
        v_employer_id,
        -- Map the 6 detailed criteria to the 3 simplified ratings
        COALESCE((v_updates->'safety'->'safety_criteria'->>'safety_management_systems')::integer, 3),
        COALESCE((v_updates->'safety'->'safety_criteria'->>'site_safety_culture')::integer, 3),
        COALESCE((v_updates->'safety'->'safety_criteria'->>'incident_reporting')::integer, 3),
        COALESCE((v_updates->'safety'->>'overall_safety_score')::integer, 3),
        'medium',
        v_updates->'safety'->>'notes',
        COALESCE((v_updates->'safety'->>'assessment_date')::date, CURRENT_DATE),
        v_current_user_id
      );
    END IF;
    
    -- 4. Update Subcontractor Use Assessment (if provided)
    IF v_updates ? 'subcontractor' THEN
      INSERT INTO subcontractor_assessments_4point (
        project_id,
        employer_id,
        usage_rating,
        subcontractor_count,
        confidence_level,
        notes,
        assessment_date,
        assessor_id
      ) VALUES (
        v_project_id,
        v_employer_id,
        -- Average the 3 criteria ratings into single usage rating
        ROUND((
          COALESCE((v_updates->'subcontractor'->'subcontracting_criteria'->>'subcontractor_usage')::integer, 3) +
          COALESCE((v_updates->'subcontractor'->'subcontracting_criteria'->>'payment_terms')::integer, 3) +
          COALESCE((v_updates->'subcontractor'->'subcontracting_criteria'->>'treatment_of_subbies')::integer, 3)
        ) / 3.0),
        COALESCE((v_updates->'subcontractor'->'subcontractor_metrics'->>'active_subcontractors')::integer, 0),
        'medium',
        v_updates->'subcontractor'->>'notes',
        COALESCE((v_updates->'subcontractor'->>'assessment_date')::date, CURRENT_DATE),
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
  
  -- Note: Token is NOT marked as used here - only when finalize is called
  
  RETURN jsonb_build_object(
    'success', true,
    'updatedCount', v_updated_count,
    'message', 'Compliance assessments updated successfully'
  );
END;
$$;

-- ==========================================
-- 4. Finalize Audit Form Token
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
  
  -- Mark token as used
  UPDATE secure_access_tokens
  SET used_at = now()
  WHERE token = p_token;
  
  RETURN jsonb_build_object(
    'success', true,
    'totalEmployers', v_total_count,
    'submittedEmployers', v_submitted_count,
    'message', format('Audit form completed. %s of %s employers assessed.', v_submitted_count, v_total_count)
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_public_audit_form_data(text) TO anon;
GRANT EXECUTE ON FUNCTION submit_public_audit_form(text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION finalize_audit_token(text) TO anon;

