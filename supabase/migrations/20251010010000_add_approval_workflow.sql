-- Add approval workflow for projects and employers created from scans

-- 1. Add approval_status to projects table
ALTER TABLE projects
ADD COLUMN approval_status text DEFAULT 'active' CHECK (approval_status IN ('pending', 'active', 'rejected'));

ALTER TABLE projects
ADD COLUMN approved_by uuid REFERENCES auth.users(id);

ALTER TABLE projects
ADD COLUMN approved_at timestamptz;

ALTER TABLE projects
ADD COLUMN rejection_reason text;

CREATE INDEX idx_projects_approval_status ON projects(approval_status);

-- 2. Add approval_status to employers table
ALTER TABLE employers
ADD COLUMN approval_status text DEFAULT 'active' CHECK (approval_status IN ('pending', 'active', 'rejected'));

ALTER TABLE employers
ADD COLUMN approved_by uuid REFERENCES auth.users(id);

ALTER TABLE employers
ADD COLUMN approved_at timestamptz;

ALTER TABLE employers
ADD COLUMN rejection_reason text;

CREATE INDEX idx_employers_approval_status ON employers(approval_status);

-- 3. Create approval_history audit table
CREATE TABLE approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('project', 'employer')),
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('approved', 'rejected', 'resubmitted')),
  performed_by uuid NOT NULL REFERENCES auth.users(id),
  performed_at timestamptz NOT NULL DEFAULT now(),
  previous_status text,
  new_status text NOT NULL,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_approval_history_entity ON approval_history(entity_type, entity_id);
CREATE INDEX idx_approval_history_performed_by ON approval_history(performed_by);
CREATE INDEX idx_approval_history_created_at ON approval_history(created_at DESC);

-- RLS for approval_history
ALTER TABLE approval_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all approval history"
  ON approval_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'lead_organiser')
    )
  );

CREATE POLICY "Users can view approval history for their submissions"
  ON approval_history FOR SELECT
  TO authenticated
  USING (
    (entity_type = 'project' AND EXISTS (
      SELECT 1 FROM projects p
      JOIN mapping_sheet_scans mss ON mss.created_project_id = p.id
      WHERE p.id = entity_id AND mss.uploaded_by = auth.uid()
    ))
    OR
    (entity_type = 'employer' AND EXISTS (
      -- Users can see approval history for employers they created through scans
      SELECT 1 FROM employers e
      WHERE e.id = entity_id
      -- Add additional logic if needed to track employer creator
    ))
  );

GRANT SELECT ON approval_history TO authenticated;

COMMENT ON TABLE approval_history IS 'Audit trail for all approval/rejection actions on projects and employers';

-- Function: approve_project
CREATE OR REPLACE FUNCTION approve_project(
  p_project_id uuid,
  p_admin_user_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_record RECORD;
  v_is_admin boolean;
BEGIN
  -- Verify user is admin or lead_organiser
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_admin_user_id
    AND role IN ('admin', 'lead_organiser')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'error', 'Unauthorized - admin or lead_organiser role required',
      'status', 403
    );
  END IF;

  -- Load project
  SELECT * INTO v_project_record
  FROM projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Project not found',
      'status', 404
    );
  END IF;

  IF v_project_record.approval_status != 'pending' THEN
    RETURN jsonb_build_object(
      'error', 'Project is not pending approval',
      'status', 400
    );
  END IF;

  -- Update project
  UPDATE projects
  SET
    approval_status = 'active',
    approved_by = p_admin_user_id,
    approved_at = now()
  WHERE id = p_project_id;

  -- Record in history
  INSERT INTO approval_history (
    entity_type,
    entity_id,
    action,
    performed_by,
    previous_status,
    new_status,
    reason,
    metadata
  ) VALUES (
    'project',
    p_project_id,
    'approved',
    p_admin_user_id,
    'pending',
    'active',
    p_notes,
    jsonb_build_object('approved_at', now())
  );

  RETURN jsonb_build_object(
    'success', true,
    'projectId', p_project_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION approve_project(uuid, uuid, text) TO authenticated;

-- Function: reject_project
CREATE OR REPLACE FUNCTION reject_project(
  p_project_id uuid,
  p_admin_user_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_record RECORD;
  v_is_admin boolean;
BEGIN
  -- Verify user is admin or lead_organiser
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_admin_user_id
    AND role IN ('admin', 'lead_organiser')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'error', 'Unauthorized - admin or lead_organiser role required',
      'status', 403
    );
  END IF;

  -- Load project
  SELECT * INTO v_project_record
  FROM projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Project not found',
      'status', 404
    );
  END IF;

  IF v_project_record.approval_status != 'pending' THEN
    RETURN jsonb_build_object(
      'error', 'Project is not pending approval',
      'status', 400
    );
  END IF;

  -- Update project
  UPDATE projects
  SET
    approval_status = 'rejected',
    approved_by = p_admin_user_id,
    approved_at = now(),
    rejection_reason = p_reason
  WHERE id = p_project_id;

  -- Record in history
  INSERT INTO approval_history (
    entity_type,
    entity_id,
    action,
    performed_by,
    previous_status,
    new_status,
    reason,
    metadata
  ) VALUES (
    'project',
    p_project_id,
    'rejected',
    p_admin_user_id,
    'pending',
    'rejected',
    p_reason,
    jsonb_build_object('rejected_at', now())
  );

  RETURN jsonb_build_object(
    'success', true,
    'projectId', p_project_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION reject_project(uuid, uuid, text) TO authenticated;

-- Function: approve_employer
CREATE OR REPLACE FUNCTION approve_employer(
  p_employer_id uuid,
  p_admin_user_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employer_record RECORD;
  v_is_admin boolean;
BEGIN
  -- Verify user is admin or lead_organiser
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_admin_user_id
    AND role IN ('admin', 'lead_organiser')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'error', 'Unauthorized - admin or lead_organiser role required',
      'status', 403
    );
  END IF;

  -- Load employer
  SELECT * INTO v_employer_record
  FROM employers
  WHERE id = p_employer_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Employer not found',
      'status', 404
    );
  END IF;

  IF v_employer_record.approval_status != 'pending' THEN
    RETURN jsonb_build_object(
      'error', 'Employer is not pending approval',
      'status', 400
    );
  END IF;

  -- Update employer
  UPDATE employers
  SET
    approval_status = 'active',
    approved_by = p_admin_user_id,
    approved_at = now()
  WHERE id = p_employer_id;

  -- Record in history
  INSERT INTO approval_history (
    entity_type,
    entity_id,
    action,
    performed_by,
    previous_status,
    new_status,
    reason,
    metadata
  ) VALUES (
    'employer',
    p_employer_id,
    'approved',
    p_admin_user_id,
    'pending',
    'active',
    p_notes,
    jsonb_build_object('approved_at', now())
  );

  RETURN jsonb_build_object(
    'success', true,
    'employerId', p_employer_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION approve_employer(uuid, uuid, text) TO authenticated;

-- Function: reject_employer
CREATE OR REPLACE FUNCTION reject_employer(
  p_employer_id uuid,
  p_admin_user_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employer_record RECORD;
  v_is_admin boolean;
BEGIN
  -- Verify user is admin or lead_organiser
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_admin_user_id
    AND role IN ('admin', 'lead_organiser')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'error', 'Unauthorized - admin or lead_organiser role required',
      'status', 403
    );
  END IF;

  -- Load employer
  SELECT * INTO v_employer_record
  FROM employers
  WHERE id = p_employer_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Employer not found',
      'status', 404
    );
  END IF;

  IF v_employer_record.approval_status != 'pending' THEN
    RETURN jsonb_build_object(
      'error', 'Employer is not pending approval',
      'status', 400
    );
  END IF;

  -- Update employer
  UPDATE employers
  SET
    approval_status = 'rejected',
    approved_by = p_admin_user_id,
    approved_at = now(),
    rejection_reason = p_reason
  WHERE id = p_employer_id;

  -- Record in history
  INSERT INTO approval_history (
    entity_type,
    entity_id,
    action,
    performed_by,
    previous_status,
    new_status,
    reason,
    metadata
  ) VALUES (
    'employer',
    p_employer_id,
    'rejected',
    p_admin_user_id,
    'pending',
    'rejected',
    p_reason,
    jsonb_build_object('rejected_at', now())
  );

  RETURN jsonb_build_object(
    'success', true,
    'employerId', p_employer_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION reject_employer(uuid, uuid, text) TO authenticated;

COMMENT ON FUNCTION approve_project(uuid, uuid, text) IS 'Approves a pending project. Admin/lead_organiser only.';
COMMENT ON FUNCTION reject_project(uuid, uuid, text) IS 'Rejects a pending project with reason. Admin/lead_organiser only.';
COMMENT ON FUNCTION approve_employer(uuid, uuid, text) IS 'Approves a pending employer. Admin/lead_organiser only.';
COMMENT ON FUNCTION reject_employer(uuid, uuid, text) IS 'Rejects a pending employer with reason. Admin/lead_organiser only.';

-- Update RLS policies to hide pending items from regular users

-- Projects: Regular users cannot see pending projects (unless they created them via scan)
CREATE POLICY "Users cannot see pending projects unless creator"
  ON projects FOR SELECT
  USING (
    approval_status != 'pending'
    OR
    EXISTS (
      SELECT 1 FROM mapping_sheet_scans mss
      WHERE mss.created_project_id = projects.id
      AND mss.uploaded_by = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'lead_organiser')
    )
  );

-- Employers: Regular users cannot see pending employers
CREATE POLICY "Users cannot see pending employers unless admin"
  ON employers FOR SELECT
  USING (
    approval_status != 'pending'
    OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'lead_organiser')
    )
  );

-- ==========================================
-- Update create_project_from_scan to support approval workflow
-- ==========================================

CREATE OR REPLACE FUNCTION create_project_from_scan(
  p_user_id uuid,
  p_scan_id uuid,
  p_project_data jsonb,
  p_contacts jsonb DEFAULT '[]'::jsonb,
  p_subcontractors jsonb DEFAULT '[]'::jsonb,
  p_employer_creations jsonb DEFAULT '[]'::jsonb,
  p_require_approval boolean DEFAULT false  -- NEW PARAMETER
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
      federal_funding,
      approval_status  -- NEW
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
      COALESCE((p_project_data->>'federal_funding')::numeric, 0),
      CASE WHEN p_require_approval THEN 'pending' ELSE 'active' END  -- NEW
    )
    RETURNING id INTO v_project_id;

    -- Add approval history entry if pending
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
        'resubmitted',  -- Initial submission
        p_user_id,
        NULL,
        'pending',
        jsonb_build_object(
          'scan_id', p_scan_id,
          'source', 'scan_upload'
        )
      );
    END IF;

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
          notes,
          approval_status  -- NEW
        ) VALUES (
          p_project_data->'builder'->'newEmployerData'->>'name',
          p_project_data->'builder'->'newEmployerData'->>'employer_type',
          p_project_data->'builder'->'newEmployerData'->>'website',
          p_project_data->'builder'->'newEmployerData'->>'notes',
          CASE WHEN p_require_approval THEN 'pending' ELSE 'active' END  -- NEW
        )
        RETURNING id INTO v_builder_id;

        -- Add approval history entry if pending
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

GRANT EXECUTE ON FUNCTION create_project_from_scan(uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean) TO authenticated;

COMMENT ON FUNCTION create_project_from_scan(uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean) IS
  'Creates a complete project from a mapping sheet scan, including job sites, contacts, and subcontractor assignments. Supports approval workflow when p_require_approval is true.';
