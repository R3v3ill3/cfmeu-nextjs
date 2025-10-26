-- Ensure project builder data stays in sync between project_assignments and projects.builder_id
-- This migration introduces helper functions, triggers, and backfill logic to keep both sources consistent.

BEGIN;

-- ============================================================================
-- Helper function: derive the canonical builder_id from contractor assignments
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_project_builder_from_assignments(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_builder_role_id uuid;
  v_primary_builder uuid;
BEGIN
  SELECT id
  INTO v_builder_role_id
  FROM contractor_role_types
  WHERE code = 'builder'
  ORDER BY is_active DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1;

  IF v_builder_role_id IS NULL THEN
    -- Nothing to do without a builder role type definition
    RETURN;
  END IF;

  SELECT pa.employer_id
  INTO v_primary_builder
  FROM project_assignments pa
  WHERE pa.project_id = p_project_id
    AND pa.assignment_type = 'contractor_role'
    AND pa.contractor_role_type_id = v_builder_role_id
  ORDER BY
    COALESCE(pa.confirmed_at, pa.updated_at, pa.matched_at, pa.created_at) DESC NULLS LAST,
    pa.id DESC
  LIMIT 1;

  UPDATE projects
  SET builder_id = v_primary_builder
  WHERE id = p_project_id
    AND (builder_id IS DISTINCT FROM v_primary_builder);
END;
$$;

-- ============================================================================
-- Trigger: when builder assignments change, sync projects.builder_id automatically
-- ============================================================================
CREATE OR REPLACE FUNCTION project_assignments_builder_sync_trg()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_builder_role_id uuid;
BEGIN
  SELECT id
  INTO v_builder_role_id
  FROM contractor_role_types
  WHERE code = 'builder'
  ORDER BY is_active DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1;

  IF v_builder_role_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.assignment_type = 'contractor_role' AND OLD.contractor_role_type_id = v_builder_role_id THEN
      PERFORM sync_project_builder_from_assignments(OLD.project_id);
    END IF;
    RETURN OLD;
  END IF;

  -- Handle INSERT or UPDATE
  IF NEW.assignment_type = 'contractor_role' AND NEW.contractor_role_type_id = v_builder_role_id THEN
    PERFORM sync_project_builder_from_assignments(NEW.project_id);
  END IF;

  IF TG_OP = 'UPDATE' AND (OLD.project_id IS DISTINCT FROM NEW.project_id
                            OR OLD.contractor_role_type_id IS DISTINCT FROM NEW.contractor_role_type_id
                            OR OLD.assignment_type IS DISTINCT FROM NEW.assignment_type) THEN
    IF OLD.assignment_type = 'contractor_role' AND OLD.contractor_role_type_id = v_builder_role_id THEN
      PERFORM sync_project_builder_from_assignments(OLD.project_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_assignments_builder_sync ON project_assignments;

CREATE TRIGGER project_assignments_builder_sync
AFTER INSERT OR UPDATE OR DELETE ON project_assignments
FOR EACH ROW
EXECUTE FUNCTION project_assignments_builder_sync_trg();

-- ============================================================================
-- Canonical RPC: set_project_builder
-- ============================================================================
CREATE OR REPLACE FUNCTION set_project_builder(
  p_project_id uuid,
  p_employer_id uuid DEFAULT NULL,
  p_source text DEFAULT 'manual',
  p_match_status text DEFAULT 'confirmed',
  p_match_confidence numeric DEFAULT 1.0,
  p_match_notes text DEFAULT NULL,
  p_confirmed_by uuid DEFAULT NULL
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_builder_role_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id
  INTO v_builder_role_id
  FROM contractor_role_types
  WHERE code = 'builder'
  ORDER BY is_active DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1;

  IF v_builder_role_id IS NULL THEN
    RETURN QUERY SELECT false, 'Builder role type not configured';
    RETURN;
  END IF;

  IF p_employer_id IS NULL THEN
    DELETE FROM project_assignments
    WHERE project_id = p_project_id
      AND assignment_type = 'contractor_role'
      AND contractor_role_type_id = v_builder_role_id;

    PERFORM sync_project_builder_from_assignments(p_project_id);
    RETURN QUERY SELECT true, 'Cleared builder assignment';
    RETURN;
  END IF;

  SELECT id
  INTO v_existing_id
  FROM project_assignments
  WHERE project_id = p_project_id
    AND assignment_type = 'contractor_role'
    AND contractor_role_type_id = v_builder_role_id
    AND employer_id = p_employer_id
  LIMIT 1;

  IF v_existing_id IS NULL THEN
    INSERT INTO project_assignments (
      project_id,
      employer_id,
      assignment_type,
      contractor_role_type_id,
      source,
      match_status,
      match_confidence,
      match_notes,
      matched_at,
      confirmed_at,
      confirmed_by
    )
    VALUES (
      p_project_id,
      p_employer_id,
      'contractor_role',
      v_builder_role_id,
      p_source,
      p_match_status,
      p_match_confidence,
      p_match_notes,
      CASE WHEN p_match_status = 'auto_matched' THEN now() ELSE NULL END,
      CASE WHEN p_match_status = 'confirmed' THEN now() ELSE NULL END,
      CASE WHEN p_match_status = 'confirmed' THEN p_confirmed_by ELSE NULL END
    );
  ELSE
    UPDATE project_assignments
    SET source = COALESCE(p_source, source),
        match_status = COALESCE(p_match_status, match_status),
        match_confidence = COALESCE(p_match_confidence, match_confidence),
        match_notes = COALESCE(p_match_notes, match_notes),
        matched_at = CASE
          WHEN p_match_status = 'auto_matched' THEN COALESCE(matched_at, now())
          ELSE matched_at
        END,
        confirmed_at = CASE
          WHEN p_match_status = 'confirmed' THEN COALESCE(confirmed_at, now())
          ELSE confirmed_at
        END,
        confirmed_by = CASE
          WHEN p_match_status = 'confirmed' THEN COALESCE(p_confirmed_by, confirmed_by)
          ELSE confirmed_by
        END
    WHERE id = v_existing_id;
  END IF;

  UPDATE projects
  SET builder_id = p_employer_id
  WHERE id = p_project_id
    AND builder_id IS DISTINCT FROM p_employer_id;

  PERFORM sync_project_builder_from_assignments(p_project_id);

  RETURN QUERY SELECT true, 'Builder assignment updated';
END;
$$;

REVOKE ALL ON FUNCTION set_project_builder(uuid, uuid, text, text, numeric, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_project_builder(uuid, uuid, text, text, numeric, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION set_project_builder(uuid, uuid, text, text, numeric, text, uuid) TO service_role;

-- ============================================================================
-- Update existing helper RPCs to leverage set_project_builder
-- ============================================================================
CREATE OR REPLACE FUNCTION assign_bci_builder(
  p_project_id uuid,
  p_employer_id uuid,
  p_company_name text
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT *
    FROM set_project_builder(
      p_project_id => p_project_id,
      p_employer_id => p_employer_id,
      p_source => 'bci_import',
      p_match_status => 'auto_matched',
      p_match_confidence => 0.8,
      p_match_notes => format('Auto-matched from BCI import: %s', p_company_name)
    );
END;
$$;

-- Ensure assign_contractor_role delegates builder logic to the canonical helper
CREATE OR REPLACE FUNCTION assign_contractor_role(
  p_project_id uuid,
  p_employer_id uuid,
  p_role_code text,
  p_company_name text,
  p_is_primary boolean DEFAULT false,
  p_estimated_workers integer DEFAULT NULL,
  p_source text DEFAULT 'manual',
  p_match_confidence numeric DEFAULT 1.0,
  p_match_notes text DEFAULT NULL
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id uuid;
BEGIN
  IF p_role_code = 'builder' THEN
    RETURN QUERY
      SELECT *
      FROM set_project_builder(
        p_project_id => p_project_id,
        p_employer_id => p_employer_id,
        p_source => COALESCE(p_source, 'manual'),
        p_match_status => CASE WHEN p_source = 'bci_import' THEN 'auto_matched' ELSE 'confirmed' END,
        p_match_confidence => p_match_confidence,
        p_match_notes => p_match_notes
      );
    RETURN;
  END IF;

  SELECT id INTO v_role_id
  FROM contractor_role_types
  WHERE code = p_role_code AND is_active = true
  LIMIT 1;

  IF v_role_id IS NULL THEN
    RETURN QUERY SELECT false, format('Invalid contractor role: %s', p_role_code);
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM project_assignments
    WHERE project_id = p_project_id
      AND employer_id = p_employer_id
      AND contractor_role_type_id = v_role_id
  ) THEN
    RETURN QUERY SELECT true, format('%s already assigned as %s', p_company_name, p_role_code);
    RETURN;
  END IF;

  INSERT INTO project_assignments (
    project_id,
    employer_id,
    assignment_type,
    contractor_role_type_id,
    is_primary_for_role,
    estimated_workers,
    source,
    match_status,
    match_confidence,
    match_notes,
    matched_at,
    confirmed_at
  )
  VALUES (
    p_project_id,
    p_employer_id,
    'contractor_role',
    v_role_id,
    p_is_primary,
    p_estimated_workers,
    COALESCE(p_source, 'manual'),
    CASE WHEN COALESCE(p_source, 'manual') = 'bci_import' THEN 'auto_matched' ELSE 'confirmed' END,
    p_match_confidence,
    p_match_notes,
    CASE WHEN COALESCE(p_source, 'manual') = 'bci_import' THEN now() ELSE NULL END,
    CASE WHEN COALESCE(p_source, 'manual') <> 'bci_import' THEN now() ELSE NULL END
  );

  RETURN QUERY SELECT true, format('Assigned %s as %s', p_company_name, p_role_code);
END;
$$;

-- ============================================================================
-- Backfill: create missing builder assignments and sync legacy data
-- ============================================================================
DO $$
DECLARE
  v_builder_role_id uuid;
BEGIN
  SELECT id
  INTO v_builder_role_id
  FROM contractor_role_types
  WHERE code = 'builder'
  ORDER BY is_active DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1;

  IF v_builder_role_id IS NULL THEN
    RAISE NOTICE 'Skipping builder backfill: role type not found';
    RETURN;
  END IF;

  -- Insert missing builder assignments for projects that only have projects.builder_id populated
  INSERT INTO project_assignments (
    project_id,
    employer_id,
    assignment_type,
    contractor_role_type_id,
    source,
    match_status,
    match_confidence,
    match_notes,
    matched_at,
    confirmed_at
  )
  SELECT p.id,
         p.builder_id,
         'contractor_role',
         v_builder_role_id,
         'legacy_sync',
         'confirmed',
         1.0,
         'Legacy builder_id sync',
         now(),
         now()
  FROM projects p
  WHERE p.builder_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM project_assignments pa
      WHERE pa.project_id = p.id
        AND pa.assignment_type = 'contractor_role'
        AND pa.contractor_role_type_id = v_builder_role_id
        AND pa.employer_id = p.builder_id
    );

  -- Ensure projects.builder_id matches the canonical assignment after backfill
  UPDATE projects p
  SET builder_id = sub.employer_id
  FROM (
    SELECT DISTINCT ON (pa.project_id) pa.project_id, pa.employer_id
    FROM project_assignments pa
    WHERE pa.assignment_type = 'contractor_role'
      AND pa.contractor_role_type_id = v_builder_role_id
    ORDER BY pa.project_id,
             COALESCE(pa.confirmed_at, pa.updated_at, pa.matched_at, pa.created_at) DESC NULLS LAST,
             pa.id DESC
  ) sub
  WHERE p.id = sub.project_id
    AND p.builder_id IS DISTINCT FROM sub.employer_id;

  -- For projects without any builder assignment, ensure builder_id is null
  UPDATE projects p
  SET builder_id = NULL
  WHERE p.builder_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM project_assignments pa
      WHERE pa.project_id = p.id
        AND pa.assignment_type = 'contractor_role'
        AND pa.contractor_role_type_id = v_builder_role_id
    );
END;
$$;

COMMIT;


