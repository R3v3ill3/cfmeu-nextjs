-- ===================================
-- CHANGE TRACKING AND COLLABORATION SYSTEM - FIXED VERSION
-- ===================================
-- This migration creates the foundation for the CFMEU NSW construction union
-- organising database change management and collaboration system
-- Supports universal write access with comprehensive audit trails and conflict resolution

-- ===================================
-- 1. EMPLOYER CHANGE AUDIT TABLE
-- ===================================
-- Tracks all changes to employer records with comprehensive metadata
CREATE TABLE IF NOT EXISTS public.employer_change_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,

  -- Change metadata
  change_type text NOT NULL CHECK (change_type IN ('INSERT', 'UPDATE', 'DELETE')),
  changed_by uuid NOT NULL REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),

  -- Version tracking
  from_version integer,
  to_version integer NOT NULL,

  -- Field-level change tracking
  changed_fields jsonb NOT NULL DEFAULT '{}',
  old_values jsonb,
  new_values jsonb,

  -- Change context
  change_context jsonb DEFAULT '{}',
  client_session_id text,
  ip_address inet,
  user_agent text,

  -- Conflict tracking
  conflict_with_change_id uuid REFERENCES public.employer_change_audit(id),
  conflict_resolution_type text CHECK (conflict_resolution_type IN ('manual_merge', 'auto_accept', 'auto_reject', 'pending')),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),

  -- Bulk operation tracking
  bulk_operation_id uuid,
  bulk_operation_index integer,

  -- System metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===================================
-- 2. EMPLOYER EDITING SESSIONS TABLE
-- ===================================
-- Tracks real-time editing sessions for conflict detection
CREATE TABLE IF NOT EXISTS public.employer_editing_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,

  -- Session metadata
  user_id uuid NOT NULL REFERENCES auth.users(id),
  session_started_at timestamptz NOT NULL DEFAULT now(),
  session_ended_at timestamptz,
  session_id text NOT NULL,

  -- Editing state
  is_active boolean NOT NULL DEFAULT true,
  last_activity_at timestamptz NOT NULL DEFAULT now(),

  -- Conflict tracking
  conflicting_sessions uuid[] DEFAULT '{}',
  conflict_resolution text,

  -- Client information
  client_session_id text,
  ip_address inet,
  user_agent text,

  -- System metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===================================
-- 3. EMPLOYER CHANGE CONFLICTS TABLE
-- ===================================
-- Tracks conflicts between concurrent changes
CREATE TABLE IF NOT EXISTS public.employer_change_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,

  -- Conflicting changes
  primary_change_id uuid NOT NULL REFERENCES public.employer_change_audit(id),
  conflicting_change_id uuid NOT NULL REFERENCES public.employer_change_audit(id),

  -- Conflict details
  conflict_fields jsonb NOT NULL DEFAULT '{}',
  conflict_type text NOT NULL CHECK (conflict_type IN ('same_field', 'related_field', 'version_mismatch')),
  conflict_description text,

  -- Resolution tracking
  resolution_status text NOT NULL DEFAULT 'pending' CHECK (resolution_status IN ('pending', 'resolved_primary', 'resolved_conflicting', 'manual_merge')),
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  resolution_method text,

  -- System metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===================================
-- 4. EMPLOYER BULK OPERATIONS TABLE
-- ===================================
-- Tracks bulk operations on employer data
CREATE TABLE IF NOT EXISTS public.employer_bulk_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Operation metadata
  operation_type text NOT NULL CHECK (operation_type IN ('bulk_update', 'bulk_import', 'bulk_rating', 'bulk_assignment')),
  initiated_by uuid NOT NULL REFERENCES auth.users(id),
  initiated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,

  -- Operation status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  total_operations integer NOT NULL DEFAULT 0,
  completed_operations integer NOT NULL DEFAULT 0,
  failed_operations integer NOT NULL DEFAULT 0,

  -- Operation details
  operation_description text,
  operation_context jsonb DEFAULT '{}',

  -- System metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===================================
-- 5. EMPLOYER VERSION SNAPSHOTS TABLE
-- ===================================
-- Stores complete snapshots of employer data at specific versions
CREATE TABLE IF NOT EXISTS public.employer_version_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,

  -- Snapshot metadata
  version integer NOT NULL,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  snapshot_type text NOT NULL DEFAULT 'auto' CHECK (snapshot_type IN ('auto', 'manual', 'pre_bulk', 'post_bulk')),

  -- Complete employer data snapshot
  employer_data jsonb NOT NULL,

  -- Snapshot context
  created_by uuid REFERENCES auth.users(id),
  change_reason text,
  bulk_operation_id uuid REFERENCES public.employer_bulk_operations(id),

  -- System metadata
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Unique constraint: one snapshot per version per employer
  UNIQUE(employer_id, version)
);

-- ===================================
-- INDEXES FOR PERFORMANCE
-- ===================================

-- Change audit indexes
CREATE INDEX IF NOT EXISTS idx_employer_change_audit_employer_id ON public.employer_change_audit(employer_id);
CREATE INDEX IF NOT EXISTS idx_employer_change_audit_changed_by ON public.employer_change_audit(changed_by);
CREATE INDEX IF NOT EXISTS idx_employer_change_audit_changed_at ON public.employer_change_audit(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_employer_change_audit_conflict_with ON public.employer_change_audit(conflict_with_change_id);
CREATE INDEX IF NOT EXISTS idx_employer_change_audit_bulk_operation ON public.employer_change_audit(bulk_operation_id);

-- Editing sessions indexes
CREATE INDEX IF NOT EXISTS idx_employer_editing_sessions_employer_id ON public.employer_editing_sessions(employer_id);
CREATE INDEX IF NOT EXISTS idx_employer_editing_sessions_user_id ON public.employer_editing_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_employer_editing_sessions_active ON public.employer_editing_sessions(is_active, last_activity_at);
CREATE INDEX IF NOT EXISTS idx_employer_editing_sessions_session_id ON public.employer_editing_sessions(session_id);

-- Change conflicts indexes
CREATE INDEX IF NOT EXISTS idx_employer_change_conflicts_employer_id ON public.employer_change_conflicts(employer_id);
CREATE INDEX IF NOT EXISTS idx_employer_change_conflicts_primary_change ON public.employer_change_conflicts(primary_change_id);
CREATE INDEX IF NOT EXISTS idx_employer_change_conflicts_conflicting_change ON public.employer_change_conflicts(conflicting_change_id);
CREATE INDEX IF NOT EXISTS idx_employer_change_conflicts_status ON public.employer_change_conflicts(resolution_status);

-- Bulk operations indexes
CREATE INDEX IF NOT EXISTS idx_employer_bulk_operations_initiated_by ON public.employer_bulk_operations(initiated_by);
CREATE INDEX IF NOT EXISTS idx_employer_bulk_operations_status ON public.employer_bulk_operations(status);
CREATE INDEX IF NOT EXISTS idx_employer_bulk_operations_created_at ON public.employer_bulk_operations(created_at DESC);

-- Version snapshots indexes
CREATE INDEX IF NOT EXISTS idx_employer_version_snapshots_employer_id ON public.employer_version_snapshots(employer_id);
CREATE INDEX IF NOT EXISTS idx_employer_version_snapshots_version ON public.employer_version_snapshots(employer_id, version);
CREATE INDEX IF NOT EXISTS idx_employer_version_snapshots_created_at ON public.employer_version_snapshots(snapshot_at DESC);

-- ===================================
-- ROW LEVEL SECURITY (RLS)
-- ===================================

-- Enable RLS on all tables
ALTER TABLE public.employer_change_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_editing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_change_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_bulk_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_version_snapshots ENABLE ROW LEVEL SECURITY;

-- Change audit policies - FIXED VERSION
CREATE POLICY "Users can view audit for employers they have access to" ON public.employer_change_audit
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.employer_organisers eo
      WHERE eo.employer_id = employer_change_audit.employer_id
      AND eo.organiser_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.patch_employers pe
      JOIN public.organiser_patch_assignments pa ON pe.patch_id = pa.patch_id
      WHERE pe.employer_id = employer_change_audit.employer_id
      AND pa.organiser_id = auth.uid()
    )
    OR "public"."get_user_role"(auth.uid()) = ANY (ARRAY['admin'::text, 'coordinator'::text])
  );

CREATE POLICY "Users can insert audit for their own changes" ON public.employer_change_audit
  FOR INSERT WITH CHECK (changed_by = auth.uid());

-- Editing sessions policies
CREATE POLICY "Users can view editing sessions for accessible employers" ON public.employer_editing_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.employer_organisers eo
      WHERE eo.employer_id = employer_editing_sessions.employer_id
      AND eo.organiser_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.patch_employers pe
      JOIN public.organiser_patch_assignments pa ON pe.patch_id = pa.patch_id
      WHERE pe.employer_id = employer_editing_sessions.employer_id
      AND pa.organiser_id = auth.uid()
    )
    OR "public"."get_user_role"(auth.uid()) = ANY (ARRAY['admin'::text, 'coordinator'::text])
  );

CREATE POLICY "Users can manage their own editing sessions" ON public.employer_editing_sessions
  FOR ALL USING (user_id = auth.uid());

-- Change conflicts policies
CREATE POLICY "Users can view conflicts for accessible employers" ON public.employer_change_conflicts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.employer_organisers eo
      WHERE eo.employer_id = employer_change_conflicts.employer_id
      AND eo.organiser_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.patch_employers pe
      JOIN public.organiser_patch_assignments pa ON pe.patch_id = pa.patch_id
      WHERE pe.employer_id = employer_change_conflicts.employer_id
      AND pa.organiser_id = auth.uid()
    )
    OR "public"."get_user_role"(auth.uid()) = ANY (ARRAY['admin'::text, 'coordinator'::text])
  );

CREATE POLICY "Users can manage conflicts they're involved in" ON public.employer_change_conflicts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.employer_change_audit audit
      WHERE audit.id = employer_change_conflicts.primary_change_id
      AND audit.changed_by = auth.uid()
    )
    OR "public"."get_user_role"(auth.uid()) = ANY (ARRAY['admin'::text, 'coordinator'::text])
  );

-- Bulk operations policies
CREATE POLICY "Users can view their own bulk operations" ON public.employer_bulk_operations
  FOR SELECT USING (initiated_by = auth.uid() OR "public"."get_user_role"(auth.uid()) = ANY (ARRAY['admin'::text, 'coordinator'::text]));

CREATE POLICY "Users can create bulk operations" ON public.employer_bulk_operations
  FOR INSERT WITH CHECK (initiated_by = auth.uid());

-- Version snapshots policies
CREATE POLICY "Users can view snapshots for accessible employers" ON public.employer_version_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.employer_organisers eo
      WHERE eo.employer_id = employer_version_snapshots.employer_id
      AND eo.organiser_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.patch_employers pe
      JOIN public.organiser_patch_assignments pa ON pe.patch_id = pa.patch_id
      WHERE pe.employer_id = employer_version_snapshots.employer_id
      AND pa.organiser_id = auth.uid()
    )
    OR "public"."get_user_role"(auth.uid()) = ANY (ARRAY['admin'::text, 'coordinator'::text])
  );

-- ===================================
-- TRIGGERS FOR AUTOMATIC CHANGE TRACKING
-- ===================================

-- Function to trigger change audit when employer data changes
CREATE OR REPLACE FUNCTION public.employer_change_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert audit record for the change
  INSERT INTO public.employer_change_audit (
    employer_id,
    change_type,
    changed_by,
    changed_fields,
    old_values,
    new_values
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    auth.uid(),
    CASE
      WHEN TG_OP = 'INSERT' THEN jsonb_build_object('created', true)
      WHEN TG_OP = 'UPDATE' THEN
        jsonb_build_object(
          'changed_fields',
          jsonb_object_keys(NEW) || jsonb_object_keys(OLD) -
          (jsonb_object_keys(NEW) & jsonb_object_keys(OLD))
        )
      WHEN TG_OP = 'DELETE' THEN jsonb_build_object('deleted', true)
    END,
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger on employers table
DROP TRIGGER IF EXISTS employer_change_audit_trigger ON public.employers;
CREATE TRIGGER employer_change_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.employers
  FOR EACH ROW EXECUTE FUNCTION public.employer_change_trigger();

-- ===================================
-- FUNCTIONS FOR CONFLICT DETECTION
-- ===================================

-- Function to detect potential conflicts before applying changes
CREATE OR REPLACE FUNCTION public.detect_employer_conflicts(
  p_employer_id uuid,
  p_changes jsonb,
  p_session_id text DEFAULT NULL
)
RETURNS TABLE (
  has_conflict boolean,
  conflicting_sessions uuid[],
  conflict_details jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXISTS(
      SELECT 1 FROM public.employer_editing_sessions
      WHERE employer_id = p_employer_id
        AND is_active = true
        AND session_id != p_session_id
        AND last_activity_at > NOW() - INTERVAL '5 minutes'
    ) as has_conflict,
    COALESCE(
      ARRAY_AGG(session_id) FILTER (WHERE is_active = true),
      ARRAY[]::uuid[]
    ) as conflicting_sessions,
    jsonb_build_object(
      'employer_id', p_employer_id,
      'session_id', p_session_id,
      'conflict_time', NOW()
    ) as conflict_details
  FROM public.employer_editing_sessions
  WHERE employer_id = p_employer_id
    AND is_active = true
    AND session_id != p_session_id
    AND last_activity_at > NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- ===================================
-- VIEWS FOR COMMON QUERIES
-- ===================================

-- View for recent employer changes
CREATE OR REPLACE VIEW public.recent_employer_changes AS
SELECT
  audit.*,
  employers.name as employer_name,
  profiles.name as changed_by_name,
  profiles.role as changed_by_role
FROM public.employer_change_audit audit
JOIN public.employers ON employers.id = audit.employer_id
JOIN public.profiles ON profiles.id = audit.changed_by
ORDER BY audit.changed_at DESC;

-- View for active editing sessions
CREATE OR REPLACE VIEW public.active_editing_sessions AS
SELECT
  sessions.*,
  employers.name as employer_name,
  profiles.name as user_name,
  profiles.role as user_role,
  EXTRACT(EPOCH FROM (NOW() - sessions.last_activity_at)) as idle_seconds
FROM public.employer_editing_sessions sessions
JOIN public.employers ON employers.id = sessions.employer_id
JOIN public.profiles ON profiles.id = sessions.user_id
WHERE sessions.is_active = true
ORDER BY sessions.last_activity_at DESC;

-- View for pending conflicts
CREATE OR REPLACE VIEW public.pending_employer_conflicts AS
SELECT
  conflicts.*,
  primary_audit.changed_by as primary_changer,
  conflicting_audit.changed_by as conflicting_changer,
  employers.name as employer_name
FROM public.employer_change_conflicts conflicts
JOIN public.employer_change_audit primary_audit ON primary_audit.id = conflicts.primary_change_id
JOIN public.employer_change_audit conflicting_audit ON conflicting_audit.id = conflicts.conflicting_change_id
JOIN public.employers ON employers.id = conflicts.employer_id
WHERE conflicts.resolution_status = 'pending'
ORDER BY conflicts.created_at DESC;

-- ===================================
-- COMMENTS
-- ===================================

COMMENT ON TABLE public.employer_change_audit IS 'Tracks all changes to employer records with comprehensive metadata for the CFMEU organising database collaboration system';
COMMENT ON TABLE public.employer_editing_sessions IS 'Tracks real-time editing sessions to enable conflict detection and resolution for concurrent employer editing';
COMMENT ON TABLE public.employer_change_conflicts IS 'Records conflicts between concurrent changes to employer data and tracks their resolution';
COMMENT ON TABLE public.employer_bulk_operations IS 'Tracks bulk operations on employer data with progress and status information';
COMMENT ON TABLE public.employer_version_snapshots IS 'Stores complete snapshots of employer data at specific versions for rollback and audit purposes';

COMMENT ON FUNCTION public.employer_change_trigger() IS 'Trigger function that automatically logs all changes to employer records in the change audit table';
COMMENT ON FUNCTION public.detect_employer_conflicts() IS 'Function to detect potential conflicts before applying changes to employer records';

COMMENT ON VIEW public.recent_employer_changes IS 'View showing recent changes to employer records with user information';
COMMENT ON VIEW public.active_editing_sessions IS 'View showing currently active editing sessions for employer records';
COMMENT ON VIEW public.pending_employer_conflicts IS 'View showing pending conflicts between concurrent employer changes';