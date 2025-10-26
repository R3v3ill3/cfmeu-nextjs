-- CFMEU Rating System Transformation - Assessment Templates and Configuration
-- This migration creates configurable templates and weighting schemes
-- for different employer roles and assessment types

-- Assessment templates table for different employer roles and assessment types
CREATE TABLE IF NOT EXISTS public.assessment_templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    template_name text NOT NULL,
    template_description text,
    employer_role employer_role_type NOT NULL,
    assessment_type text NOT NULL CHECK (assessment_type IN (
        'union_respect', 'safety', 'subcontractor_use', 'role_specific', 'comprehensive'
    )),
    template_version integer DEFAULT 1,
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,

    -- Template structure and configuration
    assessment_structure jsonb DEFAULT '{}', -- Defines the assessment fields and structure
    required_components text[] DEFAULT '{}', -- Components that must be completed
    optional_components text[] DEFAULT '{}', -- Optional assessment components
    scoring_weights jsonb DEFAULT '{}', -- Weighting for different components
    rating_thresholds jsonb DEFAULT '{}', -- Custom thresholds for this template

    -- Template metadata
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid REFERENCES public.profiles(id),

    UNIQUE(template_name, employer_role, assessment_type, template_version)
);

-- Assessment weighting configuration by role
CREATE TABLE IF NOT EXISTS public.role_assessment_weights (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_role employer_role_type NOT NULL,
    assessment_type text NOT NULL,
    component_name text NOT NULL,
    weight numeric NOT NULL CHECK (weight >= 0 AND weight <= 1),
    weight_description text,
    is_mandatory boolean DEFAULT false,
    minimum_threshold numeric CHECK (minimum_threshold >= 0 AND minimum_threshold <= 4),
    maximum_threshold numeric CHECK (maximum_threshold >= 0 AND maximum_threshold <= 4),

    -- Applicability conditions
    applies_to_project_types text[],
    applies_to_workforce_sizes text[],
    min_employee_count integer,
    max_employee_count integer,

    -- Metadata
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid REFERENCES public.profiles(id),

    UNIQUE(employer_role, assessment_type, component_name)
);

-- Assessment frequency configuration
CREATE TABLE IF NOT EXISTS public.assessment_frequency_config (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_role employer_role_type NOT NULL,
    assessment_type text NOT NULL,
    base_frequency_interval interval NOT NULL, -- How often assessments should be done
    minimum_interval interval, -- Minimum time between assessments
    maximum_interval interval, -- Maximum time between assessments

    -- Frequency adjustment factors
    high_risk_multiplier numeric DEFAULT 1.0 CHECK (high_risk_multiplier > 0),
    medium_risk_multiplier numeric DEFAULT 1.0 CHECK (medium_risk_multiplier > 0),
    low_risk_multiplier numeric DEFAULT 1.0 CHECK (low_risk_multiplier > 0),

    -- Trigger conditions for additional assessments
    additional_assessment_triggers jsonb DEFAULT '[]', -- Events that trigger additional assessments

    -- Metadata
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid REFERENCES public.profiles(id),

    UNIQUE(employer_role, assessment_type)
);

-- Assessment quality thresholds configuration
CREATE TABLE IF NOT EXISTS public.assessment_quality_thresholds (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_role employer_role_type NOT NULL,
    assessment_type text NOT NULL,
    quality_metric text NOT NULL CHECK (quality_metric IN (
        'minimum_assessments', 'data_recency', 'confidence_level', 'coverage_percentage'
    )),
    threshold_value numeric NOT NULL,
    threshold_operator text CHECK (threshold_operator IN ('>=', '<=', '=', '>', '<')),
    quality_impact text CHECK (quality_impact IN ('high', 'medium', 'low')),
    threshold_description text,

    -- Applicability conditions
    applies_to_contexts assessment_context[],
    workforce_size_requirements jsonb DEFAULT '{}',

    -- Metadata
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid REFERENCES public.profiles(id),

    UNIQUE(employer_role, assessment_type, quality_metric)
);

-- Rating calculation method configuration
CREATE TABLE IF NOT EXISTS public.rating_calculation_config (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_role employer_role_type NOT NULL,
    calculation_method text NOT NULL,
    method_description text,
    algorithm_config jsonb DEFAULT '{}', -- Configuration for the algorithm

    -- Component weights for this role/method combination
    union_respect_weight numeric CHECK (union_respect_weight >= 0 AND union_respect_weight <= 1),
    safety_weight numeric CHECK (safety_weight >= 0 AND safety_weight <= 1),
    subcontractor_weight numeric CHECK (subcontractor_weight >= 0 AND subcontractor_weight <= 1),
    role_specific_weight numeric CHECK (role_specific_weight >= 0 AND role_specific_weight <= 1),

    -- Special handling rules
    critical_components jsonb DEFAULT '[]', -- Components that can override final rating
    veto_components jsonb DEFAULT '[]', -- Components that can veto a good rating
    bonus_components jsonb DEFAULT '[]', -- Components that can improve rating

    -- Applicability conditions
    applies_to_project_values jsonb DEFAULT '{}', -- Project size/value thresholds
    applies_to_workforce_sizes text[],
    applies_to_geographic_areas text[],

    -- Metadata
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid REFERENCES public.profiles(id),

    UNIQUE(employer_role, calculation_method)
);

-- Insert default assessment templates
INSERT INTO public.assessment_templates (
    template_name, template_description, employer_role, assessment_type,
    assessment_structure, required_components, optional_components,
    scoring_weights, rating_thresholds, is_default, created_by
) VALUES
-- Union Respect Assessment Templates
(
    'Trade Union Respect Standard',
    'Standard union respect assessment for trade contractors',
    'trade', 'union_respect',
    jsonb_build_object(
        'right_of_entry', jsonb_build_object('type', 'rating', 'scale', '4_point'),
        'delegate_accommodation', jsonb_build_object('type', 'rating', 'scale', '4_point'),
        'access_to_information', jsonb_build_object('type', 'rating', 'scale', '4_point'),
        'access_to_inductions', jsonb_build_object('type', 'rating', 'scale', '4_point')
    ),
    ARRAY['right_of_entry', 'delegate_accommodation', 'access_to_information'],
    ARRAY['access_to_inductions'],
    jsonb_build_object(
        'right_of_entry', 0.3,
        'delegate_accommodation', 0.3,
        'access_to_information', 0.25,
        'access_to_inductions', 0.15
    ),
    jsonb_build_object(
        'good', jsonb_build_object('score_range', array[1, 1.5], 'description', 'Excellent union relations'),
        'fair', jsonb_build_object('score_range', array[1.51, 2.5], 'description', 'Adequate union relations'),
        'poor', jsonb_build_object('score_range', array[2.51, 3.5], 'description', 'Problematic union relations'),
        'terrible', jsonb_build_object('score_range', array[3.51, 4], 'description', 'Severe union relations issues')
    ),
    true,
    current_setting('request.jwt.claims')::json->>'sub'
),
(
    'Builder Union Respect Enhanced',
    'Enhanced union respect assessment for builders with additional project coordination focus',
    'builder', 'union_respect',
    jsonb_build_object(
        'right_of_entry', jsonb_build_object('type', 'rating', 'scale', '4_point'),
        'delegate_accommodation', jsonb_build_object('type', 'rating', 'scale', '4_point'),
        'access_to_information', jsonb_build_object('type', 'rating', 'scale', '4_point'),
        'access_to_inductions', jsonb_build_object('type', 'rating', 'scale', '4_point'),
        'project_coordination', jsonb_build_object('type', 'rating', 'scale', '4_point')
    ),
    ARRAY['right_of_entry', 'delegate_accommodation', 'access_to_information', 'project_coordination'],
    ARRAY['access_to_inductions'],
    jsonb_build_object(
        'right_of_entry', 0.25,
        'delegate_accommodation', 0.25,
        'access_to_information', 0.2,
        'access_to_inductions', 0.1,
        'project_coordination', 0.2
    ),
    jsonb_build_object(
        'good', jsonb_build_object('score_range', array[1, 1.5], 'description', 'Excellent union relations and coordination'),
        'fair', jsonb_build_object('score_range', array[1.51, 2.5], 'description', 'Adequate union relations'),
        'poor', jsonb_build_object('score_range', array[2.51, 3.5], 'description', 'Problematic union relations'),
        'terrible', jsonb_build_object('score_range', array[3.51, 4], 'description', 'Severe union relations issues')
    ),
    true,
    current_setting('request.jwt.claims')::json->>'sub'
),

-- Safety Assessment Templates
(
    'Trade Safety Standard',
    'Standard safety assessment for trade contractors focusing on site safety practices',
    'trade', 'safety',
    jsonb_build_object(
        'hsr_respect', jsonb_build_object('type', 'rating', 'scale', '4_point'),
        'general_safety', jsonb_build_object('type', 'rating', 'scale', '4_point'),
        'safety_incidents', jsonb_build_object('type', 'rating', 'scale', '4_point')
    ),
    ARRAY['hsr_respect', 'general_safety', 'safety_incidents'],
    ARRAY[]::text[],
    jsonb_build_object(
        'hsr_respect', 0.3,
        'general_safety', 0.35,
        'safety_incidents', 0.35
    ),
    jsonb_build_object(
        'good', jsonb_build_object('score_range', array[1, 1.5], 'description', 'Excellent safety performance'),
        'fair', jsonb_build_object('score_range', array[1.51, 2.5], 'description', 'Adequate safety performance'),
        'poor', jsonb_build_object('score_range', array[2.51, 3.5], 'description', 'Safety concerns identified'),
        'terrible', jsonb_build_object('score_range', array[3.51, 4], 'description', 'Serious safety issues')
    ),
    true,
    current_setting('request.jwt.claims')::json->>'sub'
),
(
    'Builder Safety Comprehensive',
    'Comprehensive safety assessment for builders including subcontractor safety management',
    'builder', 'safety',
    jsonb_build_object(
        'hsr_respect', jsonb_build_object('type', 'rating', 'scale', '4_point'),
        'general_safety', jsonb_build_object('type', 'rating', 'scale', '4_point'),
        'safety_incidents', jsonb_build_object('type', 'rating', 'scale', '4_point'),
        'subcontractor_safety_management', jsonb_build_object('type', 'rating', 'scale', '4_point'),
        'safety_systems_oversight', jsonb_build_object('type', 'rating', 'scale', '4_point')
    ),
    ARRAY['hsr_respect', 'general_safety', 'safety_incidents', 'subcontractor_safety_management'],
    ARRAY['safety_systems_oversight'],
    jsonb_build_object(
        'hsr_respect', 0.2,
        'general_safety', 0.25,
        'safety_incidents', 0.3,
        'subcontractor_safety_management', 0.15,
        'safety_systems_oversight', 0.1
    ),
    jsonb_build_object(
        'good', jsonb_build_object('score_range', array[1, 1.5], 'description', 'Excellent safety management'),
        'fair', jsonb_build_object('score_range', array[1.51, 2.5], 'description', 'Adequate safety management'),
        'poor', jsonb_build_object('score_range', array[2.51, 3.5], 'description', 'Safety management concerns'),
        'terrible', jsonb_build_object('score_range', array[3.51, 4], 'description', 'Serious safety management failures')
    ),
    true,
    current_setting('request.jwt.claims')::json->>'sub'
),

-- Role-Specific Assessment Templates
(
    'Builder Role Assessment',
    'Comprehensive assessment of builder-specific responsibilities and performance',
    'builder', 'role_specific',
    jsonb_build_object(
        'tender_consultation', jsonb_build_object('type', 'rating', 'scale', '4_point'),
        'open_communication', jsonb_build_object('type', 'rating', 'scale', '4_point'),
        'delegate_facilities', jsonb_build_object('type', 'rating', 'scale', '4_point'),
        'project_coordination', jsonb_build_object('type', 'rating', 'scale', '4_point'),
        'dispute_resolution', jsonb_build_object('type', 'rating', 'scale', '4_point'),
        'contractor_compliance', jsonb_build_object('type', 'percentage', 'scale', '0-100'),
        'eba_contractor_coverage', jsonb_build_object('type', 'percentage', 'scale', '0-100')
    ),
    ARRAY['tender_consultation', 'open_communication', 'delegate_facilities'],
    ARRAY['project_coordination', 'dispute_resolution', 'contractor_compliance', 'eba_contractor_coverage'],
    jsonb_build_object(
        'tender_consultation', 0.2,
        'open_communication', 0.2,
        'delegate_facilities', 0.2,
        'project_coordination', 0.15,
        'dispute_resolution', 0.15,
        'contractor_compliance', 0.05,
        'eba_contractor_coverage', 0.05
    ),
    jsonb_build_object(
        'good', jsonb_build_object('score_range', array[1, 1.5], 'description', 'Excellent builder performance'),
        'fair', jsonb_build_object('score_range', array[1.51, 2.5], 'description', 'Adequate builder performance'),
        'poor', jsonb_build_object('score_range', array[2.51, 3.5], 'description', 'Builder performance concerns'),
        'terrible', jsonb_build_object('score_range', array[3.51, 4], 'description', 'Serious builder performance issues')
    ),
    true,
    current_setting('request.jwt.claims')::json->>'sub'
),

-- Subcontractor Assessment Templates
(
    'Subcontractor Relations Standard',
    'Assessment of subcontractor usage and treatment for all employer types',
    'trade', 'subcontractor_use',
    jsonb_build_object(
        'usage_rating', jsonb_build_object('type', 'rating', 'scale', '4_point'),
        'subcontractor_count', jsonb_build_object('type', 'integer'),
        'subcontractor_percentage', jsonb_build_object('type', 'percentage', 'scale', '0-100'),
        'assessment_basis', jsonb_build_object('type', 'select', 'options', array['project_observation', 'workforce_analysis', 'subcontractor_interview'])
    ),
    ARRAY['usage_rating', 'assessment_basis'],
    ARRAY['subcontractor_count', 'subcontractor_percentage'],
    jsonb_build_object(
        'usage_rating', 1.0
    ),
    jsonb_build_object(
        'good', jsonb_build_object('score_range', array[1, 1.5], 'description', 'Excellent subcontractor relations'),
        'fair', jsonb_build_object('score_range', array[1.51, 2.5], 'description', 'Adequate subcontractor relations'),
        'poor', jsonb_build_object('score_range', array[2.51, 3.5], 'description', 'Subcontractor relations concerns'),
        'terrible', jsonb_build_object('score_range', array[3.51, 4], 'description', 'Serious subcontractor relations issues')
    ),
    true,
    current_setting('request.jwt.claims')::json->>'sub'
),

-- Comprehensive Assessment Template
(
    'Comprehensive Trade Assessment',
    'Complete assessment covering all areas for trade contractors',
    'trade', 'comprehensive',
    jsonb_build_object(
        'union_respect', jsonb_build_object('type', 'embedded_assessment'),
        'safety', jsonb_build_object('type', 'embedded_assessment'),
        'subcontractor_use', jsonb_build_object('type', 'embedded_assessment')
    ),
    ARRAY['union_respect', 'safety'],
    ARRAY['subcontractor_use'],
    jsonb_build_object(
        'union_respect', 0.4,
        'safety', 0.4,
        'subcontractor_use', 0.2
    ),
    jsonb_build_object(
        'good', jsonb_build_object('score_range', array[1, 1.5], 'description', 'Excellent overall performance'),
        'fair', jsonb_build_object('score_range', array[1.51, 2.5], 'description', 'Adequate overall performance'),
        'poor', jsonb_build_object('score_range', array[2.51, 3.5], 'description', 'Overall performance concerns'),
        'terrible', jsonb_build_object('score_range', array[3.51, 4], 'description', 'Serious overall performance issues')
    ),
    true,
    current_setting('request.jwt.claims')::json->>'sub'
)
ON CONFLICT (template_name, employer_role, assessment_type, template_version) DO NOTHING;

-- Insert default role assessment weights
INSERT INTO public.role_assessment_weights (
    employer_role, assessment_type, component_name, weight, weight_description,
    is_mandatory, minimum_threshold, maximum_threshold, is_active, created_by
) VALUES
-- Union Respect Weights for Trade
('trade', 'union_respect', 'right_of_entry', 0.3, 'Right of entry for union officials', true, 1, 4, true, current_setting('request.jwt.claims')::json->>'sub'),
('trade', 'union_respect', 'delegate_accommodation', 0.3, 'Accommodation of union delegates', true, 1, 4, true, current_setting('request.jwt.claims')::json->>'sub'),
('trade', 'union_respect', 'access_to_information', 0.25, 'Access to workplace information', true, 1, 4, true, current_setting('request.jwt.claims')::json->>'sub'),
('trade', 'union_respect', 'access_to_inductions', 0.15, 'Access to site inductions for union reps', false, 1, 4, true, current_setting('request.jwt.claims')::json->>'sub'),

-- Union Respect Weights for Builder
('builder', 'union_respect', 'right_of_entry', 0.25, 'Right of entry for union officials', true, 1, 4, true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'union_respect', 'delegate_accommodation', 0.25, 'Accommodation of union delegates', true, 1, 4, true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'union_respect', 'access_to_information', 0.2, 'Access to workplace information', true, 1, 4, true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'union_respect', 'project_coordination', 0.2, 'Coordination with union on project matters', true, 1, 4, true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'union_respect', 'access_to_inductions', 0.1, 'Access to site inductions for union reps', false, 1, 4, true, current_setting('request.jwt.claims')::json->>'sub'),

-- Safety Weights for Trade
('trade', 'safety', 'hsr_respect', 0.3, 'Respect for Health and Safety Representatives', true, 1, 4, true, current_setting('request.jwt.claims')::json->>'sub'),
('trade', 'safety', 'general_safety', 0.35, 'General safety performance and practices', true, 1, 4, true, current_setting('request.jwt.claims')::json->>'sub'),
('trade', 'safety', 'safety_incidents', 0.35, 'Safety incident record and response', true, 1, 4, true, current_setting('request.jwt.claims')::json->>'sub'),

-- Safety Weights for Builder
('builder', 'safety', 'hsr_respect', 0.2, 'Respect for Health and Safety Representatives', true, 1, 4, true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'safety', 'general_safety', 0.25, 'General safety performance and practices', true, 1, 4, true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'safety', 'safety_incidents', 0.3, 'Safety incident record and response', true, 1, 4, true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'safety', 'subcontractor_safety_management', 0.15, 'Management of subcontractor safety', true, 1, 4, true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'safety', 'safety_systems_oversight', 0.1, 'Oversight of safety systems across projects', false, 1, 4, true, current_setting('request.jwt.claims')::json->>'sub'),

-- Role-Specific Weights for Builder
('builder', 'role_specific', 'tender_consultation', 0.2, 'Consultation with union during tender process', true, 1, 4, true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'role_specific', 'open_communication', 0.2, 'Open communication with union representatives', true, 1, 4, true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'role_specific', 'delegate_facilities', 0.2, 'Provision of facilities for union delegates', true, 1, 4, true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'role_specific', 'project_coordination', 0.15, 'Coordination with union on project matters', true, 1, 4, true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'role_specific', 'dispute_resolution', 0.15, 'Resolution of industrial disputes', true, 1, 4, true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'role_specific', 'contractor_compliance', 0.05, 'Contractor compliance with union requirements', false, 0, 100, true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'role_specific', 'eba_contractor_coverage', 0.05, 'EBA coverage among contractors', false, 0, 100, true, current_setting('request.jwt.claims')::json->>'sub')
ON CONFLICT (employer_role, assessment_type, component_name) DO NOTHING;

-- Insert default assessment frequency configuration
INSERT INTO public.assessment_frequency_config (
    employer_role, assessment_type, base_frequency_interval, minimum_interval, maximum_interval,
    high_risk_multiplier, medium_risk_multiplier, low_risk_multiplier,
    additional_assessment_triggers, is_active, created_by
) VALUES
-- Union Respect Assessment Frequencies
('trade', 'union_respect', INTERVAL '6 months', INTERVAL '3 months', INTERVAL '12 months', 0.5, 1.0, 1.5,
 '["industrial_dispute", "complaint_filed", "delegate_change"]', true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'union_respect', INTERVAL '4 months', INTERVAL '2 months', INTERVAL '9 months', 0.5, 1.0, 1.5,
 '["industrial_dispute", "complaint_filed", "delegate_change", "major_project_start"]', true, current_setting('request.jwt.claims')::json->>'sub'),

-- Safety Assessment Frequencies
('trade', 'safety', INTERVAL '4 months', INTERVAL '2 months', INTERVAL '8 months', 0.5, 1.0, 1.5,
 '["serious_incident", "prohibition_notice", "safety_system_change"]', true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'safety', INTERVAL '3 months', INTERVAL '1 month', INTERVAL '6 months', 0.5, 1.0, 1.5,
 '["serious_incident", "prohibition_notice", "safety_system_change", "new_project_start"]', true, current_setting('request.jwt.claims')::json->>'sub'),

-- Subcontractor Assessment Frequencies
('trade', 'subcontractor_use', INTERVAL '12 months', INTERVAL '6 months', INTERVAL '18 months', 0.5, 1.0, 1.5,
 '["payment_dispute", "workforce_change", "major_contract_change"]', true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'subcontractor_use', INTERVAL '6 months', INTERVAL '3 months', INTERVAL '12 months', 0.5, 1.0, 1.5,
 '["payment_dispute", "workforce_change", "major_contract_change", "new_supply_chain"]', true, current_setting('request.jwt.claims')::json->>'sub'),

-- Role-Specific Assessment Frequencies (Builder only)
('builder', 'role_specific', INTERVAL '6 months', INTERVAL '3 months', INTERVAL '12 months', 0.5, 1.0, 1.5,
 '["major_project_completion", "dispute_resolution", "contract_change"]', true, current_setting('request.jwt.claims')::json->>'sub')
ON CONFLICT (employer_role, assessment_type) DO NOTHING;

-- Insert default assessment quality thresholds
INSERT INTO public.assessment_quality_thresholds (
    employer_role, assessment_type, quality_metric, threshold_value, threshold_operator,
    quality_impact, threshold_description, is_active, created_by
) VALUES
-- Minimum assessment thresholds
('trade', 'union_respect', 'minimum_assessments', 1, '>=', 'high', 'Minimum number of union respect assessments required', true, current_setting('request.jwt.claims')::json->>'sub'),
('trade', 'safety', 'minimum_assessments', 2, '>=', 'high', 'Minimum number of safety assessments required', true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'union_respect', 'minimum_assessments', 2, '>=', 'high', 'Minimum number of union respect assessments required', true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'safety', 'minimum_assessments', 3, '>=', 'high', 'Minimum number of safety assessments required', true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'role_specific', 'minimum_assessments', 1, '>=', 'high', 'Minimum number of role-specific assessments required', true, current_setting('request.jwt.claims')::json->>'sub'),

-- Data recency thresholds
('trade', 'union_respect', 'data_recency', 365, '<=', 'high', 'Union respect assessment must be within last year', true, current_setting('request.jwt.claims')::json->>'sub'),
('trade', 'safety', 'data_recency', 270, '<=', 'high', 'Safety assessment must be within last 9 months', true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'union_respect', 'data_recency', 270, '<=', 'high', 'Union respect assessment must be within last 9 months', true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'safety', 'data_recency', 180, '<=', 'high', 'Safety assessment must be within last 6 months', true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'role_specific', 'data_recency', 365, '<=', 'medium', 'Role-specific assessment should be within last year', true, current_setting('request.jwt.claims')::json->>'sub'),

-- Confidence level thresholds
('trade', 'union_respect', 'confidence_level', 2, '>=', 'medium', 'Union respect assessments should have medium or better confidence', true, current_setting('request.jwt.claims')::json->>'sub'),
('trade', 'safety', 'confidence_level', 2, '>=', 'high', 'Safety assessments should have medium or better confidence', true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'union_respect', 'confidence_level', 2, '>=', 'medium', 'Union respect assessments should have medium or better confidence', true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'safety', 'confidence_level', 3, '>=', 'high', 'Safety assessments should have high confidence for builders', true, current_setting('request.jwt.claims')::json->>'sub'),

-- Coverage percentage thresholds
('trade', 'comprehensive', 'coverage_percentage', 80, '>=', 'medium', 'Assessment coverage should be at least 80% for comprehensive rating', true, current_setting('request.jwt.claims')::json->>'sub'),
('builder', 'comprehensive', 'coverage_percentage', 90, '>=', 'high', 'Assessment coverage should be at least 90% for builders', true, current_setting('request.jwt.claims')::json->>'sub')
ON CONFLICT (employer_role, assessment_type, quality_metric) DO NOTHING;

-- Insert default rating calculation configurations
INSERT INTO public.rating_calculation_config (
    employer_role, calculation_method, method_description, algorithm_config,
    union_respect_weight, safety_weight, subcontractor_weight, role_specific_weight,
    critical_components, veto_components, bonus_components,
    is_default, is_active, created_by
) VALUES
-- Trade calculation method
('trade', '4_point_trade_weighted', '4-point scale calculation optimized for trade contractors',
 jsonb_build_object(
     'algorithm_type', 'weighted_average',
     'score_normalization', true,
     'critical_factor_override', false
 ),
 0.35, 0.35, 0.3, 0.0,
 '["safety_incidents_terrible", "union_respect_terrible"]', -- Critical components
 '["safety_incidents_terrible"]', -- Veto components (terrible safety rating)
 '["union_respect_good", "safety_good"]', -- Bonus components
 true, true, current_setting('request.jwt.claims')::json->>'sub'),

-- Builder calculation method
('builder', '4_point_builder_weighted', '4-point scale calculation optimized for builders',
 jsonb_build_object(
     'algorithm_type', 'weighted_average',
     'score_normalization', true,
     'critical_factor_override', true,
     'role_specific_emphasis', true
 ),
 0.25, 0.25, 0.2, 0.3,
 '["safety_incidents_terrible", "union_respect_terrible", "role_specific_terrible"]', -- Critical components
 '["safety_incidents_terrible", "union_respect_terrible"]', -- Veto components
 '["union_respect_good", "safety_good", "role_specific_good"]', -- Bonus components
 true, true, current_setting('request.jwt.claims')::json->>'sub'),

-- Both calculation method
('both', '4_point_balanced_weighted', 'Balanced 4-point scale calculation for employers operating as both trade and builder',
 jsonb_build_object(
     'algorithm_type', 'weighted_average',
     'score_normalization', true,
     'critical_factor_override', true,
     'dual_role_support', true
 ),
 0.3, 0.3, 0.2, 0.2,
 '["safety_incidents_terrible", "union_respect_terrible"]', -- Critical components
 '["safety_incidents_terrible"]', -- Veto components
 '["union_respect_good", "safety_good", "role_specific_good"]', -- Bonus components
 true, true, current_setting('request.jwt.claims')::json->>'sub')
ON CONFLICT (employer_role, calculation_method) DO NOTHING;

-- Create indexes for performance
CREATE INDEX idx_assessment_templates_role_type ON public.assessment_templates(employer_role, assessment_type, is_active);
CREATE INDEX idx_assessment_templates_active_default ON public.assessment_templates(is_active, is_default);
CREATE INDEX idx_role_assessment_weights_role_type ON public.role_assessment_weights(employer_role, assessment_type, is_active);
CREATE INDEX idx_assessment_frequency_config_role_type ON public.assessment_frequency_config(employer_role, assessment_type, is_active);
CREATE INDEX idx_assessment_quality_thresholds_role_type ON public.assessment_quality_thresholds(employer_role, assessment_type, quality_metric, is_active);
CREATE INDEX idx_rating_calculation_config_role_method ON public.rating_calculation_config(employer_role, calculation_method, is_active);

-- Add updated_at triggers
CREATE TRIGGER update_assessment_templates_updated_at
    BEFORE UPDATE ON public.assessment_templates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_role_assessment_weights_updated_at
    BEFORE UPDATE ON public.role_assessment_weights
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assessment_frequency_config_updated_at
    BEFORE UPDATE ON public.assessment_frequency_config
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assessment_quality_thresholds_updated_at
    BEFORE UPDATE ON public.assessment_quality_thresholds
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rating_calculation_config_updated_at
    BEFORE UPDATE ON public.rating_calculation_config
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.assessment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_assessment_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_frequency_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_quality_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_calculation_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Read access for authenticated users, write access for admins
CREATE POLICY "Assessment templates read access" ON public.assessment_templates
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Assessment templates write access" ON public.assessment_templates
    FOR ALL USING (
        auth.role() = 'authenticated' AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Apply similar policies to other configuration tables
CREATE POLICY "Role assessment weights read access" ON public.role_assessment_weights
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Role assessment weights write access" ON public.role_assessment_weights
    FOR ALL USING (
        auth.role() = 'authenticated' AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Assessment frequency config read access" ON public.assessment_frequency_config
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Assessment frequency config write access" ON public.assessment_frequency_config
    FOR ALL USING (
        auth.role() = 'authenticated' AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Assessment quality thresholds read access" ON public.assessment_quality_thresholds
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Assessment quality thresholds write access" ON public.assessment_quality_thresholds
    FOR ALL USING (
        auth.role() = 'authenticated' AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Rating calculation config read access" ON public.rating_calculation_config
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Rating calculation config write access" ON public.rating_calculation_config
    FOR ALL USING (
        auth.role() = 'authenticated' AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Comments for documentation
COMMENT ON TABLE public.assessment_templates IS 'Configurable templates for different employer roles and assessment types';
COMMENT ON TABLE public.role_assessment_weights IS 'Weighting configuration for assessment components by employer role';
COMMENT ON TABLE public.assessment_frequency_config IS 'Configuration for assessment frequency by employer role and assessment type';
COMMENT ON TABLE public.assessment_quality_thresholds IS 'Quality thresholds for assessment data completeness and recency';
COMMENT ON TABLE public.rating_calculation_config IS 'Configuration for rating calculation methods by employer role';

-- Grant permissions
GRANT ALL ON public.assessment_templates TO authenticated;
GRANT ALL ON public.role_assessment_weights TO authenticated;
GRANT ALL ON public.assessment_frequency_config TO authenticated;
GRANT ALL ON public.assessment_quality_thresholds TO authenticated;
GRANT ALL ON public.rating_calculation_config TO authenticated;