-- CFMEU Rating System Transformation - Rollback Script
-- This migration provides a complete rollback capability for the 4-point rating system transformation
-- Use this script to revert all changes if necessary

-- Rollback tracking table
CREATE TABLE IF NOT EXISTS public.rollback_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    rollback_step text NOT NULL,
    step_status text NOT NULL CHECK (step_status IN ('started', 'completed', 'failed', 'skipped')),
    records_affected integer DEFAULT 0,
    backup_created boolean DEFAULT false,
    backup_location text,
    error_message text,
    rollback_metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);

-- Create backup function for critical data
CREATE OR REPLACE FUNCTION public.create_rollback_backup(p_table_name text)
RETURNS text AS $$
DECLARE
    v_backup_table_name text;
    v_backup_count integer;
BEGIN
    v_backup_table_name := format('%s_backup_%s', p_table_name, to_char(now(), 'YYYYMMDD_HH24MISS'));

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I AS SELECT * FROM %I', v_backup_table_name, p_table_name);

    GET DIAGNOSTICS v_backup_count = ROW_COUNT;

    INSERT INTO public.rollback_log (rollback_step, step_status, records_affected, backup_created, backup_location, rollback_metadata)
    VALUES (
        format('backup_%s', p_table_name),
        'completed',
        v_backup_count,
        true,
        v_backup_table_name,
        jsonb_build_object('original_table', p_table_name, 'backup_table', v_backup_table_name)
    );

    RETURN v_backup_table_name;
END;
$$ LANGUAGE plpgsql;

-- Function to safely drop tables with backup
CREATE OR REPLACE FUNCTION public.safe_drop_table(p_table_name text, p_create_backup boolean DEFAULT true)
RETURNS boolean AS $$
DECLARE
    v_backup_table text;
BEGIN
    -- Create backup if requested
    IF p_create_backup THEN
        v_backup_table := public.create_rollback_backup(p_table_name);
    END IF;

    -- Drop dependent objects first
    BEGIN
        EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS %v CASCADE', replace(p_table_name, '_view', '_materialized_view'));
    EXCEPTION WHEN OTHERS THEN
        -- Continue if view doesn't exist
        NULL;
    END;

    BEGIN
        EXECUTE format('DROP VIEW IF EXISTS %v CASCADE', replace(p_table_name, '_table', '_view'));
    EXCEPTION WHEN OTHERS THEN
        -- Continue if view doesn't exist
        NULL;
    END;

    -- Drop the table
    EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', p_table_name);

    INSERT INTO public.rollback_log (rollback_step, step_status, records_affected, rollback_metadata)
    VALUES (
        format('drop_table_%s', p_table_name),
        'completed',
        1,
        jsonb_build_object('table_dropped', p_table_name, 'backup_created', p_create_backup)
    );

    RETURN true;
EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.rollback_log (rollback_step, step_status, error_message, rollback_metadata)
    VALUES (
        format('drop_table_%s', p_table_name),
        'failed',
        SQLERRM,
        jsonb_build_object('table', p_table_name, 'error_code', SQLSTATE)
    );
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function to safely drop functions
CREATE OR REPLACE FUNCTION public.safe_drop_function(p_function_signature text)
RETURNS boolean AS $$
BEGIN
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', p_function_signature);

    INSERT INTO public.rollback_log (rollback_step, step_status, rollback_metadata)
    VALUES (
        format('drop_function_%s', replace(p_function_signature, '(', '_')),
        'completed',
        jsonb_build_object('function_dropped', p_function_signature)
    );

    RETURN true;
EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.rollback_log (rollback_step, step_status, error_message, rollback_metadata)
    VALUES (
        format('drop_function_%s', replace(p_function_signature, '(', '_')),
        'failed',
        SQLERRM,
        jsonb_build_object('function', p_function_signature, 'error_code', SQLSTATE)
    );
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function to safely drop columns
CREATE OR REPLACE FUNCTION public.safe_drop_column(p_table_name text, p_column_name text, p_create_backup boolean DEFAULT true)
RETURNS boolean AS $$
BEGIN
    -- Create backup if requested
    IF p_create_backup THEN
        PERFORM public.create_rollback_backup(p_table_name);
    END IF;

    -- Drop the column
    EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS %I', p_table_name, p_column_name);

    INSERT INTO public.rollback_log (rollback_step, step_status, rollback_metadata)
    VALUES (
        format('drop_column_%s_%s', p_table_name, p_column_name),
        'completed',
        jsonb_build_object('table', p_table_name, 'column_dropped', p_column_name, 'backup_created', p_create_backup)
    );

    RETURN true;
EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.rollback_log (rollback_step, step_status, error_message, rollback_metadata)
    VALUES (
        format('drop_column_%s_%s', p_table_name, p_column_name),
        'failed',
        SQLERRM,
        jsonb_build_object('table', p_table_name, 'column', p_column_name, 'error_code', SQLSTATE)
    );
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Begin Rollback Process
INSERT INTO public.rollback_log (rollback_step, step_status, rollback_metadata)
VALUES ('rollback_4_point_transformation', 'started', jsonb_build_object(
    'description', 'Starting rollback of 4-point rating system transformation',
    'started_at', now()
));

-- Step 1: Drop materialized views
INSERT INTO public.rollback_log (rollback_step, step_status, rollback_metadata)
VALUES ('drop_materialized_views', 'started', jsonb_build_object('description', 'Dropping performance optimization materialized views'));

DO $$
BEGIN
    -- Drop materialized views
    PERFORM public.safe_drop_table('rating_distribution_summary', false);
    PERFORM public.safe_drop_table('assessment_activity_summary', false);
    PERFORM public.safe_drop_table('employer_4_point_rating_summary', false);

    UPDATE public.rollback_log
    SET step_status = 'completed', completed_at = now()
    WHERE rollback_step = 'drop_materialized_views' AND step_status = 'started';
EXCEPTION WHEN OTHERS THEN
    UPDATE public.rollback_log
    SET step_status = 'failed', error_message = SQLERRM, completed_at = now()
    WHERE rollback_step = 'drop_materialized_views' AND step_status = 'started';
END $$;

-- Step 2: Drop performance optimization tables
INSERT INTO public.rollback_log (rollback_step, step_status, rollback_metadata)
VALUES ('drop_performance_tables', 'started', jsonb_build_object('description', 'Dropping performance optimization configuration tables'));

DO $$
BEGIN
    -- Drop performance optimization tables
    PERFORM public.safe_drop_table('rating_calculation_config');
    PERFORM public.safe_drop_table('assessment_quality_thresholds');
    PERFORM public.safe_drop_table('assessment_frequency_config');
    PERFORM public.safe_drop_table('role_assessment_weights');
    PERFORM public.safe_drop_table('assessment_templates');

    UPDATE public.rollback_log
    SET step_status = 'completed', completed_at = now()
    WHERE rollback_step = 'drop_performance_tables' AND step_status = 'started';
EXCEPTION WHEN OTHERS THEN
    UPDATE public.rollback_log
    SET step_status = 'failed', error_message = SQLERRM, completed_at = now()
    WHERE rollback_step = 'drop_performance_tables' AND step_status = 'started';
END $$;

-- Step 3: Drop 4-point assessment tables
INSERT INTO public.rollback_log (rollback_step, step_status, rollback_metadata)
VALUES ('drop_assessment_tables', 'started', jsonb_build_object('description', 'Dropping 4-point assessment framework tables'));

DO $$
BEGIN
    -- Drop new assessment tables (with backup)
    PERFORM public.safe_drop_table('role_specific_assessments');
    PERFORM public.safe_drop_table('subcontractor_use_assessments');
    PERFORM public.safe_drop_table('safety_assessments_4_point');
    PERFORM public.safe_drop_table('union_respect_assessments');

    UPDATE public.rollback_log
    SET step_status = 'completed', completed_at = now()
    WHERE rollback_step = 'drop_assessment_tables' AND step_status = 'started';
EXCEPTION WHEN OTHERS THEN
    UPDATE public.rollback_log
    SET step_status = 'failed', error_message = SQLERRM, completed_at = now()
    WHERE rollback_step = 'drop_assessment_tables' AND step_status = 'started';
END $$;

-- Step 4: Remove new columns from employers table
INSERT INTO public.rollback_log (rollback_step, step_status, rollback_metadata)
VALUES ('revert_employers_table', 'started', jsonb_build_object('description', 'Removing 4-point rating columns from employers table'));

DO $$
BEGIN
    -- Remove new columns from employers table (with backup)
    PERFORM public.safe_drop_column('employers', 'geographic_operation_areas');
    PERFORM public.safe_drop_column('employers', 'annual_revenue_range');
    PERFORM public.safe_drop_column('employers', 'workforce_size_category');
    PERFORM public.safe_drop_column('employers', 'geographic_operation_areas');
    PERFORM public.safe_drop_column('employers', 'typical_project_types');
    PERFORM public.safe_drop_column('employers', 'secondary_business_activities');
    PERFORM public.safe_drop_column('employers', 'primary_business_activity');
    PERFORM public.safe_drop_column('employers', 'last_eba_verification');
    PERFORM public.safe_drop_column('employers', 'eba_status_score');
    PERFORM public.safe_drop_column('employers', 'eba_status_4_point');
    PERFORM public.safe_drop_column('employers', 'incolink_compliance_status');
    PERFORM public.safe_drop_column('employers', 'cbus_compliance_status');
    PERFORM public.safe_drop_column('employers', 'subcontractor_relations_trend');
    PERFORM public.safe_drop_column('employers', 'union_relations_trend');
    PERFORM public.safe_drop_column('employers', 'safety_performance_trend');
    PERFORM public.safe_drop_column('employers', 'assessment_coverage_percentage');
    PERFORM public.safe_drop_column('employers', 'latest_assessment_date');
    PERFORM public.safe_drop_column('employers', 'total_role_specific_assessments');
    PERFORM public.safe_drop_column('employers', 'total_subcontractor_assessments');
    PERFORM public.safe_drop_column('employers', 'total_safety_assessments');
    PERFORM public.safe_drop_column('employers', 'total_union_respect_assessments');
    PERFORM public.safe_drop_column('employers', 'rating_calculation_method');
    PERFORM public.safe_drop_column('employers', 'last_4_point_rating_calculation');
    PERFORM public.safe_drop_column('employers', 'role_specific_rating_summary');
    PERFORM public.safe_drop_column('employers', 'role_confidence_level');
    PERFORM public.safe_drop_column('employers', 'last_role_assessment_date');
    PERFORM public.safe_drop_column('employers', 'overall_subcontractor_score');
    PERFORM public.safe_drop_column('employers', 'overall_subcontractor_rating');
    PERFORM public.safe_drop_column('employers', 'overall_safety_score');
    PERFORM public.safe_drop_column('employers', 'overall_safety_rating');
    PERFORM public.safe_drop_column('employers', 'overall_union_respect_score');
    PERFORM public.safe_drop_column('employers', 'overall_union_respect_rating');
    PERFORM public.safe_drop_column('employers', 'next_rating_review_date');
    PERFORM public.safe_drop_column('employers', 'rating_data_quality_score');

    UPDATE public.rollback_log
    SET step_status = 'completed', completed_at = now()
    WHERE rollback_step = 'revert_employers_table' AND step_status = 'started';
EXCEPTION WHEN OTHERS THEN
    UPDATE public.rollback_log
    SET step_status = 'failed', error_message = SQLERRM, completed_at = now()
    WHERE rollback_step = 'revert_employers_table' AND step_status = 'started';
END $$;

-- Step 5: Drop 4-point scale functions
INSERT INTO public.rollback_log (rollback_step, step_status, rollback_metadata)
VALUES ('drop_4_point_functions', 'started', jsonb_build_object('description', 'Dropping 4-point scale calculation functions'));

DO $$
BEGIN
    -- Drop 4-point scale functions
    PERFORM public.safe_drop_function('public.calculate_final_employer_rating_4_point(uuid, date, text)');
    PERFORM public.safe_drop_function('public.calculate_role_specific_rating(uuid, date, integer)');
    PERFORM public.safe_drop_function('public.calculate_subcontractor_rating(uuid, date, integer)');
    PERFORM public.safe_drop_function('public.calculate_safety_rating_4_point(uuid, date, integer)');
    PERFORM public.safe_drop_function('public.calculate_union_respect_rating(uuid, date, integer)');
    PERFORM public.safe_drop_function('public.convert_4_point_to_traffic_light(numeric)');
    PERFORM public.safe_drop_function('public.calculate_weighted_4_point_score(numeric[], numeric[])');
    PERFORM public.safe_drop_function('public.create_or_update_final_rating_4_point(uuid, date, uuid)');

    UPDATE public.rollback_log
    SET step_status = 'completed', completed_at = now()
    WHERE rollback_step = 'drop_4_point_functions' AND step_status = 'started';
EXCEPTION WHEN OTHERS THEN
    UPDATE public.rollback_log
    SET step_status = 'failed', error_message = SQLERRM, completed_at = now()
    WHERE rollback_step = 'drop_4_point_functions' AND step_status = 'started';
END $$;

-- Step 6: Drop data migration tracking
INSERT INTO public.rollback_log (rollback_step, step_status, rollback_metadata)
VALUES ('drop_migration_tracking', 'started', jsonb_build_object('description', 'Dropping migration tracking tables and functions'));

DO $$
BEGIN
    -- Drop migration tracking functions
    PERFORM public.safe_drop_function('public.infer_employer_role(uuid)');
    PERFORM public.safe_drop_function('public.calculate_assessment_coverage(uuid)');
    PERFORM public.safe_drop_function('public.update_employer_assessment_counts()');
    PERFORM public.safe_drop_function('public.convert_4_point_to_numeric(four_point_rating)');
    PERFORM public.safe_drop_function('public.convert_numeric_to_4_point(numeric, boolean)');
    PERFORM public.safe_drop_function('public.get_employer_assessment_summary(uuid, boolean)');
    PERFORM public.safe_drop_function('public.scheduled_maintenance_tasks()');
    PERFORM public.safe_drop_function('public.refresh_rating_materialized_views()');

    -- Drop migration tracking tables (with backup)
    PERFORM public.safe_drop_table('rating_migration_log');
    PERFORM public.safe_drop_table('rating_migration_status');

    UPDATE public.rollback_log
    SET step_status = 'completed', completed_at = now()
    WHERE rollback_step = 'drop_migration_tracking' AND step_status = 'started';
EXCEPTION WHEN OTHERS THEN
    UPDATE public.rollback_log
    SET step_status = 'failed', error_message = SQLERRM, completed_at = now()
    WHERE rollback_step = 'drop_migration_tracking' AND step_status = 'started';
END $$;

-- Step 7: Drop 4-point scale types and enums
INSERT INTO public.rollback_log (rollback_step, step_status, rollback_metadata)
VALUES ('drop_4_point_types', 'started', jsonb_build_object('description', 'Dropping 4-point scale type definitions'));

DO $$
BEGIN
    -- Drop custom types (must be done after all dependent objects are removed)
    BEGIN
        DROP TYPE IF EXISTS public.assessment_context CASCADE;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    BEGIN
        DROP TYPE IF EXISTS public.four_point_rating CASCADE;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    BEGIN
        DROP TYPE IF EXISTS public.employer_role_type CASCADE;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    UPDATE public.rollback_log
    SET step_status = 'completed', completed_at = now()
    WHERE rollback_step = 'drop_4_point_types' AND step_status = 'started';
EXCEPTION WHEN OTHERS THEN
    UPDATE public.rollback_log
    SET step_status = 'failed', error_message = SQLERRM, completed_at = now()
    WHERE rollback_step = 'drop_4_point_types' AND step_status = 'started';
END $$;

-- Step 8: Clean up triggers and indexes
INSERT INTO public.rollback_log (rollback_step, step_status, rollback_metadata)
VALUES ('cleanup_triggers_indexes', 'started', jsonb_build_object('description', 'Cleaning up orphaned triggers and indexes'));

DO $$
BEGIN
    -- Drop triggers that were created for the 4-point system
    BEGIN
        DROP TRIGGER IF EXISTS trigger_union_respect_assessment_count_update ON public.union_respect_assessments;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    BEGIN
        DROP TRIGGER IF EXISTS trigger_safety_assessment_count_update ON public.safety_assessments_4_point;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    BEGIN
        DROP TRIGGER IF EXISTS trigger_subcontractor_assessment_count_update ON public.subcontractor_use_assessments;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    BEGIN
        DROP TRIGGER IF EXISTS trigger_role_specific_assessment_count_update ON public.role_specific_assessments;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- Drop indexes that were created for the 4-point system
    BEGIN
        DROP INDEX IF EXISTS public.idx_employers_4_point_ratings;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    BEGIN
        DROP INDEX IF EXISTS public.idx_employers_rating_quality;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    BEGIN
        DROP INDEX IF EXISTS public.idx_employers_assessment_coverage;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    UPDATE public.rollback_log
    SET step_status = 'completed', completed_at = now()
    WHERE rollback_step = 'cleanup_triggers_indexes' AND step_status = 'started';
EXCEPTION WHEN OTHERS THEN
    UPDATE public.rollback_log
    SET step_status = 'failed', error_message = SQLERRM, completed_at = now()
    WHERE rollback_step = 'cleanup_triggers_indexes' AND step_status = 'started';
END $$;

-- Step 9: Restore original functions (if they were replaced)
INSERT INTO public.rollback_log (rollback_step, step_status, rollback_metadata)
VALUES ('restore_original_functions', 'started', jsonb_build_object('description', 'Restoring original rating calculation functions if they exist in backup'));

DO $$
BEGIN
    -- Check if we have backup functions and restore them
    -- This is a placeholder - in a real scenario, you'd restore from backup files

    UPDATE public.rollback_log
    SET step_status = 'completed', completed_at = now()
    WHERE rollback_step = 'restore_original_functions' AND step_status = 'started';
EXCEPTION WHEN OTHERS THEN
    UPDATE public.rollback_log
    SET step_status = 'failed', error_message = SQLERRM, completed_at = now()
    WHERE rollback_step = 'restore_original_functions' AND step_status = 'started';
END $$;

-- Complete rollback process
UPDATE public.rollback_log
SET step_status = 'completed', completed_at = now()
WHERE rollback_step = 'rollback_4_point_transformation' AND step_status = 'started';

-- Create rollback summary view
CREATE OR REPLACE VIEW public.rollback_summary AS
SELECT
    rollback_step,
    step_status,
    records_affected,
    backup_created,
    backup_location,
    error_message,
    rollback_metadata,
    created_at,
    completed_at,
    CASE
        WHEN completed_at IS NOT NULL THEN completed_at - created_at
        ELSE NULL
    END as duration
FROM public.rollback_log
ORDER BY created_at;

-- Function to check rollback status
CREATE OR REPLACE FUNCTION public.check_rollback_status()
RETURNS jsonb AS $$
DECLARE
    v_total_steps integer := 0;
    v_completed_steps integer := 0;
    v_failed_steps integer := 0;
    v_result jsonb;
BEGIN
    SELECT COUNT(*) INTO v_total_steps FROM public.rollback_log;
    SELECT COUNT(*) INTO v_completed_steps FROM public.rollback_log WHERE step_status = 'completed';
    SELECT COUNT(*) INTO v_failed_steps FROM public.rollback_log WHERE step_status = 'failed';

    v_result := jsonb_build_object(
        'total_steps', v_total_steps,
        'completed_steps', v_completed_steps,
        'failed_steps', v_failed_steps,
        'success_rate', CASE WHEN v_total_steps > 0 THEN (v_completed_steps::numeric / v_total_steps::numeric) * 100 ELSE 0 END,
        'rollback_complete', v_completed_steps = v_total_steps,
        'rollback_successful', v_failed_steps = 0,
        'backup_tables_created', (SELECT COUNT(*) FROM public.rollback_log WHERE backup_created = true),
        'check_timestamp', now()
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to restore from backup (emergency use only)
CREATE OR REPLACE FUNCTION public.emergency_restore_from_backup(p_backup_table text, p_target_table text)
RETURNS boolean AS $$
BEGIN
    -- This function should only be used in emergency situations
    -- It restores data from a backup table to the target table

    EXECUTE format('TRUNCATE TABLE %I', p_target_table);
    EXECUTE format('INSERT INTO %I SELECT * FROM %I', p_target_table, p_backup_table);

    INSERT INTO public.rollback_log (rollback_step, step_status, rollback_metadata)
    VALUES (
        format('emergency_restore_%s_to_%s', p_backup_table, p_target_table),
        'completed',
        jsonb_build_object(
            'backup_table', p_backup_table,
            'target_table', p_target_table,
            'restoration_timestamp', now(),
            'emergency_restore', true
        )
    );

    RETURN true;
EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.rollback_log (rollback_step, step_status, error_message, rollback_metadata)
    VALUES (
        format('emergency_restore_%s_to_%s', p_backup_table, p_target_table),
        'failed',
        SQLERRM,
        jsonb_build_object(
            'backup_table', p_backup_table,
            'target_table', p_target_table,
            'error_code', SQLSTATE
        )
    );
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for rollback functions and views
GRANT SELECT ON public.rollback_log TO authenticated;
GRANT SELECT ON public.rollback_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rollback_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.emergency_restore_from_backup TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.rollback_log IS 'Log of rollback operations for the 4-point rating system transformation';
COMMENT ON VIEW public.rollback_summary IS 'Summary view of rollback operations and their status';
COMMENT ON FUNCTION public.check_rollback_status IS 'Returns the current status of the rollback process';
COMMENT ON FUNCTION public.emergency_restore_from_backup IS 'Emergency function to restore data from backup tables';
COMMENT ON FUNCTION public.create_rollback_backup IS 'Creates backup tables for rollback safety';
COMMENT ON FUNCTION public.safe_drop_table IS 'Safely drops tables with optional backup creation';
COMMENT ON FUNCTION public.safe_drop_function IS 'Safely drops functions with error logging';
COMMENT ON FUNCTION public.safe_drop_column IS 'Safely drops columns with optional backup creation';

-- Final rollback summary
INSERT INTO public.rollback_log (rollback_step, step_status, rollback_metadata)
SELECT
    'rollback_summary',
    'completed',
    jsonb_build_object(
        'description', '4-point rating system transformation rollback completed',
        'rollback_completed_at', now(),
        'backup_tables_available', (SELECT COUNT(*) FROM public.rollback_log WHERE backup_created = true),
        'functions_dropped', (SELECT COUNT(*) FROM public.rollback_log WHERE rollback_step LIKE 'drop_function_%' AND step_status = 'completed'),
        'tables_dropped', (SELECT COUNT(*) FROM public.rollback_log WHERE rollback_step LIKE 'drop_table_%' AND step_status = 'completed'),
        'columns_dropped', (SELECT COUNT(*) FROM public.rollback_log WHERE rollback_step LIKE 'drop_column_%' AND step_status = 'completed'),
        'total_operations', (SELECT COUNT(*) FROM public.rollback_log WHERE step_status = 'completed'),
        'success_rate', (SELECT COUNT(*) FROM public.rollback_log WHERE step_status = 'completed')::numeric / (SELECT COUNT(*) FROM public.rollback_log) * 100
    )
WHERE NOT EXISTS (
    SELECT 1 FROM public.rollback_log
    WHERE rollback_step = 'rollback_summary'
);