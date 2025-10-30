-- Update Organiser Expertise Assessment System for 4-Point Rating with Weighted Calculation
-- This migration updates the organiser expertise assessment tables to support the new 4-point system
-- and implements the weighted rating calculation function based on project count

-- First, create the expertise assessment details table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.expertise_assessment_details_4point (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    expertise_assessment_id uuid NOT NULL REFERENCES public.organiser_overall_expertise_ratings(id) ON DELETE CASCADE,
    employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    organiser_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assessment_date date NOT NULL,

    -- Union Respect assessments (5 criteria, 1-4 scale where 1=Good, 4=Terrible)
    union_right_of_entry integer CHECK (union_right_of_entry BETWEEN 1 AND 4),
    union_delegate_accommodation integer CHECK (union_delegate_accommodation BETWEEN 1 AND 4),
    union_access_to_information integer CHECK (union_access_to_information BETWEEN 1 AND 4),
    union_access_to_inductions integer CHECK (union_access_to_inductions BETWEEN 1 AND 4),
    union_eba_status integer CHECK (union_eba_status BETWEEN 1 AND 4),

    -- Safety assessments (3 criteria, 1-4 scale where 1=Good, 4=Terrible)
    safety_site_safety integer CHECK (safety_site_safety BETWEEN 1 AND 4),
    safety_safety_procedures integer CHECK (safety_procedures BETWEEN 1 AND 4),
    safety_incident_reporting integer CHECK (incident_reporting BETWEEN 1 AND 4),

    -- Subcontractor assessments (1 criterion, 1-4 scale where 1=Good, 4=Terrible)
    subcontractor_usage integer CHECK (subcontractor_usage BETWEEN 1 AND 4),

    -- Compliance assessments (3 binary checks converted to 1-4 scale)
    compliance_cbus integer CHECK (compliance_cbus BETWEEN 1 AND 4),
    compliance_incolink integer CHECK (compliance_incolink BETWEEN 1 AND 4),
    compliance_payment_timing integer CHECK (payment_timing BETWEEN 1 AND 4),

    -- Frequency scale responses (stored for audit trail)
    frequency_responses jsonb DEFAULT '{}',

    -- Assessment metadata
    assessment_method text CHECK (assessment_method IN ('site_visit', 'phone_call', 'union_meeting', 'worker_interview', 'document_review', 'other')) DEFAULT 'site_visit',
    notes text,
    evidence_urls text[],
    follow_up_required boolean DEFAULT false,
    follow_up_date date,
    confidence_factors jsonb DEFAULT '{}',

    -- Calculation audit trail
    union_respect_avg numeric,
    safety_avg numeric,
    compliance_avg numeric,
    overall_calculated_score numeric,
    calculation_weights jsonb DEFAULT '{}',

    -- Timestamps
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,

    UNIQUE(expertise_assessment_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_expertise_assessment_details_4point_assessment ON public.expertise_assessment_details_4point(expertise_assessment_id);
CREATE INDEX IF NOT EXISTS idx_expertise_assessment_details_4point_employer ON public.expertise_assessment_details_4point(employer_id, assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_expertise_assessment_details_4point_organiser ON public.expertise_assessment_details_4point(organiser_id, assessment_date DESC);

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
    END IF;

    -- Add 4-point score column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organiser_overall_expertise_ratings'
        AND column_name = 'overall_score_4point'
    ) THEN
        ALTER TABLE public.organiser_overall_expertise_ratings
        ADD COLUMN overall_score_4point numeric CHECK (overall_score_4point >= 1 AND overall_score_4point <= 4);
    END IF;

    -- Add assessment responses JSON column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organiser_overall_expertise_ratings'
        AND column_name = 'assessment_responses_4point'
    ) THEN
        ALTER TABLE public.organiser_overall_expertise_ratings
        ADD COLUMN assessment_responses_4point jsonb DEFAULT '{}';
    END IF;

    -- Add frequency scale responses column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organiser_overall_expertise_ratings'
        AND column_name = 'frequency_scale_responses'
    ) THEN
        ALTER TABLE public.organiser_overall_expertise_ratings
        ADD COLUMN frequency_scale_responses jsonb DEFAULT '{}';
    END IF;

    -- Add weight calculation audit column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organiser_overall_expertise_ratings'
        AND column_name = 'weight_calculation_audit'
    ) THEN
        ALTER TABLE public.organiser_overall_expertise_ratings
        ADD COLUMN weight_calculation_audit jsonb DEFAULT '{}';
    END IF;
END $$;

-- Create the main weighted rating calculation function
CREATE OR REPLACE FUNCTION public.calculate_weighted_employer_rating_4point(
    p_employer_id uuid,
    p_calculation_date date DEFAULT CURRENT_DATE,
    p_force_recalculate boolean DEFAULT false
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
    v_project_data jsonb;
    v_organiser_data jsonb;
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

    -- Calculate dynamic weight distribution based on project count
    -- Formula: Start at 100% organiser expertise when 0 projects
    -- Decrease organiser weight by 10% for EACH project assessment
    -- Increase project data weight by 10% for EACH project assessment
    -- Cap at 90% project data, 10% organiser expertise
    v_project_weight := LEAST(0.9, v_project_count * 0.10);
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
        SELECT
            jsonb_agg(
                jsonb_build_object(
                    'assessment_type', pca.assessment_type,
                    'score', pca.score,
                    'rating', pca.rating,
                    'assessment_date', pca.assessment_date,
                    'confidence_level', pca.confidence_level
                ) ORDER BY pca.assessment_date DESC
            ),
            MAX(pca.assessment_date)
        INTO v_project_data, v_latest_project_date
        FROM public.project_compliance_assessments pca
        WHERE pca.employer_id = p_employer_id
          AND pca.assessment_date >= p_calculation_date - INTERVAL '12 months'
          AND pca.is_active = true
          AND pca.score IS NOT NULL;

        v_project_assessments_exist := true;

        -- Convert project rating to 4-point scale
        -- This is a simplified conversion - in practice, you might want more sophisticated logic
        IF v_project_data IS NOT NULL THEN
            -- Calculate average project score and convert to 4-point scale
            DECLARE
                v_avg_score numeric := 0;
                v_score_count integer := 0;
            BEGIN
                SELECT AVG((score + 100) / 50)::numeric, COUNT(*)
                INTO v_avg_score, v_score_count
                FROM jsonb_to_recordset(v_project_data) AS x(assessment_type text, score numeric, rating text, assessment_date date, confidence_level text)
                WHERE score IS NOT NULL;

                IF v_avg_score IS NOT NULL THEN
                    -- Convert -100 to 100 scale to 1-4 scale
                    v_project_rating := GREATEST(1, LEAST(4, ROUND(((v_avg_score - 1) / 3) + 1)));
                END IF;
            END;
        END IF;
    END IF;

    -- Get organiser expertise rating
    SELECT
        jsonb_agg(
            jsonb_build_object(
                'assessment_id', oea.id,
                'overall_score_4point', oea.overall_score_4point,
                'overall_rating_4point', oea.overall_rating_4point,
                'assessment_date', oea.assessment_date,
                'confidence_level', oea.confidence_level,
                'organiser_name', p.name,
                'assessment_responses', oea.assessment_responses_4point,
                'frequency_responses', oea.frequency_scale_responses
            ) ORDER BY oea.assessment_date DESC
        ),
        MAX(oea.assessment_date)
    INTO v_organiser_data, v_latest_organiser_date
    FROM public.organiser_overall_expertise_ratings oea
    JOIN public.profiles p ON oea.organiser_id = p.id
    WHERE oea.employer_id = p_employer_id
      AND oea.assessment_date >= p_calculation_date - INTERVAL '6 months'
      AND oea.is_active = true
      AND oea.overall_score_4point IS NOT NULL;

    IF v_organiser_data IS NOT NULL THEN
        v_organiser_assessments_exist := true;

        -- Calculate weighted organiser rating
        DECLARE
            v_weighted_sum numeric := 0;
            v_total_weight numeric := 0;
            rec jsonb;
        BEGIN
            FOR rec IN SELECT * FROM jsonb_array_elements(v_organiser_data) LOOP
                DECLARE
                    v_assessment_weight numeric := 1.0;
                    v_confidence_multiplier numeric := 1.0;
                BEGIN
                    -- Adjust weight based on confidence level
                    CASE (rec->>'confidence_level')
                        WHEN 'high' THEN v_confidence_multiplier := 1.2;
                        WHEN 'medium' THEN v_confidence_multiplier := 1.0;
                        WHEN 'low' THEN v_confidence_multiplier := 0.8;
                        ELSE v_confidence_multiplier := 0.6;
                    END CASE;

                    -- More recent assessments get higher weight
                    IF (rec->>'assessment_date')::date >= p_calculation_date - INTERVAL '30 days' THEN
                        v_assessment_weight := v_confidence_multiplier * 1.5;
                    ELSIF (rec->>'assessment_date')::date >= p_calculation_date - INTERVAL '90 days' THEN
                        v_assessment_weight := v_confidence_multiplier * 1.0;
                    ELSE
                        v_assessment_weight := v_confidence_multiplier * 0.7;
                    END IF;

                    v_weighted_sum := v_weighted_sum + ((rec->>'overall_score_4point')::numeric * v_assessment_weight);
                    v_total_weight := v_total_weight + v_assessment_weight;
                END;
            END LOOP;

            IF v_total_weight > 0 THEN
                v_organiser_rating := v_weighted_sum / v_total_weight;
                v_organiser_rating := GREATEST(1, LEAST(4, ROUND(v_organiser_rating)));
            END IF;
        END;
    END IF;

    -- Get EBA status for gating
    SELECT get_employer_eba_status_4point(p_employer_id), get_employer_eba_rating_4point(p_employer_id)
    INTO v_eba_data;

    -- Calculate final weighted rating
    v_final_rating := (v_project_rating * v_project_weight) + (v_organiser_rating * v_organiser_weight);
    v_final_rating := GREATEST(1, LEAST(4, ROUND(v_final_rating)));

    -- Apply EBA gating: EBA status determines the maximum possible rating
    -- An employer cannot have a green rating without a valid EBA
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
            -- No change needed
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
            'assessments_exist', v_organiser_assessments_exist,
            'assessment_count', COALESCE(jsonb_array_length(v_organiser_data), 0)
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
        'project_weight', v_project_weight,
        'organiser_rating', v_organiser_rating,
        'organiser_weight', v_organiser_weight,

        -- Quality indicators
        'data_quality', v_data_quality,
        'project_assessments_exist', v_project_assessments_exist,
        'organiser_assessments_exist', v_organiser_assessments_exist,

        -- Audit trail
        'weight_distribution', v_weight_distribution,
        'calculation_audit', v_calculation_audit,

        -- Raw data for analysis
        'project_data', v_project_data,
        'organiser_data', v_organiser_data,
        'eba_data', v_eba_data,

        -- Metadata
        'calculated_at', now(),
        'calculation_version', '4point_v1.0'
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update organiser expertise rating with 4-point data
CREATE OR REPLACE FUNCTION public.update_organiser_expertise_rating_4point(
    p_expertise_assessment_id uuid,
    p_assessment_responses jsonb,
    p_frequency_responses jsonb,
    p_overall_score numeric,
    p_overall_rating integer
) RETURNS uuid AS $$
DECLARE
    v_updated_id uuid;
BEGIN
    -- Update the main expertise assessment record
    UPDATE public.organiser_overall_expertise_ratings
    SET
        overall_score_4point = p_overall_score,
        overall_rating_4point = p_overall_rating,
        assessment_responses_4point = p_assessment_responses,
        frequency_scale_responses = p_frequency_responses,
        weight_calculation_audit = jsonb_build_object(
            'updated_at', now(),
            'assessment_responses', p_assessment_responses,
            'frequency_responses', p_frequency_responses,
            'calculated_score', p_overall_score,
            'calculated_rating', p_overall_rating
        ),
        updated_at = now()
    WHERE id = p_expertise_assessment_id
    RETURNING id INTO v_updated_id;

    -- Update or insert the detailed assessment record
    INSERT INTO public.expertise_assessment_details_4point (
        expertise_assessment_id,
        employer_id,
        organiser_id,
        assessment_date,

        -- Union Respect
        union_right_of_entry,
        union_delegate_accommodation,
        union_access_to_information,
        union_access_to_inductions,
        union_eba_status,

        -- Safety
        safety_site_safety,
        safety_safety_procedures,
        safety_incident_reporting,

        -- Subcontractor
        subcontractor_usage,

        -- Compliance
        compliance_cbus,
        compliance_incolink,
        compliance_payment_timing,

        -- Audit trail
        frequency_responses,
        overall_calculated_score,
        union_respect_avg,
        safety_avg,
        compliance_avg,
        updated_at
    ) VALUES (
        p_expertise_assessment_id,
        (SELECT employer_id FROM public.organiser_overall_expertise_ratings WHERE id = p_expertise_assessment_id),
        (SELECT organiser_id FROM public.organiser_overall_expertise_ratings WHERE id = p_expertise_assessment_id),
        (SELECT assessment_date FROM public.organiser_overall_expertise_ratings WHERE id = p_expertise_assessment_id),

        -- Extract numeric values from assessment responses
        (p_assessment_responses->>'union_right_of_entry')::integer,
        (p_assessment_responses->>'union_delegate_accommodation')::integer,
        (p_assessment_responses->>'union_access_to_information')::integer,
        (p_assessment_responses->>'union_access_to_inductions')::integer,
        (p_assessment_responses->>'union_eba_status')::integer,

        (p_assessment_responses->>'safety_site_safety')::integer,
        (p_assessment_responses->>'safety_safety_procedures')::integer,
        (p_assessment_responses->>'safety_incident_reporting')::integer,

        (p_assessment_responses->>'subcontractor_usage')::integer,

        (p_assessment_responses->>'compliance_cbus')::integer,
        (p_assessment_responses->>'compliance_incolink')::integer,
        (p_assessment_responses->>'compliance_payment_timing')::integer,

        p_frequency_responses,
        p_overall_score,
        -- Calculate category averages
        (
            (p_assessment_responses->>'union_right_of_entry')::integer +
            (p_assessment_responses->>'union_delegate_accommodation')::integer +
            (p_assessment_responses->>'union_access_to_information')::integer +
            (p_assessment_responses->>'union_access_to_inductions')::integer +
            (p_assessment_responses->>'union_eba_status')::integer
        )::numeric / 5.0,
        (
            (p_assessment_responses->>'safety_site_safety')::integer +
            (p_assessment_responses->>'safety_safety_procedures')::integer +
            (p_assessment_responses->>'safety_incident_reporting')::integer
        )::numeric / 3.0,
        (
            (p_assessment_responses->>'compliance_cbus')::integer +
            (p_assessment_responses->>'compliance_incolink')::integer +
            (p_assessment_responses->>'compliance_payment_timing')::integer
        )::numeric / 3.0,
        now()
    )
    ON CONFLICT (expertise_assessment_id)
    DO UPDATE SET
        union_right_of_entry = EXCLUDED.union_right_of_entry,
        union_delegate_accommodation = EXCLUDED.union_delegate_accommodation,
        union_access_to_information = EXCLUDED.union_access_to_information,
        union_access_to_inductions = EXCLUDED.union_access_to_inductions,
        union_eba_status = EXCLUDED.union_eba_status,
        safety_site_safety = EXCLUDED.safety_site_safety,
        safety_safety_procedures = EXCLUDED.safety_safety_procedures,
        safety_incident_reporting = EXCLUDED.safety_incident_reporting,
        subcontractor_usage = EXCLUDED.subcontractor_usage,
        compliance_cbus = EXCLUDED.compliance_cbus,
        compliance_incolink = EXCLUDED.compliance_incolink,
        compliance_payment_timing = EXCLUDED.compliance_payment_timing,
        frequency_responses = EXCLUDED.frequency_responses,
        overall_calculated_score = EXCLUDED.overall_calculated_score,
        union_respect_avg = EXCLUDED.union_respect_avg,
        safety_avg = EXCLUDED.safety_avg,
        compliance_avg = EXCLUDED.compliance_avg,
        updated_at = now();

    RETURN v_updated_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get comprehensive 4-point rating breakdown
CREATE OR REPLACE FUNCTION public.get_employer_rating_breakdown_4point(
    p_employer_id uuid,
    p_include_details boolean DEFAULT false
) RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
    v_weighted_rating jsonb;
    v_recent_expertise jsonb := '[]';
    v_recent_projects jsonb := '[]';
    rec RECORD;
BEGIN
    -- Get weighted rating calculation
    v_weighted_rating := public.calculate_weighted_employer_rating_4point(p_employer_id);

    -- Get recent expertise assessments if requested
    IF p_include_details THEN
        FOR rec IN
            SELECT
                oea.id,
                oea.overall_score_4point,
                oea.overall_rating_4point,
                oea.assessment_date,
                oea.confidence_level,
                oea.assessment_basis,
                p.name as organiser_name,
                oea.frequency_scale_responses,
                oea.assessment_responses_4point
            FROM public.organiser_overall_expertise_ratings oea
            JOIN public.profiles p ON oea.organiser_id = p.id
            WHERE oea.employer_id = p_employer_id
              AND oea.is_active = true
              AND oea.overall_score_4point IS NOT NULL
            ORDER BY oea.assessment_date DESC
            LIMIT 5
        LOOP
            v_recent_expertise := v_recent_expertise || jsonb_build_object(
                'assessment_id', rec.id,
                'overall_score', rec.overall_score_4point,
                'overall_rating', rec.overall_rating_4point,
                'assessment_date', rec.assessment_date,
                'confidence_level', rec.confidence_level,
                'assessment_basis', rec.assessment_basis,
                'organiser_name', rec.organiser_name,
                'frequency_responses', rec.frequency_scale_responses,
                'assessment_responses', rec.assessment_responses_4point
            );
        END LOOP;

        -- Get recent project assessments
        FOR rec IN
            SELECT
                pca.assessment_type,
                pca.score,
                pca.rating,
                pca.assessment_date,
                pca.confidence_level,
                pca.project_id,
                proj.name as project_name
            FROM public.project_compliance_assessments pca
            LEFT JOIN public.projects proj ON pca.project_id = proj.id
            WHERE pca.employer_id = p_employer_id
              AND pca.is_active = true
              AND pca.assessment_date >= CURRENT_DATE - INTERVAL '12 months'
            ORDER BY pca.assessment_date DESC
            LIMIT 10
        LOOP
            v_recent_projects := v_recent_projects || jsonb_build_object(
                'assessment_type', rec.assessment_type,
                'score', rec.score,
                'rating', rec.rating,
                'assessment_date', rec.assessment_date,
                'confidence_level', rec.confidence_level,
                'project_id', rec.project_id,
                'project_name', rec.project_name
            );
        END LOOP;
    END IF;

    -- Build comprehensive result
    v_result := jsonb_build_object(
        'employer_id', p_employer_id,
        'weighted_rating', v_weighted_rating,
        'recent_expertise_assessments', v_recent_expertise,
        'recent_project_assessments', v_recent_projects,
        'retrieved_at', now()
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security for the new table
ALTER TABLE public.expertise_assessment_details_4point ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Expertise Assessment Details 4Point - Read access" ON public.expertise_assessment_details_4point
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            organiser_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.profiles p
                JOIN public.role_hierarchy rh ON rh.parent_user_id = auth.uid()
                WHERE rh.child_user_id = p.id AND p.role = 'organiser'
            )
        )
    );

CREATE POLICY "Expertise Assessment Details 4Point - Insert access" ON public.expertise_assessment_details_4point
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            organiser_id = auth.uid()
        )
    );

CREATE POLICY "Expertise Assessment Details 4Point - Update access" ON public.expertise_assessment_details_4point
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
            organiser_id = auth.uid()
        )
    );

-- Grant permissions
GRANT ALL ON public.expertise_assessment_details_4point TO authenticated;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION public.calculate_weighted_employer_rating_4point TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_organiser_expertise_rating_4point TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employer_rating_breakdown_4point TO authenticated;

-- Add updated_at trigger for the new table
CREATE TRIGGER update_expertise_assessment_details_4point_updated_at
    BEFORE UPDATE ON public.expertise_assessment_details_4point
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.expertise_assessment_details_4point IS 'Detailed 4-point assessment responses for organiser expertise evaluations';
COMMENT ON FUNCTION public.calculate_weighted_employer_rating_4point IS 'Main weighted rating calculation function that dynamically adjusts weights based on project count';
COMMENT ON FUNCTION public.update_organiser_expertise_rating_4point IS 'Updates organiser expertise assessment with 4-point data and detailed audit trail';
COMMENT ON FUNCTION public.get_employer_rating_breakdown_4point IS 'Retrieves comprehensive breakdown of employer rating with all supporting data';

-- Migration completed successfully