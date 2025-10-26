-- Employer Traffic Light Rating System - Lookup Tables and Configuration Data
-- This migration creates the foundational lookup tables and configuration data
-- for the employer traffic light rating system.

-- First, create the enums for rating categories and assessment types
CREATE TYPE public.traffic_light_rating AS ENUM ('green', 'amber', 'red', 'unknown');

CREATE TYPE public.compliance_assessment_type AS ENUM (
    'cbus_status',
    'incolink_status',
    'site_visit_report',
    'delegate_report',
    'organiser_verbal_report',
    'organiser_written_report',
    'eca_status',
    'safety_incidents',
    'industrial_disputes',
    'payment_issues'
);

CREATE TYPE public.rating_source_type AS ENUM (
    'project_assessment',
    'organiser_expertise',
    'calculated_final',
    'manual_override'
);

CREATE TYPE public.rating_confidence_level AS ENUM (
    'high',
    'medium',
    'low',
    'very_low'
);

-- Create traffic light rating thresholds configuration
-- This allows for dynamic adjustment of rating criteria
CREATE TABLE IF NOT EXISTS public.traffic_light_thresholds (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    rating traffic_light_rating NOT NULL,
    min_score numeric NOT NULL,
    max_score numeric NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id)
);

-- Create compliance assessment weight configuration
-- Allows different assessment types to have different impacts on final rating
CREATE TABLE IF NOT EXISTS public.compliance_assessment_weights (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    assessment_type compliance_assessment_type NOT NULL UNIQUE,
    weight numeric NOT NULL DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 10),
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id)
);

-- Create assessment severity levels for different compliance factors
CREATE TABLE IF NOT EXISTS public.compliance_severity_levels (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    assessment_type compliance_assessment_type NOT NULL,
    severity_level integer NOT NULL CHECK (severity_level >= 1 AND severity_level <= 5),
    severity_name text NOT NULL,
    score_impact numeric NOT NULL CHECK (score_impact >= -100 AND score_impact <= 100),
    description text,
    color_code text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id),
    UNIQUE(assessment_type, severity_level)
);

-- Create wizard configuration for organiser expertise assessments
CREATE TABLE IF NOT EXISTS public.organiser_wizard_config (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    wizard_step integer NOT NULL CHECK (wizard_step >= 1),
    step_name text NOT NULL,
    step_description text NOT NULL,
    step_type text NOT NULL CHECK (step_type IN ('question', 'info', 'calculation')),
    is_required boolean DEFAULT true,
    display_order integer NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id),
    UNIQUE(wizard_step)
);

-- Create wizard step options for multiple choice questions
CREATE TABLE IF NOT EXISTS public.organiser_wizard_step_options (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    wizard_step_id uuid NOT NULL REFERENCES public.organiser_wizard_config(id) ON DELETE CASCADE,
    option_value text NOT NULL,
    option_text text NOT NULL,
    score_impact numeric NOT NULL CHECK (score_impact >= -100 AND score_impact <= 100),
    explanation text,
    display_order integer NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create rating calculation methods configuration
CREATE TABLE IF NOT EXISTS public.rating_calculation_methods (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    method_name text NOT NULL UNIQUE,
    method_description text NOT NULL,
    algorithm_type text NOT NULL CHECK (algorithm_type IN ('weighted_average', 'weighted_sum', 'minimum_score', 'custom_function')),
    configuration jsonb DEFAULT '{}',
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id)
);

-- Create rating audit log for tracking all rating changes
CREATE TABLE IF NOT EXISTS public.rating_audit_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    previous_rating traffic_light_rating,
    new_rating traffic_light_rating NOT NULL,
    previous_score numeric,
    new_score numeric,
    rating_source rating_source_type NOT NULL,
    source_id uuid, -- References the source record (assessment, expertise rating, etc.)
    reason_for_change text,
    changed_by uuid REFERENCES public.profiles(id),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_traffic_light_thresholds_rating ON public.traffic_light_thresholds(rating) WHERE is_active = true;
CREATE INDEX idx_compliance_assessment_weights_type ON public.compliance_assessment_weights(assessment_type) WHERE is_active = true;
CREATE INDEX idx_compliance_severity_levels_type ON public.compliance_severity_levels(assessment_type, severity_level) WHERE is_active = true;
CREATE INDEX idx_wizard_config_order ON public.organiser_wizard_config(display_order) WHERE is_active = true;
CREATE INDEX idx_wizard_step_options_step ON public.organiser_wizard_step_options(wizard_step_id, display_order) WHERE is_active = true;
CREATE INDEX idx_rating_audit_log_employer ON public.rating_audit_log(employer_id, created_at DESC);
CREATE INDEX idx_rating_audit_log_source ON public.rating_audit_log(rating_source, source_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to all tables
CREATE TRIGGER update_traffic_light_thresholds_updated_at
    BEFORE UPDATE ON public.traffic_light_thresholds
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_compliance_assessment_weights_updated_at
    BEFORE UPDATE ON public.compliance_assessment_weights
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_compliance_severity_levels_updated_at
    BEFORE UPDATE ON public.compliance_severity_levels
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organiser_wizard_config_updated_at
    BEFORE UPDATE ON public.organiser_wizard_config
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organiser_wizard_step_options_updated_at
    BEFORE UPDATE ON public.organiser_wizard_step_options
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rating_calculation_methods_updated_at
    BEFORE UPDATE ON public.rating_calculation_methods
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default configuration data

-- Default traffic light thresholds
INSERT INTO public.traffic_light_thresholds (rating, min_score, max_score, description) VALUES
('green', 80, 100, 'Employer has excellent compliance and relationship with CFMEU'),
('amber', 50, 79.9, 'Employer has some compliance issues or areas for improvement'),
('red', 0, 49.9, 'Employer has significant compliance issues or poor relationship'),
('unknown', -1, -1, 'Insufficient data to determine rating');

-- Default compliance assessment weights
INSERT INTO public.compliance_assessment_weights (assessment_type, weight, description) VALUES
('cbus_status', 3.0, 'CBUS compliance status - high importance for member benefits'),
('incolink_status', 2.5, 'Incolink compliance status - important for worker insurance'),
('site_visit_report', 2.0, 'Site visit observations and assessments'),
('delegate_report', 1.5, 'Reports from site delegates'),
('organiser_verbal_report', 1.0, 'Verbal reports from organisers'),
('organiser_written_report', 1.2, 'Written reports from organisers'),
('eca_status', 2.8, 'Enterprise Agreement status - critical compliance factor'),
('safety_incidents', 2.5, 'Safety incident history and response'),
('industrial_disputes', 3.0, 'Industrial dispute history and resolution'),
('payment_issues', 2.7, 'Payment and wage compliance issues');

-- Default compliance severity levels for ECA status (example)
INSERT INTO public.compliance_severity_levels (assessment_type, severity_level, severity_name, score_impact, description) VALUES
('eca_status', 1, 'Active EBA', 20, 'Current, active enterprise agreement'),
('eca_status', 2, 'Expired EBA (< 6 months)', 5, 'Recently expired enterprise agreement'),
('eca_status', 3, 'Expired EBA (6-12 months)', -10, 'Enterprise agreement expired 6-12 months ago'),
('eca_status', 4, 'Expired EBA (> 12 months)', -25, 'Enterprise agreement expired over 12 months ago'),
('eca_status', 5, 'No EBA History', -40, 'No known enterprise agreement history');

-- Default wizard configuration
INSERT INTO public.organiser_wizard_config (wizard_step, step_name, step_description, step_type, is_required, display_order) VALUES
(1, 'EBA Status', 'Does the employer have an active enterprise agreement?', 'question', true, 1),
(2, 'CBUS Compliance', 'Is the employer compliant with CBUS requirements?', 'question', true, 2),
(3, 'Safety Record', 'How would you rate the employer''s safety record?', 'question', true, 3),
(4, 'Payment History', 'Does the employer have a good payment and wage compliance history?', 'question', true, 4),
(5, 'Union Relationship', 'How would you describe the overall relationship with the union?', 'question', true, 5),
(6, 'Recent Issues', 'Any recent compliance or relationship issues?', 'question', false, 6),
(7, 'Overall Assessment', 'Based on your knowledge, what''s your overall assessment?', 'question', true, 7);

-- Default wizard step options for EBA Status
INSERT INTO public.organiser_wizard_step_options (wizard_step_id, option_value, option_text, score_impact, explanation, display_order)
SELECT id, 'yes', 'Yes, active EBA', 25, 'Employer has current enterprise agreement', 1
FROM public.organiser_wizard_config WHERE wizard_step = 1;

INSERT INTO public.organiser_wizard_step_options (wizard_step_id, option_value, option_text, score_impact, explanation, display_order)
SELECT id, 'expired', 'Expired EBA', 5, 'Enterprise agreement has expired', 2
FROM public.organiser_wizard_config WHERE wizard_step = 1;

INSERT INTO public.organiser_wizard_step_options (wizard_step_id, option_value, option_text, score_impact, explanation, display_order)
SELECT id, 'none', 'No EBA', -20, 'No enterprise agreement history', 3
FROM public.organiser_wizard_config WHERE wizard_step = 1;

INSERT INTO public.organiser_wizard_step_options (wizard_step_id, option_value, option_text, score_impact, explanation, display_order)
SELECT id, 'unknown', 'Unknown', 0, 'EBA status unknown', 4
FROM public.organiser_wizard_config WHERE wizard_step = 1;

-- Default rating calculation methods
INSERT INTO public.rating_calculation_methods (method_name, method_description, algorithm_type, configuration) VALUES
('weighted_average', 'Weighted average of all assessment scores', 'weighted_average', '{"normalize_weights": true}'),
('weighted_sum', 'Sum of weighted assessment scores', 'weighted_sum', '{"max_total_score": 100}'),
('minimum_score', 'Uses the lowest (most critical) assessment score', 'minimum_score', '{"critical_factors": ["eca_status", "cbus_status", "safety_incidents"]}'),
('hybrid_method', 'Combines weighted average with minimum score for critical factors', 'custom_function', '{"primary_method": "weighted_average", "critical_factors": ["eca_status", "safety_incidents"], "critical_weight": 0.3}');

-- Enable Row Level Security
ALTER TABLE public.traffic_light_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_assessment_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_severity_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organiser_wizard_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organiser_wizard_step_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_calculation_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Configuration tables - read access for all authenticated users, admin-only write access
CREATE POLICY "Configuration tables read access" ON public.traffic_light_thresholds
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Configuration tables admin write access" ON public.traffic_light_thresholds
    FOR ALL USING (auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Apply same policies to other configuration tables
CREATE POLICY "Compliance weights read access" ON public.compliance_assessment_weights
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Compliance weights admin write access" ON public.compliance_assessment_weights
    FOR ALL USING (auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Severity levels read access" ON public.compliance_severity_levels
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Severity levels admin write access" ON public.compliance_severity_levels
    FOR ALL USING (auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Wizard config read access" ON public.organiser_wizard_config
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Wizard config admin write access" ON public.organiser_wizard_config
    FOR ALL USING (auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Wizard options read access" ON public.organiser_wizard_step_options
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Wizard options admin write access" ON public.organiser_wizard_step_options
    FOR ALL USING (auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Calculation methods read access" ON public.rating_calculation_methods
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Calculation methods admin write access" ON public.rating_calculation_methods
    FOR ALL USING (auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Rating audit log - read access for users with employer access, write access for system processes
CREATE POLICY "Rating audit log read access" ON public.rating_audit_log
    FOR SELECT USING (auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND (p.role = 'admin' OR p.role = 'organiser')));

CREATE POLICY "Rating audit log system write access" ON public.rating_audit_log
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.traffic_light_thresholds IS 'Configuration for traffic light rating score thresholds';
COMMENT ON TABLE public.compliance_assessment_weights IS 'Weights for different compliance assessment types';
COMMENT ON TABLE public.compliance_severity_levels IS 'Severity levels and score impacts for compliance assessments';
COMMENT ON TABLE public.organiser_wizard_config IS 'Configuration for organiser expertise assessment wizard';
COMMENT ON TABLE public.organiser_wizard_step_options IS 'Options for wizard multiple choice questions';
COMMENT ON TABLE public.rating_calculation_methods IS 'Available methods for calculating final ratings';
COMMENT ON TABLE public.rating_audit_log IS 'Audit trail for all rating changes';