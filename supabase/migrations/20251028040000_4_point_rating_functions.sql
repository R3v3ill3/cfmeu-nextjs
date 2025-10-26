-- CFMEU Rating System Transformation - 4-Point Rating Calculation Functions
-- This migration creates updated rating calculation functions that support
-- the 4-point scale and role-based assessment logic

-- Drop existing functions that need to be replaced
DROP FUNCTION IF EXISTS public.calculate_project_compliance_rating(uuid, date, integer);
DROP FUNCTION IF EXISTS public.calculate_expertise_rating(uuid, date, integer);
DROP FUNCTION IF EXISTS public.calculate_final_employer_rating(uuid, date, numeric, numeric, numeric, text);
DROP FUNCTION IF EXISTS public.create_or_update_final_rating(uuid, date, uuid);

-- Create 4-point scale calculation helpers
CREATE OR REPLACE FUNCTION public.calculate_weighted_4_point_score(
    p_scores numeric[],
    p_weights numeric[]
) RETURNS numeric AS $$
DECLARE
    v_weighted_sum numeric := 0;
    v_total_weight numeric := 0;
    v_result numeric;
    i integer;
BEGIN
    -- Calculate weighted average of 4-point scores
    FOR i IN 1..array_length(p_scores, 1) LOOP
        IF p_scores[i] IS NOT NULL AND p_weights[i] IS NOT NULL THEN
            v_weighted_sum := v_weighted_sum + (p_scores[i] * p_weights[i]);
            v_total_weight := v_total_weight + p_weights[i];
        END IF;
    END LOOP;

    -- Return weighted average or null if no valid scores
    IF v_total_weight > 0 THEN
        v_result := v_weighted_sum / v_total_weight;
        -- Ensure result stays within 1-4 range
        v_result := GREATEST(1, LEAST(4, v_result));
        RETURN v_result;
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.convert_4_point_to_traffic_light(
    p_4_point_score numeric
) RETURNS traffic_light_rating AS $$
BEGIN
    -- Convert 4-point score to traffic light rating
    -- 1 = good, 2 = fair, 3 = poor, 4 = terrible
    CASE p_4_point_score
        WHEN 1 THEN RETURN 'green';
        WHEN 2 THEN RETURN 'amber';
        WHEN 3 THEN RETURN 'red';
        WHEN 4 THEN RETURN 'red';
        ELSE RETURN 'unknown';
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Union Respect Rating Calculation
CREATE OR REPLACE FUNCTION public.calculate_union_respect_rating(
    p_employer_id uuid,
    p_calculation_date date DEFAULT CURRENT_DATE,
    p_lookback_days integer DEFAULT 365
) RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
    v_assessments jsonb := '[]';
    v_component_scores numeric[] := '{}';
    v_component_weights numeric[] := '{0.25, 0.25, 0.25, 0.25}'; -- Equal weights for all components
    v_final_score numeric;
    v_final_rating traffic_light_rating;
    v_data_quality rating_confidence_level := 'very_low';
    v_assessment_count integer := 0;
    v_latest_assessment date;
    rec RECORD;
BEGIN
    -- Get all union respect assessments within lookback period
    FOR rec IN
        SELECT
            ura.id,
            ura.right_of_entry_score,
            ura.delegate_accommodation_score,
            ura.access_to_information_score,
            ura.access_to_inductions_score,
            ura.overall_union_respect_score,
            ura.assessment_date,
            ura.confidence_level,
            ura.assessment_method,
            ura.assessment_context,
            p.name as assessor_name
        FROM public.union_respect_assessments ura
        LEFT JOIN public.profiles p ON ura.assessor_id = p.id
        WHERE ura.employer_id = p_employer_id
          AND ura.assessment_date >= p_calculation_date - (p_lookback_days || ' days')::interval
          AND ura.is_active = true
          AND ura.assessment_complete = true
        ORDER BY ura.assessment_date DESC
    LOOP
        -- Store assessment details
        v_assessments := v_assessments || jsonb_build_object(
            'assessment_id', rec.id,
            'right_of_entry_score', rec.right_of_entry_score,
            'delegate_accommodation_score', rec.delegate_accommodation_score,
            'access_to_information_score', rec.access_to_information_score,
            'access_to_inductions_score', rec.access_to_inductions_score,
            'overall_union_respect_score', rec.overall_union_respect_score,
            'assessment_date', rec.assessment_date,
            'confidence_level', rec.confidence_level,
            'assessment_method', rec.assessment_method,
            'assessment_context', rec.assessment_context,
            'assessor_name', rec.assessor_name
        );

        v_assessment_count := v_assessment_count + 1;
        IF v_latest_assessment IS NULL OR rec.assessment_date > v_latest_assessment THEN
            v_latest_assessment := rec.assessment_date;
        END IF;
    END LOOP;

    -- Calculate average scores for each component
    DECLARE
        v_right_of_entry_avg numeric;
        v_delegate_accommodation_avg numeric;
        v_access_to_information_avg numeric;
        v_access_to_inductions_avg numeric;
    BEGIN
        SELECT AVG(right_of_entry_score) INTO v_right_of_entry_avg
        FROM public.union_respect_assessments
        WHERE employer_id = p_employer_id
          AND assessment_date >= p_calculation_date - (p_lookback_days || ' days')::interval
          AND is_active = true
          AND assessment_complete = true
          AND right_of_entry_score IS NOT NULL;

        SELECT AVG(delegate_accommodation_score) INTO v_delegate_accommodation_avg
        FROM public.union_respect_assessments
        WHERE employer_id = p_employer_id
          AND assessment_date >= p_calculation_date - (p_lookback_days || ' days')::interval
          AND is_active = true
          AND assessment_complete = true
          AND delegate_accommodation_score IS NOT NULL;

        SELECT AVG(access_to_information_score) INTO v_access_to_information_avg
        FROM public.union_respect_assessments
        WHERE employer_id = p_employer_id
          AND assessment_date >= p_calculation_date - (p_lookback_days || ' days')::interval
          AND is_active = true
          AND assessment_complete = true
          AND access_to_information_score IS NOT NULL;

        SELECT AVG(access_to_inductions_score) INTO v_access_to_inductions_avg
        FROM public.union_respect_assessments
        WHERE employer_id = p_employer_id
          AND assessment_date >= p_calculation_date - (p_lookback_days || ' days')::interval
          AND is_active = true
          AND assessment_complete = true
          AND access_to_inductions_score IS NOT NULL;

        -- Build component scores array
        v_component_scores := ARRAY[
            COALESCE(v_right_of_entry_avg, 2.5),    -- Default to middle score
            COALESCE(v_delegate_accommodation_avg, 2.5),
            COALESCE(v_access_to_information_avg, 2.5),
            COALESCE(v_access_to_inductions_avg, 2.5)
        ];
    END;

    -- Calculate final score using weighted average
    v_final_score := public.calculate_weighted_4_point_score(v_component_scores, v_component_weights);

    -- Determine data quality
    IF v_assessment_count >= 3 AND (p_calculation_date - v_latest_assessment) <= 90 THEN
        v_data_quality := 'high';
    ELSIF v_assessment_count >= 2 AND (p_calculation_date - v_latest_assessment) <= 180 THEN
        v_data_quality := 'medium';
    ELSIF v_assessment_count >= 1 AND (p_calculation_date - v_latest_assessment) <= 270 THEN
        v_data_quality := 'low';
    ELSE
        v_data_quality := 'very_low';
    END IF;

    -- Determine final traffic light rating
    v_final_rating := public.convert_4_point_to_traffic_light(v_final_score);

    -- Build result JSON
    v_result := jsonb_build_object(
        'union_respect_rating', v_final_rating,
        'union_respect_score', v_final_score,
        'data_quality', v_data_quality,
        'assessment_count', v_assessment_count,
        'assessments', v_assessments,
        'latest_assessment_date', v_latest_assessment,
        'data_age_days', COALESCE(p_calculation_date - v_latest_assessment, NULL),
        'component_scores', jsonb_build_object(
            'right_of_entry', v_component_scores[1],
            'delegate_accommodation', v_component_scores[2],
            'access_to_information', v_component_scores[3],
            'access_to_inductions', v_component_scores[4]
        ),
        'calculation_date', p_calculation_date
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Safety Rating Calculation (4-point scale)
CREATE OR REPLACE FUNCTION public.calculate_safety_rating_4_point(
    p_employer_id uuid,
    p_calculation_date date DEFAULT CURRENT_DATE,
    p_lookback_days integer DEFAULT 365
) RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
    v_assessments jsonb := '[]';
    v_component_scores numeric[] := '{}';
    v_component_weights numeric[] := '{0.4, 0.4, 0.2}'; -- Safety incidents weighted more heavily
    v_final_score numeric;
    v_final_rating traffic_light_rating;
    v_data_quality rating_confidence_level := 'very_low';
    v_assessment_count integer := 0;
    v_latest_assessment date;
    rec RECORD;
BEGIN
    -- Get all safety assessments within lookback period
    FOR rec IN
        SELECT
            sa.id,
            sa.hsr_respect_score,
            sa.general_safety_score,
            sa.safety_incidents_score,
            sa.overall_safety_score,
            sa.assessment_date,
            sa.confidence_level,
            sa.assessment_method,
            sa.assessment_context,
            sa.safety_incidents_reviewed,
            p.name as assessor_name
        FROM public.safety_assessments_4_point sa
        LEFT JOIN public.profiles p ON sa.assessor_id = p.id
        WHERE sa.employer_id = p_employer_id
          AND sa.assessment_date >= p_calculation_date - (p_lookback_days || ' days')::interval
          AND sa.is_active = true
          AND sa.assessment_complete = true
        ORDER BY sa.assessment_date DESC
    LOOP
        v_assessments := v_assessments || jsonb_build_object(
            'assessment_id', rec.id,
            'hsr_respect_score', rec.hsr_respect_score,
            'general_safety_score', rec.general_safety_score,
            'safety_incidents_score', rec.safety_incidents_score,
            'overall_safety_score', rec.overall_safety_score,
            'assessment_date', rec.assessment_date,
            'confidence_level', rec.confidence_level,
            'assessment_method', rec.assessment_method,
            'assessment_context', rec.assessment_context,
            'safety_incidents_reviewed', rec.safety_incidents_reviewed,
            'assessor_name', rec.assessor_name
        );

        v_assessment_count := v_assessment_count + 1;
        IF v_latest_assessment IS NULL OR rec.assessment_date > v_latest_assessment THEN
            v_latest_assessment := rec.assessment_date;
        END IF;
    END LOOP;

    -- Calculate average scores for each component
    DECLARE
        v_hsr_respect_avg numeric;
        v_general_safety_avg numeric;
        v_safety_incidents_avg numeric;
    BEGIN
        SELECT AVG(hsr_respect_score) INTO v_hsr_respect_avg
        FROM public.safety_assessments_4_point
        WHERE employer_id = p_employer_id
          AND assessment_date >= p_calculation_date - (p_lookback_days || ' days')::interval
          AND is_active = true
          AND assessment_complete = true
          AND hsr_respect_score IS NOT NULL;

        SELECT AVG(general_safety_score) INTO v_general_safety_avg
        FROM public.safety_assessments_4_point
        WHERE employer_id = p_employer_id
          AND assessment_date >= p_calculation_date - (p_lookback_days || ' days')::interval
          AND is_active = true
          AND assessment_complete = true
          AND general_safety_score IS NOT NULL;

        SELECT AVG(safety_incidents_score) INTO v_safety_incidents_avg
        FROM public.safety_assessments_4_point
        WHERE employer_id = p_employer_id
          AND assessment_date >= p_calculation_date - (p_lookback_days || ' days')::interval
          AND is_active = true
          AND assessment_complete = true
          AND safety_incidents_score IS NOT NULL;

        -- Build component scores array
        v_component_scores := ARRAY[
            COALESCE(v_hsr_respect_avg, 2.5),       -- Default to middle score
            COALESCE(v_general_safety_avg, 2.5),
            COALESCE(v_safety_incidents_avg, 2.5)
        ];
    END;

    -- Calculate final score using weighted average
    v_final_score := public.calculate_weighted_4_point_score(v_component_scores, v_component_weights);

    -- Determine data quality
    IF v_assessment_count >= 3 AND (p_calculation_date - v_latest_assessment) <= 90 THEN
        v_data_quality := 'high';
    ELSIF v_assessment_count >= 2 AND (p_calculation_date - v_latest_assessment) <= 180 THEN
        v_data_quality := 'medium';
    ELSIF v_assessment_count >= 1 AND (p_calculation_date - v_latest_assessment) <= 270 THEN
        v_data_quality := 'low';
    ELSE
        v_data_quality := 'very_low';
    END IF;

    -- Determine final traffic light rating
    v_final_rating := public.convert_4_point_to_traffic_light(v_final_score);

    -- Build result JSON
    v_result := jsonb_build_object(
        'safety_rating', v_final_rating,
        'safety_score', v_final_score,
        'data_quality', v_data_quality,
        'assessment_count', v_assessment_count,
        'assessments', v_assessments,
        'latest_assessment_date', v_latest_assessment,
        'data_age_days', COALESCE(p_calculation_date - v_latest_assessment, NULL),
        'component_scores', jsonb_build_object(
            'hsr_respect', v_component_scores[1],
            'general_safety', v_component_scores[2],
            'safety_incidents', v_component_scores[3]
        ),
        'calculation_date', p_calculation_date
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Subcontractor Rating Calculation
CREATE OR REPLACE FUNCTION public.calculate_subcontractor_rating(
    p_employer_id uuid,
    p_calculation_date date DEFAULT CURRENT_DATE,
    p_lookback_days integer DEFAULT 365
) RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
    v_assessments jsonb := '[]';
    v_final_score numeric;
    v_final_rating traffic_light_rating;
    v_data_quality rating_confidence_level := 'very_low';
    v_assessment_count integer := 0;
    v_latest_assessment date;
    rec RECORD;
BEGIN
    -- Get all subcontractor assessments within lookback period
    FOR rec IN
        SELECT
            sua.id,
            sua.usage_score,
            sua.overall_subcontractor_score,
            sua.subcontractor_count,
            sua.subcontractor_percentage,
            sua.assessment_basis,
            sua.assessment_date,
            sua.confidence_level,
            sua.assessment_context,
            p.name as assessor_name
        FROM public.subcontractor_use_assessments sua
        LEFT JOIN public.profiles p ON sua.assessor_id = p.id
        WHERE sua.employer_id = p_employer_id
          AND sua.assessment_date >= p_calculation_date - (p_lookback_days || ' days')::interval
          AND sua.is_active = true
          AND sua.assessment_complete = true
        ORDER BY sua.assessment_date DESC
    LOOP
        v_assessments := v_assessments || jsonb_build_object(
            'assessment_id', rec.id,
            'usage_score', rec.usage_score,
            'overall_subcontractor_score', rec.overall_subcontractor_score,
            'subcontractor_count', rec.subcontractor_count,
            'subcontractor_percentage', rec.subcontractor_percentage,
            'assessment_basis', rec.assessment_basis,
            'assessment_date', rec.assessment_date,
            'confidence_level', rec.confidence_level,
            'assessment_context', rec.assessment_context,
            'assessor_name', rec.assessor_name
        );

        v_assessment_count := v_assessment_count + 1;
        IF v_latest_assessment IS NULL OR rec.assessment_date > v_latest_assessment THEN
            v_latest_assessment := rec.assessment_date;
        END IF;
    END LOOP;

    -- Calculate final score (use overall_subcontractor_score if available, otherwise usage_score)
    SELECT AVG(COALESCE(overall_subcontractor_score, usage_score)) INTO v_final_score
    FROM public.subcontractor_use_assessments
    WHERE employer_id = p_employer_id
      AND assessment_date >= p_calculation_date - (p_lookback_days || ' days')::interval
      AND is_active = true
      AND assessment_complete = true
      AND (overall_subcontractor_score IS NOT NULL OR usage_score IS NOT NULL);

    -- Ensure score is within valid range
    IF v_final_score IS NOT NULL THEN
        v_final_score := GREATEST(1, LEAST(4, v_final_score));
    END IF;

    -- Determine data quality
    IF v_assessment_count >= 2 AND (p_calculation_date - v_latest_assessment) <= 180 THEN
        v_data_quality := 'high';
    ELSIF v_assessment_count >= 1 AND (p_calculation_date - v_latest_assessment) <= 270 THEN
        v_data_quality := 'medium';
    ELSIF v_assessment_count >= 1 AND (p_calculation_date - v_latest_assessment) <= 365 THEN
        v_data_quality := 'low';
    ELSE
        v_data_quality := 'very_low';
    END IF;

    -- Determine final traffic light rating
    v_final_rating := public.convert_4_point_to_traffic_light(v_final_score);

    -- Build result JSON
    v_result := jsonb_build_object(
        'subcontractor_rating', v_final_rating,
        'subcontractor_score', v_final_score,
        'data_quality', v_data_quality,
        'assessment_count', v_assessment_count,
        'assessments', v_assessments,
        'latest_assessment_date', v_latest_assessment,
        'data_age_days', COALESCE(p_calculation_date - v_latest_assessment, NULL),
        'calculation_date', p_calculation_date
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Role-Specific Rating Calculation
CREATE OR REPLACE FUNCTION public.calculate_role_specific_rating(
    p_employer_id uuid,
    p_calculation_date date DEFAULT CURRENT_DATE,
    p_lookback_days integer DEFAULT 365
) RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
    v_assessments jsonb := '[]';
    v_component_scores numeric[] := '{}';
    v_component_weights numeric[] := '{0.25, 0.25, 0.25, 0.25}'; -- Equal weights for builder components
    v_final_score numeric;
    v_final_rating traffic_light_rating;
    v_data_quality rating_confidence_level := 'very_low';
    v_assessment_count integer := 0;
    v_latest_assessment date;
    v_employer_role employer_role_type;
    rec RECORD;
BEGIN
    -- Get employer role to determine if this assessment applies
    SELECT role_type INTO v_employer_role
    FROM public.employers
    WHERE id = p_employer_id;

    -- Return early if employer is not a builder or both
    IF v_employer_role NOT IN ('builder', 'both') THEN
        RETURN jsonb_build_object(
            'role_specific_rating', NULL,
            'role_specific_score', NULL,
            'applicable', false,
            'reason', 'Employer role does not require role-specific assessment',
            'calculation_date', p_calculation_date
        );
    END IF;

    -- Get all role-specific assessments within lookback period
    FOR rec IN
        SELECT
            rsa.id,
            rsa.tender_consultation_score,
            rsa.open_communication_score,
            rsa.delegate_facilities_score,
            rsa.project_coordination_score,
            rsa.dispute_resolution_score,
            rsa.overall_role_specific_score,
            rsa.assessment_date,
            rsa.confidence_level,
            rsa.employer_role,
            rsa.contractor_compliance_percentage,
            rsa.eba_contractor_percentage,
            p.name as assessor_name
        FROM public.role_specific_assessments rsa
        LEFT JOIN public.profiles p ON rsa.assessor_id = p.id
        WHERE rsa.employer_id = p_employer_id
          AND rsa.assessment_date >= p_calculation_date - (p_lookback_days || ' days')::interval
          AND rsa.is_active = true
          AND rsa.assessment_complete = true
        ORDER BY rsa.assessment_date DESC
    LOOP
        v_assessments := v_assessments || jsonb_build_object(
            'assessment_id', rec.id,
            'tender_consultation_score', rec.tender_consultation_score,
            'open_communication_score', rec.open_communication_score,
            'delegate_facilities_score', rec.delegate_facilities_score,
            'project_coordination_score', rec.project_coordination_score,
            'dispute_resolution_score', rec.dispute_resolution_score,
            'overall_role_specific_score', rec.overall_role_specific_score,
            'assessment_date', rec.assessment_date,
            'confidence_level', rec.confidence_level,
            'employer_role', rec.employer_role,
            'contractor_compliance_percentage', rec.contractor_compliance_percentage,
            'eba_contractor_percentage', rec.eba_contractor_percentage,
            'assessor_name', rec.assessor_name
        );

        v_assessment_count := v_assessment_count + 1;
        IF v_latest_assessment IS NULL OR rec.assessment_date > v_latest_assessment THEN
            v_latest_assessment := rec.assessment_date;
        END IF;
    END LOOP;

    -- Calculate average scores for each component
    DECLARE
        v_tender_consultation_avg numeric;
        v_open_communication_avg numeric;
        v_delegate_facilities_avg numeric;
        v_project_coordination_avg numeric;
        v_dispute_resolution_avg numeric;
    BEGIN
        SELECT AVG(tender_consultation_score) INTO v_tender_consultation_avg
        FROM public.role_specific_assessments
        WHERE employer_id = p_employer_id
          AND assessment_date >= p_calculation_date - (p_lookback_days || ' days')::interval
          AND is_active = true
          AND assessment_complete = true
          AND tender_consultation_score IS NOT NULL;

        SELECT AVG(open_communication_score) INTO v_open_communication_avg
        FROM public.role_specific_assessments
        WHERE employer_id = p_employer_id
          AND assessment_date >= p_calculation_date - (p_lookback_days || ' days')::interval
          AND is_active = true
          AND assessment_complete = true
          AND open_communication_score IS NOT NULL;

        SELECT AVG(delegate_facilities_score) INTO v_delegate_facilities_avg
        FROM public.role_specific_assessments
        WHERE employer_id = p_employer_id
          AND assessment_date >= p_calculation_date - (p_lookback_days || ' days')::interval
          AND is_active = true
          AND assessment_complete = true
          AND delegate_facilities_score IS NOT NULL;

        SELECT AVG(project_coordination_score) INTO v_project_coordination_avg
        FROM public.role_specific_assessments
        WHERE employer_id = p_employer_id
          AND assessment_date >= p_calculation_date - (p_lookback_days || ' days')::interval
          AND is_active = true
          AND assessment_complete = true
          AND project_coordination_score IS NOT NULL;

        SELECT AVG(dispute_resolution_score) INTO v_dispute_resolution_avg
        FROM public.role_specific_assessments
        WHERE employer_id = p_employer_id
          AND assessment_date >= p_calculation_date - (p_lookback_days || ' days')::interval
          AND is_active = true
          AND assessment_complete = true
          AND dispute_resolution_score IS NOT NULL;

        -- Build component scores array (use top 4 most relevant components)
        v_component_scores := ARRAY[
            COALESCE(v_tender_consultation_avg, 2.5),
            COALESCE(v_open_communication_avg, 2.5),
            COALESCE(v_delegate_facilities_avg, 2.5),
            COALESCE(v_project_coordination_avg, 2.5)
        ];
    END;

    -- Calculate final score using weighted average
    v_final_score := public.calculate_weighted_4_point_score(v_component_scores, v_component_weights);

    -- Determine data quality
    IF v_assessment_count >= 2 AND (p_calculation_date - v_latest_assessment) <= 180 THEN
        v_data_quality := 'high';
    ELSIF v_assessment_count >= 1 AND (p_calculation_date - v_latest_assessment) <= 270 THEN
        v_data_quality := 'medium';
    ELSIF v_assessment_count >= 1 AND (p_calculation_date - v_latest_assessment) <= 365 THEN
        v_data_quality := 'low';
    ELSE
        v_data_quality := 'very_low';
    END IF;

    -- Determine final traffic light rating
    v_final_rating := public.convert_4_point_to_traffic_light(v_final_score);

    -- Build result JSON
    v_result := jsonb_build_object(
        'role_specific_rating', v_final_rating,
        'role_specific_score', v_final_score,
        'data_quality', v_data_quality,
        'assessment_count', v_assessment_count,
        'applicable', true,
        'assessments', v_assessments,
        'latest_assessment_date', v_latest_assessment,
        'data_age_days', COALESCE(p_calculation_date - v_latest_assessment, NULL),
        'component_scores', jsonb_build_object(
            'tender_consultation', v_component_scores[1],
            'open_communication', v_component_scores[2],
            'delegate_facilities', v_component_scores[3],
            'project_coordination', v_component_scores[4]
        ),
        'calculation_date', p_calculation_date
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Main 4-Point Rating Calculation Function
CREATE OR REPLACE FUNCTION public.calculate_final_employer_rating_4_point(
    p_employer_id uuid,
    p_calculation_date date DEFAULT CURRENT_DATE,
    p_calculation_method text DEFAULT 'role_weighted_hybrid'
) RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
    v_union_respect_data jsonb;
    v_safety_data jsonb;
    v_subcontractor_data jsonb;
    v_role_specific_data jsonb;
    v_employer_role employer_role_type;
    v_final_score numeric;
    v_final_rating traffic_light_rating;
    v_overall_confidence rating_confidence_level;
    v_data_completeness numeric := 0;

    -- Role-based weights
    v_union_weight numeric := 0.3;
    v_safety_weight numeric := 0.3;
    v_subcontractor_weight numeric := 0.2;
    v_role_specific_weight numeric := 0.2;

    v_component_scores numeric[] := '{}';
    v_component_weights numeric[] := '{}';
    v_weight_adjustments jsonb;
BEGIN
    -- Get employer role
    SELECT role_type INTO v_employer_role
    FROM public.employers
    WHERE id = p_employer_id;

    -- Adjust weights based on employer role
    CASE v_employer_role
        WHEN 'trade' THEN
            v_union_weight := 0.35;
            v_safety_weight := 0.35;
            v_subcontractor_weight := 0.3;
            v_role_specific_weight := 0.0;
        WHEN 'builder' THEN
            v_union_weight := 0.25;
            v_safety_weight := 0.25;
            v_subcontractor_weight := 0.2;
            v_role_specific_weight := 0.3;
        WHEN 'both' THEN
            v_union_weight := 0.3;
            v_safety_weight := 0.3;
            v_subcontractor_weight := 0.2;
            v_role_specific_weight := 0.2;
        ELSE
            -- Default/unknown role - use equal weights for basic components
            v_union_weight := 0.4;
            v_safety_weight := 0.4;
            v_subcontractor_weight := 0.2;
            v_role_specific_weight := 0.0;
    END CASE;

    -- Calculate component ratings
    v_union_respect_data := public.calculate_union_respect_rating(p_employer_id, p_calculation_date);
    v_safety_data := public.calculate_safety_rating_4_point(p_employer_id, p_calculation_date);
    v_subcontractor_data := public.calculate_subcontractor_rating(p_employer_id, p_calculation_date);
    v_role_specific_data := public.calculate_role_specific_rating(p_employer_id, p_calculation_date);

    -- Build component scores and weights arrays
    IF (v_union_respect_data->>'union_respect_score') IS NOT NULL THEN
        v_component_scores := v_component_scores || (v_union_respect_data->>'union_respect_score')::numeric;
        v_component_weights := v_component_weights || v_union_weight;
        v_data_completeness := v_data_completeness + (v_union_weight * 100);
    END IF;

    IF (v_safety_data->>'safety_score') IS NOT NULL THEN
        v_component_scores := v_component_scores || (v_safety_data->>'safety_score')::numeric;
        v_component_weights := v_component_weights || v_safety_weight;
        v_data_completeness := v_data_completeness + (v_safety_weight * 100);
    END IF;

    IF (v_subcontractor_data->>'subcontractor_score') IS NOT NULL THEN
        v_component_scores := v_component_scores || (v_subcontractor_data->>'subcontractor_score')::numeric;
        v_component_weights := v_component_weights || v_subcontractor_weight;
        v_data_completeness := v_data_completeness + (v_subcontractor_weight * 100);
    END IF;

    -- Add role-specific score if applicable
    IF (v_role_specific_data->>'applicable')::boolean = true
       AND (v_role_specific_data->>'role_specific_score') IS NOT NULL THEN
        v_component_scores := v_component_scores || (v_role_specific_data->>'role_specific_score')::numeric;
        v_component_weights := v_component_weights || v_role_specific_weight;
        v_data_completeness := v_data_completeness + (v_role_specific_weight * 100);
    END IF;

    -- Calculate final score
    IF array_length(v_component_scores, 1) > 0 THEN
        v_final_score := public.calculate_weighted_4_point_score(v_component_scores, v_component_weights);
    END IF;

    -- Determine final traffic light rating
    v_final_rating := public.convert_4_point_to_traffic_light(v_final_score);

    -- Calculate overall confidence
    DECLARE
        v_component_confidences text[] := '{}';
        v_confidence_values numeric[] := '{}';
        v_confidence_weights numeric[] := '{}';
    BEGIN
        -- Collect confidence levels from components
        IF (v_union_respect_data->>'data_quality') IS NOT NULL THEN
            v_component_confidences := v_component_confidences || (v_union_respect_data->>'data_quality');
            v_confidence_weights := v_confidence_weights || v_union_weight;
        END IF;

        IF (v_safety_data->>'data_quality') IS NOT NULL THEN
            v_component_confidences := v_component_confidences || (v_safety_data->>'data_quality');
            v_confidence_weights := v_confidence_weights || v_safety_weight;
        END IF;

        IF (v_subcontractor_data->>'data_quality') IS NOT NULL THEN
            v_component_confidences := v_component_confidences || (v_subcontractor_data->>'data_quality');
            v_confidence_weights := v_confidence_weights || v_subcontractor_weight;
        END IF;

        IF (v_role_specific_data->>'data_quality') IS NOT NULL
           AND (v_role_specific_data->>'applicable')::boolean = true THEN
            v_component_confidences := v_component_confidences || (v_role_specific_data->>'data_quality');
            v_confidence_weights := v_confidence_weights || v_role_specific_weight;
        END IF;

        -- Convert confidence levels to numeric values
        FOR i IN 1..array_length(v_component_confidences, 1) LOOP
            CASE v_component_confidences[i]
                WHEN 'high' THEN v_confidence_values := v_confidence_values || 0.9;
                WHEN 'medium' THEN v_confidence_values := v_confidence_values || 0.7;
                WHEN 'low' THEN v_confidence_values || 0.5;
                WHEN 'very_low' THEN v_confidence_values || 0.3;
                ELSE v_confidence_values || 0.5;
            END CASE;
        END LOOP;

        -- Calculate weighted average confidence
        IF array_length(v_confidence_values, 1) > 0 THEN
            DECLARE
                v_weighted_confidence numeric := 0;
                v_total_weight numeric := 0;
                j integer;
            BEGIN
                FOR j IN 1..array_length(v_confidence_values, 1) LOOP
                    v_weighted_confidence := v_weighted_confidence + (v_confidence_values[j] * v_confidence_weights[j]);
                    v_total_weight := v_total_weight + v_confidence_weights[j];
                END LOOP;

                IF v_total_weight > 0 THEN
                    v_weighted_confidence := v_weighted_confidence / v_total_weight;
                END IF;

                -- Convert back to confidence level
                IF v_weighted_confidence >= 0.8 THEN
                    v_overall_confidence := 'high';
                ELSIF v_weighted_confidence >= 0.6 THEN
                    v_overall_confidence := 'medium';
                ELSIF v_weighted_confidence >= 0.4 THEN
                    v_overall_confidence := 'low';
                ELSE
                    v_overall_confidence := 'very_low';
                END IF;
            END;
        ELSE
            v_overall_confidence := 'very_low';
        END IF;
    END;

    -- Store weight adjustments for transparency
    v_weight_adjustments := jsonb_build_object(
        'employer_role', v_employer_role,
        'weights', jsonb_build_object(
            'union_respect', v_union_weight,
            'safety', v_safety_weight,
            'subcontractor', v_subcontractor_weight,
            'role_specific', v_role_specific_weight
        )
    );

    -- Build comprehensive result JSON
    v_result := jsonb_build_object(
        'employer_id', p_employer_id,
        'calculation_date', p_calculation_date,
        'final_rating', v_final_rating,
        'final_score', v_final_score,
        'employer_role', v_employer_role,

        -- Component data
        'union_respect_data', v_union_respect_data,
        'safety_data', v_safety_data,
        'subcontractor_data', v_subcontractor_data,
        'role_specific_data', v_role_specific_data,

        -- Quality indicators
        'overall_confidence', v_overall_confidence,
        'data_completeness', v_data_completeness,

        -- Calculation details
        'calculation_method', p_calculation_method,
        'weight_adjustments', v_weight_adjustments,

        -- Metadata
        'calculated_at', now(),
        'calculation_version', '4_point_scale_v1.0'
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to create or update final rating record using 4-point scale
CREATE OR REPLACE FUNCTION public.create_or_update_final_rating_4_point(
    p_employer_id uuid,
    p_calculation_date date DEFAULT CURRENT_DATE,
    p_created_by uuid DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
    v_calculation_result jsonb;
    v_final_rating_id uuid;
    v_employer_role employer_role_type;
BEGIN
    -- Calculate the rating using 4-point scale
    v_calculation_result := public.calculate_final_employer_rating_4_point(p_employer_id, p_calculation_date);

    -- Get employer role for reference
    SELECT role_type INTO v_employer_role
    FROM public.employers
    WHERE id = p_employer_id;

    -- Check if rating already exists for this date
    SELECT id INTO v_final_rating_id
    FROM public.employer_final_ratings
    WHERE employer_id = p_employer_id AND rating_date = p_calculation_date;

    -- Update or insert the rating record
    IF v_final_rating_id IS NOT NULL THEN
        UPDATE public.employer_final_ratings SET
            final_rating = (v_calculation_result->>'final_rating')::traffic_light_rating,
            final_score = (v_calculation_result->>'final_score')::numeric,

            -- Update employer record with 4-point scale data
            overall_union_respect_rating = ((v_calculation_result->'union_respect_data')->>'union_respect_rating')::four_point_rating,
            overall_union_respect_score = ((v_calculation_result->'union_respect_data')->>'union_respect_score')::numeric,
            overall_safety_rating = ((v_calculation_result->'safety_data')->>'safety_rating')::four_point_rating,
            overall_safety_score = ((v_calculation_result->'safety_data')->>'safety_score')::numeric,
            overall_subcontractor_rating = ((v_calculation_result->'subcontractor_data')->>'subcontractor_rating')::four_point_rating,
            overall_subcontractor_score = ((v_calculation_result->'subcontractor_data')->>'subcontractor_score')::numeric,

            -- Update role-specific summary
            role_specific_rating_summary = jsonb_build_object(
                'role_specific_applicable', ((v_calculation_result->'role_specific_data')->>'applicable')::boolean,
                'role_specific_rating', ((v_calculation_result->'role_specific_data')->>'role_specific_rating')::traffic_light_rating,
                'role_specific_score', ((v_calculation_result->'role_specific_data')->>'role_specific_score')::numeric,
                'employer_role', v_employer_role
            ),

            -- Update metadata
            last_4_point_rating_calculation = NOW(),
            rating_calculation_method = '4_point_scale_role_weighted',
            rating_data_quality_score = (v_calculation_result->>'data_completeness')::numeric,

            updated_by = p_created_by,
            updated_at = now()
        WHERE id = v_final_rating_id;

        -- Also update the employers table directly
        UPDATE public.employers SET
            overall_union_respect_rating = ((v_calculation_result->'union_respect_data')->>'union_respect_rating')::four_point_rating,
            overall_union_respect_score = ((v_calculation_result->'union_respect_data')->>'union_respect_score')::numeric,
            overall_safety_rating = ((v_calculation_result->'safety_data')->>'safety_rating')::four_point_rating,
            overall_safety_score = ((v_calculation_result->'safety_data')->>'safety_score')::numeric,
            overall_subcontractor_rating = ((v_calculation_result->'subcontractor_data')->>'subcontractor_rating')::four_point_rating,
            overall_subcontractor_score = ((v_calculation_result->'subcontractor_data')->>'subcontractor_score')::numeric,
            role_specific_rating_summary = jsonb_build_object(
                'role_specific_applicable', ((v_calculation_result->'role_specific_data')->>'applicable')::boolean,
                'role_specific_rating', ((v_calculation_result->'role_specific_data')->>'role_specific_rating')::traffic_light_rating,
                'role_specific_score', ((v_calculation_result->'role_specific_data')->>'role_specific_score')::numeric,
                'employer_role', v_employer_role
            ),
            last_4_point_rating_calculation = NOW(),
            rating_calculation_method = '4_point_scale_role_weighted',
            rating_data_quality_score = (v_calculation_result->>'data_completeness')::numeric,
            updated_at = now()
        WHERE id = p_employer_id;

    ELSE
        -- Insert new rating record
        INSERT INTO public.employer_final_ratings (
            employer_id,
            rating_date,
            final_rating,
            final_score,
            project_based_rating,
            project_based_score,
            project_data_quality,
            expertise_based_rating,
            expertise_based_score,
            expertise_confidence,
            overall_confidence,
            data_completeness_score,
            rating_status,
            expiry_date,
            created_by,
            updated_by
        ) VALUES (
            p_employer_id,
            p_calculation_date,
            (v_calculation_result->>'final_rating')::traffic_light_rating,
            (v_calculation_result->>'final_score')::numeric,
            NULL, -- Project-based ratings will be calculated separately
            NULL,
            NULL,
            NULL, -- Expertise-based ratings will be calculated separately
            NULL,
            NULL,
            (v_calculation_result->>'overall_confidence')::rating_confidence_level,
            (v_calculation_result->>'data_completeness')::numeric,
            'active',
            p_calculation_date + INTERVAL '6 months',
            p_created_by,
            p_created_by
        ) RETURNING id INTO v_final_rating_id;

        -- Update employers table with new rating data
        UPDATE public.employers SET
            overall_union_respect_rating = ((v_calculation_result->'union_respect_data')->>'union_respect_rating')::four_point_rating,
            overall_union_respect_score = ((v_calculation_result->'union_respect_data')->>'union_respect_score')::numeric,
            overall_safety_rating = ((v_calculation_result->'safety_data')->>'safety_rating')::four_point_rating,
            overall_safety_score = ((v_calculation_result->'safety_data')->>'safety_score')::numeric,
            overall_subcontractor_rating = ((v_calculation_result->'subcontractor_data')->>'subcontractor_rating')::four_point_rating,
            overall_subcontractor_score = ((v_calculation_result->'subcontractor_data')->>'subcontractor_score')::numeric,
            role_specific_rating_summary = jsonb_build_object(
                'role_specific_applicable', ((v_calculation_result->'role_specific_data')->>'applicable')::boolean,
                'role_specific_rating', ((v_calculation_result->'role_specific_data')->>'role_specific_rating')::traffic_light_rating,
                'role_specific_score', ((v_calculation_result->'role_specific_data')->>'role_specific_score')::numeric,
                'employer_role', v_employer_role
            ),
            last_4_point_rating_calculation = NOW(),
            rating_calculation_method = '4_point_scale_role_weighted',
            rating_data_quality_score = (v_calculation_result->>'data_completeness')::numeric,
            next_rating_review_date = CASE
                WHEN (v_calculation_result->>'overall_confidence')::text = 'very_low' THEN
                    p_calculation_date + INTERVAL '30 days'
                WHEN (v_calculation_result->>'overall_confidence')::text = 'low' THEN
                    p_calculation_date + INTERVAL '60 days'
                ELSE
                    p_calculation_date + INTERVAL '90 days'
            END,
            updated_at = now()
        WHERE id = p_employer_id;
    END IF;

    RETURN v_final_rating_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions for the new functions
GRANT EXECUTE ON FUNCTION public.calculate_weighted_4_point_score(numeric[], numeric[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_4_point_to_traffic_light(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_union_respect_rating(uuid, date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_safety_rating_4_point(uuid, date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_subcontractor_rating(uuid, date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_role_specific_rating(uuid, date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_final_employer_rating_4_point(uuid, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_update_final_rating_4_point(uuid, date, uuid) TO authenticated;

-- Comments for documentation
COMMENT ON FUNCTION public.calculate_weighted_4_point_score IS 'Calculates weighted average of 4-point scale scores';
COMMENT ON FUNCTION public.convert_4_point_to_traffic_light IS 'Converts 4-point score to traffic light rating';
COMMENT ON FUNCTION public.calculate_union_respect_rating IS 'Calculates union respect rating using 4-point scale assessments';
COMMENT ON FUNCTION public.calculate_safety_rating_4_point IS 'Calculates safety rating using 4-point scale assessments';
COMMENT ON FUNCTION public.calculate_subcontractor_rating IS 'Calculates subcontractor relations rating using 4-point scale assessments';
COMMENT ON FUNCTION public.calculate_role_specific_rating IS 'Calculates role-specific rating for builders using 4-point scale assessments';
COMMENT ON FUNCTION public.calculate_final_employer_rating_4_point IS 'Main function to calculate final employer rating using 4-point scale with role-based weighting';
COMMENT ON FUNCTION public.create_or_update_final_rating_4_point IS 'Creates or updates final rating record using 4-point scale calculations';