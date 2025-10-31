-- Migration: Audit & Compliance Public Forms
-- Adds support for shareable audit & compliance forms with employer selection

-- ==========================================
-- 1. Add metadata column to secure_access_tokens
-- ==========================================

ALTER TABLE secure_access_tokens 
ADD COLUMN IF NOT EXISTS metadata jsonb;

COMMENT ON COLUMN secure_access_tokens.metadata IS 'Stores additional context for tokens, e.g., selected employer IDs for audit compliance forms';

-- ==========================================
-- 2. Get Public Audit Form Data RPC
-- ==========================================

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

-- ==========================================
-- 3. Submit Public Audit Form RPC
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
    
    v_updated_count := v_updated_count + 1;
  END LOOP;
  
  -- Mark token as used
  UPDATE secure_access_tokens
  SET used_at = now()
  WHERE token = p_token;
  
  RETURN jsonb_build_object(
    'success', true,
    'updatedCount', v_updated_count,
    'message', 'Compliance data updated successfully'
  );
END;
$$;

-- Grant execute permissions to anon role for public access
GRANT EXECUTE ON FUNCTION get_public_audit_form_data(text) TO anon;
GRANT EXECUTE ON FUNCTION submit_public_audit_form(text, jsonb) TO anon;

