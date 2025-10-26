-- Employer Traffic Light Rating System - Track 2: Organiser Overall Expertise Ratings
-- This migration creates the tables and structures for organiser-based overall expertise assessments

-- Main organiser overall expertise ratings table
-- This stores simplified overall assessments from organisers that go beyond specific project data
CREATE TABLE IF NOT EXISTS public.organiser_overall_expertise_ratings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    organiser_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assessment_date date NOT NULL,
    overall_score numeric CHECK (overall_score >= -100 AND overall_score <= 100),
    overall_rating traffic_light_rating,
    confidence_level rating_confidence_level DEFAULT 'medium',
    assessment_basis text NOT NULL, -- Description of why this assessment was made
    assessment_context text, -- Context beyond specific projects (industry reputation, etc.)
    eba_status_known boolean DEFAULT false,
    eba_status traffic_light_rating,
    knowledge_beyond_projects boolean DEFAULT false,
    knowledge_beyond_projects_details text,
    industry_reputation text,
    union_relationship_quality text CHECK (union_relationship_quality IN ('excellent', 'good', 'neutral', 'poor', 'very_poor')),
    historical_issues text[],
    recent_improvements boolean DEFAULT false,
    improvement_details text,
    future_concerns boolean DEFAULT false,
    concern_details text,
    assessment_notes text,
    is_active boolean DEFAULT true,
    expires_date date, -- Expertise ratings can expire if not updated
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id),
    UNIQUE(employer_id, organiser_id, assessment_date)
);

-- Wizard-based organiser assessments
-- This stores the step-by-step wizard responses that lead to the overall assessment
CREATE TABLE IF NOT EXISTS public.organiser_wizard_assessments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    organiser_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    wizard_session_id uuid NOT NULL DEFAULT gen_random_uuid(),
    wizard_step_id uuid NOT NULL REFERENCES public.organiser_wizard_config(id) ON DELETE RESTRICT,
    step_response jsonb NOT NULL,
    response_value text,
    score_impact numeric CHECK (score_impact >= -100 AND score_impact <= 100),
    response_date timestamp with time zone DEFAULT now() NOT NULL,
    session_started_at timestamp with time zone NOT NULL,
    session_completed_at timestamp with time zone,
    is_complete boolean DEFAULT false,
    completion_percentage numeric DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    calculated_score numeric,
    calculated_rating traffic_light_rating,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(wizard_session_id, wizard_step_id)
);

-- Wizard assessment summary (calculated from wizard responses)
CREATE TABLE IF NOT EXISTS public.organiser_wizard_assessment_summary (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    wizard_session_id uuid NOT NULL,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    organiser_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_date date NOT NULL,
    total_score numeric CHECK (total_score >= -100 AND total_score <= 100),
    final_rating traffic_light_rating,
    step_responses jsonb DEFAULT '{}',
    step_scores jsonb DEFAULT '{}',
    completion_percentage numeric CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    time_spent_minutes integer,
    assessment_summary text,
    key_factors jsonb DEFAULT '[]',
    confidence_level rating_confidence_level DEFAULT 'medium',
    is_complete boolean DEFAULT false,
    expires_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(wizard_session_id),
    UNIQUE(employer_id, organiser_id, session_date)
);

-- Expertise validation and comparison
-- This table tracks how well organiser expertise ratings align with project compliance data
CREATE TABLE IF NOT EXISTS public.expertise_validation_records (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    organiser_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    validation_date date NOT NULL,
    expertise_rating traffic_light_rating NOT NULL,
    expertise_score numeric CHECK (expertise_score >= -100 AND expertise_score <= 100),
    project_based_rating traffic_light_rating NOT NULL,
    project_based_score numeric CHECK (project_based_score >= -100 AND project_based_score <= 100),
    rating_match boolean NOT NULL,
    score_difference numeric,
    validation_context text, -- What project data was used for comparison
    data_confidence_level rating_confidence_level,
    expertise_confidence_level rating_confidence_level,
    validation_notes text,
    requires_review boolean DEFAULT false,
    review_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id)
);

-- Organiser expertise reputation tracking
-- This tracks the historical accuracy and reliability of each organiser's assessments
CREATE TABLE IF NOT EXISTS public.organiser_expertise_reputation (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organiser_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reputation_period_start date NOT NULL,
    reputation_period_end date NOT NULL,
    total_assessments integer DEFAULT 0,
    accurate_assessments integer DEFAULT 0,
    accuracy_percentage numeric CHECK (accuracy_percentage >= 0 AND accuracy_percentage <= 100),
    average_score_difference numeric,
    reliability_score numeric CHECK (reliability_score >= 0 AND reliability_score <= 100),
    expertise_domains jsonb DEFAULT '[]',
    areas_of_strength text[],
    areas_for_improvement text[],
    assessment_volume_score numeric CHECK (assessment_volume_score >= 0 AND assessment_volume_score <= 100),
    quality_score numeric CHECK (quality_score >= 0 AND quality_score <= 100),
    overall_reputation_score numeric CHECK (overall_reputation_score >= 0 AND overall_reputation_score <= 100),
    peer_ratings jsonb DEFAULT '[]',
    feedback_summary text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(organiser_id, reputation_period_start, reputation_period_end)
);

-- Expertise weighting by domain/industry
-- This allows different organisers to have different weights based on their expertise areas
CREATE TABLE IF NOT EXISTS public.organiser_expertise_domains (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organiser_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    domain_name text NOT NULL,
    domain_category text NOT NULL, -- e.g., 'construction', 'demolition', 'civil', etc.
    expertise_level integer CHECK (expertise_level >= 1 AND expertise_level <= 5),
    years_experience numeric CHECK (years_experience >= 0),
    certification_details text,
    specializations text[],
    weighting_factor numeric DEFAULT 1.0 CHECK (weighting_factor >= 0.1 AND weighting_factor <= 3.0),
    confidence_boost numeric DEFAULT 0 CHECK (confidence_boost >= 0 AND confidence_boost <= 50),
    is_active boolean DEFAULT true,
    last_verified date,
    verification_method text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id),
    UNIQUE(organiser_id, domain_name, domain_category)
);

-- Cross-validation between multiple organisers
-- This tracks when multiple organisers assess the same employer and compares their ratings
CREATE TABLE IF NOT EXISTS public.multi_organiser_validation (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    validation_date date NOT NULL,
    validation_window_days integer DEFAULT 30,
    total_organisers_assessed integer DEFAULT 0,
    consensus_rating traffic_light_rating,
    consensus_score numeric,
    rating_variance numeric,
    requires_mediation boolean DEFAULT false,
    mediation_status text,
    mediation_outcome text,
    organiser_ratings jsonb DEFAULT '[]',
    assessment_discrepancies jsonb DEFAULT '[]',
    final_resolution text,
    confidence_in_consensus rating_confidence_level,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id)
);

-- Expertise data sources tracking
-- This tracks what sources organiser expertise assessments are based on
CREATE TABLE IF NOT EXISTS public.expertise_data_sources (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    assessment_id uuid NOT NULL REFERENCES public.organiser_overall_expertise_ratings(id) ON DELETE CASCADE,
    source_type text NOT NULL CHECK (source_type IN ('personal_knowledge', 'industry_reputation', 'previous_projects', 'peer_discussion', 'industry_contacts', 'media_reports', 'formal_complaints', 'awards_recognition')),
    source_description text NOT NULL,
    source_reliability numeric CHECK (source_reliability >= 0 AND source_reliability <= 10),
    source_impact text CHECK (source_impact IN ('positive', 'negative', 'neutral', 'mixed')),
    date_range_start date,
    date_range_end date,
    supporting_evidence jsonb DEFAULT '[]',
    confidence_in_source rating_confidence_level,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id)
);

-- Expertise rating overrides and exceptions
-- This allows for manual overrides when expertise ratings need adjustment
CREATE TABLE IF NOT EXISTS public.expertise_rating_overrides (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    original_assessment_id uuid NOT NULL REFERENCES public.organiser_overall_expertise_ratings(id) ON DELETE CASCADE,
    original_rating traffic_light_rating NOT NULL,
    original_score numeric NOT NULL,
    new_rating traffic_light_rating NOT NULL,
    new_score numeric NOT NULL,
    override_reason text NOT NULL,
    override_authority_level text NOT NULL CHECK (override_authority_level IN ('senior_organiser', 'state_secretary', 'national_office', 'admin')),
    override_notes text,
    approval_required boolean DEFAULT false,
    approved_by uuid REFERENCES public.profiles(id),
    approval_date timestamp with time zone,
    is_temporary boolean DEFAULT false,
    temporary_expiry_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id),
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_organiser_overall_expertise_ratings_employer ON public.organiser_overall_expertise_ratings(employer_id, assessment_date DESC);
CREATE INDEX idx_organiser_overall_expertise_ratings_organiser ON public.organiser_overall_expertise_ratings(organiser_id, assessment_date DESC);
CREATE INDEX idx_organiser_overall_expertise_ratings_rating ON public.organiser_overall_expertise_ratings(overall_rating, is_active);
CREATE INDEX idx_organiser_overall_expertise_ratings_expiry ON public.organiser_overall_expertise_ratings(expires_date) WHERE expires_date IS NOT NULL;

CREATE INDEX idx_organiser_wizard_assessments_session ON public.organiser_wizard_assessments(wizard_session_id, response_date);
CREATE INDEX idx_organiser_wizard_assessments_employer ON public.organiser_wizard_assessments(employer_id, organiser_id, response_date DESC);
CREATE INDEX idx_organiser_wizard_assessments_step ON public.organiser_wizard_assessments(wizard_step_id, response_date DESC);

CREATE INDEX idx_organiser_wizard_assessment_summary_employer ON public.organiser_wizard_assessment_summary(employer_id, session_date DESC);
CREATE INDEX idx_organiser_wizard_assessment_summary_organiser ON public.organiser_wizard_assessment_summary(organiser_id, session_date DESC);
CREATE INDEX idx_organiser_wizard_assessment_summary_rating ON public.organiser_wizard_assessment_summary(final_rating, is_complete);

CREATE INDEX idx_expertise_validation_records_employer ON public.expertise_validation_records(employer_id, validation_date DESC);
CREATE INDEX idx_expertise_validation_records_organiser ON public.expertise_validation_records(organiser_id, validation_date DESC);
CREATE INDEX idx_expertise_validation_records_match ON public.expertise_validation_records(rating_match, validation_date DESC);

CREATE INDEX idx_organiser_expertise_reputation_organiser ON public.organiser_expertise_reputation(organiser_id, reputation_period_end DESC);
CREATE INDEX idx_organiser_expertise_reputation_score ON public.organiser_expertise_reputation(overall_reputation_score DESC);

CREATE INDEX idx_organiser_expertise_domains_organiser ON public.organiser_expertise_domains(organiser_id, is_active);
CREATE INDEX idx_organiser_expertise_domains_category ON public.organiser_expertise_domains(domain_category, expertise_level DESC);

CREATE INDEX idx_multi_organiser_validation_employer ON public.multi_organiser_validation(employer_id, validation_date DESC);
CREATE INDEX idx_multi_organiser_validation_status ON public.multi_organiser_validation(mediation_status, requires_mediation);

CREATE INDEX idx_expertise_data_sources_assessment ON public.expertise_data_sources(assessment_id, source_type);
CREATE INDEX idx_expertise_data_sources_type ON public.expertise_data_sources(source_type, source_reliability DESC);

CREATE INDEX idx_expertise_rating_overrides_original ON public.expertise_rating_overrides(original_assessment_id);
CREATE INDEX idx_expertise_rating_overrides_authority ON public.expertise_rating_overrides(override_authority_level, created_at DESC);

-- Add updated_at triggers
CREATE TRIGGER update_organiser_overall_expertise_ratings_updated_at
    BEFORE UPDATE ON public.organiser_overall_expertise_ratings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organiser_wizard_assessments_updated_at
    BEFORE UPDATE ON public.organiser_wizard_assessments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organiser_wizard_assessment_summary_updated_at
    BEFORE UPDATE ON public.organiser_wizard_assessment_summary
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organiser_expertise_reputation_updated_at
    BEFORE UPDATE ON public.organiser_expertise_reputation
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organiser_expertise_domains_updated_at
    BEFORE UPDATE ON public.organiser_expertise_domains
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_multi_organiser_validation_updated_at
    BEFORE UPDATE ON public.multi_organiser_validation
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expertise_rating_overrides_updated_at
    BEFORE UPDATE ON public.expertise_rating_overrides
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate wizard assessment summary from individual step responses
CREATE OR REPLACE FUNCTION public.calculate_wizard_assessment_summary()
RETURNS trigger AS $$
DECLARE
    v_summary_record public.organiser_wizard_assessment_summary%ROWTYPE;
    v_total_score numeric := 0;
    v_completion_percentage numeric := 0;
    v_is_complete boolean := false;
    v_step_count integer := 0;
    v_completed_steps integer := 0;
    v_wizard_session_id uuid := NEW.wizard_session_id;
BEGIN
    -- Get wizard step count
    SELECT COUNT(*) INTO v_step_count
    FROM public.organiser_wizard_config
    WHERE is_active = true;

    -- Get completed steps count and calculate total score
    SELECT
        COUNT(*),
        COALESCE(SUM(score_impact), 0),
        MAX(response_date)
    INTO
        v_completed_steps,
        v_total_score,
        v_summary_record.session_started_at
    FROM public.organiser_wizard_assessments
    WHERE wizard_session_id = p_wizard_session_id;

    -- Calculate completion percentage
    IF v_step_count > 0 THEN
        v_completion_percentage := (v_completed_steps::numeric / v_step_count::numeric) * 100;
        v_is_complete := v_completion_percentage >= 100;
    END IF;

    -- Determine final rating based on score
    SELECT rating INTO v_summary_record.final_rating
    FROM public.traffic_light_thresholds
    WHERE v_total_score >= min_score AND v_total_score <= max_score AND is_active = true;

    -- Get employer and organiser info
    SELECT
        employer_id,
        organiser_id,
        CURRENT_DATE,
        v_total_score,
        v_summary_record.final_rating,
        v_completion_percentage,
        -- Calculate time spent in minutes
        EXTRACT(EPOCH FROM (MAX(response_date) - MIN(response_date)))::integer / 60
    INTO
        v_summary_record.employer_id,
        v_summary_record.organiser_id,
        v_summary_record.session_date,
        v_summary_record.total_score,
        v_summary_record.final_rating,
        v_summary_record.completion_percentage,
        v_summary_record.time_spent_minutes
    FROM public.organiser_wizard_assessments
    WHERE wizard_session_id = p_wizard_session_id
    GROUP BY employer_id, organiser_id;

    -- Determine confidence level based on completion and score
    IF v_completion_percentage >= 100 AND ABS(v_total_score) > 30 THEN
        v_summary_record.confidence_level := 'high';
    ELSIF v_completion_percentage >= 75 AND ABS(v_total_score) > 15 THEN
        v_summary_record.confidence_level := 'medium';
    ELSE
        v_summary_record.confidence_level := 'low';
    END IF;

    -- Set expiry date (6 months from assessment)
    v_summary_record.expires_date := CURRENT_DATE + INTERVAL '6 months';

    -- Insert or update the summary record
    INSERT INTO public.organiser_wizard_assessment_summary (
        wizard_session_id,
        employer_id,
        organiser_id,
        session_date,
        total_score,
        final_rating,
        completion_percentage,
        time_spent_minutes,
        confidence_level,
        is_complete,
        expires_date
    ) VALUES (
        p_wizard_session_id,
        v_summary_record.employer_id,
        v_summary_record.organiser_id,
        v_summary_record.session_date,
        v_summary_record.total_score,
        v_summary_record.final_rating,
        v_summary_record.completion_percentage,
        v_summary_record.time_spent_minutes,
        v_summary_record.confidence_level,
        v_is_complete,
        v_summary_record.expires_date
    )
    ON CONFLICT (wizard_session_id)
    DO UPDATE SET
        total_score = EXCLUDED.total_score,
        final_rating = EXCLUDED.final_rating,
        completion_percentage = EXCLUDED.completion_percentage,
        time_spent_minutes = EXCLUDED.time_spent_minutes,
        confidence_level = EXCLUDED.confidence_level,
        is_complete = EXCLUDED.is_complete,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate wizard summary when steps are completed
CREATE TRIGGER trigger_wizard_assessment_summary_update
    AFTER INSERT OR UPDATE ON public.organiser_wizard_assessments
    FOR EACH ROW EXECUTE FUNCTION public.calculate_wizard_assessment_summary();

-- Enable Row Level Security
ALTER TABLE public.organiser_overall_expertise_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organiser_wizard_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organiser_wizard_assessment_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expertise_validation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organiser_expertise_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organiser_expertise_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multi_organiser_validation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expertise_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expertise_rating_overrides ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expertise rating tables
CREATE POLICY "Organiser expertise ratings read access" ON public.organiser_overall_expertise_ratings
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            organiser_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.profiles p
                JOIN public.role_hierarchy rh ON rh.parent_user_id = auth.uid()
                WHERE rh.child_user_id = p.id AND p.role = 'organiser'
            )
        )
    );

CREATE POLICY "Organiser expertise ratings write access" ON public.organiser_overall_expertise_ratings
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            organiser_id = auth.uid()
        )
    );

CREATE POLICY "Organiser expertise ratings update access" ON public.organiser_overall_expertise_ratings
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            organiser_id = auth.uid() OR
            updated_by = auth.uid()
        )
    );

-- Similar policies for other expertise tables
CREATE POLICY "Wizard assessments access" ON public.organiser_wizard_assessments
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            organiser_id = auth.uid()
        )
    );

CREATE POLICY "Wizard assessment summary access" ON public.organiser_wizard_assessment_summary
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            organiser_id = auth.uid()
        )
    );

CREATE POLICY "Expertise validation records access" ON public.expertise_validation_records
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            organiser_id = auth.uid() OR
            created_by = auth.uid()
        )
    );

CREATE POLICY "Organiser expertise reputation access" ON public.organiser_expertise_reputation
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            organiser_id = auth.uid()
        )
    );

CREATE POLICY "Organiser expertise domains access" ON public.organiser_expertise_domains
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            organiser_id = auth.uid()
        )
    );

CREATE POLICY "Multi organiser validation access" ON public.multi_organiser_validation
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            created_by = auth.uid() OR
            updated_by = auth.uid()
        )
    );

CREATE POLICY "Expertise data sources access" ON public.expertise_data_sources
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            created_by = auth.uid()
        )
    );

CREATE POLICY "Expertise rating overrides access" ON public.expertise_rating_overrides
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            created_by = auth.uid()
        )
    );

-- Comments for documentation
COMMENT ON TABLE public.organiser_overall_expertise_ratings IS 'Main table for organiser overall expertise assessments';
COMMENT ON TABLE public.organiser_wizard_assessments IS 'Step-by-step wizard responses for expertise assessments';
COMMENT ON TABLE public.organiser_wizard_assessment_summary IS 'Calculated summary of wizard assessment results';
COMMENT ON TABLE public.expertise_validation_records IS 'Validation comparing expertise ratings with project compliance data';
COMMENT ON TABLE public.organiser_expertise_reputation IS 'Historical accuracy tracking for organiser assessments';
COMMENT ON TABLE public.organiser_expertise_domains IS 'Organiser expertise areas and specializations';
COMMENT ON TABLE public.multi_organiser_validation IS 'Cross-validation between multiple organiser assessments';
COMMENT ON TABLE public.expertise_data_sources IS 'Tracking of sources used for expertise assessments';
COMMENT ON TABLE public.expertise_rating_overrides IS 'Manual overrides of expertise ratings with approval tracking';