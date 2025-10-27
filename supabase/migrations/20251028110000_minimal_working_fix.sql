-- Minimal Working Fix - Only add what's needed for UI to work
-- This migration adds just the essential types and columns needed

-- Step 1: Add missing enum types safely
DO $$
BEGIN
    -- Add four_point_rating enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'four_point_rating') THEN
        CREATE TYPE public.four_point_rating AS ENUM (
            'poor',
            'fair',
            'good',
            'excellent'
        );
        RAISE NOTICE 'Created four_point_rating enum';
    END IF;

    -- Add rating_confidence_level enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rating_confidence_level') THEN
        CREATE TYPE public.rating_confidence_level AS ENUM (
            'very_high',
            'high',
            'medium',
            'low'
        );
        RAISE NOTICE 'Created rating_confidence_level enum';
    END IF;

    -- Add assessment_context enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_context') THEN
        CREATE TYPE public.assessment_context AS ENUM (
            'trade_specific',
            'builder_specific',
            'general',
            'mixed_project'
        );
        RAISE NOTICE 'Created assessment_context enum';
    END IF;

    -- Add employer_role_type enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employer_role_type') THEN
        CREATE TYPE public.employer_role_type AS ENUM (
            'trade',
            'builder',
            'both',
            'unknown'
        );
        RAISE NOTICE 'Created employer_role_type enum';
    END IF;
END $$;

-- Step 2: Add columns to employers table if they don't exist
DO $$
BEGIN
    -- Add role_type column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employers' AND column_name = 'role_type'
    ) THEN
        ALTER TABLE public.employers
        ADD COLUMN role_type employer_role_type DEFAULT 'unknown';
        RAISE NOTICE 'Added employers.role_type column';
    END IF;

    -- Add role_confidence_level column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employers' AND column_name = 'role_confidence_level'
    ) THEN
        ALTER TABLE public.employers
        ADD COLUMN role_confidence_level rating_confidence_level DEFAULT 'low';
        RAISE NOTICE 'Added employers.role_confidence_level column';
    END IF;

    -- Add overall_union_respect_rating column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employers' AND column_name = 'overall_union_respect_rating'
    ) THEN
        ALTER TABLE public.employers
        ADD COLUMN overall_union_respect_rating four_point_rating;
        RAISE NOTICE 'Added employers.overall_union_respect_rating column';
    END IF;

    -- Add overall_safety_rating column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employers' AND column_name = 'overall_safety_rating'
    ) THEN
        ALTER TABLE public.employers
        ADD COLUMN overall_safety_rating four_point_rating;
        RAISE NOTICE 'Added employers.overall_safety_rating column';
    END IF;
END $$;

-- Step 3: Create basic union_respect_assessments table (simplified)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'union_respect_assessments') THEN
        CREATE TABLE public.union_respect_assessments (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
            project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
            assessment_date date NOT NULL DEFAULT CURRENT_DATE,
            assessment_context assessment_context NOT NULL DEFAULT 'general',

            -- Simple rating fields (can be expanded later)
            union_engagement four_point_rating,
            communication_respect four_point_rating,
            collaboration_attitude four_point_rating,
            dispute_resolution four_point_rating,
            union_delegate_relations four_point_rating,

            -- Metadata
            notes text,
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            updated_at timestamp with time zone DEFAULT now() NOT NULL,
            created_by uuid REFERENCES public.profiles(id)
        );

        -- Add RLS
        ALTER TABLE public.union_respect_assessments ENABLE ROW LEVEL SECURITY;

        RAISE NOTICE 'Created union_respect_assessments table';
    END IF;
END $$;

-- Step 4: Create basic safety_assessments table (simplified)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'safety_assessments') THEN
        CREATE TABLE public.safety_assessments (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
            project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
            assessment_date date NOT NULL DEFAULT CURRENT_DATE,
            assessment_context assessment_context NOT NULL DEFAULT 'general',

            -- Simple rating fields
            hsr_respect four_point_rating,
            general_safety four_point_rating,
            safety_incidents four_point_rating,

            -- Metadata
            notes text,
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            updated_at timestamp with time zone DEFAULT now() NOT NULL,
            created_by uuid REFERENCES public.profiles(id)
        );

        -- Add RLS
        ALTER TABLE public.safety_assessments ENABLE ROW LEVEL SECURITY;

        RAISE NOTICE 'Created safety_assessments table';
    END IF;
END $$;

-- Step 5: Grant permissions
GRANT ALL ON public.union_respect_assessments TO authenticated;
GRANT ALL ON public.safety_assessments TO authenticated;
GRANT USAGE ON SEQUENCE union_respect_assessments_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE safety_assessments_id_seq TO authenticated;

RAISE NOTICE '=== MINIMAL WORKING FIX COMPLETE ===';
RAISE NOTICE 'UI should now work with these basic tables and types';
RAISE NOTICE 'Complex data migrations can be added later when needed';