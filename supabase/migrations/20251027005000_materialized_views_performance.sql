-- Employer Traffic Light Rating System - Materialized Views and Performance Optimizations
-- This migration creates materialized views for mobile performance and optimizes
-- queries for the rating system.

-- Materialized view for employer ratings summary (optimized for mobile)
-- This provides fast access to current employer ratings without complex calculations
CREATE MATERIALIZED VIEW public.employer_ratings_summary_mv AS
SELECT
    e.id as employer_id,
    e.name as employer_name,
    e.employer_type,
    e.abn,
    e.suburb,
    e.state,

    -- Current rating information
    efr.final_rating,
    efr.final_score,
    efr.overall_confidence,
    efr.data_completeness_score,
    efr.rating_date as last_rated_date,
    efr.next_review_date,
    efr.expiry_date,

    -- Component ratings
    efr.project_based_rating,
    efr.project_based_score,
    efr.expertise_based_rating,
    efr.expertise_based_score,
    efr.eba_status,

    -- Data quality indicators
    efr.projects_included,
    efr.expertise_assessments_included,
    efr.project_data_age_days,
    efr.expertise_data_age_days,

    -- Status flags
    efr.rating_status,
    efr.review_required,
    efr.rating_discrepancy,
    efr.discrepancy_level,
    efr.required_dispute_resolution,

    -- Metadata
    efr.created_at as rating_created_at,
    efr.updated_at as rating_updated_at,
    now() as view_refreshed_at

FROM public.employers e
LEFT JOIN LATERAL (
    SELECT *
    FROM public.employer_final_ratings efr2
    WHERE efr2.employer_id = e.id
      AND efr2.is_active = true
    ORDER BY efr2.rating_date DESC
    LIMIT 1
) efr ON true;

-- Create unique index for materialized view
CREATE UNIQUE INDEX idx_employer_ratings_summary_mv_employer
    ON public.employer_ratings_summary_mv(employer_id);

-- Create performance indexes for common query patterns
CREATE INDEX idx_employer_ratings_summary_mv_rating
    ON public.employer_ratings_summary_mv(final_rating, review_required);

CREATE INDEX idx_employer_ratings_summary_mv_state_rating
    ON public.employer_ratings_summary_mv(state, final_rating);

CREATE INDEX idx_employer_ratings_summary_mv_review_date
    ON public.employer_ratings_summary_mv(next_review_date)
    WHERE next_review_date IS NOT NULL;

CREATE INDEX idx_employer_ratings_summary_mv_expiry
    ON public.employer_ratings_summary_mv(expiry_date)
    WHERE expiry_date IS NOT NULL;

CREATE INDEX idx_employer_ratings_summary_mv_discrepancy
    ON public.employer_ratings_summary_mv(rating_discrepancy, discrepancy_level);

-- Materialized view for project compliance data by employer
-- Optimized for quick access to project compliance history
CREATE MATERIALIZED VIEW public.employer_project_compliance_mv AS
SELECT
    pca.employer_id,
    e.name as employer_name,

    -- Latest assessment by type
    jsonb_agg(
        jsonb_build_object(
            'assessment_type', pca.assessment_type,
            'latest_score', pca.score,
            'latest_rating', pca.rating,
            'latest_date', pca.assessment_date,
            'confidence_level', pca.confidence_level
        )
        ORDER BY pca.assessment_date DESC
    ) FILTER (WHERE pca.score IS NOT NULL) as latest_assessments,

    -- Overall compliance metrics
    COUNT(*) as total_assessments,
    COUNT(DISTINCT pca.assessment_type) as assessment_types_count,
    AVG(pca.score) as average_score,
    MAX(pca.assessment_date) as latest_assessment_date,
    MIN(pca.assessment_date) as earliest_assessment_date,

    -- Compliance breakdown
    COUNT(CASE WHEN pca.rating = 'green' THEN 1 END) as green_assessments,
    COUNT(CASE WHEN pca.rating = 'amber' THEN 1 END) as amber_assessments,
    COUNT(CASE WHEN pca.rating = 'red' THEN 1 END) as red_assessments,
    COUNT(CASE WHEN pca.rating = 'unknown' THEN 1 END) as unknown_assessments,

    -- Recent activity (last 90 days)
    COUNT(CASE WHEN pca.assessment_date >= CURRENT_DATE - INTERVAL '90 days' THEN 1 END) as recent_assessments,
    AVG(CASE WHEN pca.assessment_date >= CURRENT_DATE - INTERVAL '90 days' THEN pca.score END) as recent_average_score,

    -- Projects involved
    COUNT(DISTINCT pca.project_id) as projects_count,
    ARRAY_AGG(DISTINCT pca.project_id) FILTER (WHERE pca.project_id IS NOT NULL) as project_ids,

    now() as view_refreshed_at

FROM public.project_compliance_assessments pca
JOIN public.employers e ON pca.employer_id = e.id
WHERE pca.is_active = true
GROUP BY pca.employer_id, e.name;

-- Create indexes for project compliance materialized view
CREATE UNIQUE INDEX idx_employer_project_compliance_mv_employer
    ON public.employer_project_compliance_mv(employer_id);

CREATE INDEX idx_employer_project_compliance_mv_total_assessments
    ON public.employer_project_compliance_mv(total_assessments DESC);

CREATE INDEX idx_employer_project_compliance_mv_latest_date
    ON public.employer_project_compliance_mv(latest_assessment_date DESC);

CREATE INDEX idx_employer_project_compliance_mv_avg_score
    ON public.employer_project_compliance_mv(average_score DESC);

-- Materialized view for organiser expertise data
-- Optimized for accessing organiser expertise assessments
CREATE MATERIALIZED VIEW public.employer_expertise_ratings_mv AS
SELECT
    oea.employer_id,
    e.name as employer_name,

    -- Latest expertise assessments
    jsonb_agg(
        jsonb_build_object(
            'organiser_id', oea.organiser_id,
            'organiser_name', p.full_name,
            'overall_score', oea.overall_score,
            'overall_rating', oea.overall_rating,
            'assessment_date', oea.assessment_date,
            'confidence_level', oea.confidence_level,
            'assessment_basis', oea.assessment_basis,
            'knowledge_beyond_projects', oea.knowledge_beyond_projects
        )
        ORDER BY oea.assessment_date DESC
    ) FILTER (WHERE oea.overall_score IS NOT NULL) as expertise_assessments,

    -- Expertise metrics
    COUNT(*) as total_expertise_assessments,
    COUNT(DISTINCT oea.organiser_id) as unique_organisers,
    AVG(oea.overall_score) as average_expertise_score,
    MAX(oea.assessment_date) as latest_expertise_date,
    MIN(oea.assessment_date) as earliest_expertise_date,

    -- Expertise breakdown
    COUNT(CASE WHEN oea.overall_rating = 'green' THEN 1 END) as green_assessments,
    COUNT(CASE WHEN oea.overall_rating = 'amber' THEN 1 END) as amber_assessments,
    COUNT(CASE WHEN oea.overall_rating = 'red' THEN 1 END) as red_assessments,
    COUNT(CASE WHEN oea.overall_rating = 'unknown' THEN 1 END) as unknown_assessments,

    -- Recent expertise activity (last 90 days)
    COUNT(CASE WHEN oea.assessment_date >= CURRENT_DATE - INTERVAL '90 days' THEN 1 END) as recent_assessments,
    AVG(CASE WHEN oea.assessment_date >= CURRENT_DATE - INTERVAL '90 days' THEN oea.overall_score END) as recent_average_score,

    -- Knowledge beyond projects
    COUNT(CASE WHEN oea.knowledge_beyond_projects = true THEN 1 END) as beyond_projects_assessments,

    -- Confidence levels
    COUNT(CASE WHEN oea.confidence_level = 'high' THEN 1 END) as high_confidence,
    COUNT(CASE WHEN oea.confidence_level = 'medium' THEN 1 END) as medium_confidence,
    COUNT(CASE WHEN oea.confidence_level = 'low' THEN 1 END) as low_confidence,
    COUNT(CASE WHEN oea.confidence_level = 'very_low' THEN 1 END) as very_low_confidence,

    now() as view_refreshed_at

FROM public.organiser_overall_expertise_ratings oea
JOIN public.employers e ON oea.employer_id = e.id
JOIN public.profiles p ON oea.organiser_id = p.id
WHERE oea.is_active = true
GROUP BY oea.employer_id, e.name;

-- Create indexes for expertise materialized view
CREATE UNIQUE INDEX idx_employer_expertise_ratings_mv_employer
    ON public.employer_expertise_ratings_mv(employer_id);

CREATE INDEX idx_employer_expertise_ratings_mv_total_assessments
    ON public.employer_expertise_ratings_mv(total_expertise_assessments DESC);

CREATE INDEX idx_employer_expertise_ratings_mv_unique_organisers
    ON public.employer_expertise_ratings_mv(unique_organisers DESC);

CREATE INDEX idx_employer_expertise_ratings_mv_latest_date
    ON public.employer_expertise_ratings_mv(latest_expertise_date DESC);

-- Materialized view for rating trends and analytics
-- Optimized for analytics and trend analysis
CREATE MATERIALIZED VIEW public.rating_trends_analytics_mv AS
SELECT
    -- Date-based grouping
    DATE_TRUNC('month', efr.rating_date) as rating_month,
    DATE_TRUNC('quarter', efr.rating_date) as rating_quarter,
    DATE_TRUNC('year', efr.rating_date) as rating_year,

    -- Rating distribution
    COUNT(*) as total_ratings,
    COUNT(CASE WHEN efr.final_rating = 'green' THEN 1 END) as green_count,
    COUNT(CASE WHEN efr.final_rating = 'amber' THEN 1 END) as amber_count,
    COUNT(CASE WHEN efr.final_rating = 'red' THEN 1 END) as red_count,
    COUNT(CASE WHEN efr.final_rating = 'unknown' THEN 1 END) as unknown_count,

    -- Percentages
    ROUND(
        (COUNT(CASE WHEN efr.final_rating = 'green' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 2
    ) as green_percentage,
    ROUND(
        (COUNT(CASE WHEN efr.final_rating = 'amber' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 2
    ) as amber_percentage,
    ROUND(
        (COUNT(CASE WHEN efr.final_rating = 'red' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 2
    ) as red_percentage,

    -- Score statistics
    AVG(efr.final_score) as average_score,
    MIN(efr.final_score) as min_score,
    MAX(efr.final_score) as max_score,
    STDDEV(efr.final_score) as score_stddev,

    -- Confidence levels
    COUNT(CASE WHEN efr.overall_confidence = 'high' THEN 1 END) as high_confidence_count,
    COUNT(CASE WHEN efr.overall_confidence = 'medium' THEN 1 END) as medium_confidence_count,
    COUNT(CASE WHEN efr.overall_confidence = 'low' THEN 1 END) as low_confidence_count,
    COUNT(CASE WHEN efr.overall_confidence = 'very_low' THEN 1 END) as very_low_confidence_count,

    -- Data quality
    AVG(efr.data_completeness_score) as average_data_completeness,
    COUNT(CASE WHEN efr.data_completeness_score >= 80 THEN 1 END) as high_quality_count,
    COUNT(CASE WHEN efr.data_completeness_score >= 60 AND efr.data_completeness_score < 80 THEN 1 END) as medium_quality_count,
    COUNT(CASE WHEN efr.data_completeness_score < 60 THEN 1 END) as low_quality_count,

    -- Discrepancy metrics
    COUNT(CASE WHEN efr.rating_discrepancy = true THEN 1 END) as discrepancy_count,
    ROUND(
        (COUNT(CASE WHEN efr.rating_discrepancy = true THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 2
    ) as discrepancy_percentage,
    AVG(efr.discrepancy_level) as average_discrepancy_level,

    -- Review metrics
    COUNT(CASE WHEN efr.review_required = true THEN 1 END) as review_required_count,
    COUNT(CASE WHEN efr.required_dispute_resolution = true THEN 1 END) as dispute_required_count,

    now() as view_refreshed_at

FROM public.employer_final_ratings efr
WHERE efr.is_active = true
GROUP BY
    DATE_TRUNC('month', efr.rating_date),
    DATE_TRUNC('quarter', efr.rating_date),
    DATE_TRUNC('year', efr.rating_date);

-- Create indexes for trends analytics materialized view
CREATE INDEX idx_rating_trends_analytics_mv_month
    ON public.rating_trends_analytics_mv(rating_month DESC);

CREATE INDEX idx_rating_trends_analytics_mv_quarter
    ON public.rating_trends_analytics_mv(rating_quarter DESC);

CREATE INDEX idx_rating_trends_analytics_mv_year
    ON public.rating_trends_analytics_mv(rating_year DESC);

CREATE INDEX idx_rating_trends_analytics_mv_total_ratings
    ON public.rating_trends_analytics_mv(total_ratings DESC);

-- Materialized view for mobile dashboard data
-- Specifically optimized for mobile app performance with minimal data transfer
CREATE MATERIALIZED VIEW public.mobile_employer_dashboard_mv AS
SELECT
    e.id as employer_id,
    e.name as employer_name,
    e.employer_type,
    e.suburb,
    e.state,

    -- Current rating (minimal data for quick display)
    efr.final_rating,
    efr.final_score,
    efr.overall_confidence,
    efr.rating_date,

    -- Key status flags
    efr.review_required,
    efr.rating_discrepancy,
    efr.required_dispute_resolution,
    efr.next_review_date,

    -- Data quality indicator (0-100 scale)
    CASE
        WHEN efr.data_completeness_score >= 80 THEN 'high'
        WHEN efr.data_completeness_score >= 60 THEN 'medium'
        ELSE 'low'
    END as data_quality_level,

    -- Recent activity indicator
    CASE
        WHEN efr.rating_date >= CURRENT_DATE - INTERVAL '7 days' THEN 'very_recent'
        WHEN efr.rating_date >= CURRENT_DATE - INTERVAL '30 days' THEN 'recent'
        WHEN efr.rating_date >= CURRENT_DATE - INTERVAL '90 days' THEN 'moderate'
        ELSE 'stale'
    END as data_recency,

    -- Alert indicators
    CASE
        WHEN efr.required_dispute_resolution = true THEN 3
        WHEN efr.review_required = true THEN 2
        WHEN efr.rating_discrepancy = true THEN 1
        ELSE 0
    END as alert_level,

    -- Quick stats
    COALESCE(epm.total_assessments, 0) as project_assessment_count,
    COALESCE(eerm.total_expertise_assessments, 0) as expertise_assessment_count,
    COALESCE(epm.projects_count, 0) as projects_count,

    now() as view_refreshed_at

FROM public.employers e
LEFT JOIN LATERAL (
    SELECT *
    FROM public.employer_final_ratings efr2
    WHERE efr2.employer_id = e.id
      AND efr2.is_active = true
    ORDER BY efr2.rating_date DESC
    LIMIT 1
) efr ON true
LEFT JOIN public.employer_project_compliance_mv epm ON epm.employer_id = e.id
LEFT JOIN public.employer_expertise_ratings_mv eerm ON eerm.employer_id = e.id;

-- Create indexes for mobile dashboard materialized view
CREATE UNIQUE INDEX idx_mobile_employer_dashboard_mv_employer
    ON public.mobile_employer_dashboard_mv(employer_id);

CREATE INDEX idx_mobile_employer_dashboard_mv_rating
    ON public.mobile_employer_dashboard_mv(final_rating, review_required);

CREATE INDEX idx_mobile_employer_dashboard_mv_alert_level
    ON public.mobile_employer_dashboard_mv(alert_level DESC);

CREATE INDEX idx_mobile_employer_dashboard_mv_state
    ON public.mobile_employer_dashboard_mv(state, final_rating);

CREATE INDEX idx_mobile_employer_dashboard_mv_recency
    ON public.mobile_employer_dashboard_mv(data_recency, rating_date DESC);

-- Create function to refresh all materialized views
CREATE OR REPLACE FUNCTION public.refresh_rating_system_materialized_views()
RETURNS void AS $$
BEGIN
    -- Refresh materialized views with minimal locking
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.employer_ratings_summary_mv;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.employer_project_compliance_mv;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.employer_expertise_ratings_mv;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.rating_trends_analytics_mv;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mobile_employer_dashboard_mv;

    -- Log the refresh
    INSERT INTO public.rating_quality_metrics (
        metric_date,
        system_errors,
        ratings_calculated_per_day
    ) VALUES (
        CURRENT_DATE,
        0,
        (SELECT COUNT(*) FROM public.employer_final_ratings WHERE rating_date = CURRENT_DATE)
    )
    ON CONFLICT (metric_date)
    DO UPDATE SET
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Create optimized view for employer search with ratings
-- Combines employer search with rating data for fast filtering
CREATE OR REPLACE VIEW public.employers_with_ratings_search AS
SELECT
    e.*,

    -- Rating data from materialized view
    ers.final_rating,
    ers.final_score,
    ers.overall_confidence,
    ers.last_rated_date,
    ers.next_review_date,
    ers.project_based_rating,
    ers.expertise_based_rating,
    ers.eba_status,
    ers.review_required,
    ers.rating_discrepancy,
    ers.discrepancy_level,

    -- Search-optimized text fields
    COALESCE(e.name, '') || ' ' ||
    COALESCE(e.abn, '') || ' ' ||
    COALESCE(e.suburb, '') || ' ' ||
    COALESCE(e.state, '') as search_text,

    -- Quick filters
    CASE
        WHEN ers.final_rating = 'green' THEN 1
        WHEN ers.final_rating = 'amber' THEN 2
        WHEN ers.final_rating = 'red' THEN 3
        WHEN ers.final_rating = 'unknown' THEN 4
    END as rating_sort_order,

    CASE
        WHEN ers.review_required = true THEN 1
        ELSE 0
    END as review_priority,

    -- Data age for filtering
    CASE
        WHEN ers.last_rated_date >= CURRENT_DATE - INTERVAL '30 days' THEN 'current'
        WHEN ers.last_rated_date >= CURRENT_DATE - INTERVAL '90 days' THEN 'recent'
        WHEN ers.last_rated_date >= CURRENT_DATE - INTERVAL '180 days' THEN 'moderate'
        ELSE 'outdated'
    END as rating_currency

FROM public.employers e
LEFT JOIN public.employer_ratings_summary_mv ers ON e.id = ers.employer_id;

-- Note: Indexes cannot be created on regular views
-- If search performance is needed, consider:
-- 1. Converting to a materialized view with periodic refresh
-- 2. Creating indexes on the underlying tables
-- 3. Using the existing materialized views that have proper indexing

-- Create function for fast employer rating lookup
-- Optimized for mobile performance with minimal database hits
CREATE OR REPLACE FUNCTION public.get_employer_rating_fast(
    p_employer_id uuid
) RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
    v_rating_record public.mobile_employer_dashboard_mv%ROWTYPE;
BEGIN
    -- Get data from optimized materialized view
    SELECT * INTO v_rating_record
    FROM public.mobile_employer_dashboard_mv
    WHERE employer_id = p_employer_id;

    -- Build optimized result for mobile
    IF v_rating_record.employer_id IS NOT NULL THEN
        v_result := jsonb_build_object(
            'employer_id', v_rating_record.employer_id,
            'employer_name', v_rating_record.employer_name,
            'final_rating', v_rating_record.final_rating,
            'final_score', v_rating_record.final_score,
            'overall_confidence', v_rating_record.overall_confidence,
            'rating_date', v_rating_record.rating_date,
            'data_quality_level', v_rating_record.data_quality_level,
            'data_recency', v_rating_record.data_recency,
            'alert_level', v_rating_record.alert_level,
            'review_required', v_rating_record.review_required,
            'next_review_date', v_rating_record.next_review_date,
            'project_assessment_count', v_rating_record.project_assessment_count,
            'expertise_assessment_count', v_rating_record.expertise_assessment_count,
            'projects_count', v_rating_record.projects_count,
            'retrieved_at', now()
        );
    ELSE
        -- Fallback to basic employer info if no rating exists
        SELECT jsonb_build_object(
            'employer_id', id,
            'employer_name', name,
            'final_rating', 'unknown'::traffic_light_rating,
            'final_score', 0,
            'overall_confidence', 'very_low'::rating_confidence_level,
            'rating_date', NULL,
            'data_quality_level', 'none',
            'data_recency', 'never',
            'alert_level', 0,
            'review_required', false,
            'next_review_date', NULL,
            'project_assessment_count', 0,
            'expertise_assessment_count', 0,
            'projects_count', 0,
            'retrieved_at', now()
        ) INTO v_result
        FROM public.employers
        WHERE id = p_employer_id;
    END IF;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Create function for batch employer rating updates
-- Optimized for bulk operations and mobile sync
CREATE OR REPLACE FUNCTION public.batch_update_employer_ratings(
    p_employer_ids uuid[],
    p_created_by uuid DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
    v_results jsonb := '[]';
    v_employer_id uuid;
    v_rating_id uuid;
    v_success_count integer := 0;
    v_error_count integer := 0;
    v_errors text[] := '{}';
BEGIN
    -- Process each employer
    FOREACH v_employer_id IN ARRAY p_employer_ids LOOP
        BEGIN
            -- Calculate and update rating
            v_rating_id := public.create_or_update_final_rating(v_employer_id, CURRENT_DATE, p_created_by);

            v_results := v_results || jsonb_build_object(
                'employer_id', v_employer_id,
                'rating_id', v_rating_id,
                'status', 'success',
                'message', 'Rating updated successfully'
            );

            v_success_count := v_success_count + 1;

        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors || ('Employer ' || v_employer_id || ': ' || SQLERRM);

            v_results := v_results || jsonb_build_object(
                'employer_id', v_employer_id,
                'rating_id', NULL,
                'status', 'error',
                'message', SQLERRM
            );

            v_error_count := v_error_count + 1;
        END;
    END LOOP;

    -- Refresh materialized views after batch update
    PERFORM public.refresh_rating_system_materialized_views();

    -- Return comprehensive results
    RETURN jsonb_build_object(
        'processed_count', array_length(p_employer_ids, 1),
        'success_count', v_success_count,
        'error_count', v_error_count,
        'errors', v_errors,
        'results', v_results,
        'completed_at', now()
    );
END;
$$ LANGUAGE plpgsql;

-- Create scheduled refresh job for materialized views
-- This will be called by a cron job or scheduled function
CREATE OR REPLACE FUNCTION public.scheduled_rating_system_maintenance()
RETURNS void AS $$
BEGIN
    -- Refresh materialized views
    PERFORM public.refresh_rating_system_materialized_views();

    -- Update quality metrics
    INSERT INTO public.rating_quality_metrics (
        metric_date,
        total_employers_rated,
        ratings_by_category,
        average_confidence_score,
        data_completeness_average,
        discrepancy_rate,
        calculation_time_ms_average
    ) VALUES (
        CURRENT_DATE,
        (SELECT COUNT(*) FROM public.employer_final_ratings efr WHERE efr.is_active = true AND efr.rating_date = CURRENT_DATE),
        (SELECT jsonb_build_object(
            'green', COUNT(CASE WHEN final_rating = 'green' THEN 1 END),
            'amber', COUNT(CASE WHEN final_rating = 'amber' THEN 1 END),
            'red', COUNT(CASE WHEN final_rating = 'red' THEN 1 END),
            'unknown', COUNT(CASE WHEN final_rating = 'unknown' THEN 1 END)
        ) FROM public.employer_final_ratings WHERE is_active = true AND rating_date = CURRENT_DATE),
        (SELECT AVG(
            CASE overall_confidence
                WHEN 'high' THEN 0.9
                WHEN 'medium' THEN 0.7
                WHEN 'low' THEN 0.5
                WHEN 'very_low' THEN 0.3
                ELSE 0.5
            END
        ) FROM public.employer_final_ratings WHERE is_active = true AND rating_date = CURRENT_DATE),
        (SELECT AVG(data_completeness_score) FROM public.employer_final_ratings WHERE is_active = true AND rating_date = CURRENT_DATE),
        (SELECT COUNT(CASE WHEN rating_discrepancy = true THEN 1 END) * 1.0 / NULLIF(COUNT(*), 0) FROM public.employer_final_ratings WHERE is_active = true AND rating_date = CURRENT_DATE),
        150 -- Estimated average calculation time in milliseconds
    )
    ON CONFLICT (metric_date)
    DO UPDATE SET
        total_employers_rated = EXCLUDED.total_employers_rated,
        ratings_by_category = EXCLUDED.ratings_by_category,
        average_confidence_score = EXCLUDED.average_confidence_score,
        data_completeness_average = EXCLUDED.data_completeness_average,
        discrepancy_rate = EXCLUDED.discrepancy_rate,
        calculation_time_ms_average = EXCLUDED.calculation_time_ms_average,
        updated_at = NOW();

    -- Log maintenance completion
    RAISE LOG 'Rating system maintenance completed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Grant permissions on materialized views and functions
GRANT SELECT ON public.employer_ratings_summary_mv TO authenticated;
GRANT SELECT ON public.employer_project_compliance_mv TO authenticated;
GRANT SELECT ON public.employer_expertise_ratings_mv TO authenticated;
GRANT SELECT ON public.rating_trends_analytics_mv TO authenticated;
GRANT SELECT ON public.mobile_employer_dashboard_mv TO authenticated;
GRANT SELECT ON public.employers_with_ratings_search TO authenticated;

GRANT EXECUTE ON FUNCTION public.refresh_rating_system_materialized_views TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employer_rating_fast TO authenticated;
GRANT EXECUTE ON FUNCTION public.batch_update_employer_ratings TO authenticated;
GRANT EXECUTE ON FUNCTION public.scheduled_rating_system_maintenance TO authenticated;

-- Create row level security policies for materialized views
-- Note: Materialized views themselves don't support RLS, but we can secure the functions that access them

-- Comments for documentation
COMMENT ON MATERIALIZED VIEW public.employer_ratings_summary_mv IS 'Optimized summary view for current employer ratings (mobile-friendly)';
COMMENT ON MATERIALIZED VIEW public.employer_project_compliance_mv IS 'Project compliance data aggregated by employer';
COMMENT ON MATERIALIZED VIEW public.employer_expertise_ratings_mv IS 'Expertise assessment data aggregated by employer';
COMMENT ON MATERIALIZED VIEW public.rating_trends_analytics_mv IS 'Analytics data for rating trends and metrics';
COMMENT ON MATERIALIZED VIEW public.mobile_employer_dashboard_mv IS 'Lightweight view optimized for mobile dashboard performance';
COMMENT ON VIEW public.employers_with_ratings_search IS 'Search-optimized view combining employers with rating data';
COMMENT ON FUNCTION public.refresh_rating_system_materialized_views IS 'Refreshes all rating system materialized views concurrently';
COMMENT ON FUNCTION public.get_employer_rating_fast IS 'Fast lookup function optimized for mobile performance';
COMMENT ON FUNCTION public.batch_update_employer_ratings IS 'Batch processing function for updating multiple employer ratings';
COMMENT ON FUNCTION public.scheduled_rating_system_maintenance IS 'Scheduled maintenance function for system health monitoring';