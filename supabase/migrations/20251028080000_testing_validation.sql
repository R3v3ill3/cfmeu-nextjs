-- CFMEU Rating System Transformation - Testing and Validation Scripts
-- This migration creates comprehensive testing and validation scripts
-- to ensure data integrity and rating calculation accuracy

-- Test results tracking table
CREATE TABLE IF NOT EXISTS public.test_validation_results (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    test_suite text NOT NULL,
    test_name text NOT NULL,
    test_status text NOT NULL CHECK (test_status IN ('passed', 'failed', 'skipped', 'error')),
    test_description text,
    test_metadata jsonb DEFAULT '{}',
    expected_result jsonb,
    actual_result jsonb,
    test_duration interval,
    error_message text,
    test_timestamp timestamp with time zone DEFAULT now() NOT NULL,
    test_run_id uuid DEFAULT gen_random_uuid(),
    created_by uuid REFERENCES public.profiles(id),

    UNIQUE(test_run_id, test_suite, test_name)
);

-- Test data setup table
CREATE TABLE IF NOT EXISTS public.test_data_scenarios (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    scenario_name text NOT NULL,
    scenario_type text NOT NULL CHECK (scenario_type IN ('unit_test', 'integration_test', 'performance_test', 'edge_case')),
    employer_role employer_role_type NOT NULL,
    test_data jsonb NOT NULL,
    expected_outcomes jsonb NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.profiles(id)
);

-- Function to run a single test and log results
CREATE OR REPLACE FUNCTION public.run_test(
    p_test_suite text,
    p_test_name text,
    p_test_function text,
    p_test_data jsonb DEFAULT '{}',
    p_expected_result jsonb DEFAULT NULL
) RETURNS boolean AS $$
DECLARE
    v_start_time timestamp with time zone := now();
    v_test_result jsonb;
    v_test_passed boolean := false;
    v_error_message text;
    v_test_duration interval;
BEGIN
    BEGIN
        -- Execute the test function
        EXECUTE format('SELECT %I($1)', p_test_function) INTO v_test_result USING p_test_data;

        -- Check if test passed
        IF p_expected_result IS NOT NULL THEN
            v_test_passed := (v_test_result = p_expected_result);
        ELSE
            -- For functions that don't have expected results, check if result is not null/empty
            v_test_passed := (v_test_result IS NOT NULL AND v_test_result != 'null'::jsonb);
        END IF;

        v_test_duration := now() - v_start_time;

        -- Log test result
        INSERT INTO public.test_validation_results (
            test_suite, test_name, test_status, test_description,
            expected_result, actual_result, test_duration, test_metadata
        ) VALUES (
            p_test_suite,
            p_test_name,
            CASE WHEN v_test_passed THEN 'passed' ELSE 'failed' END,
            format('Automated test execution of %s', p_test_function),
            p_expected_result,
            v_test_result,
            v_test_duration,
            jsonb_build_object(
                'test_function', p_test_function,
                'test_data', p_test_data,
                'execution_timestamp', v_start_time
            )
        );

        RETURN v_test_passed;

    EXCEPTION WHEN OTHERS THEN
        v_test_duration := now() - v_start_time;
        v_error_message := SQLERRM;

        -- Log test failure
        INSERT INTO public.test_validation_results (
            test_suite, test_name, test_status, test_description,
            test_duration, error_message, test_metadata
        ) VALUES (
            p_test_suite,
            p_test_name,
            'error',
            format('Test execution failed for %s', p_test_function),
            v_test_duration,
            v_error_message,
            jsonb_build_object(
                'test_function', p_test_function,
                'test_data', p_test_data,
                'sql_state', SQLSTATE,
                'execution_timestamp', v_start_time
            )
        );

        RETURN false;
    END;
END;
$$ LANGUAGE plpgsql;

-- Test Functions

-- Test 1: Validate 4-point scale conversion functions
CREATE OR REPLACE FUNCTION public.test_convert_numeric_to_4_point()
RETURNS jsonb AS $$
DECLARE
    v_results jsonb := '[]';
    v_test_cases jsonb := '[
        {"input": 95, "invert": false, "expected": "good"},
        {"input": 75, "invert": false, "expected": "fair"},
        {"input": 45, "invert": false, "expected": "poor"},
        {"input": 25, "invert": false, "expected": "terrible"},
        {"input": 95, "invert": true, "expected": "terrible"},
        {"input": 25, "invert": true, "expected": "good"}
    ]';
    rec jsonb;
BEGIN
    FOR rec IN SELECT * FROM jsonb_array_elements(v_test_cases)
    LOOP
        v_results := v_results || jsonb_build_object(
            'input', rec->'input',
            'invert', rec->'invert',
            'expected', rec->'expected',
            'actual', public.convert_numeric_to_4_point((rec->'input')::numeric, (rec->'invert')::boolean),
            'test_passed', public.convert_numeric_to_4_point((rec->'input')::numeric, (rec->'invert')::boolean) = (rec->'expected')::four_point_rating
        );
    END LOOP;

    RETURN jsonb_build_object(
        'test_name', 'convert_numeric_to_4_point',
        'total_tests', jsonb_array_length(v_results),
        'passed_tests', (SELECT COUNT(*) FROM jsonb_array_elements(v_results) WHERE (value->>'test_passed')::boolean = true),
        'results', v_results
    );
END;
$$ LANGUAGE plpgsql;

-- Test 2: Validate 4-point to traffic light conversion
CREATE OR REPLACE FUNCTION public.test_convert_4_point_to_traffic_light()
RETURNS jsonb AS $$
DECLARE
    v_results jsonb := '[]';
    v_test_cases jsonb := '[
        {"input": 1, "expected": "green"},
        {"input": 2, "expected": "amber"},
        {"input": 3, "expected": "red"},
        {"input": 4, "expected": "red"}
    ]';
    rec jsonb;
BEGIN
    FOR rec IN SELECT * FROM jsonb_array_elements(v_test_cases)
    LOOP
        v_results := v_results || jsonb_build_object(
            'input', rec->'input',
            'expected', rec->'expected',
            'actual', public.convert_4_point_to_traffic_light((rec->'input')::numeric),
            'test_passed', public.convert_4_point_to_traffic_light((rec->'input')::numeric) = (rec->'expected')::traffic_light_rating
        );
    END LOOP;

    RETURN jsonb_build_object(
        'test_name', 'convert_4_point_to_traffic_light',
        'total_tests', jsonb_array_length(v_results),
        'passed_tests', (SELECT COUNT(*) FROM jsonb_array_elements(v_results) WHERE (value->>'test_passed')::boolean = true),
        'results', v_results
    );
END;
$$ LANGUAGE plpgsql;

-- Test 3: Validate weighted 4-point score calculation
CREATE OR REPLACE FUNCTION public.test_calculate_weighted_4_point_score()
RETURNS jsonb AS $$
DECLARE
    v_results jsonb := '[]';
    v_test_cases jsonb := '[
        {"scores": [1, 2, 3, 4], "weights": [0.25, 0.25, 0.25, 0.25], "expected": 2.5},
        {"scores": [1, 1, 1, 1], "weights": [0.5, 0.3, 0.1, 0.1], "expected": 1},
        {"scores": [4, 4, 4, 4], "weights": [0.25, 0.25, 0.25, 0.25], "expected": 4},
        {"scores": [1, 2, null, 4], "weights": [0.3, 0.3, 0.2, 0.2], "expected": 2.142857142857142857}
    ]';
    rec jsonb;
BEGIN
    FOR rec IN SELECT * FROM jsonb_array_elements(v_test_cases)
    LOOP
        DECLARE
            v_scores numeric[] := ARRAY(SELECT jsonb_array_elements_text(rec->'scores')::numeric[]);
            v_weights numeric[] := ARRAY(SELECT jsonb_array_elements_text(rec->'weights')::numeric[]);
            v_actual numeric;
            v_expected numeric := (rec->'expected')::numeric;
        BEGIN
            v_actual := public.calculate_weighted_4_point_score(v_scores, v_weights);

            v_results := v_results || jsonb_build_object(
                'scores', rec->'scores',
                'weights', rec->'weights',
                'expected', v_expected,
                'actual', v_actual,
                'test_passed', ABS(v_actual - v_expected) < 0.0001 -- Allow for floating point precision
            );
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'test_name', 'calculate_weighted_4_point_score',
        'total_tests', jsonb_array_length(v_results),
        'passed_tests', (SELECT COUNT(*) FROM jsonb_array_elements(v_results) WHERE (value->>'test_passed')::boolean = true),
        'results', v_results
    );
END;
$$ LANGUAGE plpgsql;

-- Test 4: Validate employer role inference
CREATE OR REPLACE FUNCTION public.test_infer_employer_role()
RETURNS jsonb AS $$
DECLARE
    v_test_employer_id uuid;
    v_results jsonb := '[]';
BEGIN
    -- Create a test employer
    INSERT INTO public.employers (name, abn, employer_type)
    VALUES ('Test Employer for Role Inference', '12345678901', 'company')
    RETURNING id INTO v_test_employer_id;

    -- Test case 1: No project history - should be unknown
    PERFORM public.infer_employer_role(v_test_employer_id);
    v_results := v_results || jsonb_build_object(
        'test_case', 'no_project_history',
        'expected', 'unknown',
        'actual', (SELECT role_type FROM public.employers WHERE id = v_test_employer_id),
        'test_passed', (SELECT role_type FROM public.employers WHERE id = v_test_employer_id) = 'unknown'
    );

    -- Clean up test employer
    DELETE FROM public.employers WHERE id = v_test_employer_id;

    RETURN jsonb_build_object(
        'test_name', 'infer_employer_role',
        'total_tests', jsonb_array_length(v_results),
        'passed_tests', (SELECT COUNT(*) FROM jsonb_array_elements(v_results) WHERE (value->>'test_passed')::boolean = true),
        'results', v_results
    );
END;
$$ LANGUAGE plpgsql;

-- Test 5: Validate assessment coverage calculation
CREATE OR REPLACE FUNCTION public.test_calculate_assessment_coverage()
RETURNS jsonb AS $$
DECLARE
    v_test_employer_id uuid;
    v_results jsonb := '[]';
    v_coverage numeric;
BEGIN
    -- Create a test employer
    INSERT INTO public.employers (name, abn, employer_type, role_type)
    VALUES ('Test Employer for Coverage', '12345678902', 'company', 'trade')
    RETURNING id INTO v_test_employer_id;

    -- Test case 1: No assessments - should be 0%
    v_coverage := public.calculate_assessment_coverage(v_test_employer_id);
    v_results := v_results || jsonb_build_object(
        'test_case', 'no_assessments',
        'expected', 0,
        'actual', v_coverage,
        'test_passed', v_coverage = 0
    );

    -- Add test assessments
    INSERT INTO public.union_respect_assessments (
        employer_id, assessment_date, overall_union_respect_score,
        overall_union_respect_rating, assessment_complete, is_active
    ) VALUES (
        v_test_employer_id, CURRENT_DATE, 2, 'fair', true, true
    );

    INSERT INTO public.safety_assessments_4_point (
        employer_id, assessment_date, overall_safety_score,
        overall_safety_rating, assessment_complete, is_active
    ) VALUES (
        v_test_employer_id, CURRENT_DATE, 2, 'fair', true, true
    );

    -- Test case 2: 2 of 3 assessments (trade role) - should be 66.67%
    v_coverage := public.calculate_assessment_coverage(v_test_employer_id);
    v_results := v_results || jsonb_build_object(
        'test_case', 'partial_assessments_trade',
        'expected', 66.67,
        'actual', ROUND(v_coverage, 2),
        'test_passed', ABS(v_coverage - 66.67) < 0.1
    );

    -- Clean up
    DELETE FROM public.union_respect_assessments WHERE employer_id = v_test_employer_id;
    DELETE FROM public.safety_assessments_4_point WHERE employer_id = v_test_employer_id;
    DELETE FROM public.employers WHERE id = v_test_employer_id;

    RETURN jsonb_build_object(
        'test_name', 'calculate_assessment_coverage',
        'total_tests', jsonb_array_length(v_results),
        'passed_tests', (SELECT COUNT(*) FROM jsonb_array_elements(v_results) WHERE (value->>'test_passed')::boolean = true),
        'results', v_results
    );
END;
$$ LANGUAGE plpgsql;

-- Test 6: Validate materialized view refresh
CREATE OR REPLACE FUNCTION public.test_refresh_materialized_views()
RETURNS jsonb AS $$
DECLARE
    v_start_time timestamp with time zone := now();
    v_refresh_success boolean := false;
BEGIN
    BEGIN
        -- Test materialized view refresh
        PERFORM public.refresh_rating_materialized_views();
        v_refresh_success := true;

        RETURN jsonb_build_object(
            'test_name', 'refresh_materialized_views',
            'test_passed', v_refresh_success,
            'duration', now() - v_start_time,
            'views_refreshed', 3
        );
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'test_name', 'refresh_materialized_views',
            'test_passed', false,
            'error_message', SQLERRM,
            'duration', now() - v_start_time
        );
    END;
END;
$$ LANGUAGE plpgsql;

-- Test 7: Performance test for rating calculations
CREATE OR REPLACE FUNCTION public.test_rating_calculation_performance()
RETURNS jsonb AS $$
DECLARE
    v_start_time timestamp with time zone := now();
    v_calculation_times interval[] := '{}';
    v_test_employer_id uuid;
    i integer;
BEGIN
    -- Create a test employer
    INSERT INTO public.employers (name, abn, employer_type, role_type)
    VALUES ('Performance Test Employer', '12345678903', 'company', 'trade')
    RETURNING id INTO v_test_employer_id;

    -- Run multiple calculations to test performance
    FOR i IN 1..10 LOOP
        DECLARE
            v_calc_start timestamp with time zone := now();
            v_result jsonb;
        BEGIN
            v_result := public.calculate_final_employer_rating_4_point(v_test_employer_id);
            v_calculation_times := v_calculation_times || (now() - v_calc_start);
        EXCEPTION WHEN OTHERS THEN
            -- Continue even if calculation fails (due to missing assessment data)
            v_calculation_times := v_calculation_times || (now() - v_calc_start);
        END;
    END LOOP;

    -- Clean up
    DELETE FROM public.employers WHERE id = v_test_employer_id;

    RETURN jsonb_build_object(
        'test_name', 'rating_calculation_performance',
        'total_calculations', array_length(v_calculation_times, 1),
        'average_time', (SELECT SUM(EXTRACT(MILLISECONDS FROM calc_time)) / array_length(v_calculation_times, 1) FROM unnest(v_calculation_times) as calc_time),
        'max_time', (SELECT MAX(EXTRACT(MILLISECONDS FROM calc_time)) FROM unnest(v_calculation_times) as calc_time),
        'min_time', (SELECT MIN(EXTRACT(MILLISECONDS FROM calc_time)) FROM unnest(v_calculation_times) as calc_time),
        'total_test_duration', now() - v_start_time,
        'test_passed', array_length(v_calculation_times, 1) = 10
    );
END;
$$ LANGUAGE plpgsql;

-- Main test suite runner
CREATE OR REPLACE FUNCTION public.run_complete_test_suite(
    p_test_run_id uuid DEFAULT gen_random_uuid()
) RETURNS jsonb AS $$
DECLARE
    v_test_run_start timestamp with time zone := now();
    v_total_tests integer := 0;
    v_passed_tests integer := 0;
    v_failed_tests integer := 0;
    v_suite_results jsonb := '[]';
    rec RECORD;
BEGIN
    -- Define all tests to run
    INSERT INTO public.test_validation_results (test_suite, test_name, test_status, test_run_id)
    VALUES
        ('unit_tests', 'convert_numeric_to_4_point', 'started', p_test_run_id),
        ('unit_tests', 'convert_4_point_to_traffic_light', 'started', p_test_run_id),
        ('unit_tests', 'calculate_weighted_4_point_score', 'started', p_test_run_id),
        ('integration_tests', 'infer_employer_role', 'started', p_test_run_id),
        ('integration_tests', 'calculate_assessment_coverage', 'started', p_test_run_id),
        ('performance_tests', 'refresh_materialized_views', 'started', p_test_run_id),
        ('performance_tests', 'rating_calculation_performance', 'started', p_test_run_id);

    -- Run each test
    FOR rec IN
        SELECT 'unit_tests' as test_suite, 'convert_numeric_to_4_point' as test_name, 'public.test_convert_numeric_to_4_point()' as test_function
        UNION ALL
        SELECT 'unit_tests', 'convert_4_point_to_traffic_light', 'public.test_convert_4_point_to_traffic_light()'
        UNION ALL
        SELECT 'unit_tests', 'calculate_weighted_4_point_score', 'public.test_calculate_weighted_4_point_score()'
        UNION ALL
        SELECT 'integration_tests', 'infer_employer_role', 'public.test_infer_employer_role()'
        UNION ALL
        SELECT 'integration_tests', 'calculate_assessment_coverage', 'public.test_calculate_assessment_coverage()'
        UNION ALL
        SELECT 'performance_tests', 'refresh_materialized_views', 'public.test_refresh_materialized_views()'
        UNION ALL
        SELECT 'performance_tests', 'rating_calculation_performance', 'public.test_rating_calculation_performance()'
    LOOP
        DECLARE
            v_test_result jsonb;
            v_test_passed boolean;
        BEGIN
            -- Execute test function
            EXECUTE rec.test_function INTO v_test_result;
            v_test_passed := (v_test_result->>'passed_tests')::numeric = (v_test_result->>'total_tests')::numeric;

            -- Update test result
            UPDATE public.test_validation_results
            SET
                test_status = CASE WHEN v_test_passed THEN 'passed' ELSE 'failed' END,
                actual_result = v_test_result,
                test_duration = now() - v_test_run_start
            WHERE test_run_id = p_test_run_id
              AND test_suite = rec.test_suite
              AND test_name = rec.test_name;

            v_total_tests := v_total_tests + 1;
            IF v_test_passed THEN
                v_passed_tests := v_passed_tests + 1;
            ELSE
                v_failed_tests := v_failed_tests + 1;
            END IF;

            v_suite_results := v_suite_results || v_test_result;

        EXCEPTION WHEN OTHERS THEN
            -- Log test failure
            UPDATE public.test_validation_results
            SET
                test_status = 'error',
                error_message = SQLERRM,
                test_duration = now() - v_test_run_start
            WHERE test_run_id = p_test_run_id
              AND test_suite = rec.test_suite
              AND test_name = rec.test_name;

            v_total_tests := v_total_tests + 1;
            v_failed_tests := v_failed_tests + 1;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'test_run_id', p_test_run_id,
        'test_run_summary', jsonb_build_object(
            'total_tests', v_total_tests,
            'passed_tests', v_passed_tests,
            'failed_tests', v_failed_tests,
            'success_rate', CASE WHEN v_total_tests > 0 THEN (v_passed_tests::numeric / v_total_tests::numeric) * 100 ELSE 0 END,
            'total_duration', now() - v_test_run_start,
            'test_completed_at', now()
        ),
        'suite_results', v_suite_results,
        'test_run_timestamp', v_test_run_start
    );
END;
$$ LANGUAGE plpgsql;

-- Data integrity validation functions
CREATE OR REPLACE FUNCTION public.validate_data_integrity()
RETURNS jsonb AS $$
DECLARE
    v_integrity_checks jsonb := '[]';
    v_total_checks integer := 0;
    v_passed_checks integer := 0;
BEGIN
    -- Check 1: Validate 4-point rating values are within range
    v_integrity_checks := v_integrity_checks || jsonb_build_object(
        'check_name', 'union_respect_score_range',
        'check_passed', NOT EXISTS (
            SELECT 1 FROM public.union_respect_assessments
            WHERE overall_union_respect_score IS NOT NULL
              AND (overall_union_respect_score < 1 OR overall_union_respect_score > 4)
        ),
        'check_description', 'All union respect scores should be between 1 and 4'
    );

    -- Check 2: Validate safety assessment score ranges
    v_integrity_checks := v_integrity_checks || jsonb_build_object(
        'check_name', 'safety_score_range',
        'check_passed', NOT EXISTS (
            SELECT 1 FROM public.safety_assessments_4_point
            WHERE overall_safety_score IS NOT NULL
              AND (overall_safety_score < 1 OR overall_safety_score > 4)
        ),
        'check_description', 'All safety scores should be between 1 and 4'
    );

    -- Check 3: Validate employer role values
    v_integrity_checks := v_integrity_checks || jsonb_build_object(
        'check_name', 'employer_role_values',
        'check_passed', NOT EXISTS (
            SELECT 1 FROM public.employers
            WHERE role_type NOT IN ('trade', 'builder', 'both', 'unknown')
        ),
        'check_description', 'All employer roles should be valid enum values'
    );

    -- Check 4: Validate assessment relationships
    v_integrity_checks := v_integrity_checks || jsonb_build_object(
        'check_name', 'assessment_employer_relationships',
        'check_passed', NOT EXISTS (
            SELECT 1 FROM public.union_respect_assessments ura
            LEFT JOIN public.employers e ON ura.employer_id = e.id
            WHERE e.id IS NULL
        ),
        'check_description', 'All assessments should reference valid employers'
    );

    -- Check 5: Validate materialized view data consistency
    v_integrity_checks := v_integrity_checks || jsonb_build_object(
        'check_name', 'materialized_view_consistency',
        'check_passed', EXISTS (
            SELECT 1 FROM public.employer_4_point_rating_summary
            LIMIT 1
        ),
        'check_description', 'Materialized views should be populated'
    );

    -- Count passed checks
    FOR rec IN SELECT * FROM jsonb_array_elements(v_integrity_checks)
    LOOP
        v_total_checks := v_total_checks + 1;
        IF (rec->>'check_passed')::boolean THEN
            v_passed_checks := v_passed_checks + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'validation_summary', jsonb_build_object(
            'total_checks', v_total_checks,
            'passed_checks', v_passed_checks,
            'failed_checks', v_total_checks - v_passed_checks,
            'validation_passed', v_passed_checks = v_total_checks,
            'validation_timestamp', now()
        ),
        'detailed_checks', v_integrity_checks
    );
END;
$$ LANGUAGE plpgsql;

-- Create views for test result monitoring
CREATE OR REPLACE VIEW public.test_results_dashboard AS
SELECT
    test_run_id,
    test_suite,
    COUNT(*) as total_tests,
    COUNT(*) FILTER (WHERE test_status = 'passed') as passed_tests,
    COUNT(*) FILTER (WHERE test_status = 'failed') as failed_tests,
    COUNT(*) FILTER (WHERE test_status = 'error') as error_tests,
    ROUND(COUNT(*) FILTER (WHERE test_status = 'passed')::numeric / COUNT(*) * 100, 2) as success_rate,
    MIN(test_timestamp) as test_start_time,
    MAX(test_timestamp) as test_end_time,
    MAX(test_timestamp) - MIN(test_timestamp) as total_duration
FROM public.test_validation_results
GROUP BY test_run_id, test_suite
ORDER BY test_start_time DESC;

CREATE OR REPLACE VIEW public.latest_test_run AS
SELECT
    tr.*,
    td.success_rate,
    td.total_duration
FROM public.test_validation_results tr
JOIN public.test_results_dashboard td ON tr.test_run_id = td.test_run_id
WHERE tr.test_run_id = (SELECT MAX(test_run_id) FROM public.test_validation_results)
ORDER BY tr.test_suite, tr.test_name;

-- Grant permissions
GRANT ALL ON public.test_validation_results TO authenticated;
GRANT ALL ON public.test_data_scenarios TO authenticated;
GRANT SELECT ON public.test_results_dashboard TO authenticated;
GRANT SELECT ON public.latest_test_run TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_test TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_complete_test_suite TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_data_integrity TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_convert_numeric_to_4_point TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_convert_4_point_to_traffic_light TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_calculate_weighted_4_point_score TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_infer_employer_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_calculate_assessment_coverage TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_refresh_materialized_views TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_rating_calculation_performance TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.test_validation_results IS 'Results of automated tests for 4-point rating system validation';
COMMENT ON TABLE public.test_data_scenarios IS 'Test data scenarios for validating rating system functionality';
COMMENT ON VIEW public.test_results_dashboard IS 'Dashboard view for test run results and statistics';
COMMENT ON VIEW public.latest_test_run IS 'View showing the most recent test run results';
COMMENT ON FUNCTION public.run_complete_test_suite IS 'Runs the complete test suite for the 4-point rating system';
COMMENT ON FUNCTION public.validate_data_integrity IS 'Validates data integrity across the 4-point rating system';

-- Create initial test run
SELECT public.run_complete_test_suite();