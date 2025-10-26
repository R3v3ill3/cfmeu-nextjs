-- Employer Traffic Light Rating System - Employer Final Ratings
-- This migration creates the tables and structures for combining both tracking systems
-- into final employer ratings with comparison logic and dispute resolution

-- Main employer final ratings table
-- This stores the final combined ratings from both project compliance and organiser expertise
CREATE TABLE IF NOT EXISTS public.employer_final_ratings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    rating_date date NOT NULL,
    final_rating traffic_light_rating NOT NULL,
    final_score numeric CHECK (final_score >= -100 AND final_score <= 100),

    -- Project-based rating data (Track 1)
    project_based_rating traffic_light_rating,
    project_based_score numeric CHECK (project_based_score >= -100 AND project_based_score <= 100),
    project_data_quality rating_confidence_level,
    project_data_age_days integer,
    projects_included integer DEFAULT 0,
    latest_project_date date,

    -- Expertise-based rating data (Track 2)
    expertise_based_rating traffic_light_rating,
    expertise_based_score numeric CHECK (expertise_based_score >= -100 AND expertise_based_score <= 100),
    expertise_confidence rating_confidence_level,
    expertise_data_age_days integer,
    expertise_assessments_included integer DEFAULT 0,
    latest_expertise_date date,

    -- Comparison and reconciliation
    rating_discrepancy boolean DEFAULT false,
    discrepancy_level integer CHECK (discrepancy_level >= 0 AND discrepancy_level <= 3),
    reconciliation_method text,
    reconciliation_notes text,
    required_dispute_resolution boolean DEFAULT false,

    -- Weighting and calculation details
    project_weight numeric DEFAULT 0.6 CHECK (project_weight >= 0 AND project_weight <= 1),
    expertise_weight numeric DEFAULT 0.4 CHECK (expertise_weight >= 0 AND expertise_weight <= 1),
    calculation_method_id uuid REFERENCES public.rating_calculation_methods(id),
    custom_adjustment numeric DEFAULT 0 CHECK (custom_adjustment >= -50 AND custom_adjustment <= 50),
    adjustment_reason text,

    -- EBA hard data point (always considered)
    eba_status traffic_light_rating,
    eba_weight numeric DEFAULT 0.15 CHECK (eba_weight >= 0 AND eba_weight <= 1),
    eba_override boolean DEFAULT false,
    eba_override_reason text,

    -- Additional factors
    industry_factor numeric DEFAULT 0 CHECK (industry_factor >= -20 AND industry_factor <= 20),
    size_factor numeric DEFAULT 0 CHECK (size_factor >= -10 AND size_factor <= 10),
    regional_factor numeric DEFAULT 0 CHECK (regional_factor >= -10 AND regional_factor <= 10),

    -- Data quality and confidence
    overall_confidence rating_confidence_level NOT NULL,
    data_completeness_score numeric CHECK (data_completeness_score >= 0 AND data_completeness_score <= 100),
    rating_stability_score numeric CHECK (rating_stability_score >= 0 AND rating_stability_score <= 100),

    -- Status and lifecycle
    rating_status text NOT NULL DEFAULT 'active' CHECK (rating_status IN ('active', 'under_review', 'disputed', 'superseded', 'archived')),
    review_required boolean DEFAULT false,
    review_reason text,
    next_review_date date,
    expiry_date date,

    -- Audit and approval
    calculated_by uuid REFERENCES public.profiles(id),
    approved_by uuid REFERENCES public.profiles(id),
    approved_at timestamp with time zone,
    approval_notes text,

    -- Metadata
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id),

    UNIQUE(employer_id, rating_date)
);

-- Rating comparison and reconciliation log
-- This tracks the detailed comparison process between project and expertise ratings
CREATE TABLE IF NOT EXISTS public.rating_comparison_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    final_rating_id uuid NOT NULL REFERENCES public.employer_final_ratings(id) ON DELETE CASCADE,
    comparison_timestamp timestamp with time zone DEFAULT now() NOT NULL,
    project_rating traffic_light_rating,
    project_score numeric,
    expertise_rating traffic_light_rating,
    expertise_score numeric,
    score_difference numeric,
    rating_match boolean,
    discrepancy_category text CHECK (discrepancy_category IN ('none', 'minor', 'moderate', 'major', 'critical')),
    reconciliation_decision text,
    reconciliation_factors jsonb DEFAULT '{}',
    final_weighting jsonb DEFAULT '{}',
    confidence_impact text,
    requires_human_review boolean DEFAULT false,
    review_priority integer CHECK (review_priority >= 1 AND review_priority <= 5),
    automated_decision boolean DEFAULT false,
    decision_logic jsonb DEFAULT '{}',
    created_by uuid REFERENCES public.profiles(id)
);

-- Rating dispute records
-- This manages formal disputes about final ratings
CREATE TABLE IF NOT EXISTS public.rating_dispute_records (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    final_rating_id uuid NOT NULL REFERENCES public.employer_final_ratings(id) ON DELETE CASCADE,
    dispute_raised_by uuid NOT NULL REFERENCES public.profiles(id),
    dispute_date date NOT NULL,
    dispute_category text NOT NULL CHECK (dispute_category IN ('calculation_error', 'data_inaccuracy', 'methodology', 'weighting', 'missing_context', 'other')),
    dispute_reason text NOT NULL,
    proposed_rating traffic_light_rating,
    proposed_score numeric,
    supporting_evidence jsonb DEFAULT '[]',
    witness_statements jsonb DEFAULT '[]',

    -- Dispute resolution
    dispute_status text NOT NULL DEFAULT 'pending' CHECK (dispute_status IN ('pending', 'under_review', 'evidence_collection', 'mediation', 'resolved', 'rejected', 'escalated')),
    assigned_reviewer uuid REFERENCES public.profiles(id),
    review_start_date date,
    review_deadline date,
    resolution_date date,
    resolution_outcome text,
    resolution_details text,
    final_rating_change boolean DEFAULT false,
    new_rating traffic_light_rating,
    new_score numeric,

    -- Appeal process
    appeal_possible boolean DEFAULT false,
    appeal_deadline date,
    appeal_status text CHECK (appeal_status IN ('none', 'filed', 'under_review', 'accepted', 'rejected')),

    -- Communication
    communication_log jsonb DEFAULT '[]',
    notifications_sent jsonb DEFAULT '[]',

    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id)
);

-- Rating history and trends
-- This tracks rating changes over time for trend analysis
CREATE TABLE IF NOT EXISTS public.employer_rating_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    rating_date date NOT NULL,
    previous_rating traffic_light_rating,
    new_rating traffic_light_rating NOT NULL,
    previous_score numeric,
    new_score numeric NOT NULL,
    rating_change_type text CHECK (rating_change_type IN ('improvement', 'decline', 'maintained', 'first_rating', 'data_driven_change')),

    -- Change analysis
    score_change numeric,
    significant_change boolean DEFAULT false,
    change_magnitude integer CHECK (change_magnitude >= 1 AND change_magnitude <= 5),
    primary_change_factors jsonb DEFAULT '[]',
    external_factors text[],

    -- Context
    time_since_previous_rating integer, -- days
    number_of_projects_in_period integer DEFAULT 0,
    number_of_expertise_assessments integer DEFAULT 0,
    major_events_in_period text[],

    -- Validation
    trend_consistent boolean DEFAULT true,
    anomaly_detected boolean DEFAULT false,
    anomaly_reason text,

    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id)
);

-- Rating quality metrics
-- This tracks the quality and reliability of the rating system
CREATE TABLE IF NOT EXISTS public.rating_quality_metrics (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    metric_date date NOT NULL,
    total_employers_rated integer DEFAULT 0,
    ratings_by_category jsonb DEFAULT '{}', -- {green: 45, amber: 30, red: 15, unknown: 10}
    average_confidence_score numeric,
    data_completeness_average numeric,

    -- Discrepancy metrics
    discrepancy_rate numeric CHECK (discrepancy_rate >= 0 AND discrepancy_rate <= 1),
    average_discrepancy_level numeric,
    resolved_discrepancies integer DEFAULT 0,
    pending_discrepancies integer DEFAULT 0,

    -- Quality indicators
    disputes_filed integer DEFAULT 0,
    disputes_resolved integer DEFAULT 0,
    resolution_success_rate numeric,
    average_resolution_days numeric,

    -- System performance
    calculation_time_ms_average numeric,
    ratings_calculated_per_day integer DEFAULT 0,
    system_errors integer DEFAULT 0,

    -- User satisfaction
    user_confidence_score numeric CHECK (user_confidence_score >= 0 AND user_confidence_score <= 100),
    feedback_positive_percentage numeric,

    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(metric_date)
);

-- External rating influences
-- This tracks external factors that might influence ratings
CREATE TABLE IF NOT EXISTS public.external_rating_influences (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    influence_date date NOT NULL,
    influence_type text NOT NULL CHECK (influence_type IN ('legal_action', 'media_report', 'industry_award', 'regulatory_action', 'major_incident', 'market_change', 'leadership_change')),
    influence_name text NOT NULL,
    influence_description text,

    -- Impact assessment
    impact_rating text CHECK (impact_rating IN ('highly_positive', 'positive', 'neutral', 'negative', 'highly_negative')),
    impact_severity integer CHECK (impact_severity >= 1 AND impact_severity <= 5),
    expected_duration_days integer,
    affected_rating_components jsonb DEFAULT '[]',

    -- Source information
    source_url text,
    source_publication text,
    source_date date,
    source_reliability numeric CHECK (source_reliability >= 0 AND source_reliability <= 10),
    verification_status text CHECK (verification_status IN ('unverified', 'pending', 'verified', 'debunked')),

    -- Integration with ratings
    applied_to_rating boolean DEFAULT false,
    rating_adjustment_made boolean DEFAULT false,
    adjustment_amount numeric,
    adjustment_reason text,

    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid REFERENCES public.profiles(id)
);

-- Rating alerts and notifications
-- This manages alerts for significant rating changes or issues
CREATE TABLE IF NOT EXISTS public.rating_alerts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    final_rating_id uuid REFERENCES public.employer_final_ratings(id) ON DELETE CASCADE,
    alert_type text NOT NULL CHECK (alert_type IN ('rating_change', 'discrepancy_detected', 'dispute_filed', 'review_required', 'expiry_warning', 'quality_issue')),
    alert_level text NOT NULL CHECK (alert_level IN ('info', 'warning', 'critical', 'emergency')),
    alert_title text NOT NULL,
    alert_message text NOT NULL,

    -- Alert conditions
    trigger_condition jsonb DEFAULT '{}',
    threshold_values jsonb DEFAULT '{}',

    -- Notification management
    notification_channels jsonb DEFAULT '[]', -- ['email', 'sms', 'in_app', 'webhook']
    recipients jsonb DEFAULT '[]', -- Array of user IDs and roles
    sent_notifications jsonb DEFAULT '[]',
    delivery_status text CHECK (delivery_status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),

    -- Response tracking
    viewed_by jsonb DEFAULT '[]',
    acknowledged_by jsonb DEFAULT '[]',
    response_required boolean DEFAULT false,
    response_deadline timestamp with time zone,
    responses_received jsonb DEFAULT '[]',

    -- Lifecycle
    is_active boolean DEFAULT true,
    resolved boolean DEFAULT false,
    resolution_details text,
    resolved_at timestamp with time zone,
    resolved_by uuid REFERENCES public.profiles(id),

    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid REFERENCES public.profiles(id)
);

-- Create indexes for performance
CREATE INDEX idx_employer_final_ratings_employer ON public.employer_final_ratings(employer_id, rating_date DESC);
CREATE INDEX idx_employer_final_ratings_rating ON public.employer_final_ratings(final_rating, rating_status, is_active);
CREATE INDEX idx_employer_final_ratings_date ON public.employer_final_ratings(rating_date DESC);
CREATE INDEX idx_employer_final_ratings_review ON public.employer_final_ratings(review_required, next_review_date);
CREATE INDEX idx_employer_final_ratings_expiry ON public.employer_final_ratings(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX idx_employer_final_ratings_discrepancy ON public.employer_final_ratings(rating_discrepancy, discrepancy_level);
CREATE INDEX idx_employer_final_ratings_status ON public.employer_final_ratings(rating_status, is_active);

CREATE INDEX idx_rating_comparison_log_final_rating ON public.rating_comparison_log(final_rating_id, comparison_timestamp DESC);
CREATE INDEX idx_rating_comparison_log_discrepancy ON public.rating_comparison_log(discrepancy_category, requires_human_review);
CREATE INDEX idx_rating_comparison_log_review ON public.rating_comparison_log(review_priority DESC, requires_human_review);

CREATE INDEX idx_rating_dispute_records_final_rating ON public.rating_dispute_records(final_rating_id, dispute_date DESC);
CREATE INDEX idx_rating_dispute_records_status ON public.rating_dispute_records(dispute_status, review_deadline);
CREATE INDEX idx_rating_dispute_records_raised_by ON public.rating_dispute_records(dispute_raised_by, dispute_date DESC);
CREATE INDEX idx_rating_dispute_records_reviewer ON public.rating_dispute_records(assigned_reviewer, dispute_status);

CREATE INDEX idx_employer_rating_history_employer ON public.employer_rating_history(employer_id, rating_date DESC);
CREATE INDEX idx_employer_rating_history_change ON public.employer_rating_history(rating_change_type, rating_date DESC);
CREATE INDEX idx_employer_rating_history_anomaly ON public.employer_rating_history(anomaly_detected, rating_date DESC);

CREATE INDEX idx_rating_quality_metrics_date ON public.rating_quality_metrics(metric_date DESC);
CREATE INDEX idx_external_rating_influences_employer ON public.external_rating_influences(employer_id, influence_date DESC);
CREATE INDEX idx_external_rating_influences_type ON public.external_rating_influences(influence_type, impact_severity DESC);

CREATE INDEX idx_rating_alerts_employer ON public.rating_alerts(employer_id, created_at DESC);
CREATE INDEX idx_rating_alerts_type ON public.rating_alerts(alert_type, alert_level, is_active);
CREATE INDEX idx_rating_alerts_status ON public.rating_alerts(delivery_status, response_required);
CREATE INDEX idx_rating_alerts_recipients ON public.rating_alerts USING GIN(recipients);

-- Add updated_at triggers
CREATE TRIGGER update_employer_final_ratings_updated_at
    BEFORE UPDATE ON public.employer_final_ratings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rating_dispute_records_updated_at
    BEFORE UPDATE ON public.rating_dispute_records
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rating_quality_metrics_updated_at
    BEFORE UPDATE ON public.rating_quality_metrics
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_external_rating_influences_updated_at
    BEFORE UPDATE ON public.external_rating_influences
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rating_alerts_updated_at
    BEFORE UPDATE ON public.rating_alerts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to automatically create rating history entries
CREATE OR REPLACE FUNCTION public.create_rating_history_entry()
RETURNS TRIGGER AS $$
DECLARE
    v_previous_rating public.employer_final_ratings%ROWTYPE;
    v_score_change numeric;
    v_change_type text;
    v_change_magnitude integer;
BEGIN
    -- Get previous rating for this employer
    SELECT * INTO v_previous_rating
    FROM public.employer_final_ratings
    WHERE employer_id = NEW.employer_id
      AND rating_date < NEW.rating_date
    ORDER BY rating_date DESC
    LIMIT 1;

    -- Calculate change metrics
    IF v_previous_rating.id IS NOT NULL THEN
        v_score_change := NEW.final_score - v_previous_rating.final_score;

        -- Determine change type
        IF NEW.final_score > v_previous_rating.final_score THEN
            v_change_type := 'improvement';
        ELSIF NEW.final_score < v_previous_rating.final_score THEN
            v_change_type := 'decline';
        ELSE
            v_change_type := 'maintained';
        END IF;

        -- Calculate change magnitude (1-5 scale)
        IF ABS(v_score_change) >= 30 THEN
            v_change_magnitude := 5;
        ELSIF ABS(v_score_change) >= 20 THEN
            v_change_magnitude := 4;
        ELSIF ABS(v_score_change) >= 10 THEN
            v_change_magnitude := 3;
        ELSIF ABS(v_score_change) >= 5 THEN
            v_change_magnitude := 2;
        ELSE
            v_change_magnitude := 1;
        END IF;
    ELSE
        v_change_type := 'first_rating';
        v_score_change := NULL;
        v_change_magnitude := NULL;
    END IF;

    -- Create history entry
    INSERT INTO public.employer_rating_history (
        employer_id,
        rating_date,
        previous_rating,
        new_rating,
        previous_score,
        new_score,
        rating_change_type,
        score_change,
        significant_change,
        change_magnitude,
        time_since_previous_rating
    ) VALUES (
        NEW.employer_id,
        NEW.rating_date,
        COALESCE(v_previous_rating.final_rating, NULL),
        NEW.final_rating,
        COALESCE(v_previous_rating.final_score, NULL),
        NEW.final_score,
        v_change_type,
        v_score_change,
        v_change_magnitude >= 3,
        v_change_magnitude,
        CASE
            WHEN v_previous_rating.id IS NOT NULL THEN
                (NEW.rating_date - v_previous_rating.rating_date)::integer
            ELSE NULL
        END
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create history entries when final ratings are created
CREATE TRIGGER create_employer_rating_history
    AFTER INSERT ON public.employer_final_ratings
    FOR EACH ROW EXECUTE FUNCTION public.create_rating_history_entry();

-- Function to check for rating discrepancies
CREATE OR REPLACE FUNCTION public.check_rating_discrepancy(
    p_project_rating traffic_light_rating,
    p_project_score numeric,
    p_expertise_rating traffic_light_rating,
    p_expertise_score numeric
) RETURNS jsonb AS $$
DECLARE
    v_discrepancy boolean := false;
    v_discrepancy_level integer := 0;
    v_score_diff numeric;
    v_result jsonb;
BEGIN
    -- Calculate score difference
    v_score_diff := ABS(p_project_score - p_expertise_score);

    -- Check for rating mismatch
    IF p_project_rating != p_expertise_rating THEN
        v_discrepancy := true;

        -- Determine discrepancy level based on rating differences
        CASE
            WHEN (p_project_rating = 'green' AND p_expertise_rating = 'red') OR
                 (p_project_rating = 'red' AND p_expertise_rating = 'green') THEN
                v_discrepancy_level := 3; -- Critical
            WHEN (p_project_rating = 'green' AND p_expertise_rating = 'amber') OR
                 (p_project_rating = 'amber' AND p_expertise_rating = 'red') OR
                 (p_project_rating = 'red' AND p_expertise_rating = 'amber') OR
                 (p_project_rating = 'amber' AND p_expertise_rating = 'green') THEN
                v_discrepancy_level := 2; -- Moderate
            ELSE
                v_discrepancy_level := 1; -- Minor
        END CASE;
    END IF;

    -- Also check score difference
    IF v_score_diff > 40 THEN
        v_discrepancy := true;
        v_discrepancy_level := GREATEST(v_discrepancy_level, 3);
    ELSIF v_score_diff > 25 THEN
        v_discrepancy := true;
        v_discrepancy_level := GREATEST(v_discrepancy_level, 2);
    ELSIF v_score_diff > 15 THEN
        v_discrepancy := true;
        v_discrepancy_level := GREATEST(v_discrepancy_level, 1);
    END IF;

    -- Build result JSON
    v_result := jsonb_build_object(
        'discrepancy_detected', v_discrepancy,
        'discrepancy_level', v_discrepancy_level,
        'score_difference', v_score_diff,
        'rating_match', p_project_rating = p_expertise_rating,
        'requires_review', v_discrepancy_level >= 2
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE public.employer_final_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_comparison_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_dispute_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_rating_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_quality_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_rating_influences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for final rating tables
CREATE POLICY "Employer final ratings read access" ON public.employer_final_ratings
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            EXISTS (
                SELECT 1 FROM public.profiles p
                JOIN public.role_hierarchy rh ON rh.parent_user_id = auth.uid()
                WHERE rh.child_user_id = p.id AND p.role = 'organiser'
            )
        )
    );

CREATE POLICY "Employer final ratings write access" ON public.employer_final_ratings
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            created_by = auth.uid()
        )
    );

CREATE POLICY "Employer final ratings update access" ON public.employer_final_ratings
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            updated_by = auth.uid() OR
            approved_by = auth.uid()
        )
    );

-- Similar policies for other tables
CREATE POLICY "Rating comparison log access" ON public.rating_comparison_log
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            created_by = auth.uid()
        )
    );

CREATE POLICY "Rating dispute records access" ON public.rating_dispute_records
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            dispute_raised_by = auth.uid() OR
            assigned_reviewer = auth.uid() OR
            created_by = auth.uid()
        )
    );

CREATE POLICY "Employer rating history access" ON public.employer_rating_history
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            EXISTS (
                SELECT 1 FROM public.profiles p
                JOIN public.role_hierarchy rh ON rh.parent_user_id = auth.uid()
                WHERE rh.child_user_id = p.id AND p.role = 'organiser'
            )
        )
    );

CREATE POLICY "Rating quality metrics access" ON public.rating_quality_metrics
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        )
    );

CREATE POLICY "External rating influences access" ON public.external_rating_influences
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            created_by = auth.uid()
        )
    );

CREATE POLICY "Rating alerts access" ON public.rating_alerts
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            created_by = auth.uid() OR
            recipients ? auth.uid()::text
        )
    );

-- Comments for documentation
COMMENT ON TABLE public.employer_final_ratings IS 'Final combined ratings from both project compliance and organiser expertise';
COMMENT ON TABLE public.rating_comparison_log IS 'Detailed comparison between project and expertise ratings';
COMMENT ON TABLE public.rating_dispute_records IS 'Formal disputes about final ratings and resolution tracking';
COMMENT ON TABLE public.employer_rating_history IS 'Historical tracking of rating changes and trends';
COMMENT ON TABLE public.rating_quality_metrics IS 'System quality metrics and performance indicators';
COMMENT ON TABLE public.external_rating_influences IS 'External factors that may influence employer ratings';
COMMENT ON TABLE public.rating_alerts IS 'Alerts and notifications for rating changes and issues';