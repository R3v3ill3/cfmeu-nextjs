-- Create Current Employer Ratings 4-Point Table
-- This table stores the current/most recent 4-point ratings for each employer
-- and serves as a fast lookup table for the frontend

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
CREATE INDEX IF NOT EXISTS idx_current_employer_ratings_4point_expiry ON public.current_employer_ratings_4point(expiry_date);
CREATE INDEX IF NOT EXISTS idx_current_employer_ratings_4point_updated ON public.current_employer_ratings_4point(last_updated DESC);

-- Enable Row Level Security
ALTER TABLE public.current_employer_ratings_4point ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Current Employer Ratings 4Point - Read access for authenticated users" ON public.current_employer_ratings_4point
    FOR SELECT USING (
        auth.role() = 'authenticated'
    );

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
    v_expires_on date;
BEGIN
    -- Calculate weighted rating using the 4-point system
    v_weighted_rating := public.calculate_weighted_employer_rating_4point(p_employer_id);

    -- Extract rating information
    v_current_score := (v_weighted_rating->>'final_score')::numeric;
    v_current_rating := (v_weighted_rating->>'final_rating')::integer;
    v_data_quality := (v_weighted_rating->>'data_quality')::rating_confidence_level;

    -- Set expiry date (6 months from now)
    v_expires_on := CURRENT_DATE + INTERVAL '6 months';

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
        expiry_date,
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
        (v_weighted_rating->'eba_data'->>'rating')::integer,
        (v_weighted_rating->>'project_rating')::integer,
        (v_weighted_rating->>'organiser_rating')::integer,

        -- Component scores
        (v_weighted_rating->'eba_data'->>'score')::numeric,
        (v_weighted_rating->>'project_rating')::numeric,
        (v_weighted_rating->>'organiser_rating')::numeric,

        -- Quality indicators
        v_data_quality,
        (v_weighted_rating->>'expertise_data'->>'confidence_level')::rating_confidence_level,
        (v_weighted_rating->>'project_data'->>'data_quality')::rating_confidence_level,

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
        v_expires_on,
        now(),
        p_updated_by,

        -- Data completeness
        (v_weighted_rating->>'project_assessments_exist')::boolean,
        (v_weighted_rating->>'organiser_assessments_exist')::boolean,
        (v_weighted_rating->'eba_data'->>'has_active_eba')::boolean,
        -- Calculate completeness score based on available data
        CASE
            WHEN (v_weighted_rating->>'project_assessments_exist')::boolean AND
                 (v_weighted_rating->>'organiser_assessments_exist')::boolean AND
                 (v_weighted_rating->'eba_data'->>'has_active_eba')::boolean THEN 100
            WHEN (v_weighted_rating->>'project_assessments_exist')::boolean OR
                 (v_weighted_rating->>'organiser_assessments_exist')::boolean THEN 66
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
        expiry_date = EXCLUDED.expiry_date,
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

-- Create function to get current rating for an employer
CREATE OR REPLACE FUNCTION public.get_current_employer_rating_4point(
    p_employer_id uuid
) RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
    v_current_rating public.current_employer_ratings_4point%ROWTYPE;
BEGIN
    -- Get current rating
    SELECT * INTO v_current_rating
    FROM public.current_employer_ratings_4point
    WHERE employer_id = p_employer_id
      AND rating_status = 'active'
      AND expiry_date >= CURRENT_DATE
    ORDER BY last_updated DESC
    LIMIT 1;

    IF v_current_rating.id IS NULL THEN
        -- No active rating found, try to calculate one
        DECLARE
            v_new_rating_id uuid;
        BEGIN
            v_new_rating_id := public.upsert_current_employer_rating_4point(p_employer_id, 'auto_calculation');

            -- Fetch the newly created rating
            SELECT * INTO v_current_rating
            FROM public.current_employer_ratings_4point
            WHERE id = v_new_rating_id;
        END;
    END IF;

    IF v_current_rating.id IS NOT NULL THEN
        v_result := jsonb_build_object(
            'id', v_current_rating.id,
            'employer_id', v_current_rating.employer_id,
            'rating_date', v_current_rating.rating_date,
            'current_rating', v_current_rating.current_rating,
            'current_score', v_current_rating.current_score,

            -- Component ratings
            'eba_status_rating', v_current_rating.eba_status_rating,
            'project_based_rating', v_current_rating.project_based_rating,
            'expertise_rating', v_current_rating.expertise_rating,

            -- Component scores
            'eba_status_score', v_current_rating.eba_status_score,
            'project_based_score', v_current_rating.project_based_score,
            'expertise_score', v_current_rating.expertise_score,

            -- Quality indicators
            'data_quality', v_current_rating.data_quality,
            'expertise_confidence', v_current_rating.expertise_confidence,
            'project_data_quality', v_current_rating.project_data_quality,

            -- Calculation details
            'rating_source', v_current_rating.rating_source,
            'weight_distribution', v_current_rating.weight_distribution,
            'calculation_audit', v_current_rating.calculation_audit,

            -- Status
            'rating_status', v_current_rating.rating_status,
            'next_review_date', v_current_rating.next_review_date,
            'expiry_date', v_current_rating.expiry_date,
            'last_updated', v_current_rating.last_updated,

            -- Data completeness
            'has_project_data', v_current_rating.has_project_data,
            'has_expertise_data', v_current_rating.has_expertise_data,
            'has_eba_data', v_current_rating.has_eba_data,
            'data_completeness_score', v_current_rating.data_completeness_score,

            'updated_by', v_current_rating.updated_by,
            'retrieved_at', now()
        );
    ELSE
        v_result := jsonb_build_object(
            'employer_id', p_employer_id,
            'current_rating', NULL,
            'current_score', NULL,
            'message', 'No rating available for this employer',
            'retrieved_at', now()
        );
    END IF;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to refresh all current ratings (for maintenance/cron jobs)
CREATE OR REPLACE FUNCTION public.refresh_all_current_ratings_4point(
    p_force_refresh boolean DEFAULT false,
    p_limit integer DEFAULT 100
) RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
    v_updated_count integer := 0;
    v_failed_count integer := 0;
    v_skipped_count integer := 0;
    v_employers_updated uuid[] := '{}';
    v_employers_failed uuid[] := '{}';
    rec RECORD;
BEGIN
    -- Get employers that need rating updates
    FOR rec IN
        SELECT DISTINCT e.id, e.name
        FROM public.employers e
        LEFT JOIN public.current_employer_ratings_4point cer ON e.id = cer.employer_id
        WHERE p_force_refresh = true
           OR cer.id IS NULL
           OR cer.last_updated < CURRENT_DATE - INTERVAL '7 days'
           OR cer.expiry_date < CURRENT_DATE + INTERVAL '30 days'
        ORDER BY e.name
        LIMIT p_limit
    LOOP
        BEGIN
            -- Try to update the rating
            PERFORM public.upsert_current_employer_rating_4point(rec.id, 'scheduled_refresh');
            v_updated_count := v_updated_count + 1;
            v_employers_updated := v_employers_updated || rec.id;
        EXCEPTION WHEN OTHERS THEN
            v_failed_count := v_failed_count + 1;
            v_employers_failed := v_employers_failed || rec.id;
        END;
    END LOOP;

    -- Calculate skipped count
    v_skipped_count := p_limit - (v_updated_count + v_failed_count);

    -- Build result
    v_result := jsonb_build_object(
        'refresh_completed', true,
        'total_processed', v_updated_count + v_failed_count + v_skipped_count,
        'updated_count', v_updated_count,
        'failed_count', v_failed_count,
        'skipped_count', v_skipped_count,
        'employers_updated', v_employers_updated,
        'employers_failed', v_employers_failed,
        'refresh_type', CASE WHEN p_force_refresh THEN 'force_refresh' ELSE 'scheduled_refresh' END,
        'processed_at', now(),
        'limit_applied', p_limit
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for updated_at
CREATE TRIGGER update_current_employer_ratings_4point_updated_at
    BEFORE UPDATE ON public.current_employer_ratings_4point
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant function permissions
GRANT EXECUTE ON FUNCTION public.upsert_current_employer_rating_4point TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_employer_rating_4point TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_all_current_ratings_4point TO authenticated;

-- Add comments
COMMENT ON TABLE public.current_employer_ratings_4point IS 'Current/most recent 4-point ratings for each employer with fast lookup capabilities';
COMMENT ON FUNCTION public.upsert_current_employer_rating_4point IS 'Upserts current employer rating using weighted 4-point calculation';
COMMENT ON FUNCTION public.get_current_employer_rating_4point IS 'Retrieves current 4-point rating for an employer, calculates if needed';
COMMENT ON FUNCTION public.refresh_all_current_ratings_4point IS 'Refreshes multiple current ratings for maintenance operations';

-- Migration completed successfully