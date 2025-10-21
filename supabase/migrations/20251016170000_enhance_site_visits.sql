-- Site Visit Enhancement Migration
-- Adds support for visit reasons, follow-up actions, drafts, and offline sync

-- =============================================
-- 1. Add new columns to site_visit table
-- =============================================

-- Add new fields to support enhanced functionality
ALTER TABLE IF EXISTS public.site_visit
  ADD COLUMN IF NOT EXISTS date timestamptz DEFAULT now() NOT NULL,
  ADD COLUMN IF NOT EXISTS organiser_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS actions_taken text,
  ADD COLUMN IF NOT EXISTS visit_status text DEFAULT 'completed' NOT NULL,
  ADD COLUMN IF NOT EXISTS offline_created boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS attachments_meta jsonb DEFAULT '[]'::jsonb;

-- Add check constraint for visit_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'site_visit_status_check'
  ) THEN
    ALTER TABLE public.site_visit
      ADD CONSTRAINT site_visit_status_check 
      CHECK (visit_status IN ('draft', 'completed', 'scheduled'));
  END IF;
END $$;

-- Make employer_id nullable (site visit can be recorded without employer)
ALTER TABLE IF EXISTS public.site_visit
  ALTER COLUMN employer_id DROP NOT NULL;

-- =============================================
-- 2. Create site_visit_reason_definitions table
-- =============================================

CREATE TABLE IF NOT EXISTS public.site_visit_reason_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_name text NOT NULL,
  description text,
  is_global boolean DEFAULT false NOT NULL,
  created_by_lead_organiser_id uuid REFERENCES public.profiles(id),
  is_active boolean DEFAULT true NOT NULL,
  display_order integer DEFAULT 0 NOT NULL,
  always_visible boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT site_visit_reason_definitions_name_key UNIQUE (name, created_by_lead_organiser_id)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_site_visit_reason_definitions_active 
  ON public.site_visit_reason_definitions(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_site_visit_reason_definitions_lead 
  ON public.site_visit_reason_definitions(created_by_lead_organiser_id);

-- =============================================
-- 3. Create site_visit_reasons table
-- =============================================

CREATE TABLE IF NOT EXISTS public.site_visit_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.site_visit(id) ON DELETE CASCADE,
  reason_definition_id uuid NOT NULL REFERENCES public.site_visit_reason_definitions(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT site_visit_reasons_unique UNIQUE (visit_id, reason_definition_id)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_site_visit_reasons_visit 
  ON public.site_visit_reasons(visit_id);
CREATE INDEX IF NOT EXISTS idx_site_visit_reasons_definition 
  ON public.site_visit_reasons(reason_definition_id);

-- =============================================
-- 4. Create site_visit_follow_ups table
-- =============================================

CREATE TABLE IF NOT EXISTS public.site_visit_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.site_visit(id) ON DELETE CASCADE,
  description text NOT NULL,
  follow_up_type text DEFAULT 'checklist_item' NOT NULL,
  is_completed boolean DEFAULT false NOT NULL,
  completed_at timestamptz,
  due_date date,
  linked_activity_id uuid REFERENCES public.union_activities(id),
  calendar_event_details jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT site_visit_follow_ups_type_check 
    CHECK (follow_up_type IN ('checklist_item', 'linked_activity', 'calendar_event'))
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_site_visit_follow_ups_visit 
  ON public.site_visit_follow_ups(visit_id);
CREATE INDEX IF NOT EXISTS idx_site_visit_follow_ups_activity 
  ON public.site_visit_follow_ups(linked_activity_id);
CREATE INDEX IF NOT EXISTS idx_site_visit_follow_ups_due_date 
  ON public.site_visit_follow_ups(due_date) WHERE NOT is_completed;

-- =============================================
-- 5. Create view for organiser-lead assignments
-- =============================================

CREATE OR REPLACE VIEW public.v_organiser_lead_assignments AS
SELECT DISTINCT
  rh.child_user_id AS organiser_id,
  rh.parent_user_id AS lead_organiser_id
FROM public.role_hierarchy rh
WHERE rh.is_active = true
  AND (rh.end_date IS NULL OR rh.end_date >= CURRENT_DATE);

-- =============================================
-- 6. Seed global visit reason definitions
-- =============================================

INSERT INTO public.site_visit_reason_definitions 
  (name, display_name, description, is_global, always_visible, display_order)
VALUES
  ('compliance_audit', 'Compliance Audit', 'Verify employer compliance with safety, wages, and union agreements', true, true, 1),
  ('delegate_election', 'Delegate Election', 'Conduct or support delegate election process', true, true, 2),
  ('eba_vote', 'EBA Vote', 'Enterprise Bargaining Agreement voting activity', true, true, 3),
  ('safety_issue', 'Safety Issue', 'Address safety concerns or incidents at the site', true, true, 4),
  ('employer_meeting', 'Employer Meeting', 'Scheduled meeting with employer representatives', true, true, 5),
  ('delegate_1on1', 'Delegate 1-on-1', 'One-on-one meeting with site delegate', true, false, 6),
  ('site_meeting', 'Site Meeting', 'General site meeting with workers', true, false, 7),
  ('general_visit', 'General Visit', 'General site visit or check-in', true, false, 8)
ON CONFLICT (name, created_by_lead_organiser_id) DO NOTHING;

-- =============================================
-- 7. Add indexes for performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_site_visit_date 
  ON public.site_visit(date DESC);
CREATE INDEX IF NOT EXISTS idx_site_visit_project 
  ON public.site_visit(project_id);
CREATE INDEX IF NOT EXISTS idx_site_visit_job_site 
  ON public.site_visit(job_site_id);
CREATE INDEX IF NOT EXISTS idx_site_visit_organiser 
  ON public.site_visit(organiser_id);
CREATE INDEX IF NOT EXISTS idx_site_visit_status 
  ON public.site_visit(visit_status);
CREATE INDEX IF NOT EXISTS idx_site_visit_created_by 
  ON public.site_visit(created_by);

-- =============================================
-- 8. Update trigger for updated_at
-- =============================================

CREATE OR REPLACE FUNCTION public.update_site_visit_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_site_visit_updated_at_trigger ON public.site_visit;
CREATE TRIGGER update_site_visit_updated_at_trigger
  BEFORE UPDATE ON public.site_visit
  FOR EACH ROW
  EXECUTE FUNCTION public.update_site_visit_updated_at();

DROP TRIGGER IF EXISTS update_site_visit_reason_definitions_updated_at_trigger 
  ON public.site_visit_reason_definitions;
CREATE TRIGGER update_site_visit_reason_definitions_updated_at_trigger
  BEFORE UPDATE ON public.site_visit_reason_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_site_visit_updated_at();

DROP TRIGGER IF EXISTS update_site_visit_follow_ups_updated_at_trigger 
  ON public.site_visit_follow_ups;
CREATE TRIGGER update_site_visit_follow_ups_updated_at_trigger
  BEFORE UPDATE ON public.site_visit_follow_ups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_site_visit_updated_at();

-- =============================================
-- 9. Enable Row Level Security
-- =============================================

ALTER TABLE public.site_visit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visit_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visit_reason_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visit_follow_ups ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 10. RLS Policies for site_visit
-- =============================================

-- All authenticated users can view site visits
DROP POLICY IF EXISTS site_visit_select_policy ON public.site_visit;
CREATE POLICY site_visit_select_policy ON public.site_visit
  FOR SELECT TO authenticated
  USING (true);

-- All authenticated users can create site visits
DROP POLICY IF EXISTS site_visit_insert_policy ON public.site_visit;
CREATE POLICY site_visit_insert_policy ON public.site_visit
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Users can update their own visits, or lead_organisers/admins can update any
DROP POLICY IF EXISTS site_visit_update_policy ON public.site_visit;
CREATE POLICY site_visit_update_policy ON public.site_visit
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid() OR
    organiser_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'lead_organiser')
    )
  );

-- Users can delete their own visits, or lead_organisers/admins can delete any
DROP POLICY IF EXISTS site_visit_delete_policy ON public.site_visit;
CREATE POLICY site_visit_delete_policy ON public.site_visit
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid() OR
    organiser_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'lead_organiser')
    )
  );

-- =============================================
-- 11. RLS Policies for site_visit_reasons
-- =============================================

-- Users can view all reasons
DROP POLICY IF EXISTS site_visit_reasons_select_policy ON public.site_visit_reasons;
CREATE POLICY site_visit_reasons_select_policy ON public.site_visit_reasons
  FOR SELECT TO authenticated
  USING (true);

-- Users can insert reasons for visits they can update
DROP POLICY IF EXISTS site_visit_reasons_insert_policy ON public.site_visit_reasons;
CREATE POLICY site_visit_reasons_insert_policy ON public.site_visit_reasons
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.site_visit sv
      WHERE sv.id = visit_id AND (
        sv.created_by = auth.uid() OR
        sv.organiser_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'lead_organiser')
        )
      )
    )
  );

-- Users can update/delete reasons for visits they can update
DROP POLICY IF EXISTS site_visit_reasons_update_policy ON public.site_visit_reasons;
CREATE POLICY site_visit_reasons_update_policy ON public.site_visit_reasons
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.site_visit sv
      WHERE sv.id = visit_id AND (
        sv.created_by = auth.uid() OR
        sv.organiser_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'lead_organiser')
        )
      )
    )
  );

DROP POLICY IF EXISTS site_visit_reasons_delete_policy ON public.site_visit_reasons;
CREATE POLICY site_visit_reasons_delete_policy ON public.site_visit_reasons
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.site_visit sv
      WHERE sv.id = visit_id AND (
        sv.created_by = auth.uid() OR
        sv.organiser_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'lead_organiser')
        )
      )
    )
  );

-- =============================================
-- 12. RLS Policies for site_visit_reason_definitions
-- =============================================

-- Users can view all active reason definitions
DROP POLICY IF EXISTS site_visit_reason_definitions_select_policy 
  ON public.site_visit_reason_definitions;
CREATE POLICY site_visit_reason_definitions_select_policy 
  ON public.site_visit_reason_definitions
  FOR SELECT TO authenticated
  USING (is_active = true OR is_global = true);

-- Only lead_organisers can create custom reasons
DROP POLICY IF EXISTS site_visit_reason_definitions_insert_policy 
  ON public.site_visit_reason_definitions;
CREATE POLICY site_visit_reason_definitions_insert_policy 
  ON public.site_visit_reason_definitions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'lead_organiser'
    )
  );

-- Lead organisers can update their own custom reasons, admins can update any
DROP POLICY IF EXISTS site_visit_reason_definitions_update_policy 
  ON public.site_visit_reason_definitions;
CREATE POLICY site_visit_reason_definitions_update_policy 
  ON public.site_visit_reason_definitions
  FOR UPDATE TO authenticated
  USING (
    (created_by_lead_organiser_id = auth.uid() AND is_global = false) OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Lead organisers can delete their own custom reasons, admins can delete any
DROP POLICY IF EXISTS site_visit_reason_definitions_delete_policy 
  ON public.site_visit_reason_definitions;
CREATE POLICY site_visit_reason_definitions_delete_policy 
  ON public.site_visit_reason_definitions
  FOR DELETE TO authenticated
  USING (
    (created_by_lead_organiser_id = auth.uid() AND is_global = false) OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- 13. RLS Policies for site_visit_follow_ups
-- =============================================

-- Users can view all follow-ups
DROP POLICY IF EXISTS site_visit_follow_ups_select_policy ON public.site_visit_follow_ups;
CREATE POLICY site_visit_follow_ups_select_policy ON public.site_visit_follow_ups
  FOR SELECT TO authenticated
  USING (true);

-- Users can insert follow-ups for visits they can update
DROP POLICY IF EXISTS site_visit_follow_ups_insert_policy ON public.site_visit_follow_ups;
CREATE POLICY site_visit_follow_ups_insert_policy ON public.site_visit_follow_ups
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.site_visit sv
      WHERE sv.id = visit_id AND (
        sv.created_by = auth.uid() OR
        sv.organiser_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'lead_organiser')
        )
      )
    )
  );

-- Users can update/delete follow-ups for visits they can update
DROP POLICY IF EXISTS site_visit_follow_ups_update_policy ON public.site_visit_follow_ups;
CREATE POLICY site_visit_follow_ups_update_policy ON public.site_visit_follow_ups
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.site_visit sv
      WHERE sv.id = visit_id AND (
        sv.created_by = auth.uid() OR
        sv.organiser_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'lead_organiser')
        )
      )
    )
  );

DROP POLICY IF EXISTS site_visit_follow_ups_delete_policy ON public.site_visit_follow_ups;
CREATE POLICY site_visit_follow_ups_delete_policy ON public.site_visit_follow_ups
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.site_visit sv
      WHERE sv.id = visit_id AND (
        sv.created_by = auth.uid() OR
        sv.organiser_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'lead_organiser')
        )
      )
    )
  );

-- =============================================
-- 14. Comments for documentation
-- =============================================

COMMENT ON TABLE public.site_visit IS 'Site visits with enhanced tracking for reasons, follow-ups, and offline support';
COMMENT ON TABLE public.site_visit_reasons IS 'Links site visits to predefined or custom visit reasons';
COMMENT ON TABLE public.site_visit_reason_definitions IS 'Global and lead_organiser-specific visit reason taxonomy';
COMMENT ON TABLE public.site_visit_follow_ups IS 'Follow-up actions from site visits';
COMMENT ON VIEW public.v_organiser_lead_assignments IS 'Active organiser to lead_organiser relationships';

