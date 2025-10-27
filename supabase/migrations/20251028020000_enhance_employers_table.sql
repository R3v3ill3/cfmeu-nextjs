-- CFMEU Rating System Transformation - Enhance Employers Table
-- This migration modifies the employers table to support role differentiation
-- and 4-point scale ratings as part of the rating system transformation

-- Create role type enum for employer classification
CREATE TYPE public.employer_role_type AS ENUM (
    'trade',      -- Trade/contractor specialists
    'builder',    -- Head contractors/builders
    'both',       -- Operates as both trade and builder
    'unknown'     -- Role not yet determined
);

-- Add role differentiation and 4-point scale rating columns to employers table
ALTER TABLE public.employers
ADD COLUMN IF NOT EXISTS role_type employer_role_type DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS overall_union_respect_rating four_point_rating,
ADD COLUMN IF NOT EXISTS overall_union_respect_score numeric CHECK (overall_union_respect_score >= 1 AND overall_union_respect_score <= 4),
ADD COLUMN IF NOT EXISTS overall_safety_rating four_point_rating,
ADD COLUMN IF NOT EXISTS overall_safety_score numeric CHECK (overall_safety_score >= 1 AND overall_safety_score <= 4),
ADD COLUMN IF NOT EXISTS overall_subcontractor_rating four_point_rating,
ADD COLUMN IF NOT EXISTS overall_subcontractor_score numeric CHECK (overall_subcontractor_score >= 1 AND overall_subcontractor_score <= 4),
ADD COLUMN IF NOT EXISTS role_specific_rating_summary jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_role_assessment_date date,
ADD COLUMN IF NOT EXISTS role_confidence_level rating_confidence_level DEFAULT 'low';

-- Add rating metadata columns
ALTER TABLE public.employers
ADD COLUMN IF NOT EXISTS last_4_point_rating_calculation timestamp with time zone,
ADD COLUMN IF NOT EXISTS rating_calculation_method text,
ADD COLUMN IF NOT EXISTS rating_data_quality_score numeric CHECK (rating_data_quality_score >= 0 AND rating_data_quality_score <= 100),
ADD COLUMN IF NOT EXISTS next_rating_review_date date;

-- Add assessment tracking columns
ALTER TABLE public.employers
ADD COLUMN IF NOT EXISTS total_union_respect_assessments integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_safety_assessments integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_subcontractor_assessments integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_role_specific_assessments integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS latest_assessment_date date,
ADD COLUMN IF NOT EXISTS assessment_coverage_percentage numeric CHECK (assessment_coverage_percentage >= 0 AND assessment_coverage_percentage <= 100);

-- Add role-based business information
ALTER TABLE public.employers
ADD COLUMN IF NOT EXISTS primary_business_activity text,
ADD COLUMN IF NOT EXISTS secondary_business_activities text[],
ADD COLUMN IF NOT EXISTS typical_project_types text[],
ADD COLUMN IF NOT EXISTS workforce_size_category text CHECK (workforce_size_category IN ('micro', 'small', 'medium', 'large', 'enterprise')),
ADD COLUMN IF NOT EXISTS annual_revenue_range text,
ADD COLUMN IF NOT EXISTS geographic_operation_areas text[];

-- Add compliance tracking columns
ALTER TABLE public.employers
ADD COLUMN IF NOT EXISTS cbus_compliance_status text CHECK (cbus_compliance_status IN ('compliant', 'non_compliant', 'pending', 'exempt', 'unknown')),
ADD COLUMN IF NOT EXISTS incolink_compliance_status text CHECK (incolink_compliance_status IN ('active', 'lapsed', 'pending', 'exempt', 'unknown')),
ADD COLUMN IF NOT EXISTS eba_status_4_point four_point_rating,
ADD COLUMN IF NOT EXISTS eba_status_score numeric CHECK (eba_status_score >= 1 AND eba_status_score <= 4),
ADD COLUMN IF NOT EXISTS last_eba_verification date;

-- Add role-specific performance indicators
ALTER TABLE public.employers
ADD COLUMN IF NOT EXISTS safety_performance_trend text CHECK (safety_performance_trend IN ('improving', 'stable', 'declining', 'unknown')),
ADD COLUMN IF NOT EXISTS union_relations_trend text CHECK (union_relations_trend IN ('improving', 'stable', 'declining', 'unknown')),
ADD COLUMN IF NOT EXISTS subcontractor_relations_trend text CHECK (subcontractor_relations_trend IN ('improving', 'stable', 'declining', 'unknown'));

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_employers_role_type ON public.employers(role_type) WHERE role_type != 'unknown';
CREATE INDEX IF NOT EXISTS idx_employers_union_respect_rating ON public.employers(overall_union_respect_rating) WHERE overall_union_respect_rating IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employers_safety_rating ON public.employers(overall_safety_rating) WHERE overall_safety_rating IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employers_subcontractor_rating ON public.employers(overall_subcontractor_rating) WHERE overall_subcontractor_rating IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employers_last_assessment ON public.employers(latest_assessment_date DESC) WHERE latest_assessment_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employers_rating_review_date ON public.employers(next_rating_review_date) WHERE next_rating_review_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employers_workforce_size ON public.employers(workforce_size_category) WHERE workforce_size_category IS NOT NULL;

-- Create function to update employer assessment counts
CREATE OR REPLACE FUNCTION public.update_employer_assessment_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Update assessment counts based on the assessment type
    IF TG_TABLE_NAME = 'union_respect_assessments' THEN
        UPDATE public.employers
        SET
            total_union_respect_assessments = (
                SELECT COUNT(*)
                FROM public.union_respect_assessments
                WHERE employer_id = NEW.employer_id AND is_active = true
            ),
            latest_assessment_date = GREATEST(
                COALESCE(latest_assessment_date, '1970-01-01'::date),
                NEW.assessment_date
            ),
            updated_at = NOW()
        WHERE id = NEW.employer_id;

    ELSIF TG_TABLE_NAME = 'safety_assessments_4_point' THEN
        UPDATE public.employers
        SET
            total_safety_assessments = (
                SELECT COUNT(*)
                FROM public.safety_assessments_4_point
                WHERE employer_id = NEW.employer_id AND is_active = true
            ),
            latest_assessment_date = GREATEST(
                COALESCE(latest_assessment_date, '1970-01-01'::date),
                NEW.assessment_date
            ),
            updated_at = NOW()
        WHERE id = NEW.employer_id;

    ELSIF TG_TABLE_NAME = 'subcontractor_use_assessments' THEN
        UPDATE public.employers
        SET
            total_subcontractor_assessments = (
                SELECT COUNT(*)
                FROM public.subcontractor_use_assessments
                WHERE employer_id = NEW.employer_id AND is_active = true
            ),
            latest_assessment_date = GREATEST(
                COALESCE(latest_assessment_date, '1970-01-01'::date),
                NEW.assessment_date
            ),
            updated_at = NOW()
        WHERE id = NEW.employer_id;

    ELSIF TG_TABLE_NAME = 'role_specific_assessments' THEN
        UPDATE public.employers
        SET
            total_role_specific_assessments = (
                SELECT COUNT(*)
                FROM public.role_specific_assessments
                WHERE employer_id = NEW.employer_id AND is_active = true
            ),
            latest_assessment_date = GREATEST(
                COALESCE(latest_assessment_date, '1970-01-01'::date),
                NEW.assessment_date
            ),
            updated_at = NOW()
        WHERE id = NEW.employer_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update assessment counts
CREATE TRIGGER trigger_union_respect_assessment_count_update
    AFTER INSERT OR UPDATE ON public.union_respect_assessments
    FOR EACH ROW EXECUTE FUNCTION public.update_employer_assessment_counts();

CREATE TRIGGER trigger_safety_assessment_count_update
    AFTER INSERT OR UPDATE ON public.safety_assessments_4_point
    FOR EACH ROW EXECUTE FUNCTION public.update_employer_assessment_counts();

CREATE TRIGGER trigger_subcontractor_assessment_count_update
    AFTER INSERT OR UPDATE ON public.subcontractor_use_assessments
    FOR EACH ROW EXECUTE FUNCTION public.update_employer_assessment_counts();

CREATE TRIGGER trigger_role_specific_assessment_count_update
    AFTER INSERT OR UPDATE ON public.role_specific_assessments
    FOR EACH ROW EXECUTE FUNCTION public.update_employer_assessment_counts();

-- Create function to calculate assessment coverage
CREATE OR REPLACE FUNCTION public.calculate_assessment_coverage(p_employer_id uuid)
RETURNS numeric AS $$
DECLARE
    v_total_possible integer := 0;
    v_total_completed integer := 0;
    v_coverage_percentage numeric := 0;
    v_employer_role employer_role_type;
BEGIN
    -- Get employer role
    SELECT role_type INTO v_employer_role
    FROM public.employers
    WHERE id = p_employer_id;

    -- Determine which assessments are expected based on role
    CASE v_employer_role
        WHEN 'trade' THEN
            v_total_possible := 3; -- union_respect, safety, subcontractor
        WHEN 'builder' THEN
            v_total_possible := 4; -- union_respect, safety, subcontractor, role_specific
        WHEN 'both' THEN
            v_total_possible := 4; -- all assessments
        ELSE
            v_total_possible := 3; -- default to basic assessments
    END CASE;

    -- Count completed assessments
    SELECT COALESCE(SUM(assessment_count), 0) INTO v_total_completed
    FROM (
        SELECT COUNT(*) as assessment_count
        FROM public.union_respect_assessments
        WHERE employer_id = p_employer_id AND is_active = true
        AND assessment_complete = true

        UNION ALL

        SELECT COUNT(*) as assessment_count
        FROM public.safety_assessments_4_point
        WHERE employer_id = p_employer_id AND is_active = true
        AND assessment_complete = true

        UNION ALL

        SELECT COUNT(*) as assessment_count
        FROM public.subcontractor_use_assessments
        WHERE employer_id = p_employer_id AND is_active = true
        AND assessment_complete = true

        UNION ALL

        SELECT COUNT(*) as assessment_count
        FROM public.role_specific_assessments
        WHERE employer_id = p_employer_id AND is_active = true
        AND assessment_complete = true
    ) subquery;

    -- Calculate coverage percentage
    IF v_total_possible > 0 THEN
        v_coverage_percentage := (v_total_completed::numeric / v_total_possible::numeric) * 100;
    END IF;

    -- Update employer record
    UPDATE public.employers
    SET assessment_coverage_percentage = v_coverage_percentage
    WHERE id = p_employer_id;

    RETURN v_coverage_percentage;
END;
$$ LANGUAGE plpgsql;

-- Create function to infer employer role from existing data
CREATE OR REPLACE FUNCTION public.infer_employer_role(p_employer_id uuid)
RETURNS employer_role_type AS $$
DECLARE
    v_inferred_role employer_role_type := 'unknown';
    v_has_builder_projects integer := 0;
    v_has_trade_projects integer := 0;
    v_role_votes integer[] := '{}';
    v_most_common_role employer_role_type;
BEGIN
    -- Check project involvement to infer role
    SELECT COUNT(DISTINCT p.id) INTO v_has_builder_projects
    FROM public.projects p
    JOIN public.site_employers se ON p.id = se.employer_id
    WHERE se.employer_id = p_employer_id
    AND p.project_type IN ('private', 'government', 'mixed');

    -- Check for trade-specific indicators
    SELECT COUNT(*) INTO v_has_trade_projects
    FROM public.projects p
    JOIN public.site_employers se ON p.id = se.employer_id
    WHERE se.employer_id = p_employer_id
    AND (p.trade_types && ARRAY['carpentry', 'plumbing', 'electrical', 'concrete'] OR
         EXISTS (
             SELECT 1 FROM jsonb_array_elements(p.project_metadata) as elem
             WHERE elem->>'role' = 'subcontractor'
         ));

    -- Check existing role-specific assessments
    IF EXISTS (SELECT 1 FROM public.role_specific_assessments WHERE employer_id = p_employer_id) THEN
        v_inferred_role := 'builder';
    ELSIF v_has_builder_projects > v_has_trade_projects AND v_has_builder_projects > 2 THEN
        v_inferred_role := 'builder';
    ELSIF v_has_trade_projects > 0 AND v_has_builder_projects = 0 THEN
        v_inferred_role := 'trade';
    ELSIF v_has_builder_projects > 0 AND v_has_trade_projects > 0 THEN
        v_inferred_role := 'both';
    END IF;

    -- Update employer record
    UPDATE public.employers
    SET
        role_type = v_inferred_role,
        last_role_assessment_date = CURRENT_DATE,
        role_confidence_level = CASE
            WHEN v_inferred_role = 'unknown' THEN 'very_low'
            WHEN v_has_builder_projects + v_has_trade_projects > 5 THEN 'high'
            WHEN v_has_builder_projects + v_has_trade_projects > 2 THEN 'medium'
            ELSE 'low'
        END
    WHERE id = p_employer_id;

    RETURN v_inferred_role;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update RLS policies for new employer columns
-- No additional RLS needed as these are extensions to existing table

-- Add comments for documentation
COMMENT ON TYPE public.employer_role_type IS 'Employer role classification: trade, builder, both, or unknown';
COMMENT ON COLUMN public.employers.role_type IS 'Primary role of the employer in construction projects';
COMMENT ON COLUMN public.employers.overall_union_respect_rating IS 'Overall union respect rating on 4-point scale';
COMMENT ON COLUMN public.employers.overall_safety_rating IS 'Overall safety rating on 4-point scale';
COMMENT ON COLUMN public.employers.overall_subcontractor_rating IS 'Overall subcontractor relations rating on 4-point scale';
COMMENT ON COLUMN public.employers.role_specific_rating_summary IS 'JSON summary of role-specific ratings and assessments';
COMMENT ON COLUMN public.employers.last_role_assessment_date IS 'Date when employer role was last assessed or updated';
COMMENT ON COLUMN public.employers.role_confidence_level IS 'Confidence level in the assigned employer role';
COMMENT ON COLUMN public.employers.rating_data_quality_score IS 'Quality score of data used for rating calculations (0-100)';
COMMENT ON COLUMN public.employers.assessment_coverage_percentage IS 'Percentage of required assessments that have been completed';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.update_employer_assessment_counts TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_assessment_coverage TO authenticated;
GRANT EXECUTE ON FUNCTION public.infer_employer_role TO authenticated;