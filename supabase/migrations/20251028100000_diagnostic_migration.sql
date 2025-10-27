-- Diagnostic Migration - Identify exact migration issues
-- This migration will help identify what's causing the failures

-- Check what project_type values actually exist
DO $$
DECLARE
    v_existing_types text[];
    v_enum_values text[];
BEGIN
    -- Get existing project_type values from projects table
    BEGIN
        SELECT array_agg(DISTINCT project_type) INTO v_existing_types
        FROM public.projects
        WHERE project_type IS NOT NULL;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not query projects table: %', SQLERRM;
        v_existing_types := ARRAY[]::text[];
    END;

    -- Get enum values
    BEGIN
        SELECT array_agg(enumlabel) INTO v_enum_values
        FROM pg_enum
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'project_type';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not query project_type enum: %', SQLERRM;
        v_enum_values := ARRAY[]::text[];
    END;

    RAISE NOTICE '=== DIAGNOSTIC RESULTS ===';
    RAISE NOTICE 'Existing project_type values in projects table: %', v_existing_types;
    RAISE NOTICE 'Valid project_type enum values: %', v_enum_values;

    -- Check for invalid values
    IF v_existing_types IS NOT NULL AND v_enum_values IS NOT NULL THEN
        FOR i IN 1..array_length(v_existing_types, 1) LOOP
            IF NOT (v_existing_types[i] = ANY(v_enum_values)) THEN
                RAISE NOTICE 'INVALID project_type found: %', v_existing_types[i];
            END IF;
        END LOOP;
    END IF;
END $$;

-- Check what tables and functions exist
DO $$
BEGIN
    RAISE NOTICE '=== TABLE AND FUNCTION STATUS ===';

    -- Check if rating_migration_log exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rating_migration_log') THEN
        RAISE NOTICE '✓ rating_migration_log table exists';
    ELSE
        RAISE NOTICE '✗ rating_migration_log table missing';
    END IF;

    -- Check if union_respect_assessments exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'union_respect_assessments') THEN
        RAISE NOTICE '✓ union_respect_assessments table exists';
    ELSE
        RAISE NOTICE '✗ union_respect_assessments table missing';
    END IF;

    -- Check if infer_employer_role function exists
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'infer_employer_role') THEN
        RAISE NOTICE '✓ infer_employer_role function exists';
    ELSE
        RAISE NOTICE '✗ infer_employer_role function missing';
    END IF;

    -- Check if employers table has role_type column
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employers' AND column_name = 'role_type') THEN
        RAISE NOTICE '✓ employers.role_type column exists';
    ELSE
        RAISE NOTICE '✗ employers.role_type column missing';
    END IF;

    -- Check if four_point_rating enum exists
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'four_point_rating') THEN
        RAISE NOTICE '✓ four_point_rating enum exists';
    ELSE
        RAISE NOTICE '✗ four_point_rating enum missing';
    END IF;

    -- Check if rating_confidence_level enum exists
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rating_confidence_level') THEN
        RAISE NOTICE '✓ rating_confidence_level enum exists';
    ELSE
        RAISE NOTICE '✗ rating_confidence_level enum missing';
    END IF;

END $$;

-- Check migration log status
DO $$
BEGIN
    RAISE NOTICE '=== MIGRATION LOG STATUS ===';

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rating_migration_log') THEN
        RAISE NOTICE 'Recent migration entries:';
        FOR rec IN
            SELECT migration_step, step_status, created_at, completed_at, error_message
            FROM public.rating_migration_log
            ORDER BY created_at DESC
            LIMIT 5
        LOOP
            RAISE NOTICE '- %: % (created: %, completed: %)',
                rec.migration_step,
                rec.step_status,
                rec.created_at,
                rec.completed_at;
            IF rec.error_message IS NOT NULL THEN
                RAISE NOTICE '  Error: %', rec.error_message;
            END IF;
        END LOOP;
    END IF;
END $$;

RAISE NOTICE '=== DIAGNOSTIC COMPLETE ===';