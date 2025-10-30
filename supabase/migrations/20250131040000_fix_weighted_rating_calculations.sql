-- Fix Weighted Rating Calculations for 4-Point System
-- This migration adds the missing pieces to make the 4-point weighted rating system work correctly
-- It updates the weighting formula to use project_count * 0.10 as specified

-- Add 4-point rating columns to organiser_overall_expertise_ratings if they don't exist
DO $$
BEGIN
    -- Add 4-point rating column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organiser_overall_expertise_ratings'
        AND column_name = 'overall_rating_4point'
    ) THEN
        ALTER TABLE public.organiser_overall_expertise_ratings
        ADD COLUMN overall_rating_4point integer CHECK (overall_rating_4point BETWEEN 1 AND 4);
        RAISE NOTICE 'Added overall_rating_4point column to organiser_overall_expertise_ratings';
    END IF;

    -- Add 4-point score column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organiser_overall_expertise_ratings'
        AND column_name = 'overall_score_4point'
    ) THEN
        ALTER TABLE public.organiser_overall_expertise_ratings
        ADD COLUMN overall_score_4point numeric CHECK (overall_score_4point >= 1 AND overall_score_4point <= 4);
        RAISE NOTICE 'Added overall_score_4point column to organiser_overall_expertise_ratings';
    END IF;

    -- Add assessment responses JSON column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organiser_overall_expertise_ratings'
        AND column_name = 'assessment_responses_4point'
    ) THEN
        ALTER TABLE public.organiser_overall_expertise_ratings
        ADD COLUMN assessment_responses_4point jsonb DEFAULT '{}';
        RAISE NOTICE 'Added assessment_responses_4point column to organiser_overall_expertise_ratings';
    END IF;
END $$;

-- Drop the incorrect view if it exists
DROP VIEW IF EXISTS public.current_employer_ratings_4point;

-- Create the current employer ratings table
CREATE TABLE IF NOT EXISTS public.current_employer_ratings_4point (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    rating_date date NOT NULL DEFAULT CURRENT_DATE,

    -- Current rating (4-point system: 1=red, 2=amber, 3=yellow, 4=green)
    current_rating integer CHECK (current_rating BETWEEN 1 AND 4),
    current_score numeric CHECK (current_score >= 1 AND current_score <= 4),

    -- Component ratings
    eba_status_rating integer CHECK (eba_status_rating BETWEEN 1 AND 4),
    project_based_rating integer CHECK (project_based_rating BETWEEN 1 AND 4),
    expertise_rating integer CHECK (expertise_rating BETWEEN 1 AND 4),

    -- Component scores
    eba_status_score numeric CHECK (eba_status_score >= 1 AND eba_status_score <= 4),
    project_based_score numeric CHECK (project_based_score >= 1 AND project_based_score <= 4),
    expertise_score numeric CHECK (expertise_score >= 1 AND expertise_score <= 4),

    -- Quality and confidence indicators
    data_quality rating_confidence_level DEFAULT 'medium',
    expertise_confidence rating_confidence_level DEFAULT 'medium',
    project_data_quality rating_confidence_level DEFAULT 'medium',

    -- Weight distribution and calculation details
    rating_source text CHECK (rating_source IN ('project_only', 'expertise_only', 'hybrid', 'manual_override')) DEFAULT 'hybrid',
    weight_distribution jsonb DEFAULT '{}',
    calculation_audit jsonb DEFAULT '{}',

    -- Status and metadata
    rating_status text CHECK (rating_status IN ('active', 'pending_review', 'expired', 'under_dispute')) DEFAULT 'active',
    next_review_date date,
    expiry_date date DEFAULT (CURRENT_DATE + INTERVAL '6 months'),
    last_updated timestamp with time zone DEFAULT now(),
    updated_by uuid REFERENCES public.profiles(id),

    -- Data completeness indicators
    has_project_data boolean DEFAULT false,
    has_expertise_data boolean DEFAULT false,
    has_eba_data boolean DEFAULT false,
    data_completeness_score numeric CHECK (data_completeness_score >= 0 AND data_completeness_score <= 100),

    -- Timestamps
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,

    UNIQUE(employer_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_current_employer_ratings_4point_employer ON public.current_employer_ratings_4point(employer_id);
CREATE INDEX IF NOT EXISTS idx_current_employer_ratings_4point_rating ON public.current_employer_ratings_4point(current_rating, rating_status);
CREATE INDEX IF NOT EXISTS idx_current_employer_ratings_4point_date ON public.current_employer_ratings_4point(rating_date DESC);

-- Enable Row Level Security
ALTER TABLE public.current_employer_ratings_4point ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Current Employer Ratings 4Point - Read access for authenticated users" ON public.current_employer_ratings_4point
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Current Employer Ratings 4Point - Insert access for authenticated users" ON public.current_employer_ratings_4point
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            updated_by = auth.uid()
        )
    );

CREATE POLICY "Current Employer Ratings 4Point - Update access for authenticated users" ON public.current_employer_ratings_4point
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            updated_by = auth.uid()
        )
    );

-- Grant permissions
GRANT ALL ON public.current_employer_ratings_4point TO authenticated;

-- Create the main weighted rating calculation function with CORRECT weighting formula
CREATE OR REPLACE FUNCTION public.calculate_weighted_employer_rating_4point(
    p_employer_id uuid,
    p_calculation_date date DEFAULT CURRENT_DATE
) RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
    v_project_count integer := 0;
    v_project_weight numeric := 0.0;
    v_organiser_weight numeric := 0.0;
    v_project_rating numeric := 3.0; -- Default to yellow
    v_organiser_rating numeric := 3.0; -- Default to yellow
    v_final_rating numeric := 3.0;
    v_final_label text := 'yellow';
    v_weight_distribution jsonb;
    v_calculation_audit jsonb;
    v_eba_data jsonb;
    v_data_quality rating_confidence_level := 'very_low';
    v_latest_project_date date;
    v_latest_organiser_date date;
    v_project_assessments_exist boolean := false;
    v_organiser_assessments_exist boolean := false;
BEGIN
    -- Count project compliance assessments within the last 12 months
    SELECT COUNT(DISTINCT project_id)
    INTO v_project_count
    FROM public.project_compliance_assessments pca
    WHERE pca.employer_id = p_employer_id
      AND pca.assessment_date >= p_calculation_date - INTERVAL '12 months'
      AND pca.is_active = true;

    -- CORRECT WEIGHTING FORMULA: project_count * 0.10
    -- Cap at 90% project data, 10% organiser expertise minimum
    v_project_weight := LEAST(0.9, v_project_count::numeric * 0.10);
    v_organiser_weight := 1 - v_project_weight;

    -- Build weight distribution object
    v_weight_distribution := jsonb_build_object(
        'project_count', v_project_count,
        'project_weight', v_project_weight,
        'organiser_weight', v_organiser_weight,
        'weight_logic', format('Project count: %s. Project weight: MIN(0.9, %s * 0.10) = %s. Organiser weight: 1 - %s = %s',
            v_project_count, v_project_count, v_project_weight, v_project_weight, v_organiser_weight)
    );

    -- Get project-based rating
    IF v_project_count > 0 THEN
        -- Get latest project assessment data
        DECLARE
            v_avg_score numeric := 0;
            v_score_count integer := 0;
        BEGIN
            SELECT AVG((score + 100) / 50)::numeric, COUNT(*)
            INTO v_avg_score, v_score_count
            FROM public.project_compliance_assessments pca
            WHERE pca.employer_id = p_employer_id
              AND pca.assessment_date >= p_calculation_date - INTERVAL '12 months'
              AND pca.is_active = true
              AND pca.score IS NOT NULL;

            IF v_avg_score IS NOT NULL THEN
                -- Convert -100 to 100 scale to 1-4 scale
                v_project_rating := GREATEST(1, LEAST(4, ROUND(((v_avg_score - 1) / 3) + 1)));
            END IF;
        END;

        v_project_assessments_exist := true;
        SELECT MAX(assessment_date) INTO v_latest_project_date
        FROM public.project_compliance_assessments pca
        WHERE pca.employer_id = p_employer_id
          AND pca.assessment_date >= p_calculation_date - INTERVAL '12 months'
          AND pca.is_active = true;
    END IF;

    -- Get organiser expertise rating
    SELECT
        COALESCE(AVG(overall_score_4point), 3.0),
        MAX(assessment_date)
    INTO v_organiser_rating, v_latest_organiser_date
    FROM public.organiser_overall_expertise_ratings oea
    WHERE oea.employer_id = p_employer_id
      AND oea.assessment_date >= p_calculation_date - INTERVAL '6 months'
      AND oea.is_active = true
      AND oea.overall_score_4point IS NOT NULL;

    IF v_organiser_rating IS NOT NULL THEN
        v_organiser_assessments_exist := true;
        v_organiser_rating := GREATEST(1, LEAST(4, ROUND(v_organiser_rating)));
    END IF;

    -- Get EBA status for gating
    BEGIN
        DECLARE
            v_eba_status TEXT;
            v_eba_rating integer;
        BEGIN
            v_eba_status := public.get_employer_eba_status_4point(p_employer_id);
            v_eba_rating := public.get_employer_eba_rating_4point(p_employer_id);

            v_eba_data := jsonb_build_object(
                'status', v_eba_status,
                'rating', v_eba_rating,
                'score', v_eba_rating,
                'has_active_eba', v_eba_status != 'red'
            );
        END;
    EXCEPTION WHEN OTHERS THEN
        -- Functions don't exist, use default values
        v_eba_data := jsonb_build_object(
            'status', 'unknown',
            'rating', 3,
            'score', 3.0,
            'has_active_eba', false
        );
    END;

    -- Calculate final weighted rating
    v_final_rating := (v_project_rating * v_project_weight) + (v_organiser_rating * v_organiser_weight);
    v_final_rating := GREATEST(1, LEAST(4, ROUND(v_final_rating)));

    -- Apply EBA gating: EBA status determines the maximum possible rating
    DECLARE
        v_eba_status TEXT;
    BEGIN
        v_eba_status := (v_eba_data->>'status')::TEXT;

        IF v_eba_status = 'red' OR v_eba_status IS NULL THEN
            -- No EBA = maximum rating is amber (2)
            v_final_rating := LEAST(v_final_rating, 2);
        ELSIF v_eba_status = 'amber' THEN
            -- Expired/poor EBA = maximum rating is yellow (3)
            v_final_rating := LEAST(v_final_rating, 3);
        ELSIF v_eba_status = 'yellow' THEN
            -- Current EBA = no additional restriction (can be green)
            NULL;
        ELSE
            -- Unknown status = conservative approach, cap at amber
            v_final_rating := LEAST(v_final_rating, 2);
        END IF;
    END;

    -- Convert to label
    CASE v_final_rating
        WHEN 1 THEN v_final_label := 'red';
        WHEN 2 THEN v_final_label := 'amber';
        WHEN 3 THEN v_final_label := 'yellow';
        WHEN 4 THEN v_final_label := 'green';
        ELSE v_final_label := 'red';
    END CASE;

    -- Determine overall data quality
    IF v_project_assessments_exist AND v_organiser_assessments_exist THEN
        IF v_project_count >= 3 AND (p_calculation_date - v_latest_project_date) <= 60 AND (p_calculation_date - v_latest_organiser_date) <= 60 THEN
            v_data_quality := 'high';
        ELSIF v_project_count >= 1 AND (p_calculation_date - v_latest_project_date) <= 90 AND (p_calculation_date - v_latest_organiser_date) <= 90 THEN
            v_data_quality := 'medium';
        ELSE
            v_data_quality := 'low';
        END IF;
    ELSIF v_project_assessments_exist OR v_organiser_assessments_exist THEN
        v_data_quality := 'low';
    ELSE
        v_data_quality := 'very_low';
    END IF;

    -- Build calculation audit trail
    v_calculation_audit := jsonb_build_object(
        'calculation_date', p_calculation_date,
        'weight_distribution', v_weight_distribution,
        'project_data', jsonb_build_object(
            'project_count', v_project_count,
            'project_rating', v_project_rating,
            'project_weight', v_project_weight,
            'latest_project_date', v_latest_project_date,
            'assessments_exist', v_project_assessments_exist
        ),
        'organiser_data', jsonb_build_object(
            'organiser_rating', v_organiser_rating,
            'organiser_weight', v_organiser_weight,
            'latest_organiser_date', v_latest_organiser_date,
            'assessments_exist', v_organiser_assessments_exist
        ),
        'calculation', jsonb_build_object(
            'project_contribution', v_project_rating * v_project_weight,
            'organiser_contribution', v_organiser_rating * v_organiser_weight,
            'weighted_score_before_eba_gating', (v_project_rating * v_project_weight) + (v_organiser_rating * v_organiser_weight),
            'final_weighted_score', v_final_rating,
            'final_rating_label', v_final_label,
            'eba_gating_applied', CASE
                WHEN (v_eba_data->>'status')::TEXT = 'red' OR (v_eba_data->>'status')::TEXT IS NULL THEN true
                WHEN (v_eba_data->>'status')::TEXT = 'amber' THEN true
                ELSE false
            END,
            'eba_max_rating_allowed', CASE
                WHEN (v_eba_data->>'status')::TEXT = 'red' OR (v_eba_data->>'status')::TEXT IS NULL THEN 2
                WHEN (v_eba_data->>'status')::TEXT = 'amber' THEN 3
                ELSE 4
            END
        ),
        'eba_data', v_eba_data,
        'data_quality', v_data_quality
    );

    -- Build final result
    v_result := jsonb_build_object(
        'employer_id', p_employer_id,
        'calculation_date', p_calculation_date,
        'final_rating', v_final_label,
        'final_score', v_final_rating,

        -- Component data
        'project_rating', v_project_rating,
        'project_score', v_project_rating,
        'project_weight', v_project_weight,
        'organiser_rating', v_organiser_rating,
        'organiser_score', v_organiser_rating,
        'organiser_weight', v_organiser_weight,

        -- Quality indicators
        'data_quality', v_data_quality,
        'project_assessments_exist', v_project_assessments_exist,
        'organiser_assessments_exist', v_organiser_assessments_exist,

        -- Audit trail
        'weight_distribution', v_weight_distribution,
        'calculation_audit', v_calculation_audit,

        -- EBA data
        'eba_data', v_eba_data,

        -- Metadata
        'calculated_at', now(),
        'calculation_version', '4point_v1.1_corrected'
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to upsert current employer rating
CREATE OR REPLACE FUNCTION public.upsert_current_employer_rating_4point(
    p_employer_id uuid,
    p_rating_source text DEFAULT 'hybrid',
    p_updated_by uuid DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
    v_rating_id uuid;
    v_weighted_rating jsonb;
    v_current_rating integer;
    v_current_score numeric;
    v_data_quality rating_confidence_level;
BEGIN
    -- Calculate weighted rating using the 4-point system
    v_weighted_rating := public.calculate_weighted_employer_rating_4point(p_employer_id);

    -- Extract rating information
    v_current_score := (v_weighted_rating->>'final_score')::numeric;
    v_current_rating := CASE
        WHEN (v_weighted_rating->>'final_rating') = 'green' THEN 4
        WHEN (v_weighted_rating->>'final_rating') = 'yellow' THEN 3
        WHEN (v_weighted_rating->>'final_rating') = 'amber' THEN 2
        WHEN (v_weighted_rating->>'final_rating') = 'red' THEN 1
        ELSE 3 -- Default to yellow
    END;

    v_data_quality := (v_weighted_rating->>'data_quality')::rating_confidence_level;

    -- Upsert the current rating
    INSERT INTO public.current_employer_ratings_4point (
        employer_id,
        rating_date,
        current_rating,
        current_score,

        -- Component ratings
        eba_status_rating,
        project_based_rating,
        expertise_rating,

        -- Component scores
        eba_status_score,
        project_based_score,
        expertise_score,

        -- Quality indicators
        data_quality,
        expertise_confidence,
        project_data_quality,

        -- Calculation details
        rating_source,
        weight_distribution,
        calculation_audit,

        -- Status
        rating_status,
        next_review_date,
        last_updated,
        updated_by,

        -- Data completeness
        has_project_data,
        has_expertise_data,
        has_eba_data,
        data_completeness_score,

        updated_at
    ) VALUES (
        p_employer_id,
        CURRENT_DATE,
        v_current_rating,
        v_current_score,

        -- Component ratings from weighted calculation
        COALESCE((v_weighted_rating->'eba_data'->>'rating')::integer, 3),
        COALESCE((v_weighted_rating->>'project_rating')::integer, 3),
        COALESCE((v_weighted_rating->>'organiser_rating')::integer, 3),

        -- Component scores
        COALESCE((v_weighted_rating->'eba_data'->>'score')::numeric, 3.0),
        COALESCE((v_weighted_rating->>'project_score')::numeric, 3.0),
        COALESCE((v_weighted_rating->>'organiser_score')::numeric, 3.0),

        -- Quality indicators
        v_data_quality,
        v_data_quality, -- Simplified for now
        v_data_quality, -- Simplified for now

        -- Calculation details
        p_rating_source,
        v_weighted_rating->>'weight_distribution',
        v_weighted_rating->>'calculation_audit',

        -- Status
        CASE WHEN v_data_quality = 'very_low' THEN 'pending_review' ELSE 'active' END,
        CASE
            WHEN v_data_quality = 'very_low' THEN CURRENT_DATE + INTERVAL '30 days'
            WHEN v_data_quality = 'low' THEN CURRENT_DATE + INTERVAL '60 days'
            WHEN v_data_quality = 'medium' THEN CURRENT_DATE + INTERVAL '90 days'
            ELSE CURRENT_DATE + INTERVAL '180 days'
        END,
        now(),
        p_updated_by,

        -- Data completeness
        COALESCE((v_weighted_rating->>'project_assessments_exist')::boolean, false),
        COALESCE((v_weighted_rating->>'organiser_assessments_exist')::boolean, false),
        COALESCE((v_weighted_rating->'eba_data'->>'has_active_eba')::boolean, false),
        -- Calculate completeness score based on available data
        CASE
            WHEN COALESCE((v_weighted_rating->>'project_assessments_exist')::boolean, false) AND
                 COALESCE((v_weighted_rating->>'organiser_assessments_exist')::boolean, false) AND
                 COALESCE((v_weighted_rating->'eba_data'->>'has_active_eba')::boolean, false) THEN 100
            WHEN COALESCE((v_weighted_rating->>'project_assessments_exist')::boolean, false) OR
                 COALESCE((v_weighted_rating->>'organiser_assessments_exist')::boolean, false) THEN 66
            ELSE 33
        END,

        now()
    )
    ON CONFLICT (employer_id)
    DO UPDATE SET
        rating_date = EXCLUDED.rating_date,
        current_rating = EXCLUDED.current_rating,
        current_score = EXCLUDED.current_score,

        -- Component ratings
        eba_status_rating = EXCLUDED.eba_status_rating,
        project_based_rating = EXCLUDED.project_based_rating,
        expertise_rating = EXCLUDED.expertise_rating,

        -- Component scores
        eba_status_score = EXCLUDED.eba_status_score,
        project_based_score = EXCLUDED.project_based_score,
        expertise_score = EXCLUDED.expertise_score,

        -- Quality indicators
        data_quality = EXCLUDED.data_quality,
        expertise_confidence = EXCLUDED.expertise_confidence,
        project_data_quality = EXCLUDED.project_data_quality,

        -- Calculation details
        rating_source = EXCLUDED.rating_source,
        weight_distribution = EXCLUDED.weight_distribution,
        calculation_audit = EXCLUDED.calculation_audit,

        -- Status
        rating_status = EXCLUDED.rating_status,
        next_review_date = EXCLUDED.next_review_date,
        last_updated = EXCLUDED.last_updated,
        updated_by = EXCLUDED.updated_by,

        -- Data completeness
        has_project_data = EXCLUDED.has_project_data,
        has_expertise_data = EXCLUDED.has_expertise_data,
        has_eba_data = EXCLUDED.has_eba_data,
        data_completeness_score = EXCLUDED.data_completeness_score,

        updated_at = now()
    RETURNING id INTO v_rating_id;

    RETURN v_rating_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for updated_at
CREATE TRIGGER update_current_employer_ratings_4point_updated_at
    BEFORE UPDATE ON public.current_employer_ratings_4point
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant function permissions
GRANT EXECUTE ON FUNCTION public.calculate_weighted_employer_rating_4point TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_current_employer_rating_4point TO authenticated;

-- Add comments
COMMENT ON TABLE public.current_employer_ratings_4point IS 'Current/most recent 4-point ratings for each employer with fast lookup capabilities';
COMMENT ON FUNCTION public.calculate_weighted_employer_rating_4point IS 'Main weighted rating calculation function with CORRECT formula: project_weight = MIN(0.9, project_count * 0.10)';
COMMENT ON FUNCTION public.upsert_current_employer_rating_4point IS 'Upserts current employer rating using weighted 4-point calculation';

-- Migration completed successfully