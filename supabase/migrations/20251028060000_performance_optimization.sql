-- CFMEU Rating System Transformation - Performance Optimization
-- This migration creates performance indexes and materialized views
-- to optimize database performance for the 4-point rating system

-- Create composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_union_respect_assessments_composite
ON public.union_respect_assessments(employer_id, assessment_date DESC, assessment_context, is_active)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_safety_assessments_4_point_composite
ON public.safety_assessments_4_point(employer_id, assessment_date DESC, assessment_context, is_active)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_subcontractor_use_assessments_composite
ON public.subcontractor_use_assessments(employer_id, assessment_date DESC, assessment_context, is_active)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_role_specific_assessments_composite
ON public.role_specific_assessments(employer_id, assessment_date DESC, employer_role, is_active)
WHERE is_active = true;

-- Create partial indexes for active assessments only
CREATE INDEX IF NOT EXISTS idx_union_respect_assessments_active
ON public.union_respect_assessments(employer_id, assessment_date DESC)
WHERE is_active = true AND assessment_complete = true;

CREATE INDEX IF NOT EXISTS idx_safety_assessments_4_point_active
ON public.safety_assessments_4_point(employer_id, assessment_date DESC)
WHERE is_active = true AND assessment_complete = true;

CREATE INDEX IF NOT EXISTS idx_subcontractor_use_assessments_active
ON public.subcontractor_use_assessments(employer_id, assessment_date DESC)
WHERE is_active = true AND assessment_complete = true;

CREATE INDEX IF NOT EXISTS idx_role_specific_assessments_active
ON public.role_specific_assessments(employer_id, assessment_date DESC)
WHERE is_active = true AND assessment_complete = true;

-- Create indexes for employer rating queries
CREATE INDEX IF NOT EXISTS idx_employers_4_point_ratings
ON public.employers(role_type, overall_union_respect_rating, overall_safety_rating, overall_subcontractor_rating)
WHERE role_type != 'unknown';

CREATE INDEX IF NOT EXISTS idx_employers_rating_quality
ON public.employers(rating_data_quality_score DESC, last_4_point_rating_calculation DESC)
WHERE rating_data_quality_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employers_assessment_coverage
ON public.employers(assessment_coverage_percentage DESC, latest_assessment_date DESC)
WHERE assessment_coverage_percentage IS NOT NULL;

-- Create function-based indexes for rating calculations
CREATE INDEX IF NOT EXISTS idx_union_respect_overall_score_gin
ON public.union_respect_assessments USING GIN(overall_union_respect_score)
WHERE overall_union_respect_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_safety_overall_score_gin
ON public.safety_assessments_4_point USING GIN(overall_safety_score)
WHERE overall_safety_score IS NOT NULL;

-- Materialized Views for Performance Optimization

-- Employer 4-Point Rating Summary View
CREATE MATERIALIZED VIEW IF NOT EXISTS public.employer_4_point_rating_summary AS
SELECT
    e.id as employer_id,
    e.name as employer_name,
    e.role_type,

    -- Latest 4-point ratings
    e.overall_union_respect_rating,
    e.overall_union_respect_score,
    e.overall_safety_rating,
    e.overall_safety_score,
    e.overall_subcontractor_rating,
    e.overall_subcontractor_score,

    -- Rating metadata
    e.last_4_point_rating_calculation,
    e.rating_data_quality_score,
    e.assessment_coverage_percentage,
    e.next_rating_review_date,

    -- Assessment counts
    e.total_union_respect_assessments,
    e.total_safety_assessments,
    e.total_subcontractor_assessments,
    e.total_role_specific_assessments,
    e.latest_assessment_date,

    -- Latest assessment dates by type
    (SELECT MAX(assessment_date)
     FROM public.union_respect_assessments
     WHERE employer_id = e.id AND is_active = true) as latest_union_respect_date,

    (SELECT MAX(assessment_date)
     FROM public.safety_assessments_4_point
     WHERE employer_id = e.id AND is_active = true) as latest_safety_date,

    (SELECT MAX(assessment_date)
     FROM public.subcontractor_use_assessments
     WHERE employer_id = e.id AND is_active = true) as latest_subcontractor_date,

    (SELECT MAX(assessment_date)
     FROM public.role_specific_assessments
     WHERE employer_id = e.id AND is_active = true) as latest_role_specific_date,

    -- Data quality indicators
    CASE
        WHEN e.rating_data_quality_score >= 80 THEN 'high'
        WHEN e.rating_data_quality_score >= 60 THEN 'medium'
        WHEN e.rating_data_quality_score >= 40 THEN 'low'
        ELSE 'very_low'
    END as data_quality_level,

    -- Overall 4-point assessment status
    CASE
        WHEN e.assessment_coverage_percentage >= 90 THEN 'comprehensive'
        WHEN e.assessment_coverage_percentage >= 70 THEN 'substantial'
        WHEN e.assessment_coverage_percentage >= 50 THEN 'partial'
        WHEN e.assessment_coverage_percentage >= 30 THEN 'minimal'
        ELSE 'insufficient'
    END as assessment_status,

    -- Timestamps
    e.updated_at as summary_updated_at

FROM public.employers e
WHERE e.role_type != 'unknown'
   OR e.overall_union_respect_rating IS NOT NULL
   OR e.overall_safety_rating IS NOT NULL
   OR e.overall_subcontractor_rating IS NOT NULL;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_employer_4_point_rating_summary_unique
ON public.employer_4_point_rating_summary(employer_id);

-- Create indexes for common queries on the materialized view
CREATE INDEX IF NOT EXISTS idx_employer_4_point_rating_summary_role
ON public.employer_4_point_rating_summary(role_type, data_quality_level DESC);

CREATE INDEX IF NOT EXISTS idx_employer_4_point_rating_summary_ratings
ON public.employer_4_point_rating_summary(overall_union_respect_rating, overall_safety_rating, overall_subcontractor_rating);

CREATE INDEX IF NOT EXISTS idx_employer_4_point_rating_summary_coverage
ON public.employer_4_point_rating_summary(assessment_coverage_percentage DESC, assessment_status);

CREATE INDEX IF NOT EXISTS idx_employer_4_point_rating_summary_review_date
ON public.employer_4_point_rating_summary(next_rating_review_date)
WHERE next_rating_review_date IS NOT NULL;

-- Assessment Activity Summary View
CREATE MATERIALIZED VIEW IF NOT EXISTS public.assessment_activity_summary AS
SELECT
    DATE_TRUNC('month', assessment_date) as assessment_month,
    employer_role,
    assessment_type,
    COUNT(*) as total_assessments,
    COUNT(DISTINCT employer_id) as unique_employers_assessed,
    AVG(CASE
        WHEN assessment_type = 'union_respect' THEN overall_union_respect_score
        WHEN assessment_type = 'safety' THEN overall_safety_score
        WHEN assessment_type = 'subcontractor_use' THEN overall_subcontractor_score
        WHEN assessment_type = 'role_specific' THEN overall_role_specific_score
    END) as average_score,

    -- Count by rating categories
    COUNT(*) FILTER (WHERE
        (assessment_type = 'union_respect' AND overall_union_respect_rating = 'good') OR
        (assessment_type = 'safety' AND overall_safety_rating = 'good') OR
        (assessment_type = 'subcontractor_use' AND overall_subcontractor_rating = 'good') OR
        (assessment_type = 'role_specific' AND overall_role_specific_rating = 'good')
    ) as good_ratings,

    COUNT(*) FILTER (WHERE
        (assessment_type = 'union_respect' AND overall_union_respect_rating = 'fair') OR
        (assessment_type = 'safety' AND overall_safety_rating = 'fair') OR
        (assessment_type = 'subcontractor_use' AND overall_subcontractor_rating = 'fair') OR
        (assessment_type = 'role_specific' AND overall_role_specific_rating = 'fair')
    ) as fair_ratings,

    COUNT(*) FILTER (WHERE
        (assessment_type = 'union_respect' AND overall_union_respect_rating = 'poor') OR
        (assessment_type = 'safety' AND overall_safety_rating = 'poor') OR
        (assessment_type = 'subcontractor_use' AND overall_subcontractor_rating = 'poor') OR
        (assessment_type = 'role_specific' AND overall_role_specific_rating = 'poor')
    ) as poor_ratings,

    COUNT(*) FILTER (WHERE
        (assessment_type = 'union_respect' AND overall_union_respect_rating = 'terrible') OR
        (assessment_type = 'safety' AND overall_safety_rating = 'terrible') OR
        (assessment_type = 'subcontractor_use' AND overall_subcontractor_rating = 'terrible') OR
        (assessment_type = 'role_specific' AND overall_role_specific_rating = 'terrible')
    ) as terrible_ratings

FROM (
    SELECT
        employer_id,
        assessment_date,
        'union_respect' as assessment_type,
        overall_union_respect_rating,
        overall_union_respect_score,
        (SELECT role_type FROM public.employers e WHERE e.id = ura.employer_id) as employer_role
    FROM public.union_respect_assessments ura
    WHERE ura.is_active = true AND ura.assessment_complete = true

    UNION ALL

    SELECT
        employer_id,
        assessment_date,
        'safety' as assessment_type,
        overall_safety_rating,
        overall_safety_score,
        (SELECT role_type FROM public.employers e WHERE e.id = sa.employer_id) as employer_role
    FROM public.safety_assessments_4_point sa
    WHERE sa.is_active = true AND sa.assessment_complete = true

    UNION ALL

    SELECT
        employer_id,
        assessment_date,
        'subcontractor_use' as assessment_type,
        overall_subcontractor_rating,
        overall_subcontractor_score,
        (SELECT role_type FROM public.employers e WHERE e.id = e.employer_id) as employer_role
    FROM public.subcontractor_use_assessments sua
    WHERE sua.is_active = true AND sua.assessment_complete = true

    UNION ALL

    SELECT
        employer_id,
        assessment_date,
        'role_specific' as assessment_type,
        overall_role_specific_rating,
        overall_role_specific_score,
        employer_role
    FROM public.role_specific_assessments rsa
    WHERE rsa.is_active = true AND rsa.assessment_complete = true
) all_assessments
GROUP BY assessment_month, employer_role, assessment_type;

-- Create indexes for assessment activity summary
CREATE INDEX IF NOT EXISTS idx_assessment_activity_summary_month_role
ON public.assessment_activity_summary(assessment_month DESC, employer_role, assessment_type);

CREATE INDEX IF NOT EXISTS idx_assessment_activity_summary_month
ON public.assessment_activity_summary(assessment_month DESC);

-- Rating Distribution View
CREATE MATERIALIZED VIEW IF NOT EXISTS public.rating_distribution_summary AS
SELECT
    employer_role,
    assessment_type,
    rating_category,
    COUNT(*) as employer_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY employer_role, assessment_type), 2) as percentage,

    -- Additional metrics
    AVG(assessment_count) as avg_assessments_per_employer,
    MAX(assessment_count) as max_assessments_per_employer,
    AVG(latest_assessment_days) as avg_days_since_last_assessment

FROM (
    SELECT
        e.id as employer_id,
        e.role_type as employer_role,

        -- Union respect data
        COALESCE(e.overall_union_respect_rating, 'unknown') as union_respect_rating,
        e.total_union_respect_assessments as union_respect_count,
        EXTRACT(DAYS FROM CURRENT_DATE - MAX(ura.assessment_date)) as union_respect_days,

        -- Safety data
        COALESCE(e.overall_safety_rating, 'unknown') as safety_rating,
        e.total_safety_assessments as safety_count,
        EXTRACT(DAYS FROM CURRENT_DATE - MAX(sa.assessment_date)) as safety_days,

        -- Subcontractor data
        COALESCE(e.overall_subcontractor_rating, 'unknown') as subcontractor_rating,
        e.total_subcontractor_assessments as subcontractor_count,
        EXTRACT(DAYS FROM CURRENT_DATE - MAX(sua.assessment_date)) as subcontractor_days

    FROM public.employers e
    LEFT JOIN public.union_respect_assessments ura ON ura.employer_id = e.id AND ura.is_active = true
    LEFT JOIN public.safety_assessments_4_point sa ON sa.employer_id = e.id AND sa.is_active = true
    LEFT JOIN public.subcontractor_use_assessments sua ON sua.employer_id = e.id AND sua.is_active = true
    WHERE e.role_type != 'unknown'
    GROUP BY e.id, e.role_type, e.overall_union_respect_rating, e.overall_safety_rating, e.overall_subcontractor_rating,
             e.total_union_respect_assessments, e.total_safety_assessments, e.total_subcontractor_assessments
) employer_data
UNPIVOT (
    rating_category FOR assessment_type IN (
        union_respect_rating TEXT,
        safety_rating TEXT,
        subcontractor_rating TEXT
    )
)
CROSS JOIN LATERAL (
    SELECT
        CASE assessment_type
            WHEN 'union_respect_rating' THEN union_respect_count
            WHEN 'safety_rating' THEN safety_count
            WHEN 'subcontractor_rating' THEN subcontractor_count
        END as assessment_count,
        CASE assessment_type
            WHEN 'union_respect_rating' THEN union_respect_days
            WHEN 'safety_rating' THEN safety_days
            WHEN 'subcontractor_rating' THEN subcontractor_days
        END as latest_assessment_days
) metrics
WHERE rating_category != 'unknown'
GROUP BY employer_role, assessment_type, rating_category;

-- Create indexes for rating distribution summary
CREATE INDEX IF NOT EXISTS idx_rating_distribution_summary_role_type
ON public.rating_distribution_summary(employer_role, assessment_type, rating_category);

CREATE INDEX IF NOT EXISTS idx_rating_distribution_summary_percentage
ON public.rating_distribution_summary(percentage DESC);

-- Functions to refresh materialized views
CREATE OR REPLACE FUNCTION public.refresh_rating_materialized_views()
RETURNS void AS $$
BEGIN
    -- Refresh materialized views without locking
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.employer_4_point_rating_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.assessment_activity_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.rating_distribution_summary;

    RAISE NOTICE 'Materialized views refreshed successfully';
END;
$$ LANGUAGE plpgsql;

-- Function to create assessment summary for an employer
CREATE OR REPLACE FUNCTION public.get_employer_assessment_summary(
    p_employer_id uuid,
    p_include_details boolean DEFAULT false
) RETURNS jsonb AS $$
DECLARE
    v_summary jsonb;
    v_employer_data public.employer_4_point_rating_summary%ROWTYPE;
BEGIN
    -- Get data from materialized view
    SELECT * INTO v_employer_data
    FROM public.employer_4_point_rating_summary
    WHERE employer_id = p_employer_id;

    IF v_employer_data.employer_id IS NULL THEN
        -- If not in materialized view, get directly from employers table
        SELECT
            e.id as employer_id,
            e.name as employer_name,
            e.role_type,
            e.overall_union_respect_rating,
            e.overall_union_respect_score,
            e.overall_safety_rating,
            e.overall_safety_score,
            e.overall_subcontractor_rating,
            e.overall_subcontractor_score,
            e.last_4_point_rating_calculation,
            e.rating_data_quality_score,
            e.assessment_coverage_percentage,
            e.next_rating_review_date,
            e.total_union_respect_assessments,
            e.total_safety_assessments,
            e.total_subcontractor_assessments,
            e.total_role_specific_assessments,
            e.latest_assessment_date,
            NULL::date as latest_union_respect_date,
            NULL::date as latest_safety_date,
            NULL::date as latest_subcontractor_date,
            NULL::date as latest_role_specific_date,
            'unknown'::text as data_quality_level,
            'insufficient'::text as assessment_status,
            e.updated_at as summary_updated_at
        INTO v_employer_data
        FROM public.employers e
        WHERE e.id = p_employer_id;
    END IF;

    IF v_employer_data.employer_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Employer not found');
    END IF;

    -- Build base summary
    v_summary := jsonb_build_object(
        'employer_id', v_employer_data.employer_id,
        'employer_name', v_employer_data.employer_name,
        'role_type', v_employer_data.role_type,

        -- Current ratings
        'ratings', jsonb_build_object(
            'union_respect', jsonb_build_object(
                'rating', v_employer_data.overall_union_respect_rating,
                'score', v_employer_data.overall_union_respect_score,
                'last_assessment', v_employer_data.latest_union_respect_date,
                'total_assessments', v_employer_data.total_union_respect_assessments
            ),
            'safety', jsonb_build_object(
                'rating', v_employer_data.overall_safety_rating,
                'score', v_employer_data.overall_safety_score,
                'last_assessment', v_employer_data.latest_safety_date,
                'total_assessments', v_employer_data.total_safety_assessments
            ),
            'subcontractor', jsonb_build_object(
                'rating', v_employer_data.overall_subcontractor_rating,
                'score', v_employer_data.overall_subcontractor_score,
                'last_assessment', v_employer_data.latest_subcontractor_date,
                'total_assessments', v_employer_data.total_subcontractor_assessments
            ),
            'role_specific', jsonb_build_object(
                'total_assessments', v_employer_data.total_role_specific_assessments,
                'last_assessment', v_employer_data.latest_role_specific_date
            )
        ),

        -- Quality indicators
        'data_quality', jsonb_build_object(
            'score', v_employer_data.rating_data_quality_score,
            'level', v_employer_data.data_quality_level,
            'coverage_percentage', v_employer_data.assessment_coverage_percentage,
            'status', v_employer_data.assessment_status
        ),

        -- Metadata
        'last_calculation', v_employer_data.last_4_point_rating_calculation,
        'next_review_date', v_employer_data.next_rating_review_date,
        'summary_updated_at', v_employer_data.summary_updated_at
    );

    -- Add detailed assessment data if requested
    IF p_include_details THEN
        v_summary := v_summary || jsonb_build_object(
            'detailed_assessments', jsonb_build_object(
                'union_respect', (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', id,
                            'assessment_date', assessment_date,
                            'overall_score', overall_union_respect_score,
                            'overall_rating', overall_union_respect_rating,
                            'confidence_level', confidence_level,
                            'assessment_method', assessment_method
                        ) ORDER BY assessment_date DESC
                    )
                    FROM public.union_respect_assessments
                    WHERE employer_id = p_employer_id AND is_active = true
                    LIMIT 5
                ),
                'safety', (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', id,
                            'assessment_date', assessment_date,
                            'overall_score', overall_safety_score,
                            'overall_rating', overall_safety_rating,
                            'confidence_level', confidence_level,
                            'assessment_method', assessment_method
                        ) ORDER BY assessment_date DESC
                    )
                    FROM public.safety_assessments_4_point
                    WHERE employer_id = p_employer_id AND is_active = true
                    LIMIT 5
                ),
                'subcontractor', (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', id,
                            'assessment_date', assessment_date,
                            'overall_score', overall_subcontractor_score,
                            'overall_rating', overall_subcontractor_rating,
                            'confidence_level', confidence_level,
                            'assessment_basis', assessment_basis
                        ) ORDER BY assessment_date DESC
                    )
                    FROM public.subcontractor_use_assessments
                    WHERE employer_id = p_employer_id AND is_active = true
                    LIMIT 5
                ),
                'role_specific', (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', id,
                            'assessment_date', assessment_date,
                            'overall_score', overall_role_specific_score,
                            'overall_rating', overall_role_specific_rating,
                            'employer_role', employer_role,
                            'confidence_level', confidence_level
                        ) ORDER BY assessment_date DESC
                    )
                    FROM public.role_specific_assessments
                    WHERE employer_id = p_employer_id AND is_active = true
                    LIMIT 5
                )
            )
        );
    END IF;

    RETURN v_summary;
END;
$$ LANGUAGE plpgsql;

-- Create index for function performance
CREATE INDEX IF NOT EXISTS idx_employers_summary_lookup
ON public.employers(id, role_type, overall_union_respect_rating, overall_safety_rating, overall_subcontractor_rating);

-- Grant permissions
GRANT SELECT ON public.employer_4_point_rating_summary TO authenticated;
GRANT SELECT ON public.assessment_activity_summary TO authenticated;
GRANT SELECT ON public.rating_distribution_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_rating_materialized_views TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employer_assessment_summary TO authenticated;

-- Comments for documentation
COMMENT ON MATERIALIZED VIEW public.employer_4_point_rating_summary IS 'Summary view of employer 4-point ratings for performance optimization';
COMMENT ON MATERIALIZED VIEW public.assessment_activity_summary IS 'Monthly summary of assessment activity by role and type';
COMMENT ON MATERIALIZED VIEW public.rating_distribution_summary IS 'Distribution of ratings across employer roles and assessment types';
COMMENT ON FUNCTION public.refresh_rating_materialized_views IS 'Refreshes all rating-related materialized views concurrently';
COMMENT ON FUNCTION public.get_employer_assessment_summary IS 'Returns comprehensive assessment summary for an employer with optional details';

-- Create scheduled refresh function (to be called by cron or similar)
CREATE OR REPLACE FUNCTION public.scheduled_maintenance_tasks()
RETURNS void AS $$
BEGIN
    -- Refresh materialized views
    PERFORM public.refresh_rating_materialized_views();

    -- Update employer assessment counts and coverage
    -- (This would be called periodically to ensure data consistency)

    RAISE NOTICE 'Scheduled maintenance tasks completed';
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.scheduled_maintenance_tasks TO authenticated;