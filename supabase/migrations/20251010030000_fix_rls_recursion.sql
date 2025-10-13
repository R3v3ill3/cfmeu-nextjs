-- ============================================================================
-- HOTFIX: Fix RLS recursion between mapping_sheet_scans and projects
-- ============================================================================
--
-- Problem: The approval workflow policies created a circular dependency:
--   - mapping_sheet_scans policy checks projects table
--   - projects policy checks mapping_sheet_scans table
--   - Result: infinite recursion error
--
-- Solution: Simplify policies to avoid cross-table checks where possible
-- ============================================================================

-- 1. Drop the problematic policies FIRST
DROP POLICY IF EXISTS "Users can view scans for accessible projects" ON mapping_sheet_scans;
DROP POLICY IF EXISTS "Users cannot see pending projects unless creator" ON projects;

-- 2. Add created_by to projects if it doesn't exist
--    This breaks the dependency on mapping_sheet_scans for ownership check
--    MUST be done before creating function/policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE projects ADD COLUMN created_by uuid REFERENCES auth.users(id);

    -- Backfill created_by from mapping_sheet_scans for existing pending projects
    UPDATE projects p
    SET created_by = mss.uploaded_by
    FROM mapping_sheet_scans mss
    WHERE mss.created_project_id = p.id
      AND p.created_by IS NULL
      AND p.approval_status = 'pending';
  END IF;
END $$;

-- 3. Create helper function to check project access without triggering RLS recursion
--    MUST be created BEFORE policies that reference it
CREATE OR REPLACE FUNCTION user_can_access_project(p_user_id uuid, p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with elevated privileges, bypasses RLS
STABLE
AS $$
BEGIN
  -- Check if user has access to project via project_assignments or other mechanisms
  -- This function bypasses RLS, so it won't cause recursion
  RETURN EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = p_project_id
    AND (
      -- Project is active (not pending)
      p.approval_status != 'pending'
      OR
      -- User created this project
      p.created_by = p_user_id
      OR
      -- User is admin
      has_role(p_user_id, 'admin')
      OR
      has_role(p_user_id, 'lead_organiser')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION user_can_access_project(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION user_can_access_project(uuid, uuid) IS
  'Helper function to check project access without triggering RLS recursion. Uses SECURITY DEFINER to bypass RLS.';

-- 4. NOW create mapping_sheet_scans policy (function exists now)
--    Key insight: Users can ALWAYS see their own uploads, no need to check project access
CREATE POLICY "Users can view their own scans or scans for accessible projects"
  ON mapping_sheet_scans FOR SELECT
  USING (
    -- Always allow users to see scans they uploaded (breaks recursion)
    auth.uid() = uploaded_by
    OR
    -- Allow viewing scans for existing-project mode IF user has project access
    -- Uses SECURITY DEFINER function to bypass RLS during this check
    (
      project_id IS NOT NULL
      AND upload_mode = 'existing_project'
      AND user_can_access_project(auth.uid(), project_id)
    )
    OR
    -- Admins can see all scans
    has_role(auth.uid(), 'admin')
    OR
    has_role(auth.uid(), 'lead_organiser')
  );

-- 5. NOW create projects policy (created_by column exists now)
--    Key insight: Track creator directly on projects table instead of via scans
CREATE POLICY "Users can view active projects or their pending projects"
  ON projects FOR SELECT
  USING (
    -- Non-pending projects visible to all with project access (existing policies)
    approval_status != 'pending'
    OR
    -- Pending projects: visible to creator (check created_by instead of scans)
    created_by = auth.uid()
    OR
    -- Admins can see all pending projects
    has_role(auth.uid(), 'admin')
    OR
    has_role(auth.uid(), 'lead_organiser')
  );

-- 6. Update create_project_from_scan to set created_by
--    (Only the INSERT statement needs updating)
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
    -- 1. Create project (NOW WITH created_by)
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
      created_by  -- NEW: Track creator directly
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
      CASE WHEN p_require_approval THEN 'pending' ELSE 'active' END,
      p_user_id  -- NEW: Set creator
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

      UPDATE projects
      SET main_job_site_id = v_job_site_id
      WHERE id = v_project_id;
    END IF;

    -- 3. Handle builder assignment
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

GRANT EXECUTE ON FUNCTION create_project_from_scan(uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean) TO authenticated;

COMMENT ON FUNCTION create_project_from_scan(uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean) IS
  'Creates a complete project from a mapping sheet scan. Supports approval workflow. Tracks creator to avoid RLS recursion.';
