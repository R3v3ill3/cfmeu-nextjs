-- Update Existing Rating Functions for 4-Point System Compatibility
-- This migration updates existing rating calculation functions to work with the new 4-point system

-- Update the calculate_expertise_rating function to support 4-point assessments
CREATE OR REPLACE FUNCTION public.calculate_expertise_rating(
    p_employer_id uuid,
    p_calculation_date date DEFAULT CURRENT_DATE,
    p_lookback_days integer DEFAULT 180,
    p_rating_system text DEFAULT '4point' -- '4point' or 'legacy'
) RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
    v_assessments jsonb := '[]';
    v_weighted_scores numeric[] := '{}';
    v_confidence_weights numeric[] := '{}';
    v_final_score numeric := 0;
    v_final_rating text;
    v_confidence_level rating_confidence_level := 'very_low';
    v_assessment_count integer := 0;
    v_latest_assessment date;
    v_total_weight numeric := 0;
    rec RECORD;
BEGIN
    IF p_rating_system = '4point' THEN
        -- Get 4-point organiser expertise assessments
        FOR rec IN
            SELECT
                oea.id,
                oea.organiser_id,
                oea.overall_score_4point as overall_score,
                oea.overall_rating_4point as overall_rating,
                oea.confidence_level,
                oea.assessment_date,
                p.name as organiser_name,
                oer.accuracy_percentage,
                oer.overall_reputation_score,
                oea.frequency_scale_responses,
                oea.assessment_responses_4point
            FROM public.organiser_overall_expertise_ratings oea
            JOIN public.profiles p ON oea.organiser_id = p.id
            LEFT JOIN public.organiser_expertise_reputation oer
                ON oea.organiser_id = oer.organiser_id
                AND oea.assessment_date BETWEEN oer.reputation_period_start AND oer.reputation_period_end
            WHERE oea.employer_id = p_employer_id
              AND oea.assessment_date >= p_calculation_date - (p_lookback_days || ' days')::interval
              AND oea.is_active = true
              AND oea.overall_score_4point IS NOT NULL
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
                'rating', rec.overall_rating,
                'confidence_level', rec.confidence_level,
                'assessment_date', rec.assessment_date,
                'confidence_weight', v_confidence_weight,
                'accuracy_percentage', rec.accuracy_percentage,
                'reputation_score', rec.overall_reputation_score,
                'frequency_responses', rec.frequency_scale_responses,
                'assessment_responses', rec.assessment_responses_4point
            );

            v_weighted_scores := v_weighted_scores || rec.overall_score;
            v_confidence_weights := v_confidence_weights || v_confidence_weight;
            v_total_weight := v_total_weight + v_confidence_weight;
            v_assessment_count := v_assessment_count + 1;

            IF v_latest_assessment IS NULL OR rec.assessment_date > v_latest_assessment THEN
                v_latest_assessment := rec.assessment_date;
            END IF;
        END LOOP;

        -- Calculate weighted average score for 4-point system
        IF v_total_weight > 0 AND v_assessment_count > 0 THEN
            DECLARE
                v_weighted_sum numeric := 0;
                i integer;
            BEGIN
                FOR i IN 1..v_assessment_count LOOP
                    v_weighted_sum := v_weighted_sum + (v_weighted_scores[i] * v_confidence_weights[i]);
                END LOOP;
                v_final_score := v_weighted_sum / v_total_weight;
                -- Ensure score is within 1-4 range
                v_final_score := GREATEST(1, LEAST(4, v_final_score));
            END;
        END IF;

        -- Convert numeric score to rating label
        CASE v_final_score
            WHEN 1 THEN v_final_rating := 'red';
            WHEN 2 THEN v_final_rating := 'amber';
            WHEN 3 THEN v_final_rating := 'yellow';
            WHEN 4 THEN v_final_rating := 'green';
            ELSE v_final_rating := 'red';
        END CASE;

    ELSE
        -- Legacy rating system (existing logic)
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

        -- Calculate weighted average score for legacy system
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

        -- Determine final rating for legacy system
        IF v_final_score IS NOT NULL THEN
            SELECT rating INTO v_final_rating
            FROM public.traffic_light_thresholds
            WHERE v_final_score >= min_score AND v_final_score <= max_score AND is_active = true;
        ELSE
            v_final_rating := 'unknown';
        END IF;
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

    -- Build result JSON
    v_result := jsonb_build_object(
        'expertise_rating', v_final_rating,
        'expertise_score', v_final_score,
        'confidence_level', v_confidence_level,
        'assessment_count', v_assessment_count,
        'assessments', v_assessments,
        'latest_assessment_date', v_latest_assessment,
        'data_age_days', COALESCE(p_calculation_date - v_latest_assessment, NULL),
        'calculation_date', p_calculation_date,
        'rating_system', p_rating_system
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Update the calculate_final_employer_rating function to support 4-point system
CREATE OR REPLACE FUNCTION public.calculate_final_employer_rating(
    p_employer_id uuid,
    p_calculation_date date DEFAULT CURRENT_DATE,
    p_project_weight numeric DEFAULT 0.6,
    p_expertise_weight numeric DEFAULT 0.4,
    p_eba_weight numeric DEFAULT 0.15,
    p_calculation_method text DEFAULT 'hybrid_method',
    p_rating_system text DEFAULT '4point' -- '4point' or 'legacy'
) RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
    v_project_data jsonb;
    v_expertise_data jsonb;
    v_eba_data jsonb;
    v_discrepancy_check jsonb;
    v_final_score numeric := 0;
    v_final_rating text;
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

    -- Calculate component ratings with rating system preference
    v_project_data := public.calculate_project_compliance_rating(p_employer_id, p_calculation_date);
    v_expertise_data := public.calculate_expertise_rating(p_employer_id, p_calculation_date, 180, p_rating_system);

    IF p_rating_system = '4point' THEN
        -- Use 4-point EBA rating
        DECLARE
            v_eba_status text;
            v_eba_rating integer;
        BEGIN
            v_eba_status := public.get_employer_eba_status_4point(p_employer_id);
            v_eba_rating := public.get_employer_eba_rating_4point(p_employer_id);

            v_eba_data := jsonb_build_object(
                'eba_status', v_eba_status,
                'eba_score', v_eba_rating,
                'has_active_eba', v_eba_status != 'red',
                'latest_eba_date', NULL, -- Not available in current implementation
                'eba_details', '[]'::jsonb,
                'data_age_days', NULL,
                'calculation_date', p_calculation_date
            );
        END;
    ELSE
        -- Use legacy EBA rating
        v_eba_data := public.get_eba_status_with_score(p_employer_id, p_calculation_date);
    END IF;

    -- Check for discrepancies between project and expertise ratings
    IF p_rating_system = '4point' THEN
        -- Use 4-point discrepancy checking
        v_discrepancy_check := public.check_rating_discrepancy_4point(
            COALESCE((v_project_data->>'project_rating')::text, 'unknown'),
            COALESCE((v_project_data->>'project_score')::numeric, 0),
            (v_expertise_data->>'expertise_rating')::text,
            COALESCE((v_expertise_data->>'expertise_score')::numeric, 0)
        );
    ELSE
        -- Use legacy discrepancy checking
        v_discrepancy_check := public.check_rating_discrepancy(
            COALESCE((v_project_data->>'project_rating')::traffic_light_rating, 'unknown'),
            COALESCE((v_project_data->>'project_score')::numeric, 0),
            (v_expertise_data->>'expertise_rating')::traffic_light_rating,
            COALESCE((v_expertise_data->>'expertise_score')::numeric, 0)
        );
    END IF;

    -- Calculate final score based on algorithm type and rating system
    IF p_rating_system = '4point' THEN
        -- 4-point system calculation
        CASE v_algorithm_type
            WHEN 'weighted_average' THEN
                -- Standard weighted average for 4-point system
                DECLARE
                    v_total_weight numeric := p_project_weight + p_expertise_weight + p_eba_weight;
                    v_project_score numeric := COALESCE((v_project_data->>'project_score')::numeric, 3.0); -- Default to yellow
                    v_expertise_score numeric := COALESCE((v_expertise_data->>'expertise_score')::numeric, 3.0);
                    v_eba_score numeric := COALESCE((v_eba_data->>'eba_score')::numeric, 3.0);
                BEGIN
                    IF v_total_weight > 0 THEN
                        v_final_score := (
                            (v_project_score * p_project_weight) +
                            (v_expertise_score * p_expertise_weight) +
                            (v_eba_score * p_eba_weight)
                        ) / v_total_weight;
                        -- Ensure score is within 1-4 range
                        v_final_score := GREATEST(1, LEAST(4, v_final_score));
                    END IF;
                END;

            WHEN 'custom_function' THEN
                -- Hybrid method with special handling for 4-point system
                DECLARE
                    v_project_score numeric := COALESCE((v_project_data->>'project_score')::numeric, 3.0);
                    v_expertise_score numeric := COALESCE((v_expertise_data->>'expertise_score')::numeric, 3.0);
                    v_eba_score numeric := COALESCE((v_eba_data->>'eba_score')::numeric, 3.0);
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
                        v_base_score := 3.0; -- Default to yellow
                    END IF;

                    -- Critical factors (EBA is most critical)
                    v_critical_score := v_eba_score;

                    -- Combine base and critical scores
                    v_final_score := (v_base_score * (1 - v_critical_weight)) + (v_critical_score * v_critical_weight);
                    -- Ensure score is within 1-4 range
                    v_final_score := GREATEST(1, LEAST(4, v_final_score));
                END;

            ELSE
                -- Default to weighted average for 4-point system
                DECLARE
                    v_total_weight numeric := p_project_weight + p_expertise_weight + p_eba_weight;
                    v_project_score numeric := COALESCE((v_project_data->>'project_score')::numeric, 3.0);
                    v_expertise_score numeric := COALESCE((v_expertise_data->>'expertise_score')::numeric, 3.0);
                    v_eba_score numeric := COALESCE((v_eba_data->>'eba_score')::numeric, 3.0);
                BEGIN
                    IF v_total_weight > 0 THEN
                        v_final_score := (
                            (v_project_score * p_project_weight) +
                            (v_expertise_score * p_expertise_weight) +
                            (v_eba_score * p_eba_weight)
                        ) / v_total_weight;
                        -- Ensure score is within 1-4 range
                        v_final_score := GREATEST(1, LEAST(4, v_final_score));
                    END IF;
                END;
        END CASE;

        -- Convert numeric score to rating label for 4-point system
        CASE v_final_score
            WHEN 1 THEN v_final_rating := 'red';
            WHEN 2 THEN v_final_rating := 'amber';
            WHEN 3 THEN v_final_rating := 'yellow';
            WHEN 4 THEN v_final_rating := 'green';
            ELSE v_final_rating := 'red';
        END CASE;

    ELSE
        -- Legacy rating system calculation (existing logic)
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

        -- Determine final rating for legacy system
        IF v_final_score IS NOT NULL THEN
            SELECT rating INTO v_final_rating
            FROM public.traffic_light_thresholds
            WHERE v_final_score >= min_score AND v_final_score <= max_score AND is_active = true;
        ELSE
            v_final_rating := 'unknown';
        END IF;
    END IF;

    -- Calculate overall confidence
    DECLARE
        v_project_confidence text := COALESCE(v_project_data->>'data_quality', 'very_low');
        v_expertise_confidence text := COALESCE(v_expertise_data->>'confidence_level', 'very_low');
        v_eba_confidence text := CASE WHEN (v_eba_data->>'has_active_eba') = 'true' THEN 'high' ELSE 'medium' END;
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
        'calculation_version', CASE WHEN p_rating_system = '4point' THEN '4point_v1.0' ELSE 'legacy_v1.0' END,
        'rating_system', p_rating_system
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Create 4-point specific discrepancy checking function
CREATE OR REPLACE FUNCTION public.check_rating_discrepancy_4point(
    p_project_rating text,
    p_project_score numeric,
    p_expertise_rating text,
    p_expertise_score numeric
) RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
    v_discrepancy_detected boolean := false;
    v_discrepancy_level integer := 0;
    v_score_difference numeric;
    v_rating_match boolean;
    v_requires_review boolean := false;
    v_discrepancy_category text;
BEGIN
    -- Calculate score difference
    v_score_difference := ABS(p_project_score - p_expertise_score);

    -- Check if ratings match
    v_rating_match := p_project_rating = p_expertise_rating;

    -- Determine discrepancy level
    IF v_score_difference >= 2.0 THEN
        v_discrepancy_level := 3; -- Major discrepancy
        v_discrepancy_detected := true;
        v_requires_review := true;
        v_discrepancy_category := 'major';
    ELSIF v_score_difference >= 1.5 THEN
        v_discrepancy_level := 2; -- Moderate discrepancy
        v_discrepancy_detected := true;
        v_requires_review := true;
        v_discrepancy_category := 'moderate';
    ELSIF v_score_difference >= 1.0 THEN
        v_discrepancy_level := 1; -- Minor discrepancy
        v_discrepancy_detected := true;
        v_discrepancy_category := 'minor';
    ELSE
        v_discrepancy_level := 0; -- No significant discrepancy
        v_discrepancy_category := 'none';
    END IF;

    -- Additional check for critical rating mismatches
    IF NOT v_rating_match THEN
        -- Check for red vs green mismatch (most critical)
        IF (p_project_rating = 'red' AND p_expertise_rating = 'green') OR
           (p_project_rating = 'green' AND p_expertise_rating = 'red') THEN
            v_discrepancy_level := GREATEST(v_discrepancy_level, 3);
            v_requires_review := true;
            v_discrepancy_category := 'critical';
        END IF;
    END IF;

    -- Build result
    v_result := jsonb_build_object(
        'discrepancy_detected', v_discrepancy_detected,
        'discrepancy_level', v_discrepancy_level,
        'score_difference', v_score_difference,
        'rating_match', v_rating_match,
        'requires_review', v_requires_review,
        'discrepancy_category', v_discrepancy_category,
        'project_rating', p_project_rating,
        'project_score', p_project_score,
        'expertise_rating', p_expertise_rating,
        'expertise_score', p_expertise_score,
        'checked_at', now()
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Update function permissions
GRANT EXECUTE ON FUNCTION public.calculate_expertise_rating TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_final_employer_rating TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rating_discrepancy_4point TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.calculate_expertise_rating IS 'Calculates expertise rating with support for both 4-point and legacy rating systems';
COMMENT ON FUNCTION public.calculate_final_employer_rating IS 'Calculates final employer rating with support for both 4-point and legacy rating systems';
COMMENT ON FUNCTION public.check_rating_discrepancy_4point IS 'Checks for discrepancies between project and expertise ratings in the 4-point system';

-- Migration completed successfully