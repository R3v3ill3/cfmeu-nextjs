-- CFMEU Rating System Transformation - Union Respect Assessments
-- This migration creates the comprehensive union respect assessment framework
-- as part of the 4-point rating system transformation

-- Create 4-point rating enum for assessments
CREATE TYPE public.four_point_rating AS ENUM (
    'good',      -- 1 point - Good performance
    'fair',      -- 2 points - Fair performance
    'poor',      -- 3 points - Poor performance
    'terrible'   -- 4 points - Terrible performance
);

-- Create assessment context enum for role-specific evaluations
CREATE TYPE public.assessment_context AS ENUM (
    'trade_specific',
    'builder_specific',
    'general',
    'mixed_project'
);

-- Create rating confidence level enum
CREATE TYPE public.rating_confidence_level AS ENUM (
    'very_high',
    'high',
    'medium',
    'low'
);

-- Create union respect assessments table
-- This supports the comprehensive union respect assessment framework
CREATE TABLE IF NOT EXISTS public.union_respect_assessments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    assessment_date date NOT NULL,
    assessment_period_start date,
    assessment_period_end date,
    assessment_context assessment_context NOT NULL DEFAULT 'general',

    -- 4-point scale assessment components
    right_of_entry_rating four_point_rating,
    right_of_entry_score integer CHECK (right_of_entry_score >= 1 AND right_of_entry_score <= 4),
    right_of_entry_notes text,

    delegate_accommodation_rating four_point_rating,
    delegate_accommodation_score integer CHECK (delegate_accommodation_score >= 1 AND delegate_accommodation_score <= 4),
    delegate_accommodation_notes text,

    access_to_information_rating four_point_rating,
    access_to_information_score integer CHECK (access_to_information_score >= 1 AND access_to_information_score <= 4),
    access_to_information_notes text,

    access_to_inductions_rating four_point_rating,
    access_to_inductions_score integer CHECK (access_to_inductions_score >= 1 AND access_to_inductions_score <= 4),
    access_to_inductions_notes text,

    -- Overall union respect calculation
    overall_union_respect_score numeric CHECK (overall_union_respect_score >= 1 AND overall_union_respect_score <= 4),
    overall_union_respect_rating four_point_rating,

    -- Assessment metadata
    assessor_id uuid REFERENCES public.profiles(id),
    assessor_name text,
    assessor_role text,
    assessment_method text CHECK (assessment_method IN ('site_visit', 'delegate_interview', 'organiser_knowledge', 'formal_complaint', 'incident_report', 'meeting_observation')),
    confidence_level rating_confidence_level DEFAULT 'medium',

    -- Supporting evidence
    specific_incidents jsonb DEFAULT '[]',
    positive_examples jsonb DEFAULT '[]',
    concerns_raised jsonb DEFAULT '[]',
    witness_statements jsonb DEFAULT '[]',
    supporting_documents jsonb DEFAULT '[]',

    -- Follow-up actions
    improvement_required boolean DEFAULT false,
    improvement_actions text[],
    follow_up_date date,
    union_meeting_required boolean DEFAULT false,

    -- Data quality and validation
    assessment_complete boolean DEFAULT false,
    validation_notes text,
    data_sources jsonb DEFAULT '[]',

    -- Lifecycle management
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id),

    -- Unique constraint to prevent duplicate assessments
    UNIQUE(employer_id, project_id, assessment_date, assessment_context)
);

-- Safety assessments table (4-point scale)
-- Replaces numeric safety scores with 4-point scale assessment
CREATE TABLE IF NOT EXISTS public.safety_assessments_4_point (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    assessment_date date NOT NULL,
    assessment_period_start date,
    assessment_period_end date,
    assessment_context assessment_context NOT NULL DEFAULT 'general',

    -- 4-point scale safety assessment components
    hsr_respect_rating four_point_rating,
    hsr_respect_score integer CHECK (hsr_respect_score >= 1 AND hsr_respect_score <= 4),
    hsr_respect_notes text,

    general_safety_rating four_point_rating,
    general_safety_score integer CHECK (general_safety_score >= 1 AND general_safety_score <= 4),
    general_safety_notes text,

    safety_incidents_rating four_point_rating,
    safety_incidents_score integer CHECK (safety_incidents_score >= 1 AND safety_incidents_score <= 4),
    safety_incidents_notes text,

    -- Overall safety calculation
    overall_safety_score numeric CHECK (overall_safety_score >= 1 AND overall_safety_score <= 4),
    overall_safety_rating four_point_rating,

    -- Safety-specific assessment details
    safety_systems_reviewed boolean DEFAULT false,
    safety_systems_quality text,
    incident_history_reviewed boolean DEFAULT false,
    incident_prevention_effectiveness text,
    worker_safety_consultation text,

    -- Assessment metadata
    assessor_id uuid REFERENCES public.profiles(id),
    assessor_name text,
    assessor_qualifications text[],
    assessment_method text CHECK (assessment_method IN ('site_inspection', 'document_review', 'interview', 'incident_analysis', 'safety_audit')),
    confidence_level rating_confidence_level DEFAULT 'medium',

    -- Safety-specific evidence
    safety_incidents_reviewed jsonb DEFAULT '[]',
    safety_documents_reviewed jsonb DEFAULT '[]',
    safety_observations jsonb DEFAULT '[]',
    worker_interviews jsonb DEFAULT '[]',

    -- Follow-up actions
    safety_improvements_required boolean DEFAULT false,
    safety_improvement_plan text[],
    safety_follow_up_date date,
    work_cover_notified boolean DEFAULT false,

    -- Data quality
    assessment_complete boolean DEFAULT false,
    validation_notes text,

    -- Lifecycle management
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id),

    UNIQUE(employer_id, project_id, assessment_date, assessment_context)
);

-- Subcontractor use assessments table
-- Assesses subcontractor usage patterns and treatment
CREATE TABLE IF NOT EXISTS public.subcontractor_use_assessments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    assessment_date date NOT NULL,
    assessment_period_start date,
    assessment_period_end date,
    assessment_context assessment_context NOT NULL DEFAULT 'general',

    -- 4-point scale subcontractor assessment
    usage_rating four_point_rating,
    usage_score integer CHECK (usage_score >= 1 AND usage_score <= 4),
    usage_notes text,

    -- Subcontractor specific metrics
    subcontractor_count integer DEFAULT 0,
    direct_employee_count integer DEFAULT 0,
    subcontractor_percentage numeric CHECK (subcontractor_percentage >= 0 AND subcontractor_percentage <= 100),
    assessment_basis text CHECK (assessment_basis IN ('project_observation', 'workforce_analysis', 'subcontractor_interview', 'site_review', 'document_analysis')),

    -- Duration and stability analysis
    average_subcontractor_duration_months numeric,
    subcontractor_turnover_rate numeric CHECK (subcontractor_turnover_rate >= 0 AND subcontractor_turnover_rate <= 100),
    long_term_subcontractors integer DEFAULT 0,

    -- Treatment and compliance assessment
    payment_terms_assessment text,
    work_conditions_assessment text,
    compliance_monitoring text,

    -- Overall calculation
    overall_subcontractor_score numeric CHECK (overall_subcontractor_score >= 1 AND overall_subcontractor_score <= 4),
    overall_subcontractor_rating four_point_rating,

    -- Assessment metadata
    assessor_id uuid REFERENCES public.profiles(id),
    assessor_name text,
    confidence_level rating_confidence_level DEFAULT 'medium',

    -- Supporting data
    subcontractor_list jsonb DEFAULT '[]',
    subcontractor_complaints jsonb DEFAULT '[]',
    positive_subcontractor_feedback jsonb DEFAULT '[]',

    -- Follow-up actions
    review_required boolean DEFAULT false,
    review_focus_areas text[],
    follow_up_date date,

    -- Data quality
    assessment_complete boolean DEFAULT false,
    validation_notes text,

    -- Lifecycle management
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id),

    UNIQUE(employer_id, project_id, assessment_date, assessment_context)
);

-- Role-specific assessments table (primarily for builders)
-- Assesses builder-specific responsibilities and behaviors
CREATE TABLE IF NOT EXISTS public.role_specific_assessments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    assessment_date date NOT NULL,
    assessment_period_start date,
    assessment_period_end date,
    employer_role assessment_context NOT NULL, -- Must be builder_specific or mixed_project

    -- Builder-specific assessment components
    tender_consultation_rating four_point_rating,
    tender_consultation_score integer CHECK (tender_consultation_score >= 1 AND tender_consultation_score <= 4),
    tender_consultation_notes text,

    open_communication_rating four_point_rating,
    open_communication_score integer CHECK (open_communication_score >= 1 AND open_communication_score <= 4),
    open_communication_notes text,

    delegate_facilities_rating four_point_rating,
    delegate_facilities_score integer CHECK (delegate_facilities_score >= 1 AND delegate_facilities_score <= 4),
    delegate_facilities_notes text,

    -- Builder-specific compliance metrics
    contractor_compliance_percentage numeric CHECK (contractor_compliance_percentage >= 0 AND contractor_compliance_percentage <= 100),
    eba_contractor_percentage numeric CHECK (eba_contractor_percentage >= 0 AND eba_contractor_percentage <= 100),
    subcontractor_safety_compliance numeric CHECK (subcontractor_safety_compliance >= 0 AND subcontractor_safety_compliance <= 100),

    -- Project management assessment
    project_coordination_rating four_point_rating,
    project_coordination_score integer CHECK (project_coordination_score >= 1 AND project_coordination_score <= 4),
    project_coordination_notes text,

    dispute_resolution_rating four_point_rating,
    dispute_resolution_score integer CHECK (dispute_resolution_score >= 1 AND dispute_resolution_score <= 4),
    dispute_resolution_notes text,

    -- Overall role-specific calculation
    overall_role_specific_score numeric CHECK (overall_role_specific_score >= 1 AND overall_role_specific_score <= 4),
    overall_role_specific_rating four_point_rating,

    -- Assessment metadata
    assessor_id uuid REFERENCES public.profiles(id),
    assessor_name text,
    assessor_expertise_area text,
    confidence_level rating_confidence_level DEFAULT 'medium',

    -- Supporting evidence
    project_documentation_reviewed jsonb DEFAULT '[]',
    stakeholder_interviews jsonb DEFAULT '[]',
    site_observations jsonb DEFAULT '[]',

    -- Follow-up actions
    builder_improvements_required boolean DEFAULT false,
    improvement_areas text[],
    follow_up_date date,

    -- Data quality
    assessment_complete boolean DEFAULT false,
    validation_notes text,

    -- Lifecycle management
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id),

    UNIQUE(employer_id, project_id, assessment_date, employer_role)
);

-- Create indexes for performance optimization
CREATE INDEX idx_union_respect_assessments_employer ON public.union_respect_assessments(employer_id, assessment_date DESC);
CREATE INDEX idx_union_respect_assessments_project ON public.union_respect_assessments(project_id, assessment_date DESC);
CREATE INDEX idx_union_respect_assessments_context ON public.union_respect_assessments(assessment_context, is_active);
CREATE INDEX idx_union_respect_assessments_assessor ON public.union_respect_assessments(assessor_id, assessment_date DESC);

CREATE INDEX idx_safety_assessments_4_point_employer ON public.safety_assessments_4_point(employer_id, assessment_date DESC);
CREATE INDEX idx_safety_assessments_4_point_project ON public.safety_assessments_4_point(project_id, assessment_date DESC);
CREATE INDEX idx_safety_assessments_4_point_context ON public.safety_assessments_4_point(assessment_context, is_active);
CREATE INDEX idx_safety_assessments_4_point_assessor ON public.safety_assessments_4_point(assessor_id, assessment_date DESC);

CREATE INDEX idx_subcontractor_use_assessments_employer ON public.subcontractor_use_assessments(employer_id, assessment_date DESC);
CREATE INDEX idx_subcontractor_use_assessments_project ON public.subcontractor_use_assessments(project_id, assessment_date DESC);
CREATE INDEX idx_subcontractor_use_assessments_context ON public.subcontractor_use_assessments(assessment_context, is_active);

CREATE INDEX idx_role_specific_assessments_employer ON public.role_specific_assessments(employer_id, assessment_date DESC);
CREATE INDEX idx_role_specific_assessments_project ON public.role_specific_assessments(project_id, assessment_date DESC);
CREATE INDEX idx_role_specific_assessments_role ON public.role_specific_assessments(employer_role, is_active);

-- Create triggers for updated_at columns
CREATE TRIGGER update_union_respect_assessments_updated_at
    BEFORE UPDATE ON public.union_respect_assessments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_safety_assessments_4_point_updated_at
    BEFORE UPDATE ON public.safety_assessments_4_point
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subcontractor_use_assessments_updated_at
    BEFORE UPDATE ON public.subcontractor_use_assessments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_role_specific_assessments_updated_at
    BEFORE UPDATE ON public.role_specific_assessments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.union_respect_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_assessments_4_point ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontractor_use_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_specific_assessments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for union respect assessments
CREATE POLICY "Union respect assessments read access" ON public.union_respect_assessments
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid()
                AND (p.scoped_employers = '{}'::uuid[] OR employer_id = ANY(p.scoped_employers))
            ) OR
            EXISTS (
                SELECT 1 FROM public.patch_project_mapping_view ppmv
                JOIN public.organiser_patch_assignments opa ON ppmv.patch_id = opa.patch_id
                WHERE ppmv.project_id = project_id
                AND opa.organiser_id = auth.uid()
                AND opa.effective_to IS NULL
            ) OR
            EXISTS (
                SELECT 1 FROM public.patch_project_mapping_view ppmv
                JOIN public.lead_organiser_patch_assignments lopa ON ppmv.patch_id = lopa.patch_id
                WHERE ppmv.project_id = project_id
                AND lopa.lead_organiser_id = auth.uid()
                AND lopa.effective_to IS NULL
            ) OR
            assessor_id = auth.uid()
        )
    );

CREATE POLICY "Union respect assessments write access" ON public.union_respect_assessments
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            created_by = auth.uid()
        )
    );

CREATE POLICY "Union respect assessments update access" ON public.union_respect_assessments
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            updated_by = auth.uid() OR
            assessor_id = auth.uid()
        )
    );

-- Similar RLS policies for other assessment tables
CREATE POLICY "Safety assessments 4 point read access" ON public.safety_assessments_4_point
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid()
                AND (p.scoped_employers = '{}'::uuid[] OR employer_id = ANY(p.scoped_employers))
            ) OR
            EXISTS (
                SELECT 1 FROM public.patch_project_mapping_view ppmv
                JOIN public.organiser_patch_assignments opa ON ppmv.patch_id = opa.patch_id
                WHERE ppmv.project_id = project_id
                AND opa.organiser_id = auth.uid()
                AND opa.effective_to IS NULL
            ) OR
            assessor_id = auth.uid()
        )
    );

CREATE POLICY "Safety assessments 4 point write access" ON public.safety_assessments_4_point
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            created_by = auth.uid() OR
            assessor_id = auth.uid()
        )
    );

CREATE POLICY "Subcontractor use assessments read access" ON public.subcontractor_use_assessments
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid()
                AND (p.scoped_employers = '{}'::uuid[] OR employer_id = ANY(p.scoped_employers))
            ) OR
            assessor_id = auth.uid()
        )
    );

CREATE POLICY "Subcontractor use assessments write access" ON public.subcontractor_use_assessments
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            created_by = auth.uid()
        )
    );

CREATE POLICY "Role specific assessments read access" ON public.role_specific_assessments
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid()
                AND (p.scoped_employers = '{}'::uuid[] OR employer_id = ANY(p.scoped_employers))
            ) OR
            assessor_id = auth.uid()
        )
    );

CREATE POLICY "Role specific assessments write access" ON public.role_specific_assessments
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            created_by = auth.uid()
        )
    );

-- Comments for documentation
COMMENT ON TYPE public.four_point_rating IS '4-point rating scale for assessments: good(1), fair(2), poor(3), terrible(4)';
COMMENT ON TYPE public.assessment_context IS 'Context for assessments: trade_specific, builder_specific, general, mixed_project';
COMMENT ON TABLE public.union_respect_assessments IS 'Comprehensive union respect assessment framework with 4-point scale ratings';
COMMENT ON TABLE public.safety_assessments_4_point IS 'Safety assessment framework using 4-point scale instead of numeric scores';
COMMENT ON TABLE public.subcontractor_use_assessments IS 'Assessment of subcontractor usage patterns and treatment';
COMMENT ON TABLE public.role_specific_assessments IS 'Role-specific assessments, primarily for builder responsibilities';

-- Grant permissions
GRANT ALL ON public.union_respect_assessments TO authenticated;
GRANT ALL ON public.safety_assessments_4_point TO authenticated;
GRANT ALL ON public.subcontractor_use_assessments TO authenticated;
GRANT ALL ON public.role_specific_assessments TO authenticated;