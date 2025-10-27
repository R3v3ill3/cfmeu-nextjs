-- Fix Migration Dependencies and Add Missing Types
-- This migration fixes the dependencies that were causing migrations to fail

-- First, let's add missing enum types if they don't exist
DO $$
BEGIN
    -- Create rating_confidence_level enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rating_confidence_level') THEN
        CREATE TYPE public.rating_confidence_level AS ENUM (
            'very_high',
            'high',
            'medium',
            'low'
        );
    END IF;

    -- Create assessment_status enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_status') THEN
        CREATE TYPE public.assessment_status AS ENUM (
            'draft',
            'in_progress',
            'completed',
            'reviewed',
            'approved'
        );
    END IF;

    -- Create role_type enum for employers if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employer_role_type') THEN
        CREATE TYPE public.employer_role_type AS ENUM (
            'trade',
            'builder',
            'both',
            'unknown'
        );
    END IF;
END $$;

-- Add role_type column to employers table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employers' AND column_name = 'role_type'
    ) THEN
        ALTER TABLE public.employers
        ADD COLUMN role_type employer_role_type DEFAULT 'unknown';
    END IF;
END $$;

-- Add role_confidence_level column to employers table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employers' AND column_name = 'role_confidence_level'
    ) THEN
        ALTER TABLE public.employers
        ADD COLUMN role_confidence_level rating_confidence_level DEFAULT 'low';
    END IF;
END $$;

-- Create migration tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.rating_migration_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    migration_step text NOT NULL,
    step_status text NOT NULL CHECK (step_status IN ('started', 'completed', 'failed', 'skipped')),
    records_processed integer DEFAULT 0,
    records_created integer DEFAULT 0,
    records_updated integer DEFAULT 0,
    error_message text,
    migration_metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);

-- Grant permissions to authenticated users
GRANT ALL ON public.rating_migration_log TO authenticated;
GRANT USAGE ON SEQUENCE rating_migration_log_id_seq TO authenticated;

-- Add comment
COMMENT ON TABLE public.rating_migration_log IS 'Tracks the progress of rating system migration steps';

-- Log successful fix
INSERT INTO public.rating_migration_log (
    migration_step,
    step_status,
    records_processed,
    records_created,
    migration_metadata
) VALUES (
    'fix_migration_dependencies',
    'completed',
    1,
    0,
    jsonb_build_object(
        'fix_timestamp', now(),
        'types_created', ARRAY['rating_confidence_level', 'assessment_status', 'employer_role_type'],
        'columns_added', ARRAY['role_type', 'role_confidence_level']
    )
);

RAISE NOTICE 'Migration dependencies fixed successfully';