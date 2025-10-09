-- Migration: Public Form API - RLS-backed RPCs
-- Removes need for service-role key in Next.js routes
-- F-001: Critical security fix

-- ==========================================
-- 1. Token Validation Helper Function
-- ==========================================

CREATE OR REPLACE FUNCTION validate_public_token(p_token text)
RETURNS TABLE (
  valid boolean,
  error_message text,
  resource_type text,
  resource_id uuid,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_record RECORD;
  v_now timestamptz;
BEGIN
  v_now := now();

  -- Fetch token record
  SELECT * INTO v_token_record
  FROM secure_access_tokens
  WHERE token = p_token;

  -- Token not found
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Token not found'::text, null::text, null::uuid, null::timestamptz;
    RETURN;
  END IF;

  -- Token expired
  IF v_token_record.expires_at < v_now THEN
    RETURN QUERY SELECT false, 'Token has expired'::text, null::text, null::uuid, null::timestamptz;
    RETURN;
  END IF;

  -- Token valid
  RETURN QUERY SELECT
    true,
    null::text,
    v_token_record.resource_type,
    v_token_record.resource_id,
    v_token_record.expires_at;
END;
$$;

-- ==========================================
-- 2. Get Public Form Data RPC
-- ==========================================

CREATE OR REPLACE FUNCTION get_public_form_data(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_validation RECORD;
  v_result jsonb;
  v_project RECORD;
  v_main_job_site_id uuid;
BEGIN
  -- Validate token
  SELECT * INTO v_validation
  FROM validate_public_token(p_token)
  LIMIT 1;

  IF NOT v_validation.valid THEN
    RETURN jsonb_build_object(
      'error', v_validation.error_message,
      'status', 404
    );
  END IF;

  -- Only handle PROJECT_MAPPING_SHEET for now
  IF v_validation.resource_type != 'PROJECT_MAPPING_SHEET' THEN
    RETURN jsonb_build_object(
      'error', 'Unsupported resource type',
      'status', 400
    );
  END IF;

  -- Fetch project data
  SELECT
    id, name, value, tier,
    proposed_start_date, proposed_finish_date,
    roe_email, project_type,
    COALESCE(state_funding, 0) as state_funding,
    COALESCE(federal_funding, 0) as federal_funding,
    main_job_site_id
  INTO v_project
  FROM projects
  WHERE id = v_validation.resource_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Project not found',
      'status', 404
    );
  END IF;

  v_main_job_site_id := v_project.main_job_site_id;

  -- Build response with project data
  v_result := jsonb_build_object(
    'token', p_token,
    'resourceType', v_validation.resource_type,
    'resourceId', v_validation.resource_id,
    'expiresAt', v_validation.expires_at,
    'allowedActions', jsonb_build_array('view', 'update'),
    'project', jsonb_build_object(
      'id', v_project.id,
      'name', v_project.name,
      'value', v_project.value,
      'tier', v_project.tier,
      'proposed_start_date', v_project.proposed_start_date,
      'proposed_finish_date', v_project.proposed_finish_date,
      'roe_email', v_project.roe_email,
      'project_type', v_project.project_type,
      'state_funding', v_project.state_funding,
      'federal_funding', v_project.federal_funding,
      'main_job_site_id', v_main_job_site_id,
      'address', (
        SELECT full_address
        FROM job_sites
        WHERE id = v_main_job_site_id
        LIMIT 1
      )
    )
  );

  -- Add site contacts if main job site exists
  IF v_main_job_site_id IS NOT NULL THEN
    v_result := v_result || jsonb_build_object(
      'siteContacts', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', id,
              'role', role,
              'name', name,
              'email', email,
              'phone', phone
            )
          )
          FROM site_contacts
          WHERE job_site_id = v_main_job_site_id
        ),
        '[]'::jsonb
      )
    );
  ELSE
    v_result := v_result || jsonb_build_object('siteContacts', '[]'::jsonb);
  END IF;

  -- Note: Full contractor roles and trade contractors data would require
  -- additional complex queries. For now, returning minimal data.
  -- The Next.js route will handle the complex aggregations using anon client
  -- with proper RLS policies (implemented separately if needed)

  RETURN v_result;
END;
$$;

-- Grant execute to anon users
GRANT EXECUTE ON FUNCTION validate_public_token(text) TO anon;
GRANT EXECUTE ON FUNCTION get_public_form_data(text) TO anon;

-- ==========================================
-- 2b. Helper: Get Contractor Roles for Public Form
-- ==========================================

CREATE OR REPLACE FUNCTION get_public_form_contractor_roles(
  p_token text,
  p_project_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_validation RECORD;
BEGIN
  -- Validate token and ensure it matches the project
  SELECT * INTO v_validation
  FROM validate_public_token(p_token)
  LIMIT 1;

  IF NOT v_validation.valid OR v_validation.resource_id != p_project_id THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Return contractor roles
  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pa.id,
          'employerId', pa.employer_id,
          'employerName', COALESCE(e.name, 'Unknown'),
          'roleLabel', COALESCE(crt.name, 'Other'),
          'roleCode', COALESCE(crt.code, 'other'),
          'ebaStatus', COALESCE(e.enterprise_agreement_status, false),
          'dataSource', pa.source,
          'matchStatus', pa.match_status
        )
      )
      FROM project_assignments pa
      LEFT JOIN employers e ON e.id = pa.employer_id
      LEFT JOIN contractor_role_types crt ON crt.id = pa.contractor_role_type_id
      WHERE pa.project_id = p_project_id
        AND pa.assignment_type = 'contractor_role'
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_form_contractor_roles(text, uuid) TO anon;

-- ==========================================
-- 2c. Helper: Get Trade Contractors for Public Form
-- ==========================================

CREATE OR REPLACE FUNCTION get_public_form_trade_contractors(
  p_token text,
  p_project_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_validation RECORD;
BEGIN
  -- Validate token and ensure it matches the project
  SELECT * INTO v_validation
  FROM validate_public_token(p_token)
  LIMIT 1;

  IF NOT v_validation.valid OR v_validation.resource_id != p_project_id THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Return trade contractors from project_assignments
  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', 'assignment_trade:' || pa.id::text,
          'employerId', pa.employer_id,
          'employerName', COALESCE(e.name, 'Unknown'),
          'tradeType', COALESCE(pa.trade_type, 'other'),
          'tradeLabel', COALESCE(tt.name, replace(replace(COALESCE(pa.trade_type, 'other'), '_', ' '), initcap(replace(COALESCE(pa.trade_type, 'other'), '_', ' ')), initcap(replace(COALESCE(pa.trade_type, 'other'), '_', ' ')))),
          'stage', CASE
            WHEN pa.trade_type IN ('demolition', 'earthworks', 'piling', 'excavations', 'scaffolding', 'traffic_control', 'traffic_management', 'waste_management', 'cleaning', 'labour_hire') THEN 'early_works'
            WHEN pa.trade_type IN ('tower_crane', 'mobile_crane', 'crane_and_rigging', 'concrete', 'concreting', 'form_work', 'reinforcing_steel', 'steel_fixing', 'post_tensioning', 'structural_steel', 'bricklaying', 'foundations') THEN 'structure'
            WHEN pa.trade_type IN ('carpentry', 'electrical', 'plumbing', 'mechanical_services', 'painting', 'plastering', 'waterproofing', 'tiling', 'flooring', 'roofing', 'windows', 'facade', 'glazing', 'kitchens', 'landscaping', 'final_clean', 'insulation', 'internal_walls', 'ceilings', 'stairs_balustrades', 'fire_protection', 'security_systems', 'building_services', 'fitout', 'technology') THEN 'finishing'
            ELSE 'other'
          END,
          'estimatedWorkforce', pa.estimated_workforce,
          'ebaStatus', COALESCE(e.enterprise_agreement_status, false),
          'dataSource', pa.source,
          'matchStatus', pa.match_status
        )
      )
      FROM project_assignments pa
      LEFT JOIN employers e ON e.id = pa.employer_id
      LEFT JOIN trade_types tt ON tt.code = pa.trade_type
      WHERE pa.project_id = p_project_id
        AND pa.assignment_type = 'trade_work'
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_form_trade_contractors(text, uuid) TO anon;

-- ==========================================
-- 2d. Helper: Get Reference Data for Public Form
-- ==========================================

CREATE OR REPLACE FUNCTION get_public_form_reference_data(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_validation RECORD;
BEGIN
  -- Validate token
  SELECT * INTO v_validation
  FROM validate_public_token(p_token)
  LIMIT 1;

  IF NOT v_validation.valid THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Return reference data
  RETURN jsonb_build_object(
    'employers', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', id,
            'name', name,
            'enterprise_agreement_status', enterprise_agreement_status
          )
        )
        FROM (
          SELECT id, name, enterprise_agreement_status
          FROM employers
          ORDER BY name
          LIMIT 1000
        ) e
      ),
      '[]'::jsonb
    ),
    'contractorRoleTypes', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', id,
            'code', code,
            'name', name
          )
        )
        FROM contractor_role_types
        ORDER BY name
      ),
      '[]'::jsonb
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_form_reference_data(text) TO anon;

-- ==========================================
-- 3. Submit Public Form RPC
-- ==========================================

CREATE OR REPLACE FUNCTION submit_public_form(
  p_token text,
  p_submission jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_validation RECORD;
  v_project_id uuid;
  v_main_job_site_id uuid;
  v_contact jsonb;
  v_update jsonb;
BEGIN
  -- Validate token
  SELECT * INTO v_validation
  FROM validate_public_token(p_token)
  LIMIT 1;

  IF NOT v_validation.valid THEN
    RETURN jsonb_build_object(
      'error', v_validation.error_message,
      'status', 404
    );
  END IF;

  IF v_validation.resource_type != 'PROJECT_MAPPING_SHEET' THEN
    RETURN jsonb_build_object(
      'error', 'Unsupported resource type',
      'status', 400
    );
  END IF;

  v_project_id := v_validation.resource_id;

  -- Get main job site ID
  SELECT main_job_site_id INTO v_main_job_site_id
  FROM projects
  WHERE id = v_project_id;

  -- Handle project updates
  IF p_submission ? 'projectUpdates' AND p_submission->'projectUpdates' != 'null'::jsonb THEN
    UPDATE projects
    SET
      name = COALESCE((p_submission->'projectUpdates'->>'name')::text, name),
      value = COALESCE((p_submission->'projectUpdates'->>'value')::numeric, value),
      proposed_start_date = COALESCE((p_submission->'projectUpdates'->>'proposed_start_date')::date, proposed_start_date),
      proposed_finish_date = COALESCE((p_submission->'projectUpdates'->>'proposed_finish_date')::date, proposed_finish_date),
      project_type = COALESCE((p_submission->'projectUpdates'->>'project_type')::text, project_type),
      state_funding = COALESCE((p_submission->'projectUpdates'->>'state_funding')::numeric, state_funding),
      federal_funding = COALESCE((p_submission->'projectUpdates'->>'federal_funding')::numeric, federal_funding),
      roe_email = COALESCE((p_submission->'projectUpdates'->>'roe_email')::text, roe_email)
    WHERE id = v_project_id;
  END IF;

  -- Handle address updates
  IF p_submission ? 'addressUpdate' AND v_main_job_site_id IS NOT NULL THEN
    UPDATE job_sites
    SET
      full_address = (p_submission->>'addressUpdate')::text,
      location = (p_submission->>'addressUpdate')::text
    WHERE id = v_main_job_site_id;
  END IF;

  -- Handle site contact updates
  IF p_submission ? 'siteContactUpdates' AND v_main_job_site_id IS NOT NULL THEN
    FOR v_contact IN SELECT * FROM jsonb_array_elements(p_submission->'siteContactUpdates')
    LOOP
      IF v_contact ? 'id' AND v_contact->>'id' != '' THEN
        -- Update existing contact
        UPDATE site_contacts
        SET
          role = v_contact->>'role',
          name = trim(v_contact->>'name'),
          email = NULLIF(v_contact->>'email', ''),
          phone = NULLIF(v_contact->>'phone', '')
        WHERE id = (v_contact->>'id')::uuid;
      ELSE
        -- Insert new contact
        INSERT INTO site_contacts (job_site_id, role, name, email, phone)
        VALUES (
          v_main_job_site_id,
          v_contact->>'role',
          trim(v_contact->>'name'),
          NULLIF(v_contact->>'email', ''),
          NULLIF(v_contact->>'phone', '')
        );
      END IF;
    END LOOP;
  END IF;

  -- Mark token as used
  UPDATE secure_access_tokens
  SET used_at = now()
  WHERE token = p_token;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Form submitted successfully'
  );
END;
$$;

-- Grant execute to anon users
GRANT EXECUTE ON FUNCTION submit_public_form(text, jsonb) TO anon;

-- ==========================================
-- 3b. Handle Contractor Role Updates
-- ==========================================

CREATE OR REPLACE FUNCTION handle_contractor_role_updates(
  p_token text,
  p_project_id uuid,
  p_updates jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_validation RECORD;
  v_update jsonb;
  v_role_type_id uuid;
BEGIN
  -- Validate token
  SELECT * INTO v_validation
  FROM validate_public_token(p_token)
  LIMIT 1;

  IF NOT v_validation.valid OR v_validation.resource_id != p_project_id THEN
    RETURN jsonb_build_object('error', 'Invalid token', 'status', 403);
  END IF;

  -- Process each update
  FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    CASE v_update->>'action'
      WHEN 'create' THEN
        -- Get contractor role type ID from code
        SELECT id INTO v_role_type_id
        FROM contractor_role_types
        WHERE code = v_update->>'roleCode'
        LIMIT 1;

        IF v_role_type_id IS NOT NULL THEN
          INSERT INTO project_assignments (
            project_id, employer_id, assignment_type,
            contractor_role_type_id, source, match_status
          ) VALUES (
            p_project_id,
            (v_update->>'employerId')::uuid,
            'contractor_role',
            v_role_type_id,
            'public_form',
            'manual'
          );
        END IF;

      WHEN 'update' THEN
        UPDATE project_assignments
        SET
          employer_id = (v_update->>'employerId')::uuid,
          match_status = 'delegate_confirmed',
          confirmed_at = now()
        WHERE id = (v_update->>'id')::uuid
          AND project_id = p_project_id;

      WHEN 'confirm_match' THEN
        UPDATE project_assignments
        SET
          match_status = 'delegate_confirmed',
          confirmed_at = now()
        WHERE id = (v_update->>'id')::uuid
          AND project_id = p_project_id;

      WHEN 'mark_wrong' THEN
        UPDATE project_assignments
        SET
          match_status = 'incorrect_via_delegate',
          confirmed_at = now()
        WHERE id = (v_update->>'id')::uuid
          AND project_id = p_project_id;

      WHEN 'delete' THEN
        DELETE FROM project_assignments
        WHERE id = (v_update->>'id')::uuid
          AND project_id = p_project_id;
    END CASE;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION handle_contractor_role_updates(text, uuid, jsonb) TO anon;

-- ==========================================
-- 3c. Handle Trade Contractor Updates
-- ==========================================

CREATE OR REPLACE FUNCTION handle_trade_contractor_updates(
  p_token text,
  p_project_id uuid,
  p_updates jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_validation RECORD;
  v_update jsonb;
BEGIN
  -- Validate token
  SELECT * INTO v_validation
  FROM validate_public_token(p_token)
  LIMIT 1;

  IF NOT v_validation.valid OR v_validation.resource_id != p_project_id THEN
    RETURN jsonb_build_object('error', 'Invalid token', 'status', 403);
  END IF;

  -- Process each update
  FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    CASE v_update->>'action'
      WHEN 'create' THEN
        INSERT INTO project_assignments (
          project_id, employer_id, assignment_type,
          trade_type, estimated_workforce, source, match_status
        ) VALUES (
          p_project_id,
          (v_update->>'employerId')::uuid,
          'trade_work',
          v_update->>'tradeType',
          (v_update->>'estimatedWorkforce')::integer,
          'public_form',
          'manual'
        );

      WHEN 'update' THEN
        UPDATE project_assignments
        SET
          employer_id = COALESCE((v_update->>'employerId')::uuid, employer_id),
          estimated_workforce = COALESCE((v_update->>'estimatedWorkforce')::integer, estimated_workforce),
          match_status = 'delegate_confirmed',
          confirmed_at = now()
        WHERE id = (v_update->>'id')::uuid
          AND project_id = p_project_id;

      WHEN 'confirm_match' THEN
        UPDATE project_assignments
        SET
          match_status = 'delegate_confirmed',
          confirmed_at = now()
        WHERE id = (v_update->>'id')::uuid
          AND project_id = p_project_id;

      WHEN 'mark_wrong' THEN
        UPDATE project_assignments
        SET
          match_status = 'incorrect_via_delegate',
          confirmed_at = now()
        WHERE id = (v_update->>'id')::uuid
          AND project_id = p_project_id;

      WHEN 'delete' THEN
        DELETE FROM project_assignments
        WHERE id = (v_update->>'id')::uuid
          AND project_id = p_project_id;
    END CASE;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION handle_trade_contractor_updates(text, uuid, jsonb) TO anon;

-- ==========================================
-- 4. Help Chat Logging RPC (F-011)
-- ==========================================

CREATE OR REPLACE FUNCTION log_help_interaction(
  p_user_id uuid,
  p_question text,
  p_answer text,
  p_confidence numeric,
  p_context jsonb,
  p_sources jsonb,
  p_ai_provider text,
  p_tokens_used integer,
  p_response_time_ms integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the authenticated user matches the p_user_id
  -- This ensures users can only log their own interactions
  IF auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'error', 'Unauthorized',
      'status', 403
    );
  END IF;

  -- Insert interaction log
  INSERT INTO help_interactions (
    user_id,
    question,
    answer,
    confidence,
    context,
    sources,
    ai_provider,
    tokens_used,
    response_time_ms
  ) VALUES (
    p_user_id,
    p_question,
    p_answer,
    p_confidence,
    p_context,
    p_sources,
    p_ai_provider,
    p_tokens_used,
    p_response_time_ms
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION log_help_interaction(uuid, text, text, numeric, jsonb, jsonb, text, integer, integer) TO authenticated;

-- ==========================================
-- 5. Comments
-- ==========================================

COMMENT ON FUNCTION validate_public_token IS
  'Validates a public access token and returns resource information. Used by public form APIs.';

COMMENT ON FUNCTION get_public_form_data IS
  'Fetches public form data for a valid token. Returns minimal project data securely without service-role key.';

COMMENT ON FUNCTION submit_public_form IS
  'Submits public form updates for a valid token. Handles project, address, and site contact updates securely.';

COMMENT ON FUNCTION log_help_interaction IS
  'Logs a help chat interaction. Used by help chat API to avoid service-role key exposure. Validates that user can only log their own interactions.';
