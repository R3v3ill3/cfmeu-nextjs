-- Employer Traffic Light Rating System - Rating Calculation Functions
-- This migration contains all the database functions for calculating ratings,
-- comparing data sources, and managing the rating system logic.

-- Function to calculate project compliance rating
-- Combines all project-specific compliance assessments into a single rating
CREATE OR REPLACE FUNCTION public.calculate_project_compliance_rating(
    p_employer_id uuid,
    p_calculation_date date DEFAULT CURRENT_DATE,
    p_lookback_days integer DEFAULT 365
) RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
    v_assessments jsonb := '[]';
    v_weighted_sum numeric := 0;
    v_total_weight numeric := 0;
    v_final_score numeric := 0;
    v_final_rating traffic_light_rating;
    v_data_quality rating_confidence_level := 'very_low';
    v_assessment_count integer := 0;
    v_latest_assessment date;
    v_earliest_assessment date;
    rec RECORD;
BEGIN
    -- Get all project compliance assessments within lookback period
    FOR rec IN
        SELECT
            pca.assessment_type,
            pca.score,
            pca.confidence_level,
            pca.assessment_date,
            caw.weight,
            pca.severity_level,
            csl.severity_name
        FROM public.project_compliance_assessments pca
        JOIN public.compliance_assessment_weights caw
            ON pca.assessment_type = caw.assessment_type AND caw.is_active = true
        LEFT JOIN public.compliance_severity_levels csl
            ON pca.assessment_type = csl.assessment_type
            AND pca.severity_level = csl.severity_level
            AND csl.is_active = true
        WHERE pca.employer_id = p_employer_id
          AND pca.assessment_date >= p_calculation_date - (p_lookback_days || ' days')::interval
          AND pca.is_active = true
          AND pca.score IS NOT NULL
        ORDER BY pca.assessment_date DESC
    LOOP
        v_assessments := v_assessments || jsonb_build_object(
            'assessment_type', rec.assessment_type,
            'score', rec.score,
            'confidence_level', rec.confidence_level,
            'assessment_date', rec.assessment_date,
            'weight', rec.weight,
            'severity_level', rec.severity_level,
            'severity_name', rec.severity_name
        );

        -- Calculate weighted contribution
        v_weighted_sum := v_weighted_sum + (rec.score * rec.weight);
        v_total_weight := v_total_weight + rec.weight;
        v_assessment_count := v_assessment_count + 1;

        -- Track date range
        IF v_latest_assessment IS NULL OR rec.assessment_date > v_latest_assessment THEN
            v_latest_assessment := rec.assessment_date;
        END IF;
        IF v_earliest_assessment IS NULL OR rec.assessment_date < v_earliest_assessment THEN
            v_earliest_assessment := rec.assessment_date;
        END IF;
    END LOOP;

    -- Calculate final score if we have data
    IF v_total_weight > 0 THEN
        v_final_score := v_weighted_sum / v_total_weight;
    END IF;

    -- Determine data quality based on assessment count and recency
    IF v_assessment_count >= 5 AND (p_calculation_date - v_latest_assessment) <= 30 THEN
        v_data_quality := 'high';
    ELSIF v_assessment_count >= 3 AND (p_calculation_date - v_latest_assessment) <= 60 THEN
        v_data_quality := 'medium';
    ELSIF v_assessment_count >= 1 AND (p_calculation_date - v_latest_assessment) <= 90 THEN
        v_data_quality := 'low';
    ELSE
        v_data_quality := 'very_low';
    END IF;

    -- Determine final rating based on score
    IF v_final_score IS NOT NULL THEN
        SELECT rating INTO v_final_rating
        FROM public.traffic_light_thresholds
        WHERE v_final_score >= min_score AND v_final_score <= max_score AND is_active = true;
    ELSE
        v_final_rating := 'unknown';
    END IF;

    -- Build result JSON
    v_result := jsonb_build_object(
        'project_rating', v_final_rating,
        'project_score', v_final_score,
        'data_quality', v_data_quality,
        'assessment_count', v_assessment_count,
        'assessments', v_assessments,
        'latest_assessment_date', v_latest_assessment,
        'earliest_assessment_date', v_earliest_assessment,
        'data_age_days', COALESCE(p_calculation_date - v_latest_assessment, NULL),
        'calculation_date', p_calculation_date
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate expertise rating from wizard assessments
-- Combines organiser expertise assessments with confidence weighting
CREATE OR REPLACE FUNCTION public.calculate_expertise_rating(
    p_employer_id uuid,
    p_calculation_date date DEFAULT CURRENT_DATE,
    p_lookback_days integer DEFAULT 180
) RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
    v_assessments jsonb := '[]';
    v_weighted_scores numeric[] := '{}';
    v_confidence_weights numeric[] := '{}';
    v_final_score numeric := 0;
    v_final_rating traffic_light_rating;
    v_confidence_level rating_confidence_level := 'very_low';
    v_assessment_count integer := 0;
    v_latest_assessment date;
    v_total_weight numeric := 0;
    rec RECORD;
BEGIN
    -- Get all organiser expertise assessments within lookback period
    FOR rec IN
        SELECT
            oea.id,
            oea.organiser_id,
            oea.overall_score,
            oea.confidence_level,
            oea.assessment_date,
            p.name as organiser_name,
            oer.accuracy_percentage,
            oer.overall_reputation_score
        FROM public.organiser_overall_expertise_ratings oea
        JOIN public.profiles p ON oea.organiser_id = p.id
        LEFT JOIN public.organiser_expertise_reputation oer
            ON oea.organiser_id = oer.organiser_id
            AND oea.assessment_date BETWEEN oer.reputation_period_start AND oer.reputation_period_end
        WHERE oea.employer_id = p_employer_id
          AND oea.assessment_date >= p_calculation_date - (p_lookback_days || ' days')::interval
          AND oea.is_active = true
          AND oea.overall_score IS NOT NULL
        ORDER BY oea.assessment_date DESC
    LOOP
        -- Calculate confidence weight based on organiser reputation and assessment confidence
        DECLARE
            v_confidence_weight numeric := 1.0;
            v_confidence_multiplier numeric;
        BEGIN
            -- Base confidence from assessment
            CASE rec.confidence_level
                WHEN 'high' THEN v_confidence_multiplier := 1.0;
                WHEN 'medium' THEN v_confidence_multiplier := 0.8;
                WHEN 'low' THEN v_confidence_multiplier := 0.6;
                WHEN 'very_low' THEN v_confidence_multiplier := 0.4;
                ELSE v_confidence_multiplier := 0.5;
            END CASE;

            -- Adjust based on organiser reputation
            IF rec.accuracy_percentage IS NOT NULL THEN
                v_confidence_weight := v_confidence_multiplier * (rec.accuracy_percentage / 100.0);
            ELSIF rec.overall_reputation_score IS NOT NULL THEN
                v_confidence_weight := v_confidence_multiplier * (rec.overall_reputation_score / 100.0);
            ELSE
                v_confidence_weight := v_confidence_multiplier * 0.7; -- Default for unknown reputation
            END IF;

            -- Ensure minimum weight
            v_confidence_weight := GREATEST(v_confidence_weight, 0.1);
        END;

        v_assessments := v_assessments || jsonb_build_object(
            'assessment_id', rec.id,
            'organiser_id', rec.organiser_id,
            'organiser_name', rec.organiser_name,
            'score', rec.overall_score,
            'confidence_level', rec.confidence_level,
            'assessment_date', rec.assessment_date,
            'confidence_weight', v_confidence_weight,
            'accuracy_percentage', rec.accuracy_percentage,
            'reputation_score', rec.overall_reputation_score
        );

        v_weighted_scores := v_weighted_scores || rec.overall_score;
        v_confidence_weights := v_confidence_weights || v_confidence_weight;
        v_total_weight := v_total_weight + v_confidence_weight;
        v_assessment_count := v_assessment_count + 1;

        IF v_latest_assessment IS NULL OR rec.assessment_date > v_latest_assessment THEN
            v_latest_assessment := rec.assessment_date;
        END IF;
    END LOOP;

    -- Calculate weighted average score
    IF v_total_weight > 0 AND v_assessment_count > 0 THEN
        DECLARE
            v_weighted_sum numeric := 0;
            i integer;
        BEGIN
            FOR i IN 1..v_assessment_count LOOP
                v_weighted_sum := v_weighted_sum + (v_weighted_scores[i] * v_confidence_weights[i]);
            END LOOP;
            v_final_score := v_weighted_sum / v_total_weight;
        END;
    END IF;

    -- Determine overall confidence level
    IF v_assessment_count >= 2 AND (p_calculation_date - v_latest_assessment) <= 60 THEN
        v_confidence_level := 'high';
    ELSIF v_assessment_count >= 1 AND (p_calculation_date - v_latest_assessment) <= 90 THEN
        v_confidence_level := 'medium';
    ELSIF v_assessment_count >= 1 AND (p_calculation_date - v_latest_assessment) <= 120 THEN
        v_confidence_level := 'low';
    ELSE
        v_confidence_level := 'very_low';
    END IF;

    -- Determine final rating
    IF v_final_score IS NOT NULL THEN
        SELECT rating INTO v_final_rating
        FROM public.traffic_light_thresholds
        WHERE v_final_score >= min_score AND v_final_score <= max_score AND is_active = true;
    ELSE
        v_final_rating := 'unknown';
    END IF;

    -- Build result JSON
    v_result := jsonb_build_object(
        'expertise_rating', v_final_rating,
        'expertise_score', v_final_score,
        'confidence_level', v_confidence_level,
        'assessment_count', v_assessment_count,
        'assessments', v_assessments,
        'latest_assessment_date', v_latest_assessment,
        'data_age_days', COALESCE(p_calculation_date - v_latest_assessment, NULL),
        'calculation_date', p_calculation_date
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to get EBA status with scoring
-- EBA status is treated as a hard data point with significant weight
CREATE OR REPLACE FUNCTION public.get_eba_status_with_score(
    p_employer_id uuid,
    p_calculation_date date DEFAULT CURRENT_DATE
) RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
    v_has_active_eba boolean := false;
    v_eba_status traffic_light_rating := 'unknown';
    v_eba_score numeric := 0;
    v_latest_eba_date date;
    v_eba_details jsonb;
BEGIN
    -- Check for active EBA records
    SELECT EXISTS (
        SELECT 1 FROM public.company_eba_records cer
        WHERE cer.employer_id = p_employer_id
          AND cer.fwc_certified_date IS NOT NULL
          AND cer.fwc_certified_date >= (p_calculation_date - INTERVAL '4 years')
    ) INTO v_has_active_eba;

    -- Get latest EBA details
    SELECT
        jsonb_agg(
            jsonb_build_object(
                'id', cer.id,
                'eba_file_number', cer.eba_file_number,
                'sector', cer.sector,
                'fwc_certified_date', cer.fwc_certified_date,
                'date_eba_signed', cer.date_eba_signed,
                'date_vote_occurred', cer.date_vote_occurred
            ) ORDER BY cer.fwc_certified_date DESC
        ) FILTER (WHERE cer.id IS NOT NULL),
        MAX(cer.fwc_certified_date)
    INTO v_eba_details, v_latest_eba_date
    FROM public.company_eba_records cer
    WHERE cer.employer_id = p_employer_id
      AND cer.fwc_certified_date IS NOT NULL;

    -- Determine EBA status and score
    IF v_has_active_eba THEN
        -- Check how recent the EBA is
        IF v_latest_eba_date >= (p_calculation_date - INTERVAL '1 year') THEN
            v_eba_status := 'green';
            v_eba_score := 25;
        ELSIF v_latest_eba_date >= (p_calculation_date - INTERVAL '2 years') THEN
            v_eba_status := 'green';
            v_eba_score := 20;
        ELSIF v_latest_eba_date >= (p_calculation_date - INTERVAL '3 years') THEN
            v_eba_status := 'amber';
            v_eba_score := 10;
        ELSE
            v_eba_status := 'amber';
            v_eba_score := 5;
        END IF;
    ELSE
        -- Check for any EBA history
        IF EXISTS (
            SELECT 1 FROM public.company_eba_records cer
            WHERE cer.employer_id = p_employer_id
              AND cer.id IS NOT NULL
        ) THEN
            v_eba_status := 'red';
            v_eba_score := -20;
        ELSE
            v_eba_status := 'unknown';
            v_eba_score := 0;
        END IF;
    END IF;

    -- Build result JSON
    v_result := jsonb_build_object(
        'eba_status', v_eba_status,
        'eba_score', v_eba_score,
        'has_active_eba', v_has_active_eba,
        'latest_eba_date', v_latest_eba_date,
        'eba_details', COALESCE(v_eba_details, '[]'::jsonb),
        'data_age_days', COALESCE(p_calculation_date - v_latest_eba_date, NULL),
        'calculation_date', p_calculation_date
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Main function to calculate final employer rating
-- Combines project compliance, organiser expertise, and EBA status
CREATE OR REPLACE FUNCTION public.calculate_final_employer_rating(
    p_employer_id uuid,
    p_calculation_date date DEFAULT CURRENT_DATE,
    p_project_weight numeric DEFAULT 0.6,
    p_expertise_weight numeric DEFAULT 0.4,
    p_eba_weight numeric DEFAULT 0.15,
    p_calculation_method text DEFAULT 'hybrid_method'
) RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
    v_project_data jsonb;
    v_expertise_data jsonb;
    v_eba_data jsonb;
    v_discrepancy_check jsonb;
    v_final_score numeric := 0;
    v_final_rating traffic_light_rating;
    v_overall_confidence rating_confidence_level;
    v_data_completeness numeric := 0;
    v_reconciliation_needed boolean := false;
    v_reconciliation_method text;

    -- Calculation method configuration
    v_method_config jsonb;
    v_algorithm_type text;
BEGIN
    -- Get calculation method configuration
    SELECT configuration, algorithm_type
    INTO v_method_config, v_algorithm_type
    FROM public.rating_calculation_methods
    WHERE method_name = p_calculation_method AND is_active = true;

    -- Calculate component ratings
    v_project_data := public.calculate_project_compliance_rating(p_employer_id, p_calculation_date);
    v_expertise_data := public.calculate_expertise_rating(p_employer_id, p_calculation_date);
    v_eba_data := public.get_eba_status_with_score(p_employer_id, p_calculation_date);

    -- Check for discrepancies between project and expertise ratings
    v_discrepancy_check := public.check_rating_discrepancy(
        (v_project_data->>'project_rating')::traffic_light_rating,
        COALESCE((v_project_data->>'project_score')::numeric, 0),
        (v_expertise_data->>'expertise_rating')::traffic_light_rating,
        COALESCE((v_expertise_data->>'expertise_score')::numeric, 0)
    );

    -- Calculate final score based on algorithm type
    CASE v_algorithm_type
        WHEN 'weighted_average' THEN
            -- Standard weighted average
            DECLARE
                v_total_weight numeric := p_project_weight + p_expertise_weight + p_eba_weight;
                v_project_score numeric := COALESCE((v_project_data->>'project_score')::numeric, 0);
                v_expertise_score numeric := COALESCE((v_expertise_data->>'expertise_score')::numeric, 0);
                v_eba_score numeric := (v_eba_data->>'eba_score')::numeric;
            BEGIN
                IF v_total_weight > 0 THEN
                    v_final_score := (
                        (v_project_score * p_project_weight) +
                        (v_expertise_score * p_expertise_weight) +
                        (v_eba_score * p_eba_weight)
                    ) / v_total_weight;
                END IF;
            END;

        WHEN 'weighted_sum' THEN
            -- Weighted sum with normalization
            DECLARE
                v_project_score numeric := COALESCE((v_project_data->>'project_score')::numeric, 0);
                v_expertise_score numeric := COALESCE((v_expertise_data->>'expertise_score')::numeric, 0);
                v_eba_score numeric := (v_eba_data->>'eba_score')::numeric;
            BEGIN
                v_final_score := (
                    (v_project_score * p_project_weight) +
                    (v_expertise_score * p_expertise_weight) +
                    (v_eba_score * p_eba_weight)
                );
            END;

        WHEN 'minimum_score' THEN
            -- Use minimum of critical factors
            DECLARE
                v_critical_factors jsonb;
                v_min_score numeric := 100;
                factor text;
            BEGIN
                v_critical_factors := COALESCE(v_method_config->'critical_factors', '["eca_status", "cbus_status", "safety_incidents"]'::jsonb);

                -- EBA score is always critical
                v_min_score := LEAST(v_min_score, (v_eba_data->>'eba_score')::numeric);

                -- If project data exists, it's critical
                IF (v_project_data->>'project_score') IS NOT NULL THEN
                    v_min_score := LEAST(v_min_score, (v_project_data->>'project_score')::numeric);
                END IF;

                v_final_score := v_min_score;
            END;

        WHEN 'custom_function' THEN
            -- Hybrid method with special handling
            DECLARE
                v_project_score numeric := COALESCE((v_project_data->>'project_score')::numeric, 0);
                v_expertise_score numeric := COALESCE((v_expertise_data->>'expertise_score')::numeric, 0);
                v_eba_score numeric := (v_eba_data->>'eba_score')::numeric;
                v_critical_weight numeric := COALESCE((v_method_config->'critical_weight')::numeric, 0.3);
                v_base_score numeric;
                v_critical_score numeric;
            BEGIN
                -- Calculate base score from project and expertise
                IF (p_project_weight + p_expertise_weight) > 0 THEN
                    v_base_score := (
                        (v_project_score * p_project_weight) +
                        (v_expertise_score * p_expertise_weight)
                    ) / (p_project_weight + p_expertise_weight);
                ELSE
                    v_base_score := 0;
                END IF;

                -- Critical factors (EBA is most critical)
                v_critical_score := v_eba_score;

                -- Combine base and critical scores
                v_final_score := (v_base_score * (1 - v_critical_weight)) + (v_critical_score * v_critical_weight);
            END;

        ELSE
            -- Default to weighted average
            DECLARE
                v_total_weight numeric := p_project_weight + p_expertise_weight + p_eba_weight;
                v_project_score numeric := COALESCE((v_project_data->>'project_score')::numeric, 0);
                v_expertise_score numeric := COALESCE((v_expertise_data->>'expertise_score')::numeric, 0);
                v_eba_score numeric := (v_eba_data->>'eba_score')::numeric;
            BEGIN
                IF v_total_weight > 0 THEN
                    v_final_score := (
                        (v_project_score * p_project_weight) +
                        (v_expertise_score * p_expertise_weight) +
                        (v_eba_score * p_eba_weight)
                    ) / v_total_weight;
                END IF;
            END;
    END CASE;

    -- Determine final rating
    IF v_final_score IS NOT NULL THEN
        SELECT rating INTO v_final_rating
        FROM public.traffic_light_thresholds
        WHERE v_final_score >= min_score AND v_final_score <= max_score AND is_active = true;
    ELSE
        v_final_rating := 'unknown';
    END IF;

    -- Calculate overall confidence
    DECLARE
        v_project_confidence text := COALESCE(v_project_data->>'data_quality', 'very_low');
        v_expertise_confidence text := COALESCE(v_expertise_data->>'confidence_level', 'very_low');
        v_eba_confidence text := CASE WHEN v_eba_data->>'has_active_eba' = 'true' THEN 'high' ELSE 'medium' END;
        v_confidence_values numeric[] := '{}';
    BEGIN
        -- Convert confidence levels to numeric values
        CASE v_project_confidence
            WHEN 'high' THEN v_confidence_values := v_confidence_values || 0.9;
            WHEN 'medium' THEN v_confidence_values := v_confidence_values || 0.7;
            WHEN 'low' THEN v_confidence_values := v_confidence_values || 0.5;
            WHEN 'very_low' THEN v_confidence_values := v_confidence_values || 0.3;
            ELSE v_confidence_values := v_confidence_values || 0.5;
        END CASE;

        CASE v_expertise_confidence
            WHEN 'high' THEN v_confidence_values := v_confidence_values || 0.9;
            WHEN 'medium' THEN v_confidence_values := v_confidence_values || 0.7;
            WHEN 'low' THEN v_confidence_values := v_confidence_values || 0.5;
            WHEN 'very_low' THEN v_confidence_values := v_confidence_values || 0.3;
            ELSE v_confidence_values := v_confidence_values || 0.5;
        END CASE;

        CASE v_eba_confidence
            WHEN 'high' THEN v_confidence_values := v_confidence_values || 0.9;
            WHEN 'medium' THEN v_confidence_values := v_confidence_values || 0.7;
            WHEN 'low' THEN v_confidence_values := v_confidence_values || 0.5;
            WHEN 'very_low' THEN v_confidence_values := v_confidence_values || 0.3;
            ELSE v_confidence_values := v_confidence_values || 0.5;
        END CASE;

        -- Calculate weighted average confidence
        DECLARE
            v_confidence_weights numeric[] := '{0.6, 0.4, 0.15}'; -- project, expertise, EBA
            v_weighted_confidence numeric := 0;
            v_total_confidence_weight numeric := 0;
            i integer;
        BEGIN
            FOR i IN 1..3 LOOP
                v_weighted_confidence := v_weighted_confidence + (v_confidence_values[i] * v_confidence_weights[i]);
                v_total_confidence_weight := v_total_confidence_weight + v_confidence_weights[i];
            END LOOP;

            IF v_total_confidence_weight > 0 THEN
                v_weighted_confidence := v_weighted_confidence / v_total_confidence_weight;
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
    END;

    -- Calculate data completeness
    DECLARE
        v_has_project_data boolean := (v_project_data->>'project_score') IS NOT NULL;
        v_has_expertise_data boolean := (v_expertise_data->>'expertise_score') IS NOT NULL;
        v_has_eba_data boolean := (v_eba_data->>'eba_score') IS NOT NULL;
    BEGIN
        v_data_completeness :=
            CASE WHEN v_has_project_data THEN 40 ELSE 0 END +
            CASE WHEN v_has_expertise_data THEN 40 ELSE 0 END +
            CASE WHEN v_has_eba_data THEN 20 ELSE 0 END;
    END;

    -- Determine if reconciliation is needed
    IF (v_discrepancy_check->>'requires_review')::boolean = true THEN
        v_reconciliation_needed := true;
        v_reconciliation_method := 'human_review_required';
    ELSIF (v_discrepancy_check->>'discrepancy_detected')::boolean = true THEN
        v_reconciliation_needed := true;
        v_reconciliation_method := 'automated_weighting_adjustment';
    END IF;

    -- Build comprehensive result JSON
    v_result := jsonb_build_object(
        'employer_id', p_employer_id,
        'calculation_date', p_calculation_date,
        'final_rating', v_final_rating,
        'final_score', v_final_score,

        -- Component data
        'project_data', v_project_data,
        'expertise_data', v_expertise_data,
        'eba_data', v_eba_data,

        -- Quality indicators
        'overall_confidence', v_overall_confidence,
        'data_completeness', v_data_completeness,
        'discrepancy_check', v_discrepancy_check,

        -- Calculation details
        'calculation_method', p_calculation_method,
        'weights', jsonb_build_object(
            'project', p_project_weight,
            'expertise', p_expertise_weight,
            'eba', p_eba_weight
        ),
        'algorithm_type', v_algorithm_type,
        'method_config', v_method_config,

        -- Reconciliation
        'reconciliation_needed', v_reconciliation_needed,
        'reconciliation_method', v_reconciliation_method,

        -- Metadata
        'calculated_at', now(),
        'calculation_version', '1.0'
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to create or update final rating record
-- This function should be called when ratings need to be calculated and stored
CREATE OR REPLACE FUNCTION public.create_or_update_final_rating(
    p_employer_id uuid,
    p_calculation_date date DEFAULT CURRENT_DATE,
    p_created_by uuid DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
    v_calculation_result jsonb;
    v_final_rating_id uuid;
    v_project_data jsonb;
    v_expertise_data jsonb;
    v_eba_data jsonb;
    v_discrepancy_check jsonb;
BEGIN
    -- Calculate the rating
    v_calculation_result := public.calculate_final_employer_rating(p_employer_id, p_calculation_date);

    -- Extract component data for storage
    v_project_data := v_calculation_result->'project_data';
    v_expertise_data := v_calculation_result->'expertise_data';
    v_eba_data := v_calculation_result->'eba_data';
    v_discrepancy_check := v_calculation_result->'discrepancy_check';

    -- Check if rating already exists for this date
    SELECT id INTO v_final_rating_id
    FROM public.employer_final_ratings
    WHERE employer_id = p_employer_id AND rating_date = p_calculation_date;

    -- Update or insert the rating record
    IF v_final_rating_id IS NOT NULL THEN
        UPDATE public.employer_final_ratings SET
            final_rating = (v_calculation_result->>'final_rating')::traffic_light_rating,
            final_score = (v_calculation_result->>'final_score')::numeric,

            -- Project-based data
            project_based_rating = (v_project_data->>'project_rating')::traffic_light_rating,
            project_based_score = (v_project_data->>'project_score')::numeric,
            project_data_quality = (v_project_data->>'data_quality')::rating_confidence_level,
            project_data_age_days = (v_project_data->>'data_age_days')::integer,
            projects_included = (v_project_data->>'assessment_count')::integer,
            latest_project_date = (v_project_data->>'latest_assessment_date')::date,

            -- Expertise-based data
            expertise_based_rating = (v_expertise_data->>'expertise_rating')::traffic_light_rating,
            expertise_based_score = (v_expertise_data->>'expertise_score')::numeric,
            expertise_confidence = (v_expertise_data->>'confidence_level')::rating_confidence_level,
            expertise_data_age_days = (v_expertise_data->>'data_age_days')::integer,
            expertise_assessments_included = (v_expertise_data->>'assessment_count')::integer,
            latest_expertise_date = (v_expertise_data->>'latest_assessment_date')::date,

            -- EBA data
            eba_status = (v_eba_data->>'eba_status')::traffic_light_rating,

            -- Discrepancy data
            rating_discrepancy = (v_discrepancy_check->>'discrepancy_detected')::boolean,
            discrepancy_level = COALESCE((v_discrepancy_check->>'discrepancy_level')::integer, 0),
            reconciliation_method = v_calculation_result->>'reconciliation_method',
            required_dispute_resolution = (v_discrepancy_check->>'requires_review')::boolean,

            -- Quality and confidence
            overall_confidence = (v_calculation_result->>'overall_confidence')::rating_confidence_level,
            data_completeness_score = (v_calculation_result->>'data_completeness')::numeric,

            -- Review requirements
            review_required = (v_calculation_result->>'reconciliation_needed')::boolean,
            review_reason = CASE
                WHEN (v_calculation_result->>'reconciliation_needed')::boolean THEN
                    'Discrepancy detected between project and expertise ratings'
                ELSE NULL
            END,
            next_review_date = CASE
                WHEN (v_calculation_result->>'overall_confidence')::text = 'very_low' THEN
                    p_calculation_date + INTERVAL '30 days'
                WHEN (v_calculation_result->>'overall_confidence')::text = 'low' THEN
                    p_calculation_date + INTERVAL '60 days'
                ELSE
                    p_calculation_date + INTERVAL '90 days'
            END,
            expiry_date = p_calculation_date + INTERVAL '6 months',

            -- Metadata
            updated_by = p_created_by,
            updated_at = now()
        WHERE id = v_final_rating_id;

        -- Create comparison log entry
        INSERT INTO public.rating_comparison_log (
            final_rating_id,
            project_rating,
            project_score,
            expertise_rating,
            expertise_score,
            score_difference,
            rating_match,
            discrepancy_category,
            reconciliation_decision,
            reconciliation_factors,
            final_weighting,
            confidence_impact,
            requires_human_review,
            automated_decision,
            decision_logic,
            created_by
        ) VALUES (
            v_final_rating_id,
            (v_project_data->>'project_rating')::traffic_light_rating,
            (v_project_data->>'project_score')::numeric,
            (v_expertise_data->>'expertise_rating')::traffic_light_rating,
            (v_expertise_data->>'expertise_score')::numeric,
            ABS(COALESCE((v_project_data->>'project_score')::numeric, 0) - COALESCE((v_expertise_data->>'expertise_score')::numeric, 0)),
            (v_project_data->>'project_rating')::text = (v_expertise_data->>'expertise_rating')::text,
            CASE
                WHEN (v_discrepancy_check->>'discrepancy_level')::integer = 0 THEN 'none'
                WHEN (v_discrepancy_check->>'discrepancy_level')::integer = 1 THEN 'minor'
                WHEN (v_discrepancy_check->>'discrepancy_level')::integer = 2 THEN 'moderate'
                WHEN (v_discrepancy_check->>'discrepancy_level')::integer = 3 THEN 'major'
                ELSE 'critical'
            END,
            v_calculation_result->>'reconciliation_method',
            jsonb_build_object(
                'project_weight', (v_calculation_result->'weights'->>'project')::numeric,
                'expertise_weight', (v_calculation_result->'weights'->>'expertise')::numeric,
                'eba_weight', (v_calculation_result->'weights'->>'eba')::numeric
            ),
            v_calculation_result->'weights',
            CASE
                WHEN (v_calculation_result->>'overall_confidence')::text = 'high' THEN 'High confidence in result'
                WHEN (v_calculation_result->>'overall_confidence')::text = 'medium' THEN 'Moderate confidence, consider review'
                WHEN (v_calculation_result->>'overall_confidence')::text = 'low' THEN 'Low confidence, human review recommended'
                ELSE 'Very low confidence, urgent review required'
            END,
            (v_discrepancy_check->>'requires_review')::boolean,
            true,
            v_calculation_result->'method_config',
            p_created_by
        );

    ELSE
        -- Insert new rating record
        INSERT INTO public.employer_final_ratings (
            employer_id,
            rating_date,
            final_rating,
            final_score,

            -- Project-based data
            project_based_rating,
            project_based_score,
            project_data_quality,
            project_data_age_days,
            projects_included,
            latest_project_date,

            -- Expertise-based data
            expertise_based_rating,
            expertise_based_score,
            expertise_confidence,
            expertise_data_age_days,
            expertise_assessments_included,
            latest_expertise_date,

            -- EBA data
            eba_status,

            -- Discrepancy data
            rating_discrepancy,
            discrepancy_level,
            reconciliation_method,
            required_dispute_resolution,

            -- Quality and confidence
            overall_confidence,
            data_completeness_score,

            -- Review requirements
            review_required,
            review_reason,
            next_review_date,
            expiry_date,

            -- Metadata
            created_by,
            updated_by
        ) VALUES (
            p_employer_id,
            p_calculation_date,
            (v_calculation_result->>'final_rating')::traffic_light_rating,
            (v_calculation_result->>'final_score')::numeric,

            -- Project-based data
            (v_project_data->>'project_rating')::traffic_light_rating,
            (v_project_data->>'project_score')::numeric,
            (v_project_data->>'data_quality')::rating_confidence_level,
            (v_project_data->>'data_age_days')::integer,
            (v_project_data->>'assessment_count')::integer,
            (v_project_data->>'latest_assessment_date')::date,

            -- Expertise-based data
            (v_expertise_data->>'expertise_rating')::traffic_light_rating,
            (v_expertise_data->>'expertise_score')::numeric,
            (v_expertise_data->>'confidence_level')::rating_confidence_level,
            (v_expertise_data->>'data_age_days')::integer,
            (v_expertise_data->>'assessment_count')::integer,
            (v_expertise_data->>'latest_assessment_date')::date,

            -- EBA data
            (v_eba_data->>'eba_status')::traffic_light_rating,

            -- Discrepancy data
            (v_discrepancy_check->>'discrepancy_detected')::boolean,
            COALESCE((v_discrepancy_check->>'discrepancy_level')::integer, 0),
            v_calculation_result->>'reconciliation_method',
            (v_discrepancy_check->>'requires_review')::boolean,

            -- Quality and confidence
            (v_calculation_result->>'overall_confidence')::rating_confidence_level,
            (v_calculation_result->>'data_completeness')::numeric,

            -- Review requirements
            (v_calculation_result->>'reconciliation_needed')::boolean,
            CASE
                WHEN (v_calculation_result->>'reconciliation_needed')::boolean THEN
                    'Discrepancy detected between project and expertise ratings'
                ELSE NULL
            END,
            CASE
                WHEN (v_calculation_result->>'overall_confidence')::text = 'very_low' THEN
                    p_calculation_date + INTERVAL '30 days'
                WHEN (v_calculation_result->>'overall_confidence')::text = 'low' THEN
                    p_calculation_date + INTERVAL '60 days'
                ELSE
                    p_calculation_date + INTERVAL '90 days'
            END,
            p_calculation_date + INTERVAL '6 months',

            -- Metadata
            p_created_by,
            p_created_by
        ) RETURNING id INTO v_final_rating_id;
    END IF;

    RETURN v_final_rating_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get employer rating with all details
-- This is the main function for the frontend to retrieve rating data
CREATE OR REPLACE FUNCTION public.get_employer_rating_details(
    p_employer_id uuid,
    p_include_history boolean DEFAULT false,
    p_history_days integer DEFAULT 365
) RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
    v_current_rating public.employer_final_ratings%ROWTYPE;
    v_history jsonb := '[]';
    v_recent_projects jsonb := '[]';
    v_recent_expertise jsonb := '[]';
    rec RECORD;
BEGIN
    -- Get current rating
    SELECT * INTO v_current_rating
    FROM public.employer_final_ratings
    WHERE employer_id = p_employer_id
      AND is_active = true
    ORDER BY rating_date DESC
    LIMIT 1;

    -- Get history if requested
    IF p_include_history THEN
        FOR rec IN
            SELECT
                erh.rating_date,
                erh.previous_rating,
                erh.new_rating,
                erh.previous_score,
                erh.new_score,
                erh.rating_change_type,
                erh.score_change,
                erh.significant_change,
                erh.change_magnitude,
                erh.primary_change_factors,
                erh.external_factors
            FROM public.employer_rating_history erh
            WHERE erh.employer_id = p_employer_id
              AND erh.rating_date >= CURRENT_DATE - (p_history_days || ' days')::interval
            ORDER BY erh.rating_date DESC
            LIMIT 10
        LOOP
            v_history := v_history || jsonb_build_object(
                'rating_date', rec.rating_date,
                'previous_rating', rec.previous_rating,
                'new_rating', rec.new_rating,
                'previous_score', rec.previous_score,
                'new_score', rec.new_score,
                'rating_change_type', rec.rating_change_type,
                'score_change', rec.score_change,
                'significant_change', rec.significant_change,
                'change_magnitude', rec.change_magnitude,
                'primary_change_factors', rec.primary_change_factors,
                'external_factors', rec.external_factors
            );
        END LOOP;
    END IF;

    -- Get recent project compliance data
    FOR rec IN
        SELECT
            pca.assessment_type,
            pca.score,
            pca.rating,
            pca.assessment_date,
            pca.confidence_level,
            pca.assessment_notes
        FROM public.project_compliance_assessments pca
        WHERE pca.employer_id = p_employer_id
          AND pca.is_active = true
          AND pca.assessment_date >= CURRENT_DATE - INTERVAL '90 days'
        ORDER BY pca.assessment_date DESC
        LIMIT 5
    LOOP
        v_recent_projects := v_recent_projects || jsonb_build_object(
            'assessment_type', rec.assessment_type,
            'score', rec.score,
            'rating', rec.rating,
            'assessment_date', rec.assessment_date,
            'confidence_level', rec.confidence_level,
            'assessment_notes', rec.assessment_notes
        );
    END LOOP;

    -- Get recent expertise assessments
    FOR rec IN
        SELECT
            oea.overall_score,
            oea.overall_rating,
            oea.assessment_date,
            oea.confidence_level,
            oea.assessment_basis,
            oea.knowledge_beyond_projects,
            p.name as organiser_name
        FROM public.organiser_overall_expertise_ratings oea
        JOIN public.profiles p ON oea.organiser_id = p.id
        WHERE oea.employer_id = p_employer_id
          AND oea.is_active = true
          AND oea.assessment_date >= CURRENT_DATE - INTERVAL '90 days'
        ORDER BY oea.assessment_date DESC
        LIMIT 3
    LOOP
        v_recent_expertise := v_recent_expertise || jsonb_build_object(
            'overall_score', rec.overall_score,
            'overall_rating', rec.overall_rating,
            'assessment_date', rec.assessment_date,
            'confidence_level', rec.confidence_level,
            'assessment_basis', rec.assessment_basis,
            'knowledge_beyond_projects', rec.knowledge_beyond_projects,
            'organiser_name', rec.organiser_name
        );
    END LOOP;

    -- Build comprehensive result
    IF v_current_rating.id IS NOT NULL THEN
        v_result := jsonb_build_object(
            'employer_id', p_employer_id,
            'current_rating', jsonb_build_object(
                'id', v_current_rating.id,
                'rating_date', v_current_rating.rating_date,
                'final_rating', v_current_rating.final_rating,
                'final_score', v_current_rating.final_score,

                -- Component ratings
                'project_based_rating', v_current_rating.project_based_rating,
                'project_based_score', v_current_rating.project_based_score,
                'project_data_quality', v_current_rating.project_data_quality,
                'projects_included', v_current_rating.projects_included,

                'expertise_based_rating', v_current_rating.expertise_based_rating,
                'expertise_based_score', v_current_rating.expertise_based_score,
                'expertise_confidence', v_current_rating.expertise_confidence,
                'expertise_assessments_included', v_current_rating.expertise_assessments_included,

                'eba_status', v_current_rating.eba_status,

                -- Quality indicators
                'overall_confidence', v_current_rating.overall_confidence,
                'data_completeness_score', v_current_rating.data_completeness_score,
                'rating_discrepancy', v_current_rating.rating_discrepancy,
                'discrepancy_level', v_current_rating.discrepancy_level,

                -- Status
                'rating_status', v_current_rating.rating_status,
                'review_required', v_current_rating.review_required,
                'review_reason', v_current_rating.review_reason,
                'next_review_date', v_current_rating.next_review_date,
                'expiry_date', v_current_rating.expiry_date,

                -- Metadata
                'calculated_at', v_current_rating.created_at,
                'updated_at', v_current_rating.updated_at
            ),

            -- Supporting data
            'recent_project_assessments', v_recent_projects,
            'recent_expertise_assessments', v_recent_expertise,
            'rating_history', v_history,

            -- Metadata
            'retrieved_at', now()
        );
    ELSE
        -- No rating exists
        v_result := jsonb_build_object(
            'employer_id', p_employer_id,
            'current_rating', NULL,
            'recent_project_assessments', v_recent_projects,
            'recent_expertise_assessments', v_recent_expertise,
            'rating_history', v_history,
            'message', 'No rating found for this employer',
            'retrieved_at', now()
        );
    END IF;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions for the functions
GRANT EXECUTE ON FUNCTION public.calculate_project_compliance_rating TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_expertise_rating TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_eba_status_with_score TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_final_employer_rating TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_update_final_rating TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employer_rating_details TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rating_discrepancy TO authenticated;

-- Comments for documentation
COMMENT ON FUNCTION public.calculate_project_compliance_rating IS 'Calculates project compliance rating from all project assessments';
COMMENT ON FUNCTION public.calculate_expertise_rating IS 'Calculates expertise rating from organiser assessments';
COMMENT ON FUNCTION public.get_eba_status_with_score IS 'Gets EBA status with scoring impact';
COMMENT ON FUNCTION public.calculate_final_employer_rating IS 'Main function to calculate final employer rating combining all data sources';
COMMENT ON FUNCTION public.create_or_update_final_rating IS 'Creates or updates final rating record in database';
COMMENT ON FUNCTION public.get_employer_rating_details IS 'Retrieves comprehensive employer rating details for frontend';
COMMENT ON FUNCTION public.check_rating_discrepancy IS 'Checks for discrepancies between project and expertise ratings';