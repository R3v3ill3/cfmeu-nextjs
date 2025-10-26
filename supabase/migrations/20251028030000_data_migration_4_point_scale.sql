-- CFMEU Rating System Transformation - Data Migration for 4-Point Scale
-- This migration converts existing data to the new 4-point rating system
-- and populates the new assessment structures with existing data

-- Create migration tracking table
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

-- Helper function to convert numeric scores to 4-point scale
CREATE OR REPLACE FUNCTION public.convert_numeric_to_4_point(
    p_numeric_score numeric,
    p_invert boolean DEFAULT false
) RETURNS four_point_rating AS $$
DECLARE
    v_converted_score numeric;
BEGIN
    -- Invert if needed (lower numeric scores should be better)
    IF p_invert THEN
        v_converted_score := 100 - p_numeric_score;
    ELSE
        v_converted_score := p_numeric_score;
    END IF;

    -- Convert to 4-point scale (1=good, 2=fair, 3=poor, 4=terrible)
    CASE
        WHEN v_converted_score >= 80 THEN RETURN 'good';
        WHEN v_converted_score >= 60 THEN RETURN 'fair';
        WHEN v_converted_score >= 40 THEN RETURN 'poor';
        ELSE RETURN 'terrible';
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Helper function to convert 4-point rating to numeric score
CREATE OR REPLACE FUNCTION public.convert_4_point_to_numeric(
    p_rating four_point_rating
) RETURNS numeric AS $$
BEGIN
    CASE p_rating
        WHEN 'good' THEN RETURN 1;
        WHEN 'fair' THEN RETURN 2;
        WHEN 'poor' THEN RETURN 3;
        WHEN 'terrible' THEN RETURN 4;
        ELSE RETURN NULL;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Migration Step 1: Infer employer roles from existing data
INSERT INTO public.rating_migration_log (migration_step, step_status, migration_metadata)
VALUES ('infer_employer_roles', 'started', '{"description": "Infer employer roles from project history and existing data"}')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
    v_migration_log_id uuid;
    v_employer_count integer := 0;
    v_updated_count integer := 0;
    rec RECORD;
BEGIN
    -- Get migration log entry
    SELECT id INTO v_migration_log_id
    FROM public.rating_migration_log
    WHERE migration_step = 'infer_employer_roles' AND step_status = 'started'
    ORDER BY created_at DESC LIMIT 1;

    -- Count employers needing role inference
    SELECT COUNT(*) INTO v_employer_count
    FROM public.employers
    WHERE role_type = 'unknown' OR role_type IS NULL;

    -- Infer roles for employers without explicit role assignment
    FOR rec IN
        SELECT id FROM public.employers
        WHERE role_type = 'unknown' OR role_type IS NULL
        LIMIT 1000  -- Process in batches
    LOOP
        PERFORM public.infer_employer_role(rec.id);
        v_updated_count := v_updated_count + 1;
    END LOOP;

    -- Update migration log
    UPDATE public.rating_migration_log
    SET
        step_status = CASE WHEN v_employer_count = v_updated_count THEN 'completed' ELSE 'partial' END,
        records_processed = v_employer_count,
        records_updated = v_updated_count,
        completed_at = NOW(),
        migration_metadata = jsonb_set(
            migration_metadata,
            '{total_employers}',
            to_jsonb(v_employer_count)
        ) || jsonb_build_object(
            'roles_assigned', v_updated_count,
            'completion_percentage', CASE WHEN v_employer_count > 0 THEN (v_updated_count::numeric / v_employer_count::numeric) * 100 ELSE 0 END
        )
    WHERE id = v_migration_log_id;

    RAISE NOTICE 'Employer role inference completed: % of % employers processed', v_updated_count, v_employer_count;
END $$;

-- Migration Step 2: Convert existing safety assessments to 4-point scale
INSERT INTO public.rating_migration_log (migration_step, step_status, migration_metadata)
VALUES ('convert_safety_assessments', 'started', '{"description": "Convert existing safety assessments to 4-point scale"}')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
    v_migration_log_id uuid;
    v_existing_assessments integer := 0;
    v_converted_assessments integer := 0;
    rec RECORD;
BEGIN
    SELECT id INTO v_migration_log_id
    FROM public.rating_migration_log
    WHERE migration_step = 'convert_safety_assessments' AND step_status = 'started'
    ORDER BY created_at DESC LIMIT 1;

    -- Count existing safety-related assessments
    SELECT COUNT(*) INTO v_existing_assessments
    FROM public.project_compliance_assessments pca
    WHERE pca.assessment_type IN ('safety_incidents', 'site_visit_report')
      AND pca.is_active = true
      AND pca.score IS NOT NULL;

    -- Convert safety assessments
    FOR rec IN
        SELECT DISTINCT
            pca.employer_id,
            pca.project_id,
            pca.assessment_date,
            pca.score as safety_score,
            pca.assessment_type,
            pca.confidence_level,
            pca.assessment_notes,
            p.name as assessor_name
        FROM public.project_compliance_assessments pca
        LEFT JOIN public.profiles p ON pca.created_by = p.id
        WHERE pca.assessment_type IN ('safety_incidents', 'site_visit_report')
          AND pca.is_active = true
          AND pca.score IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.safety_assessments_4_point sa
              WHERE sa.employer_id = pca.employer_id
                AND sa.project_id = pca.project_id
                AND sa.assessment_date = pca.assessment_date
          )
        LIMIT 1000
    LOOP
        INSERT INTO public.safety_assessments_4_point (
            employer_id,
            project_id,
            assessment_date,
            overall_safety_score,
            overall_safety_rating,
            hsr_respect_score,
            hsr_respect_rating,
            general_safety_score,
            general_safety_rating,
            safety_incidents_score,
            safety_incidents_rating,
            assessment_method,
            confidence_level,
            assessor_name,
            assessment_notes,
            assessment_complete,
            is_active,
            created_by,
            updated_by
        ) VALUES (
            rec.employer_id,
            rec.project_id,
            rec.assessment_date,
            public.convert_4_point_to_numeric(public.convert_numeric_to_4_point(rec.safety_score, true)),
            public.convert_numeric_to_4_point(rec.safety_score, true),
            public.convert_4_point_to_numeric(public.convert_numeric_to_4_point(rec.safety_score, true)),
            public.convert_numeric_to_4_point(rec.safety_score, true),
            public.convert_4_point_to_numeric(public.convert_numeric_to_4_point(rec.safety_score, true)),
            public.convert_numeric_to_4_point(rec.safety_score, true),
            public.convert_4_point_to_numeric(public.convert_numeric_to_4_point(rec.safety_score, true)),
            public.convert_numeric_to_4_point(rec.safety_score, true),
            CASE WHEN rec.assessment_type = 'site_visit_report' THEN 'site_inspection' ELSE 'incident_analysis' END,
            rec.confidence_level,
            rec.assessor_name,
            'Migrated from legacy safety assessment',
            true,
            true,
            current_setting('request.jwt.claims')::json->>'sub',
            current_setting('request.jwt.claims')::json->>'sub'
        );

        v_converted_assessments := v_converted_assessments + 1;
    END LOOP;

    UPDATE public.rating_migration_log
    SET
        step_status = CASE WHEN v_converted_assessments >= v_existing_assessments THEN 'completed' ELSE 'partial' END,
        records_processed = v_existing_assessments,
        records_created = v_converted_assessments,
        completed_at = NOW(),
        migration_metadata = jsonb_set(
            migration_metadata,
            '{total_assessments}',
            to_jsonb(v_existing_assessments)
        ) || jsonb_build_object(
            'converted', v_converted_assessments,
            'completion_percentage', CASE WHEN v_existing_assessments > 0 THEN (v_converted_assessments::numeric / v_existing_assessments::numeric) * 100 ELSE 0 END
        )
    WHERE id = v_migration_log_id;

    RAISE NOTICE 'Safety assessment conversion completed: % of % assessments converted', v_converted_assessments, v_existing_assessments;
END $$;

-- Migration Step 3: Create union respect assessments from existing compliance data
INSERT INTO public.rating_migration_log (migration_step, step_status, migration_metadata)
VALUES ('create_union_respect_assessments', 'started', '{"description": "Create union respect assessments from existing compliance and delegate reports"}')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
    v_migration_log_id uuid;
    v_source_records integer := 0;
    v_created_assessments integer := 0;
    rec RECORD;
BEGIN
    SELECT id INTO v_migration_log_id
    FROM public.rating_migration_log
    WHERE migration_step = 'create_union_respect_assessments' AND step_status = 'started'
    ORDER BY created_at DESC LIMIT 1;

    -- Count source records for union respect assessment creation
    SELECT COUNT(*) INTO v_source_records
    FROM (
        SELECT DISTINCT employer_id, project_id
        FROM public.delegate_compliance_reports
        WHERE union_cooperation_score IS NOT NULL

        UNION

        SELECT DISTINCT employer_id, project_id
        FROM public.organiser_compliance_reports
        WHERE overall_assessment IS NOT NULL

        UNION

        SELECT DISTINCT employer_id, project_id
        FROM public.project_compliance_assessments
        WHERE assessment_type IN ('organiser_verbal_report', 'organiser_written_report')
          AND score IS NOT NULL
    ) source_data;

    -- Create union respect assessments from delegate reports
    FOR rec IN
        SELECT
            dcr.employer_id,
            dcr.project_id,
            dcr.report_date as assessment_date,
            dcr.union_cooperation_score,
            dcr.confidence_level,
            dcr.report_text,
            dcr.urgent_escalations,
            p.name as assessor_name,
            'delegate_interview' as assessment_method
        FROM public.delegate_compliance_reports dcr
        LEFT JOIN public.profiles p ON dcr.delegate_id = p.id
        WHERE dcr.union_cooperation_score IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.union_respect_assessments ura
              WHERE ura.employer_id = dcr.employer_id
                AND ura.project_id = dcr.project_id
                AND ura.assessment_date = dcr.report_date
          )
        LIMIT 500
    LOOP
        INSERT INTO public.union_respect_assessments (
            employer_id,
            project_id,
            assessment_date,
            right_of_entry_score,
            right_of_entry_rating,
            delegate_accommodation_score,
            delegate_accommodation_rating,
            access_to_information_score,
            access_to_information_rating,
            access_to_inductions_score,
            access_to_inductions_rating,
            overall_union_respect_score,
            overall_union_respect_rating,
            assessment_method,
            confidence_level,
            assessor_name,
            assessment_notes,
            concerns_raised,
            assessment_complete,
            is_active,
            created_by,
            updated_by
        ) VALUES (
            rec.employer_id,
            rec.project_id,
            rec.assessment_date,
            public.convert_4_point_to_numeric(public.convert_numeric_to_4_point(rec.union_cooperation_score, false)),
            public.convert_numeric_to_4_point(rec.union_cooperation_score, false),
            public.convert_4_point_to_numeric(public.convert_numeric_to_4_point(rec.union_cooperation_score, false)),
            public.convert_numeric_to_4_point(rec.union_cooperation_score, false),
            public.convert_4_point_to_numeric(public.convert_numeric_to_4_point(rec.union_cooperation_score, false)),
            public.convert_numeric_to_4_point(rec.union_cooperation_score, false),
            public.convert_4_point_to_numeric(public.convert_numeric_to_4_point(rec.union_cooperation_score, false)),
            public.convert_numeric_to_4_point(rec.union_cooperation_score, false),
            public.convert_4_point_to_numeric(public.convert_numeric_to_4_point(rec.union_cooperation_score, false)),
            public.convert_numeric_to_4_point(rec.union_cooperation_score, false),
            rec.assessment_method,
            rec.confidence_level,
            rec.assessor_name,
            'Migrated from delegate compliance report: ' || COALESCE(rec.report_text, 'No notes provided'),
            CASE WHEN rec.urgent_escalations THEN '["Urgent escalation recorded"]' ELSE '[]'::jsonb END,
            true,
            true,
            current_setting('request.jwt.claims')::json->>'sub',
            current_setting('request.jwt.claims')::json->>'sub'
        );

        v_created_assessments := v_created_assessments + 1;
    END LOOP;

    UPDATE public.rating_migration_log
    SET
        step_status = CASE WHEN v_created_assessments >= v_source_records * 0.8 THEN 'completed' ELSE 'partial' END,
        records_processed = v_source_records,
        records_created = v_created_assessments,
        completed_at = NOW(),
        migration_metadata = jsonb_set(
            migration_metadata,
            '{total_source_records}',
            to_jsonb(v_source_records)
        ) || jsonb_build_object(
            'assessments_created', v_created_assessments,
            'completion_percentage', CASE WHEN v_source_records > 0 THEN (v_created_assessments::numeric / v_source_records::numeric) * 100 ELSE 0 END
        )
    WHERE id = v_migration_log_id;

    RAISE NOTICE 'Union respect assessment creation completed: % assessments created from % source records', v_created_assessments, v_source_records;
END $$;

-- Migration Step 4: Create subcontractor use assessments from project data
INSERT INTO public.rating_migration_log (migration_step, step_status, migration_metadata)
VALUES ('create_subcontractor_assessments', 'started', '{"description": "Create subcontractor use assessments from existing project and site data"}')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
    v_migration_log_id uuid;
    v_projects_with_data integer := 0;
    v_created_assessments integer := 0;
    rec RECORD;
BEGIN
    SELECT id INTO v_migration_log_id
    FROM public.rating_migration_log
    WHERE migration_step = 'create_subcontractor_assessments' AND step_status = 'started'
    ORDER BY created_at DESC LIMIT 1;

    -- Count projects that might have subcontractor data
    SELECT COUNT(DISTINCT project_id) INTO v_projects_with_data
    FROM public.projects p
    WHERE p.project_metadata ? 'subcontractors'
       OR p.project_metadata ? 'workforce_breakdown'
       OR EXISTS (
           SELECT 1 FROM public.project_compliance_assessments pca
           WHERE pca.project_id = p.id
             AND pca.assessment_type = 'payment_issues'
       );

    -- Create subcontractor assessments based on available data
    FOR rec IN
        SELECT DISTINCT
            p.id as project_id,
            COALESCE(pse.employer_id, e.id) as employer_id,
            CURRENT_DATE as assessment_date,
            e.name as employer_name
        FROM public.projects p
        LEFT JOIN public.site_employers pse ON p.id = pse.project_id
        LEFT JOIN public.employers e ON (
            pse.employer_id = e.id OR
            (pse.employer_id IS NULL AND e.name = p.primary_contractor_name)
        )
        WHERE (p.project_metadata ? 'subcontractors'
              OR p.project_metadata ? 'workforce_breakdown')
          AND NOT EXISTS (
              SELECT 1 FROM public.subcontractor_use_assessments sua
              WHERE sua.project_id = p.id
                AND sua.employer_id = COALESCE(pse.employer_id, e.id)
                AND sua.assessment_date = CURRENT_DATE
          )
        LIMIT 300
    LOOP
        -- Extract subcontractor data from project metadata
        DECLARE
            v_subcontractor_count integer := 0;
            v_subcontractor_percentage numeric := 0;
            v_payment_issues_count integer := 0;
        BEGIN
            -- Try to extract subcontractor count from metadata
            SELECT (p.project_metadata->>'subcontractor_count')::integer INTO v_subcontractor_count
            FROM public.projects p
            WHERE p.id = rec.project_id;

            -- Calculate subcontractor percentage if available
            SELECT (p.project_metadata->>'subcontractor_percentage')::numeric INTO v_subcontractor_percentage
            FROM public.projects p
            WHERE p.id = rec.project_id;

            -- Count payment issues
            SELECT COUNT(*) INTO v_payment_issues_count
            FROM public.project_compliance_assessments pca
            WHERE pca.project_id = rec.project_id
              AND pca.employer_id = rec.employer_id
              AND pca.assessment_type = 'payment_issues';

            -- Insert subcontractor assessment
            INSERT INTO public.subcontractor_use_assessments (
                employer_id,
                project_id,
                assessment_date,
                subcontractor_count,
                subcontractor_percentage,
                usage_score,
                usage_rating,
                usage_notes,
                assessment_basis,
                assessment_complete,
                is_active,
                created_by,
                updated_by
            ) VALUES (
                rec.employer_id,
                rec.project_id,
                rec.assessment_date,
                COALESCE(v_subcontractor_count, 0),
                COALESCE(v_subcontractor_percentage, 0),
                CASE
                    WHEN v_payment_issues_count = 0 AND v_subcontractor_percentage BETWEEN 20 AND 80 THEN 1  -- Good
                    WHEN v_payment_issues_count <= 2 THEN 2  -- Fair
                    WHEN v_payment_issues_count <= 5 THEN 3  -- Poor
                    ELSE 4  -- Terrible
                END,
                CASE
                    WHEN v_payment_issues_count = 0 AND v_subcontractor_percentage BETWEEN 20 AND 80 THEN 'good'
                    WHEN v_payment_issues_count <= 2 THEN 'fair'
                    WHEN v_payment_issues_count <= 5 THEN 'poor'
                    ELSE 'terrible'
                END,
                format('Migrated from project data. Subcontractors: %s, Payment issues: %s', v_subcontractor_count, v_payment_issues_count),
                'project_observation',
                true,
                true,
                current_setting('request.jwt.claims')::json->>'sub',
                current_setting('request.jwt.claims')::json->>'sub'
            );

            v_created_assessments := v_created_assessments + 1;
        END;
    END LOOP;

    UPDATE public.rating_migration_log
    SET
        step_status = CASE WHEN v_created_assessments >= v_projects_with_data * 0.6 THEN 'completed' ELSE 'partial' END,
        records_processed = v_projects_with_data,
        records_created = v_created_assessments,
        completed_at = NOW(),
        migration_metadata = jsonb_set(
            migration_metadata,
            '{total_projects}',
            to_jsonb(v_projects_with_data)
        ) || jsonb_build_object(
            'assessments_created', v_created_assessments,
            'completion_percentage', CASE WHEN v_projects_with_data > 0 THEN (v_created_assessments::numeric / v_projects_with_data::numeric) * 100 ELSE 0 END
        )
    WHERE id = v_migration_log_id;

    RAISE NOTICE 'Subcontractor assessment creation completed: % assessments created from % projects', v_created_assessments, v_projects_with_data;
END $$;

-- Migration Step 5: Update employer rating summaries
INSERT INTO public.rating_migration_log (migration_step, step_status, migration_metadata)
VALUES ('update_employer_summaries', 'started', '{"description": "Update employer rating summaries with new 4-point scale data"}')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
    v_migration_log_id uuid;
    v_total_employers integer := 0;
    v_updated_employers integer := 0;
    rec RECORD;
BEGIN
    SELECT id INTO v_migration_log_id
    FROM public.rating_migration_log
    WHERE migration_step = 'update_employer_summaries' AND step_status = 'started'
    ORDER BY created_at DESC LIMIT 1;

    -- Count employers to update
    SELECT COUNT(*) INTO v_total_employers
    FROM public.employers e
    WHERE EXISTS (
        SELECT 1 FROM public.union_respect_assessments ura
        WHERE ura.employer_id = e.id AND ura.is_active = true
    ) OR EXISTS (
        SELECT 1 FROM public.safety_assessments_4_point sa
        WHERE sa.employer_id = e.id AND sa.is_active = true
    ) OR EXISTS (
        SELECT 1 FROM public.subcontractor_use_assessments sua
        WHERE sua.employer_id = e.id AND sua.is_active = true
    );

    -- Update employer summaries
    FOR rec IN
        SELECT e.id
        FROM public.employers e
        WHERE EXISTS (
            SELECT 1 FROM public.union_respect_assessments ura
            WHERE ura.employer_id = e.id AND ura.is_active = true
        ) OR EXISTS (
            SELECT 1 FROM public.safety_assessments_4_point sa
            WHERE sa.employer_id = e.id AND sa.is_active = true
        ) OR EXISTS (
            SELECT 1 FROM public.subcontractor_use_assessments sua
            WHERE sua.employer_id = e.id AND sua.is_active = true
        )
        LIMIT 1000
    LOOP
        -- Calculate latest union respect rating
        UPDATE public.employers
        SET
            overall_union_respect_rating = (
                SELECT overall_union_respect_rating
                FROM public.union_respect_assessments
                WHERE employer_id = rec.id AND is_active = true
                ORDER BY assessment_date DESC, created_at DESC
                LIMIT 1
            ),
            overall_union_respect_score = (
                SELECT overall_union_respect_score
                FROM public.union_respect_assessments
                WHERE employer_id = rec.id AND is_active = true
                ORDER BY assessment_date DESC, created_at DESC
                LIMIT 1
            ),
            overall_safety_rating = (
                SELECT overall_safety_rating
                FROM public.safety_assessments_4_point
                WHERE employer_id = rec.id AND is_active = true
                ORDER BY assessment_date DESC, created_at DESC
                LIMIT 1
            ),
            overall_safety_score = (
                SELECT overall_safety_score
                FROM public.safety_assessments_4_point
                WHERE employer_id = rec.id AND is_active = true
                ORDER BY assessment_date DESC, created_at DESC
                LIMIT 1
            ),
            overall_subcontractor_rating = (
                SELECT overall_subcontractor_rating
                FROM public.subcontractor_use_assessments
                WHERE employer_id = rec.id AND is_active = true
                ORDER BY assessment_date DESC, created_at DESC
                LIMIT 1
            ),
            overall_subcontractor_score = (
                SELECT overall_subcontractor_score
                FROM public.subcontractor_use_assessments
                WHERE employer_id = rec.id AND is_active = true
                ORDER BY assessment_date DESC, created_at DESC
                LIMIT 1
            ),
            last_4_point_rating_calculation = NOW(),
            rating_data_quality_score = CASE
                WHEN (
                    (SELECT COUNT(*) FROM public.union_respect_assessments WHERE employer_id = rec.id AND is_active = true) +
                    (SELECT COUNT(*) FROM public.safety_assessments_4_point WHERE employer_id = rec.id AND is_active = true) +
                    (SELECT COUNT(*) FROM public.subcontractor_use_assessments WHERE employer_id = rec.id AND is_active = true)
                ) >= 3 THEN 80
                WHEN (
                    (SELECT COUNT(*) FROM public.union_respect_assessments WHERE employer_id = rec.id AND is_active = true) +
                    (SELECT COUNT(*) FROM public.safety_assessments_4_point WHERE employer_id = rec.id AND is_active = true) +
                    (SELECT COUNT(*) FROM public.subcontractor_use_assessments WHERE employer_id = rec.id AND is_active = true)
                ) >= 1 THEN 50
                ELSE 20
            END
        WHERE id = rec.id;

        -- Update assessment coverage
        PERFORM public.calculate_assessment_coverage(rec.id);

        v_updated_employers := v_updated_employers + 1;
    END LOOP;

    UPDATE public.rating_migration_log
    SET
        step_status = 'completed',
        records_processed = v_total_employers,
        records_updated = v_updated_employers,
        completed_at = NOW(),
        migration_metadata = jsonb_set(
            migration_metadata,
            '{total_employers}',
            to_jsonb(v_total_employers)
        ) || jsonb_build_object(
            'employers_updated', v_updated_employers,
            'completion_percentage', CASE WHEN v_total_employers > 0 THEN (v_updated_employers::numeric / v_total_employers::numeric) * 100 ELSE 0 END
        )
    WHERE id = v_migration_log_id;

    RAISE NOTICE 'Employer summary update completed: % of % employers updated', v_updated_employers, v_total_employers;
END $$;

-- Final step: Create migration summary
INSERT INTO public.rating_migration_log (migration_step, step_status, migration_metadata)
SELECT
    'migration_summary',
    'completed',
    jsonb_build_object(
        'description', 'Summary of 4-point scale data migration',
        'migration_completed_at', NOW(),
        'total_steps', 5,
        'employers_processed', (SELECT COUNT(*) FROM public.employers WHERE role_type != 'unknown'),
        'union_respect_assessments', (SELECT COUNT(*) FROM public.union_respect_assessments WHERE is_active = true),
        'safety_assessments_4_point', (SELECT COUNT(*) FROM public.safety_assessments_4_point WHERE is_active = true),
        'subcontractor_assessments', (SELECT COUNT(*) FROM public.subcontractor_use_assessments WHERE is_active = true),
        'employers_with_ratings', (
            SELECT COUNT(*) FROM public.employers
            WHERE overall_union_respect_rating IS NOT NULL
               OR overall_safety_rating IS NOT NULL
               OR overall_subcontractor_rating IS NOT NULL
        )
    )
WHERE NOT EXISTS (
    SELECT 1 FROM public.rating_migration_log
    WHERE migration_step = 'migration_summary'
);

-- Create view for migration status monitoring
CREATE OR REPLACE VIEW public.rating_migration_status AS
SELECT
    migration_step,
    step_status,
    records_processed,
    records_created,
    records_updated,
    error_message,
    created_at,
    completed_at,
    CASE
        WHEN completed_at IS NOT NULL THEN completed_at - created_at
        ELSE NULL
    END as duration,
    migration_metadata
FROM public.rating_migration_log
ORDER BY created_at;

-- Grant permissions
GRANT SELECT ON public.rating_migration_log TO authenticated;
GRANT SELECT ON public.rating_migration_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_numeric_to_4_point TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_4_point_to_numeric TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.rating_migration_log IS 'Migration tracking log for 4-point rating system transformation';
COMMENT ON VIEW public.rating_migration_status IS 'View for monitoring migration progress and status';
COMMENT ON FUNCTION public.convert_numeric_to_4_point IS 'Converts legacy numeric scores to 4-point rating scale';
COMMENT ON FUNCTION public.convert_4_point_to_numeric IS 'Converts 4-point rating to numeric score for calculations';