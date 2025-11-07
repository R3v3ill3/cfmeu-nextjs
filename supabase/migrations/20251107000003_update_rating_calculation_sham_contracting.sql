-- Update rating calculation function to implement sham contracting hard block
-- This prevents employers with active sham contracting flags from receiving green ratings (max yellow/amber)

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
    
    -- Sham contracting check variables
    v_sham_contracting_status record;
    v_has_sham_contracting boolean := false;
    v_sham_contracting_block boolean := false;
    v_sham_contracting_reason text := NULL;
    v_original_rating traffic_light_rating;

    -- Calculation method configuration
    v_method_config jsonb;
    v_algorithm_type text;
BEGIN
    -- Check for active sham contracting flags
    SELECT * INTO v_sham_contracting_status
    FROM public.get_employer_sham_contracting_status(p_employer_id);
    
    v_has_sham_contracting := COALESCE(v_sham_contracting_status.has_active_flags, false);
    
    IF v_has_sham_contracting THEN
        v_sham_contracting_block := true;
        v_sham_contracting_reason := format(
            'Active sham contracting flags: %s total, %s active. Latest: %s',
            v_sham_contracting_status.total_flags,
            v_sham_contracting_status.active_flags,
            COALESCE(v_sham_contracting_status.latest_flag_notes, 'No notes')
        );
    END IF;

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
                v_critical_factors := COALESCE(v_method_config->'critical_factors', '["eba_status", "cbus_status", "safety_incidents"]'::jsonb);

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

    -- Determine final rating from score
    IF v_final_score IS NOT NULL THEN
        SELECT rating INTO v_final_rating
        FROM public.traffic_light_thresholds
        WHERE v_final_score >= min_score AND v_final_score <= max_score AND is_active = true;
    ELSE
        v_final_rating := 'unknown';
    END IF;
    
    -- Store original rating before sham contracting block
    v_original_rating := v_final_rating;

    -- SHAM CONTRACTING HARD BLOCK: Cap rating at yellow/amber if detected
    IF v_sham_contracting_block THEN
        IF v_final_rating = 'green' THEN
            -- Downgrade from green to amber/yellow
            v_final_rating := 'amber';
            v_sham_contracting_reason := v_sham_contracting_reason || ' (Rating capped from green to amber due to sham contracting)';
        END IF;
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

            -- Map to confidence level
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
        v_has_eba_data boolean := (v_eba_data->>'has_active_eba')::boolean = true;
        v_completeness_count integer := 0;
    BEGIN
        IF v_has_project_data THEN v_completeness_count := v_completeness_count + 1; END IF;
        IF v_has_expertise_data THEN v_completeness_count := v_completeness_count + 1; END IF;
        IF v_has_eba_data THEN v_completeness_count := v_completeness_count + 1; END IF;
        
        v_data_completeness := (v_completeness_count::numeric / 3.0) * 100;
    END;

    -- Check if reconciliation is needed
    v_reconciliation_needed := (v_discrepancy_check->>'discrepancy_detected')::boolean;
    IF v_reconciliation_needed THEN
        v_reconciliation_method := v_discrepancy_check->>'recommended_reconciliation_method';
    END IF;

    -- Build final result
    v_result := jsonb_build_object(
        'employer_id', p_employer_id,
        'calculation_date', p_calculation_date,
        'final_rating', v_final_rating,
        'final_score', v_final_score,
        'original_rating', v_original_rating,
        
        -- Sham contracting block info
        'sham_contracting_block', v_sham_contracting_block,
        'sham_contracting_reason', v_sham_contracting_reason,
        'has_sham_contracting', v_has_sham_contracting,
        
        -- Component ratings
        'project_rating', v_project_data->>'project_rating',
        'project_score', v_project_data->>'project_score',
        'project_data_quality', v_project_data->>'data_quality',
        'project_data_age_days', v_project_data->>'data_age_days',
        'projects_included', v_project_data->>'projects_included',
        
        'expertise_rating', v_expertise_data->>'expertise_rating',
        'expertise_score', v_expertise_data->>'expertise_score',
        'expertise_confidence', v_expertise_data->>'confidence_level',
        'expertise_data_age_days', v_expertise_data->>'data_age_days',
        'expertise_assessments_included', v_expertise_data->>'assessments_included',
        
        'eba_status', v_eba_data->>'eba_status',
        'eba_score', v_eba_data->>'eba_score',
        'has_active_eba', v_eba_data->>'has_active_eba',
        
        -- Metadata
        'overall_confidence', v_overall_confidence,
        'data_completeness', v_data_completeness,
        'calculation_method', p_calculation_method,
        'weights', jsonb_build_object(
            'project_weight', p_project_weight,
            'expertise_weight', p_expertise_weight,
            'eba_weight', p_eba_weight
        ),
        
        -- Reconciliation
        'reconciliation_needed', v_reconciliation_needed,
        'reconciliation_method', v_reconciliation_method,
        'discrepancy_details', v_discrepancy_check
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION public.calculate_final_employer_rating IS 
'Calculates final employer rating with sham contracting hard block. Employers with active sham contracting flags are capped at yellow/amber rating (cannot receive green).';

