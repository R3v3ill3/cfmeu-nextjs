-- ===================================
-- EMPLOYER VERSION MANAGEMENT SYSTEM
-- ===================================
-- This migration adds version management capabilities to the employers table
-- Enables optimistic locking, conflict detection, and change tracking

-- ===================================
-- 1. ADD VERSION COLUMN TO EMPLOYERS TABLE
-- ===================================

-- Add version column for optimistic locking
ALTER TABLE public.employers ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;

-- Add column to track last known version for conflict detection
ALTER TABLE public.employers ADD COLUMN IF NOT EXISTS last_known_version integer;

-- Add column to track editing status
ALTER TABLE public.employers ADD COLUMN IF NOT EXISTS is_being_edited boolean DEFAULT false;

-- Add column to track current editor
ALTER TABLE public.employers ADD COLUMN IF NOT EXISTS current_editor_id uuid REFERENCES auth.users(id);

-- Add column to track editing session
ALTER TABLE public.employers ADD COLUMN IF NOT EXISTS current_editing_session_id uuid;

-- Add indexes for version management
CREATE INDEX IF NOT EXISTS idx_employers_version ON public.employers(version);
CREATE INDEX IF NOT EXISTS idx_employers_current_editor ON public.employers(current_editor_id) WHERE current_editor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employers_being_edited ON public.employers(is_being_edited) WHERE is_being_edited = true;

-- ===================================
-- 2. EMPLOYER VERSION CHECK FUNCTION
-- ===================================
-- Function to validate version before updates (optimistic locking)

CREATE OR REPLACE FUNCTION public.check_employer_version(
  p_employer_id uuid,
  p_expected_version integer
)
RETURNS boolean AS $$
DECLARE
  v_current_version integer;
  v_is_being_edited boolean;
  v_current_editor_id uuid;
BEGIN
  -- Get current version and editing status
  SELECT version, is_being_edited, current_editor_id
  INTO v_current_version, v_is_being_edited, v_current_editor_id
  FROM public.employers
  WHERE id = p_employer_id;

  -- Check if employer exists
  IF v_current_version IS NULL THEN
    RAISE EXCEPTION 'Employer not found: %', p_employer_id;
  END IF;

  -- Check version match
  IF v_current_version <> p_expected_version THEN
    RAISE EXCEPTION 'Version conflict: expected % but current version is %',
                    p_expected_version, v_current_version;
  END IF;

  -- Check if someone else is editing
  IF v_is_being_edited AND v_current_editor_id <> auth.uid() THEN
    RAISE EXCEPTION 'Employer is currently being edited by another user';
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ===================================
-- 3. EMPLOYER VERSION UPDATE FUNCTION
-- ===================================
-- Function to safely update employer with version increment

CREATE OR REPLACE FUNCTION public.update_employer_with_version(
  p_employer_id uuid,
  p_expected_version integer,
  p_employer_data jsonb,
  p_change_context jsonb DEFAULT '{}'
)
RETURNS TABLE(
  success boolean,
  new_version integer,
  conflict_detected boolean,
  conflict_details jsonb
) AS $$
DECLARE
  v_current_version integer;
  v_new_version integer;
  v_conflict_detected boolean := false;
  v_conflict_details jsonb := '{}';
  v_updated_at timestamptz;
BEGIN
  -- Check version and get current data
  BEGIN
    PERFORM public.check_employer_version(p_employer_id, p_expected_version);

    SELECT version, updated_at
    INTO v_current_version, v_updated_at
    FROM public.employers
    WHERE id = p_employer_id;
  EXCEPTION WHEN OTHERS THEN
    -- Return conflict information
    success := false;
    new_version := v_current_version;
    conflict_detected := true;
    conflict_details := jsonb_build_object(
      'error', SQLERRM,
      'expected_version', p_expected_version,
      'current_version', v_current_version,
      'updated_at', v_updated_at
    );
    RETURN NEXT;
    RETURN;
  END;

  -- Increment version
  v_new_version := v_current_version + 1;

  -- Update employer with new version
  UPDATE public.employers
  SET
    version = v_new_version,
    last_known_version = v_current_version,
    updated_at = now()
  WHERE id = p_employer_id
    AND version = p_expected_version;

  -- Apply specific field updates from jsonb data
  IF p_employer_data ? 'name' THEN
    UPDATE public.employers SET name = p_employer_data->>'name' WHERE id = p_employer_id;
  END IF;

  IF p_employer_data ? 'abn' THEN
    UPDATE public.employers SET abn = p_employer_data->>'abn' WHERE id = p_employer_id;
  END IF;

  IF p_employer_data ? 'phone' THEN
    UPDATE public.employers SET phone = p_employer_data->>'phone' WHERE id = p_employer_id;
  END IF;

  IF p_employer_data ? 'email' THEN
    UPDATE public.employers SET email = p_employer_data->>'email' WHERE id = p_employer_id;
  END IF;

  IF p_employer_data ? 'address_line_1' THEN
    UPDATE public.employers SET address_line_1 = p_employer_data->>'address_line_1' WHERE id = p_employer_id;
  END IF;

  IF p_employer_data ? 'address_line_2' THEN
    UPDATE public.employers SET address_line_2 = p_employer_data->>'address_line_2' WHERE id = p_employer_id;
  END IF;

  IF p_employer_data ? 'suburb' THEN
    UPDATE public.employers SET suburb = p_employer_data->>'suburb' WHERE id = p_employer_id;
  END IF;

  IF p_employer_data ? 'state' THEN
    UPDATE public.employers SET state = p_employer_data->>'state' WHERE id = p_employer_id;
  END IF;

  IF p_employer_data ? 'postcode' THEN
    UPDATE public.employers SET postcode = p_employer_data->>'postcode' WHERE id = p_employer_id;
  END IF;

  IF p_employer_data ? 'website' THEN
    UPDATE public.employers SET website = p_employer_data->>'website' WHERE id = p_employer_id;
  END IF;

  IF p_employer_data ? 'contact_notes' THEN
    UPDATE public.employers SET contact_notes = p_employer_data->>'contact_notes' WHERE id = p_employer_id;
  END IF;

  IF p_employer_data ? 'primary_contact_name' THEN
    UPDATE public.employers SET primary_contact_name = p_employer_data->>'primary_contact_name' WHERE id = p_employer_id;
  END IF;

  IF p_employer_data ? 'estimated_worker_count' THEN
    UPDATE public.employers SET estimated_worker_count = (p_employer_data->>'estimated_worker_count')::integer WHERE id = p_employer_id;
  END IF;

  IF p_employer_data ? 'enterprise_agreement_status' THEN
    UPDATE public.employers SET enterprise_agreement_status = (p_employer_data->>'enterprise_agreement_status')::boolean WHERE id = p_employer_id;
  END IF;

  IF p_employer_data ? 'employer_type' THEN
    UPDATE public.employers SET employer_type = (p_employer_data->>'employer_type')::public.employer_type WHERE id = p_employer_id;
  END IF;

  -- Return success
  success := true;
  new_version := v_new_version;
  conflict_detected := false;
  conflict_details := '{}';
  RETURN NEXT;
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- ===================================
-- 4. EMPLOYER EDITING SESSION MANAGEMENT
-- ===================================

-- Function to start editing session
CREATE OR REPLACE FUNCTION public.start_employer_editing_session(
  p_employer_id uuid,
  p_client_session_id text,
  p_expected_version integer DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_session_id uuid;
  v_current_version integer;
  v_is_being_edited boolean;
  v_current_editor_id uuid;
  v_existing_session_id uuid;
BEGIN
  -- Get current employer state
  SELECT version, is_being_edited, current_editor_id
  INTO v_current_version, v_is_being_edited, v_current_editor_id
  FROM public.employers
  WHERE id = p_employer_id;

  IF v_current_version IS NULL THEN
    RAISE EXCEPTION 'Employer not found: %', p_employer_id;
  END IF;

  -- Check version if provided
  IF p_expected_version IS NOT NULL AND v_current_version <> p_expected_version THEN
    RAISE EXCEPTION 'Version conflict: expected % but current version is %',
                    p_expected_version, v_current_version;
  END IF;

  -- Check if someone else is editing
  IF v_is_being_edited AND v_current_editor_id <> auth.uid() THEN
    RAISE EXCEPTION 'Employer is currently being edited by another user';
  END IF;

  -- Check for existing session for this user and employer
  SELECT id INTO v_existing_session_id
  FROM public.employer_editing_sessions
  WHERE employer_id = p_employer_id
    AND user_id = auth.uid()
    AND client_session_id = p_client_session_id
    AND session_ended_at IS NULL;

  IF v_existing_session_id IS NOT NULL THEN
    -- Update heartbeat and return existing session
    UPDATE public.employer_editing_sessions
    SET last_heartbeat = now(),
        current_version = v_current_version
    WHERE id = v_existing_session_id;

    v_session_id := v_existing_session_id;
  ELSE
    -- Create new editing session
    INSERT INTO public.employer_editing_sessions(
      employer_id,
      user_id,
      current_version,
      client_session_id,
      ip_address,
      user_agent
    ) VALUES (
      p_employer_id,
      auth.uid(),
      v_current_version,
      p_client_session_id,
      p_ip_address,
      p_user_agent
    ) RETURNING id INTO v_session_id;
  END IF;

  -- Mark employer as being edited
  UPDATE public.employers
  SET
    is_being_edited = true,
    current_editor_id = auth.uid(),
    current_editing_session_id = v_session_id
  WHERE id = p_employer_id;

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to end editing session
CREATE OR REPLACE FUNCTION public.end_employer_editing_session(
  p_session_id uuid
)
RETURNS boolean AS $$
DECLARE
  v_employer_id uuid;
  v_user_id uuid;
BEGIN
  -- Get session details
  SELECT employer_id, user_id
  INTO v_employer_id, v_user_id
  FROM public.employer_editing_sessions
  WHERE id = p_session_id AND session_ended_at IS NULL;

  IF v_employer_id IS NULL THEN
    RAISE EXCEPTION 'Editing session not found or already ended: %', p_session_id;
  END IF;

  -- Only the session owner can end it
  IF v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the session owner can end this editing session';
  END IF;

  -- End the session
  UPDATE public.employer_editing_sessions
  SET session_ended_at = now()
  WHERE id = p_session_id;

  -- Check if there are other active sessions for this employer
  IF NOT EXISTS (
    SELECT 1 FROM public.employer_editing_sessions
    WHERE employer_id = v_employer_id
      AND session_ended_at IS NULL
  ) THEN
    -- No more active sessions, mark employer as not being edited
    UPDATE public.employers
    SET
      is_being_edited = false,
      current_editor_id = NULL,
      current_editing_session_id = NULL
    WHERE id = v_employer_id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to heartbeat editing session
CREATE OR REPLACE FUNCTION public.heartbeat_employer_editing_session(
  p_session_id uuid
)
RETURNS boolean AS $$
DECLARE
  v_session_exists boolean;
BEGIN
  -- Check if session exists and is active
  SELECT EXISTS(
    SELECT 1 FROM public.employer_editing_sessions
    WHERE id = p_session_id
      AND user_id = auth.uid()
      AND session_ended_at IS NULL
  ) INTO v_session_exists;

  IF NOT v_session_exists THEN
    RETURN false;
  END IF;

  -- Update heartbeat
  UPDATE public.employer_editing_sessions
  SET last_heartbeat = now()
  WHERE id = p_session_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ===================================
-- 5. CONFLICT DETECTION TRIGGERS
-- ===================================

-- Function to detect version conflicts before update
CREATE OR REPLACE FUNCTION public.employer_version_conflict_check()
RETURNS TRIGGER AS $$
DECLARE
  v_current_version integer;
  v_is_being_edited boolean;
  v_current_editor_id uuid;
BEGIN
  -- Get current state
  SELECT version, is_being_edited, current_editor_id
  INTO v_current_version, v_is_being_edited, v_current_editor_id
  FROM public.employers
  WHERE id = COALESCE(NEW.id, OLD.id);

  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
    NEW.version := COALESCE(NEW.version, 1);
    NEW.last_known_version := NULL;
    NEW.is_being_edited := false;
    NEW.current_editor_id := NULL;
    NEW.current_editing_session_id := NULL;
    RETURN NEW;
  END IF;

  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- Auto-increment version if not already set
    IF NEW.version = OLD.version THEN
      NEW.version := OLD.version + 1;
    END IF;

    NEW.last_known_version := OLD.version;

    -- Check for concurrent editing conflicts
    IF v_is_being_edited AND v_current_editor_id <> auth.uid() THEN
      -- Create conflict record
      INSERT INTO public.employer_change_conflicts(
        employer_id,
        conflicting_change_id_1,
        conflicting_change_id_2,
        conflict_severity,
        conflicting_fields
      ) VALUES (
        NEW.id,
        -- Get the most recent audit record for the current editor
        (SELECT id FROM public.employer_change_audit
         WHERE employer_id = NEW.id AND changed_by = v_current_editor_id
         ORDER BY changed_at DESC LIMIT 1),
        -- This will be filled by the audit trigger
        gen_random_uuid(),
        'high',
        jsonb_build_object('concurrent_editing', true)
      );
    END IF;

    RETURN NEW;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    -- Clean up any active editing sessions
    UPDATE public.employer_editing_sessions
    SET session_ended_at = now()
    WHERE employer_id = OLD.id AND session_ended_at IS NULL;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for version management
DROP TRIGGER IF EXISTS employer_version_management_trigger ON public.employers;
CREATE TRIGGER employer_version_management_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.employers
  FOR EACH ROW EXECUTE FUNCTION public.employer_version_conflict_check();

-- ===================================
-- 6. BACKFILL VERSION DATA FOR EXISTING EMPLOYERS
-- ===================================

-- Set initial version for existing employers
UPDATE public.employers
SET
  version = COALESCE(version, 1),
  last_known_version = NULL,
  is_being_edited = false,
  current_editor_id = NULL,
  current_editing_session_id = NULL
WHERE version IS NULL OR version = 0;

-- ===================================
-- 7. VIEWS FOR VERSION MANAGEMENT
-- ===================================

-- View showing employers with their editing status
CREATE OR REPLACE VIEW public.employers_with_editing_status AS
SELECT
  e.*,
  es.user_id as session_editor_id,
  es.last_heartbeat,
  es.client_session_id,
  CASE
    WHEN es.user_id IS NOT NULL AND es.session_ended_at IS NULL THEN true
    ELSE false
  END as is_currently_edited
FROM public.employers e
LEFT JOIN public.employer_editing_sessions es
  ON e.id = es.employer_id
  AND es.session_ended_at IS NULL
  AND es.last_heartbeat > now() - interval '5 minutes';

-- View showing change history for employers
CREATE OR REPLACE VIEW public.employer_change_history AS
SELECT
  eca.*,
  e.name as employer_name,
  u.raw_user_meta_data->>'name' as changed_by_name,
  u.email as changed_by_email,
  CASE
    WHEN eca.conflict_with_change_id IS NOT NULL THEN true
    ELSE false
  END as has_conflict
FROM public.employer_change_audit eca
JOIN public.employers e ON eca.employer_id = e.id
LEFT JOIN auth.users u ON eca.changed_by = u.id
ORDER BY eca.changed_at DESC;

-- ===================================
-- 8. SECURITY POLICIES FOR NEW COLUMNS
-- ===================================

-- Update existing RLS policies to include version checking
-- (Note: Existing policies from change tracking system will cover the new columns)

-- ===================================
-- 9. UTILITY FUNCTIONS FOR BATCH OPERATIONS
-- ===================================

-- Function to batch update employers with version tracking
CREATE OR REPLACE FUNCTION public.batch_update_employers(
  p_updates jsonb,  -- Array of {employer_id, expected_version, data} objects
  p_bulk_operation_id uuid DEFAULT NULL
)
RETURNS TABLE(
  employer_id uuid,
  success boolean,
  new_version integer,
  error_message text
) AS $$
DECLARE
  v_update_record jsonb;
  v_employer_id uuid;
  v_expected_version integer;
  v_employer_data jsonb;
  v_result boolean;
  v_new_version integer;
  v_conflict_detected boolean;
  v_conflict_details jsonb;
BEGIN
  -- Process each update
  FOR v_update_record IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    v_employer_id := (v_update_record->>'employer_id')::uuid;
    v_expected_version := (v_update_record->>'expected_version')::integer;
    v_employer_data := v_update_record->>'data'::jsonb;

    -- Attempt to update employer
    SELECT success, new_version
    INTO v_result, v_new_version
    FROM public.update_employer_with_version(
      v_employer_id,
      v_expected_version,
      v_employer_data,
      jsonb_build_object('bulk_operation', true, 'bulk_operation_id', p_bulk_operation_id)
    );

    -- Return result
    employer_id := v_employer_id;
    success := v_result;
    new_version := v_new_version;

    IF NOT v_result THEN
      error_message := 'Update failed due to version conflict';
    ELSE
      error_message := NULL;
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ===================================
-- MIGRATION NOTES
-- ===================================
-- This migration adds comprehensive version management to the employers table:
-- 1. Version column for optimistic locking
-- 2. Editing status tracking for real-time collaboration
-- 3. Version check and update functions with conflict detection
-- 4. Editing session management functions
-- 5. Automatic conflict detection triggers
-- 6. Views for monitoring editing status and change history
-- 7. Batch update functionality with version tracking
--
-- The system now supports:
-- - Optimistic locking to prevent lost updates
-- - Real-time collaboration awareness
-- - Automatic conflict detection and tracking
-- - Comprehensive audit trail integration
-- - Bulk operations with full version tracking
--
-- Next steps:
-- 1. Create advanced conflict detection functions
-- 2. Build API endpoints for version management
-- 3. Implement real-time collaboration UI components