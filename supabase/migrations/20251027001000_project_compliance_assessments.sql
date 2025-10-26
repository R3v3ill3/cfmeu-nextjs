-- Employer Traffic Light Rating System - Track 1: Project Compliance Assessments
-- This migration creates the tables and structures for project-specific compliance assessments

-- Main project compliance assessments table
-- This stores detailed compliance data collected at the project level
CREATE TABLE IF NOT EXISTS public.project_compliance_assessments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    assessment_type compliance_assessment_type NOT NULL,
    severity_level integer CHECK (severity_level >= 1 AND severity_level <= 5),
    score numeric CHECK (score >= -100 AND score <= 100),
    rating traffic_light_rating,
    assessment_date date NOT NULL,
    assessment_period_start date,
    assessment_period_end date,
    assessor_id uuid REFERENCES public.profiles(id),
    assessor_name text,
    assessment_notes text,
    evidence_data jsonb DEFAULT '{}',
    source_document_id uuid,
    source_document_type text,
    confidence_level rating_confidence_level DEFAULT 'medium',
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id),
    UNIQUE(project_id, employer_id, assessment_type, assessment_date)
);

-- CBUS specific compliance tracking
CREATE TABLE IF NOT EXISTS public.cbus_compliance_records (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    cbus_compliant boolean NOT NULL,
    compliance_percentage numeric CHECK (compliance_percentage >= 0 AND compliance_percentage <= 100),
    total_employees integer DEFAULT 0,
    compliant_employees integer DEFAULT 0,
    last_verified_date date,
    verification_method text,
    non_compliance_reasons text[],
    next_review_date date,
    assessor_id uuid REFERENCES public.profiles(id),
    assessment_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id),
    UNIQUE(project_id, employer_id, last_verified_date)
);

-- Incolink specific compliance tracking
CREATE TABLE IF NOT EXISTS public.incolink_compliance_records (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    incolink_registered boolean NOT NULL,
    incolink_employer_id text,
    policy_active boolean DEFAULT true,
    policy_number text,
    coverage_amount numeric,
    coverage_percentage numeric CHECK (coverage_percentage >= 0 AND coverage_percentage <= 100),
    total_employees integer DEFAULT 0,
    covered_employees integer DEFAULT 0,
    last_premium_date date,
    expiry_date date,
    last_verified_date date,
    verification_method text,
    non_compliance_reasons text[],
    assessor_id uuid REFERENCES public.profiles(id),
    assessment_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id),
    UNIQUE(project_id, employer_id, last_verified_date)
);

-- Site visit compliance assessments
CREATE TABLE IF NOT EXISTS public.site_visit_compliance_assessments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    site_visit_id uuid NOT NULL REFERENCES public.site_visits(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    visit_date date NOT NULL,
    overall_score numeric CHECK (overall_score >= -100 AND overall_score <= 100),
    overall_rating traffic_light_rating,
    safety_compliance_score numeric CHECK (safety_compliance_score >= 0 AND safety_compliance_score <= 100),
    union_relations_score numeric CHECK (union_relations_score >= -100 AND union_relations_score <= 100),
    worker_conditions_score numeric CHECK (worker_conditions_score >= 0 AND worker_conditions_score <= 100),
    site_standards_score numeric CHECK (site_standards_score >= 0 AND site_standards_score <= 100),
    specific_findings jsonb DEFAULT '[]',
    positive_observations text[],
    compliance_concerns text[],
    immediate_actions_required text[],
    follow_up_required boolean DEFAULT false,
    follow_up_date date,
    visitor_id uuid REFERENCES public.profiles(id),
    visitor_role text,
    assessment_notes text,
    photos_evidence jsonb DEFAULT '[]',
    documents_evidence jsonb DEFAULT '[]',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id)
);

-- Delegate reports compliance tracking
CREATE TABLE IF NOT EXISTS public.delegate_compliance_reports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    delegate_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    report_date date NOT NULL,
    report_period_start date,
    report_period_end date,
    overall_sentiment text CHECK (overall_sentiment IN ('very_positive', 'positive', 'neutral', 'negative', 'very_negative')),
    union_cooperation_score numeric CHECK (union_cooperation_score >= -100 AND union_cooperation_score <= 100),
    safety_observation_score numeric CHECK (safety_observation_score >= -100 AND safety_observation_score <= 100),
    payment_compliance boolean,
    payment_issues text[],
    worker_treatment_issues text[],
    safety_concerns text[],
    positive_comments text[],
    urgent_escalations boolean DEFAULT false,
    escalation_details text,
    follow_up_required boolean DEFAULT false,
    follow_up_action_items text[],
    report_text text,
    contact_method text CHECK (contact_method IN ('verbal', 'written', 'phone', 'email', 'meeting')),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id),
    UNIQUE(delegate_id, project_id, employer_id, report_date)
);

-- Organiser reports (verbal and written) compliance tracking
CREATE TABLE IF NOT EXISTS public.organiser_compliance_reports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organiser_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    report_type text CHECK (report_type IN ('verbal', 'written', 'site_observation', 'phone_call')),
    report_date date NOT NULL,
    contact_person text,
    contact_method text,
    report_period_start date,
    report_period_end date,
    overall_assessment text CHECK (overall_assessment IN ('excellent', 'good', 'satisfactory', 'concerning', 'poor')),
    compliance_areas jsonb DEFAULT '{}',
    specific_issues text[],
    positive_developments text[],
    action_taken text[],
    recommended_actions text[],
    urgency_level integer CHECK (urgency_level >= 1 AND urgency_level <= 5),
    requires_follow_up boolean DEFAULT false,
    follow_up_date date,
    report_text text,
    supporting_documents jsonb DEFAULT '[]',
    confidence_level rating_confidence_level DEFAULT 'medium',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id)
);

-- Safety incidents tracking
CREATE TABLE IF NOT EXISTS public.safety_incident_compliance (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    incident_date date NOT NULL,
    incident_type text NOT NULL,
    severity_level integer CHECK (severity_level >= 1 AND severity_level <= 5),
    description text,
    immediate_action_taken text,
    corrective_actions jsonb DEFAULT '[]',
    prevention_measures jsonb DEFAULT '[]',
    union_notified boolean DEFAULT false,
    work_safe_notified boolean DEFAULT false,
    investigation_required boolean DEFAULT false,
    investigation_status text,
    impact_on_workers text,
    resolution_date date,
    reported_by uuid REFERENCES public.profiles(id),
    assessor_id uuid REFERENCES public.profiles(id),
    assessment_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id)
);

-- Industrial disputes tracking
CREATE TABLE IF NOT EXISTS public.industrial_dispute_records (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    dispute_date date NOT NULL,
    dispute_type text NOT NULL,
    severity_level integer CHECK (severity_level >= 1 AND severity_level <= 5),
    description text,
    issues_involved text[],
    workers_involved integer DEFAULT 0,
    duration_days integer DEFAULT 0,
    resolution_status text,
    resolution_date date,
    union_representative uuid REFERENCES public.profiles(id),
    employer_representative text,
    outcome text,
    ongoing_issues boolean DEFAULT false,
    prevention_actions jsonb DEFAULT '[]',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id)
);

-- Payment and wage compliance tracking
CREATE TABLE IF NOT EXISTS public.payment_compliance_records (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    assessment_date date NOT NULL,
    assessment_period_start date,
    assessment_period_end date,
    payment_compliance boolean NOT NULL,
    wage_rate_compliance boolean NOT NULL,
    superannuation_compliance boolean NOT NULL,
    allowance_compliance boolean NOT NULL,
    total_workers integer DEFAULT 0,
    compliant_workers integer DEFAULT 0,
    underpayment_amount numeric DEFAULT 0,
    underpayment_period_days integer DEFAULT 0,
    issues_identified text[],
    corrective_actions jsonb DEFAULT '[]',
    repayment_plan text,
    verification_method text,
    next_audit_date date,
    assessor_id uuid REFERENCES public.profiles(id),
    assessment_notes text,
    evidence_documents jsonb DEFAULT '[]',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id),
    UNIQUE(project_id, employer_id, assessment_date)
);

-- Project compliance summary (calculated from all project assessments)
CREATE TABLE IF NOT EXISTS public.project_compliance_summary (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    summary_date date NOT NULL,
    overall_score numeric CHECK (overall_score >= -100 AND overall_score <= 100),
    overall_rating traffic_light_rating,
    cbus_score numeric,
    incolink_score numeric,
    safety_score numeric,
    payment_score numeric,
    union_relations_score numeric,
    total_assessments integer DEFAULT 0,
    assessment_categories jsonb DEFAULT '{}',
    confidence_level rating_confidence_level,
    data_quality_score numeric CHECK (data_quality_score >= 0 AND data_quality_score <= 100),
    last_updated timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid REFERENCES public.profiles(id),
    UNIQUE(project_id, employer_id, summary_date)
);

-- Create indexes for performance
CREATE INDEX idx_project_compliance_assessments_project ON public.project_compliance_assessments(project_id, assessment_date DESC);
CREATE INDEX idx_project_compliance_assessments_employer ON public.project_compliance_assessments(employer_id, assessment_date DESC);
CREATE INDEX idx_project_compliance_assessments_type ON public.project_compliance_assessments(assessment_type, is_active);
CREATE INDEX idx_cbus_compliance_records_project ON public.cbus_compliance_records(project_id, last_verified_date DESC);
CREATE INDEX idx_incolink_compliance_records_project ON public.incolink_compliance_records(project_id, last_verified_date DESC);
CREATE INDEX idx_site_visit_compliance_assessments_visit ON public.site_visit_compliance_assessments(site_visit_id);
CREATE INDEX idx_site_visit_compliance_assessments_project ON public.site_visit_compliance_assessments(project_id, visit_date DESC);
CREATE INDEX idx_delegate_compliance_reports_delegate ON public.delegate_compliance_reports(delegate_id, report_date DESC);
CREATE INDEX idx_delegate_compliance_reports_project ON public.delegate_compliance_reports(project_id, report_date DESC);
CREATE INDEX idx_organiser_compliance_reports_organiser ON public.organiser_compliance_reports(organiser_id, report_date DESC);
CREATE INDEX idx_organiser_compliance_reports_project ON public.organiser_compliance_reports(project_id, report_date DESC);
CREATE INDEX idx_safety_incident_compliance_project ON public.safety_incident_compliance(project_id, incident_date DESC);
CREATE INDEX idx_safety_incident_compliance_employer ON public.safety_incident_compliance(employer_id, incident_date DESC);
CREATE INDEX idx_industrial_dispute_records_project ON public.industrial_dispute_records(project_id, dispute_date DESC);
CREATE INDEX idx_industrial_dispute_records_employer ON public.industrial_dispute_records(employer_id, dispute_date DESC);
CREATE INDEX idx_payment_compliance_records_project ON public.payment_compliance_records(project_id, assessment_date DESC);
CREATE INDEX idx_payment_compliance_records_employer ON public.payment_compliance_records(employer_id, assessment_date DESC);
CREATE INDEX idx_project_compliance_summary_project ON public.project_compliance_summary(project_id, summary_date DESC);
CREATE INDEX idx_project_compliance_summary_employer ON public.project_compliance_summary(employer_id, summary_date DESC);

-- Add updated_at triggers
CREATE TRIGGER update_project_compliance_assessments_updated_at
    BEFORE UPDATE ON public.project_compliance_assessments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cbus_compliance_records_updated_at
    BEFORE UPDATE ON public.cbus_compliance_records
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_incolink_compliance_records_updated_at
    BEFORE UPDATE ON public.incolink_compliance_records
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_site_visit_compliance_assessments_updated_at
    BEFORE UPDATE ON public.site_visit_compliance_assessments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_delegate_compliance_reports_updated_at
    BEFORE UPDATE ON public.delegate_compliance_reports
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organiser_compliance_reports_updated_at
    BEFORE UPDATE ON public.organiser_compliance_reports
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_safety_incident_compliance_updated_at
    BEFORE UPDATE ON public.safety_incident_compliance
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_industrial_dispute_records_updated_at
    BEFORE UPDATE ON public.industrial_dispute_records
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_compliance_records_updated_at
    BEFORE UPDATE ON public.payment_compliance_records
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to trigger summary recalculation when related data changes
CREATE OR REPLACE FUNCTION public.trigger_project_compliance_summary_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update compliance summary when assessments change
    INSERT INTO public.project_compliance_summary (
        project_id, employer_id, summary_date, updated_by
    ) VALUES (
        NEW.project_id, NEW.employer_id, CURRENT_DATE, NEW.updated_by
    )
    ON CONFLICT (project_id, employer_id, summary_date)
    DO UPDATE SET
        last_updated = NOW(),
        updated_by = NEW.updated_by;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to recalculate summaries when assessments change
CREATE TRIGGER trigger_compliance_assessment_summary_update
    AFTER INSERT OR UPDATE ON public.project_compliance_assessments
    FOR EACH ROW EXECUTE FUNCTION public.trigger_project_compliance_summary_update();

CREATE TRIGGER trigger_cbus_compliance_summary_update
    AFTER INSERT OR UPDATE ON public.cbus_compliance_records
    FOR EACH ROW EXECUTE FUNCTION public.trigger_project_compliance_summary_update();

CREATE TRIGGER trigger_incolink_compliance_summary_update
    AFTER INSERT OR UPDATE ON public.incolink_compliance_records
    FOR EACH ROW EXECUTE FUNCTION public.trigger_project_compliance_summary_update();

CREATE TRIGGER trigger_site_visit_summary_update
    AFTER INSERT OR UPDATE ON public.site_visit_compliance_assessments
    FOR EACH ROW EXECUTE FUNCTION public.trigger_project_compliance_summary_update();

CREATE TRIGGER trigger_delegate_report_summary_update
    AFTER INSERT OR UPDATE ON public.delegate_compliance_reports
    FOR EACH ROW EXECUTE FUNCTION public.trigger_project_compliance_summary_update();

CREATE TRIGGER trigger_organiser_report_summary_update
    AFTER INSERT OR UPDATE ON public.organiser_compliance_reports
    FOR EACH ROW EXECUTE FUNCTION public.trigger_project_compliance_summary_update();

CREATE TRIGGER trigger_safety_incident_summary_update
    AFTER INSERT OR UPDATE ON public.safety_incident_compliance
    FOR EACH ROW EXECUTE FUNCTION public.trigger_project_compliance_summary_update();

CREATE TRIGGER trigger_industrial_dispute_summary_update
    AFTER INSERT OR UPDATE ON public.industrial_dispute_records
    FOR EACH ROW EXECUTE FUNCTION public.trigger_project_compliance_summary_update();

CREATE TRIGGER trigger_payment_compliance_summary_update
    AFTER INSERT OR UPDATE ON public.payment_compliance_records
    FOR EACH ROW EXECUTE FUNCTION public.trigger_project_compliance_summary_update();

-- Enable Row Level Security
ALTER TABLE public.project_compliance_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbus_compliance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incolink_compliance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visit_compliance_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delegate_compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organiser_compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_incident_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.industrial_dispute_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_compliance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_compliance_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project compliance tables
-- Users can view records for projects they have access to
CREATE POLICY "Project compliance assessments read access" ON public.project_compliance_assessments
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid() AND p.role = 'admin'
            ) OR
            EXISTS (
                SELECT 1 FROM public.project_assignments pa
                WHERE pa.project_id = project_id
                AND pa.user_id = auth.uid()
            ) OR
            EXISTS (
                SELECT 1 FROM public.profiles p
                JOIN public.role_hierarchy rh ON rh.parent_user_id = auth.uid()
                WHERE rh.child_user_id = p.id AND p.role = 'organiser'
            )
        )
    );

CREATE POLICY "Project compliance assessments write access" ON public.project_compliance_assessments
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND (
            EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid() AND p.role = 'admin'
            ) OR
            EXISTS (
                SELECT 1 FROM public.project_assignments pa
                WHERE pa.project_id = project_id
                AND pa.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Project compliance assessments update access" ON public.project_compliance_assessments
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND (
            EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid() AND p.role = 'admin'
            ) OR
            updated_by = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.project_assignments pa
                WHERE pa.project_id = project_id
                AND pa.user_id = auth.uid()
            )
        )
    );

-- Apply similar policies to other compliance tables (using a consistent pattern)
CREATE POLICY "CBUS compliance records read access" ON public.cbus_compliance_records
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            EXISTS (
                SELECT 1 FROM public.project_assignments pa
                WHERE pa.project_id = project_id AND pa.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "CBUS compliance records write access" ON public.cbus_compliance_records
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            EXISTS (
                SELECT 1 FROM public.project_assignments pa
                WHERE pa.project_id = project_id AND pa.user_id = auth.uid()
            )
        )
    );

-- Similar policies for other compliance tables...
CREATE POLICY "Incolink compliance records access" ON public.incolink_compliance_records
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            EXISTS (
                SELECT 1 FROM public.project_assignments pa
                WHERE pa.project_id = project_id AND pa.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Site visit compliance assessments access" ON public.site_visit_compliance_assessments
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            EXISTS (
                SELECT 1 FROM public.project_assignments pa
                WHERE pa.project_id = project_id AND pa.user_id = auth.uid()
            ) OR
            visitor_id = auth.uid()
        )
    );

CREATE POLICY "Delegate compliance reports access" ON public.delegate_compliance_reports
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            EXISTS (
                SELECT 1 FROM public.project_assignments pa
                WHERE pa.project_id = project_id AND pa.user_id = auth.uid()
            ) OR
            delegate_id = auth.uid()
        )
    );

CREATE POLICY "Organiser compliance reports access" ON public.organiser_compliance_reports
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            EXISTS (
                SELECT 1 FROM public.project_assignments pa
                WHERE pa.project_id = project_id AND pa.user_id = auth.uid()
            ) OR
            organiser_id = auth.uid()
        )
    );

CREATE POLICY "Safety incident compliance access" ON public.safety_incident_compliance
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            EXISTS (
                SELECT 1 FROM public.project_assignments pa
                WHERE pa.project_id = project_id AND pa.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Industrial dispute records access" ON public.industrial_dispute_records
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            EXISTS (
                SELECT 1 FROM public.project_assignments pa
                WHERE pa.project_id = project_id AND pa.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Payment compliance records access" ON public.payment_compliance_records
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            EXISTS (
                SELECT 1 FROM public.project_assignments pa
                WHERE pa.project_id = project_id AND pa.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Project compliance summary read access" ON public.project_compliance_summary
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            EXISTS (
                SELECT 1 FROM public.project_assignments pa
                WHERE pa.project_id = project_id AND pa.user_id = auth.uid()
            )
        )
    );

-- Comments for documentation
COMMENT ON TABLE public.project_compliance_assessments IS 'Main table for storing project-specific compliance assessments';
COMMENT ON TABLE public.cbus_compliance_records IS 'CBUS compliance tracking at project level';
COMMENT ON TABLE public.incolink_compliance_records IS 'Incolink insurance compliance tracking at project level';
COMMENT ON TABLE public.site_visit_compliance_assessments IS 'Compliance data from site visits';
COMMENT ON TABLE public.delegate_compliance_reports IS 'Compliance reports from union delegates';
COMMENT ON TABLE public.organiser_compliance_reports IS 'Compliance reports from union organisers (verbal and written)';
COMMENT ON TABLE public.safety_incident_compliance IS 'Safety incident tracking and compliance assessment';
COMMENT ON TABLE public.industrial_dispute_records IS 'Industrial disputes tracking and compliance impact';
COMMENT ON TABLE public.payment_compliance_records IS 'Payment and wage compliance tracking';
COMMENT ON TABLE public.project_compliance_summary IS 'Calculated summary of all project compliance data';