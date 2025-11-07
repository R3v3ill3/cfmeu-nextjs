-- Add Sham Contracting Detection System
-- Adds sham contracting detection fields, audit log, and helper functions
-- Part of the traffic light rating system enhancement

-- ============================================================================
-- 1. Add sham contracting fields to employer_compliance_checks
-- ============================================================================

ALTER TABLE public.employer_compliance_checks
ADD COLUMN IF NOT EXISTS sham_contracting_detected boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sham_contracting_detected_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS sham_contracting_detected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sham_contracting_detection_notes text,
ADD COLUMN IF NOT EXISTS sham_contracting_cleared_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS sham_contracting_cleared_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sham_contracting_clearing_reason text;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_employer_compliance_sham_contracting 
ON public.employer_compliance_checks(employer_id, sham_contracting_detected) 
WHERE sham_contracting_detected = true;

-- Add comment
COMMENT ON COLUMN public.employer_compliance_checks.sham_contracting_detected IS 
'Indicates if evidence of sham contracting has been detected. Applies hard block to green rating (max yellow).';

-- ============================================================================
-- 2. Add sham contracting fields to subcontractor_assessments_4point
-- ============================================================================

ALTER TABLE public.subcontractor_assessments_4point
ADD COLUMN IF NOT EXISTS sham_contracting_detected boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sham_contracting_detected_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS sham_contracting_detected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sham_contracting_detection_notes text,
ADD COLUMN IF NOT EXISTS sham_contracting_cleared_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS sham_contracting_cleared_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sham_contracting_clearing_reason text;

-- Add index
CREATE INDEX IF NOT EXISTS idx_subcontractor_assessments_sham_contracting 
ON public.subcontractor_assessments_4point(employer_id, sham_contracting_detected) 
WHERE sham_contracting_detected = true;

-- ============================================================================
-- 3. Add sham contracting fields to organiser_overall_expertise_ratings (Track 2)
-- ============================================================================

ALTER TABLE public.organiser_overall_expertise_ratings
ADD COLUMN IF NOT EXISTS sham_contracting_detected boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sham_contracting_detected_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS sham_contracting_detected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sham_contracting_detection_notes text,
ADD COLUMN IF NOT EXISTS sham_contracting_cleared_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS sham_contracting_cleared_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sham_contracting_clearing_reason text;

-- Add index
CREATE INDEX IF NOT EXISTS idx_organiser_expertise_sham_contracting 
ON public.organiser_overall_expertise_ratings(employer_id, sham_contracting_detected) 
WHERE sham_contracting_detected = true;

-- ============================================================================
-- 4. Create sham contracting audit log table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sham_contracting_audit_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
    action_type text NOT NULL CHECK (action_type IN ('flagged', 'cleared', 'reflagged')),
    action_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    action_timestamp timestamp with time zone DEFAULT now() NOT NULL,
    notes text NOT NULL,
    clearing_reason text,
    source_table text CHECK (source_table IN ('employer_compliance_checks', 'subcontractor_assessments_4point', 'organiser_overall_expertise_ratings')),
    source_record_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_sham_audit_employer 
ON public.sham_contracting_audit_log(employer_id, action_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_sham_audit_project 
ON public.sham_contracting_audit_log(project_id, action_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_sham_audit_action_by 
ON public.sham_contracting_audit_log(action_by, action_timestamp DESC);

-- Enable RLS
ALTER TABLE public.sham_contracting_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit log
DROP POLICY IF EXISTS "Sham Contracting Audit Log - Read access for authenticated users" ON public.sham_contracting_audit_log;
CREATE POLICY "Sham Contracting Audit Log - Read access for authenticated users" 
ON public.sham_contracting_audit_log
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Sham Contracting Audit Log - Insert access for authenticated users" ON public.sham_contracting_audit_log;
CREATE POLICY "Sham Contracting Audit Log - Insert access for authenticated users" 
ON public.sham_contracting_audit_log
FOR INSERT 
WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.sham_contracting_audit_log TO authenticated;

-- ============================================================================
-- 5. Create trigger function to automatically log sham contracting changes
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_sham_contracting_change()
RETURNS TRIGGER AS $$
DECLARE
    v_action_type text;
    v_notes text;
    v_clearing_reason text;
    v_action_by uuid;
    v_project_id uuid := NULL;
BEGIN
    -- Determine action type
    IF OLD.sham_contracting_detected = false AND NEW.sham_contracting_detected = true THEN
        IF OLD.sham_contracting_cleared_date IS NOT NULL THEN
            v_action_type := 'reflagged';
        ELSE
            v_action_type := 'flagged';
        END IF;
        v_notes := NEW.sham_contracting_detection_notes;
        v_action_by := NEW.sham_contracting_detected_by;
    ELSIF OLD.sham_contracting_detected = true AND NEW.sham_contracting_detected = false THEN
        v_action_type := 'cleared';
        v_notes := COALESCE(NEW.sham_contracting_clearing_reason, 'Cleared without reason');
        v_clearing_reason := NEW.sham_contracting_clearing_reason;
        v_action_by := NEW.sham_contracting_cleared_by;
    ELSIF OLD.sham_contracting_detected = true AND 
          NEW.sham_contracting_cleared_date IS NOT NULL AND 
          OLD.sham_contracting_cleared_date IS NULL THEN
        v_action_type := 'cleared';
        v_notes := COALESCE(NEW.sham_contracting_clearing_reason, 'Cleared without reason');
        v_clearing_reason := NEW.sham_contracting_clearing_reason;
        v_action_by := NEW.sham_contracting_cleared_by;
    ELSE
        -- No relevant change, skip logging
        RETURN NEW;
    END IF;

    -- Get project_id if available (from employer_compliance_checks table)
    IF TG_TABLE_NAME = 'employer_compliance_checks' THEN
        v_project_id := NEW.project_id;
    END IF;

    -- Insert audit log entry
    INSERT INTO public.sham_contracting_audit_log (
        employer_id,
        project_id,
        action_type,
        action_by,
        notes,
        clearing_reason,
        source_table,
        source_record_id
    ) VALUES (
        NEW.employer_id,
        v_project_id,
        v_action_type,
        v_action_by,
        v_notes,
        v_clearing_reason,
        TG_TABLE_NAME,
        NEW.id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for all relevant tables
DROP TRIGGER IF EXISTS employer_compliance_sham_contracting_audit ON public.employer_compliance_checks;
CREATE TRIGGER employer_compliance_sham_contracting_audit
    AFTER UPDATE ON public.employer_compliance_checks
    FOR EACH ROW
    WHEN (OLD.sham_contracting_detected IS DISTINCT FROM NEW.sham_contracting_detected OR
          OLD.sham_contracting_cleared_date IS DISTINCT FROM NEW.sham_contracting_cleared_date)
    EXECUTE FUNCTION public.log_sham_contracting_change();

DROP TRIGGER IF EXISTS subcontractor_assessments_sham_contracting_audit ON public.subcontractor_assessments_4point;
CREATE TRIGGER subcontractor_assessments_sham_contracting_audit
    AFTER UPDATE ON public.subcontractor_assessments_4point
    FOR EACH ROW
    WHEN (OLD.sham_contracting_detected IS DISTINCT FROM NEW.sham_contracting_detected OR
          OLD.sham_contracting_cleared_date IS DISTINCT FROM NEW.sham_contracting_cleared_date)
    EXECUTE FUNCTION public.log_sham_contracting_change();

DROP TRIGGER IF EXISTS organiser_expertise_sham_contracting_audit ON public.organiser_overall_expertise_ratings;
CREATE TRIGGER organiser_expertise_sham_contracting_audit
    AFTER UPDATE ON public.organiser_overall_expertise_ratings
    FOR EACH ROW
    WHEN (OLD.sham_contracting_detected IS DISTINCT FROM NEW.sham_contracting_detected OR
          OLD.sham_contracting_cleared_date IS DISTINCT FROM NEW.sham_contracting_cleared_date)
    EXECUTE FUNCTION public.log_sham_contracting_change();

-- ============================================================================
-- 6. Helper function: Get employer sham contracting status (aggregated)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_employer_sham_contracting_status(p_employer_id uuid)
RETURNS TABLE (
    has_active_flags boolean,
    total_flags integer,
    active_flags integer,
    cleared_flags integer,
    latest_flag_date timestamp with time zone,
    latest_flag_notes text,
    latest_clear_date timestamp with time zone,
    flagged_projects uuid[]
) AS $$
BEGIN
    RETURN QUERY
    WITH all_flags AS (
        -- From employer_compliance_checks
        SELECT 
            project_id,
            sham_contracting_detected,
            sham_contracting_detected_date,
            sham_contracting_detection_notes,
            sham_contracting_cleared_date
        FROM public.employer_compliance_checks
        WHERE employer_id = p_employer_id
          AND is_current = true
        
        UNION ALL
        
        -- From subcontractor_assessments_4point
        SELECT 
            project_id,
            sham_contracting_detected,
            sham_contracting_detected_date,
            sham_contracting_detection_notes,
            sham_contracting_cleared_date
        FROM public.subcontractor_assessments_4point
        WHERE employer_id = p_employer_id
        
        UNION ALL
        
        -- From organiser_overall_expertise_ratings
        SELECT 
            NULL::uuid as project_id,
            sham_contracting_detected,
            sham_contracting_detected_date,
            sham_contracting_detection_notes,
            sham_contracting_cleared_date
        FROM public.organiser_overall_expertise_ratings
        WHERE employer_id = p_employer_id
          AND is_active = true
    ),
    aggregated AS (
        SELECT
            BOOL_OR(sham_contracting_detected AND sham_contracting_cleared_date IS NULL) as has_active,
            COUNT(*) FILTER (WHERE sham_contracting_detected_date IS NOT NULL) as total,
            COUNT(*) FILTER (WHERE sham_contracting_detected AND sham_contracting_cleared_date IS NULL) as active,
            COUNT(*) FILTER (WHERE sham_contracting_cleared_date IS NOT NULL) as cleared,
            MAX(sham_contracting_detected_date) as latest_date,
            MAX(sham_contracting_cleared_date) as latest_clear,
            ARRAY_AGG(DISTINCT project_id) FILTER (WHERE project_id IS NOT NULL AND sham_contracting_detected AND sham_contracting_cleared_date IS NULL) as projects
        FROM all_flags
    ),
    latest_note AS (
        SELECT sham_contracting_detection_notes
        FROM all_flags
        WHERE sham_contracting_detected_date = (SELECT latest_date FROM aggregated)
        LIMIT 1
    )
    SELECT
        COALESCE(a.has_active, false),
        COALESCE(a.total::integer, 0),
        COALESCE(a.active::integer, 0),
        COALESCE(a.cleared::integer, 0),
        a.latest_date,
        n.sham_contracting_detection_notes,
        a.latest_clear,
        COALESCE(a.projects, ARRAY[]::uuid[])
    FROM aggregated a
    CROSS JOIN latest_note n;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_employer_sham_contracting_status(uuid) TO authenticated;

-- ============================================================================
-- 7. Helper function: Get project sham contracting status
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_project_sham_contracting_status(p_project_id uuid)
RETURNS TABLE (
    has_sham_contracting boolean,
    flagged_employer_count integer,
    flagged_employers jsonb
) AS $$
BEGIN
    RETURN QUERY
    WITH flagged AS (
        SELECT DISTINCT
            ecc.employer_id,
            e.name as employer_name,
            ecc.sham_contracting_detected_date,
            ecc.sham_contracting_detection_notes
        FROM public.employer_compliance_checks ecc
        JOIN public.employers e ON e.id = ecc.employer_id
        WHERE ecc.project_id = p_project_id
          AND ecc.sham_contracting_detected = true
          AND ecc.sham_contracting_cleared_date IS NULL
          AND ecc.is_current = true
        
        UNION
        
        SELECT DISTINCT
            sa.employer_id,
            e.name as employer_name,
            sa.sham_contracting_detected_date,
            sa.sham_contracting_detection_notes
        FROM public.subcontractor_assessments_4point sa
        JOIN public.employers e ON e.id = sa.employer_id
        WHERE sa.project_id = p_project_id
          AND sa.sham_contracting_detected = true
          AND sa.sham_contracting_cleared_date IS NULL
    )
    SELECT
        COALESCE(COUNT(*) > 0, false),
        COUNT(*)::integer,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'employer_id', employer_id,
                    'employer_name', employer_name,
                    'detected_date', sham_contracting_detected_date,
                    'notes', sham_contracting_detection_notes
                )
                ORDER BY sham_contracting_detected_date DESC
            ),
            '[]'::jsonb
        )
    FROM flagged;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_project_sham_contracting_status(uuid) TO authenticated;

-- ============================================================================
-- 8. Add sham contracting indicator to employer_ratings_4point
-- ============================================================================

ALTER TABLE public.employer_ratings_4point
ADD COLUMN IF NOT EXISTS sham_contracting_block boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sham_contracting_block_reason text;

COMMENT ON COLUMN public.employer_ratings_4point.sham_contracting_block IS 
'Indicates if rating is capped due to active sham contracting detection. Prevents green rating (max yellow).';

-- ============================================================================
-- 9. Add sham contracting indicator to employer_final_ratings
-- ============================================================================

ALTER TABLE public.employer_final_ratings
ADD COLUMN IF NOT EXISTS sham_contracting_block boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sham_contracting_block_reason text;

COMMENT ON COLUMN public.employer_final_ratings.sham_contracting_block IS 
'Indicates if rating is capped due to active sham contracting detection. Prevents green rating (max yellow).';

-- ============================================================================
-- 10. Comments and documentation
-- ============================================================================

COMMENT ON TABLE public.sham_contracting_audit_log IS 
'Audit trail for all sham contracting detection flags and clearances. Provides full history for compliance tracking.';

COMMENT ON FUNCTION public.get_employer_sham_contracting_status(uuid) IS 
'Aggregates sham contracting status across all projects and assessments for an employer.';

COMMENT ON FUNCTION public.get_project_sham_contracting_status(uuid) IS 
'Checks if any employers on a project have active sham contracting flags.';

