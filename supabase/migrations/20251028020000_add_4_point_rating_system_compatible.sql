-- CFMEU 4-Point Rating System - Compatible Addition
-- This migration ADDS the 4-point rating system alongside the existing traffic light system
-- It does not modify or replace existing functionality

-- Create 4-point rating label type (different from traffic_light_rating)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'four_point_rating_label') THEN
        CREATE TYPE public.four_point_rating_label AS ENUM ('red', 'amber', 'yellow', 'green');
        RAISE NOTICE 'Created four_point_rating_label enum type';
    ELSE
        RAISE NOTICE 'four_point_rating_label enum type already exists';
    END IF;
END $$;

-- Add missing columns to company_eba_records if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'company_eba_records'
        AND column_name = 'expiry_date'
    ) THEN
        ALTER TABLE company_eba_records
        ADD COLUMN expiry_date DATE;
        RAISE NOTICE 'Added expiry_date column to company_eba_records';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'company_eba_records'
        AND column_name = 'active'
    ) THEN
        ALTER TABLE company_eba_records
        ADD COLUMN active BOOLEAN DEFAULT true;
        RAISE NOTICE 'Added active column to company_eba_records';
    END IF;
END $$;

-- Update expiry_date from nominal_expiry_date for existing records
UPDATE company_eba_records
SET expiry_date = nominal_expiry_date
WHERE expiry_date IS NULL AND nominal_expiry_date IS NOT NULL;

-- Create 4-point EBA status assessment function (NEW - doesn't conflict with existing)
CREATE OR REPLACE FUNCTION get_employer_eba_status_4point(p_employer_id uuid)
RETURNS TEXT AS $$
DECLARE
    v_eba_status TEXT;
    v_eba_expiry DATE;
BEGIN
    -- Get EBA status from existing company_eba_records table
    SELECT eba_status, expiry_date INTO v_eba_status, v_eba_expiry
    FROM company_eba_records
    WHERE employer_id = p_employer_id
    AND active = true
    ORDER BY expiry_date DESC NULLS LAST, fwc_certified_date DESC NULLS LAST
    LIMIT 1;

    -- Rating logic based on EBA status
    IF v_eba_status IS NULL THEN
        RETURN 'red';  -- No EBA = automatic red
    ELSIF v_eba_expiry < CURRENT_DATE - INTERVAL '3 years' THEN
        RETURN 'red';  -- Expired EBA = red
    ELSIF v_eba_expiry < CURRENT_DATE - INTERVAL '1 year' THEN
        RETURN 'amber';  -- Old EBA = amber
    ELSE
        RETURN 'yellow';  -- Current EBA = baseline yellow
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get EBA rating as numeric value (1-4 scale)
CREATE OR REPLACE FUNCTION get_employer_eba_rating_4point(p_employer_id uuid)
RETURNS INTEGER AS $$
DECLARE
    v_eba_status TEXT;
BEGIN
    v_eba_status := get_employer_eba_status_4point(p_employer_id);

    CASE v_eba_status
        WHEN 'red' THEN RETURN 1;
        WHEN 'amber' THEN RETURN 2;
        WHEN 'yellow' THEN RETURN 3;
        WHEN 'green' THEN RETURN 4;
        ELSE RETURN 1;  -- Default to red if unknown
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_employer_eba_status_4point(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_employer_eba_rating_4point(uuid) TO authenticated;

-- Create 4-point assessment tables with different names to avoid conflicts
CREATE TABLE IF NOT EXISTS union_respect_assessments_4point (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    assessment_date date DEFAULT CURRENT_DATE,
    assessor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

    -- 5 criteria, each rated 1-4 (1=good, 2=fair, 3=poor, 4=terrible)
    right_of_entry_rating INTEGER CHECK (right_of_entry_rating BETWEEN 1 AND 4),
    delegate_accommodation_rating INTEGER CHECK (delegate_accommodation_rating BETWEEN 1 AND 4),
    access_to_information_rating INTEGER CHECK (access_to_information_rating BETWEEN 1 AND 4),
    access_to_inductions_rating INTEGER CHECK (access_to_inductions_rating BETWEEN 1 AND 4),
    eba_status_rating INTEGER CHECK (eba_status_rating BETWEEN 1 AND 4),

    -- Overall union respect rating (calculated as average)
    overall_union_respect_rating INTEGER CHECK (overall_union_respect_rating BETWEEN 1 AND 4),

    -- Assessment metadata
    confidence_level TEXT CHECK (confidence_level IN ('very_high', 'high', 'medium', 'low')) DEFAULT 'medium',
    assessment_method TEXT CHECK (assessment_method IN ('site_visit', 'phone_call', 'union_meeting', 'worker_interview', 'document_review', 'other')) DEFAULT 'site_visit',
    notes TEXT,
    evidence_urls TEXT[],
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_date DATE,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create safety assessments table
CREATE TABLE IF NOT EXISTS safety_assessments_4point (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    assessment_date date DEFAULT CURRENT_DATE,
    assessor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

    -- Safety criteria (4-point scale: 1=good, 2=fair, 3=poor, 4=terrible)
    hsr_respect_rating INTEGER CHECK (hsr_respect_rating BETWEEN 1 AND 4),
    general_safety_rating INTEGER CHECK (general_safety_rating BETWEEN 1 AND 4),
    safety_incidents_rating INTEGER CHECK (safety_incidents_rating BETWEEN 1 AND 4),

    -- Overall safety rating (calculated as average)
    overall_safety_rating INTEGER CHECK (overall_safety_rating BETWEEN 1 AND 4),

    -- Assessment metadata
    confidence_level TEXT CHECK (confidence_level IN ('very_high', 'high', 'medium', 'low')) DEFAULT 'medium',
    assessment_method TEXT CHECK (assessment_method IN ('site_inspection', 'safety_walkthrough', 'hsr_interview', 'incident_review', 'document_review', 'other')) DEFAULT 'site_inspection',
    notes TEXT,
    evidence_urls TEXT[],
    safety_concerns TEXT[],
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_date DATE,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create subcontractor assessments table
CREATE TABLE IF NOT EXISTS subcontractor_assessments_4point (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    assessment_date date DEFAULT CURRENT_DATE,
    assessor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

    -- Subcontractor usage (4-point scale: 1=good, 2=fair, 3=poor, 4=terrible)
    usage_rating INTEGER CHECK (usage_rating BETWEEN 1 AND 4),
    subcontractor_count INTEGER,
    subcontractor_percentage DECIMAL(5,2),
    assessment_basis TEXT CHECK (assessment_basis IN ('payroll_review', 'site_observation', 'union_knowledge', 'contractor_interview', 'document_review', 'other')) DEFAULT 'site_observation',

    -- Assessment metadata
    confidence_level TEXT CHECK (confidence_level IN ('very_high', 'high', 'medium', 'low')) DEFAULT 'medium',
    notes TEXT,
    evidence_urls TEXT[],
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_date DATE,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create final employer ratings table for 4-point system
CREATE TABLE IF NOT EXISTS employer_ratings_4point (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    rating_date DATE DEFAULT CURRENT_DATE,

    -- Overall rating (1-4 scale: 4=green, 3=yellow, 2=amber, 1=red)
    overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 4),
    overall_rating_label four_point_rating_label CHECK (overall_rating_label IN ('red', 'amber', 'yellow', 'green')),

    -- Component ratings (all 1-4 scale)
    eba_status_rating INTEGER CHECK (eba_status_rating BETWEEN 1 AND 4),
    compliance_rating INTEGER CHECK (compliance_rating BETWEEN 1 AND 4),
    union_respect_rating INTEGER CHECK (union_respect_rating BETWEEN 1 AND 4),
    safety_rating INTEGER CHECK (safety_rating BETWEEN 1 AND 4),
    subcontractor_rating INTEGER CHECK (subcontractor_rating BETWEEN 1 AND 4),

    -- Rating calculation details
    calculation_method TEXT CHECK (calculation_method IN ('automatic_calculation', 'manual_override', 'hybrid')) DEFAULT 'automatic_calculation',
    weights JSONB,
    rating_factors JSONB,

    -- Confidence and metadata
    overall_confidence_level TEXT CHECK (overall_confidence_level IN ('very_high', 'high', 'medium', 'low')) DEFAULT 'medium',
    rating_basis TEXT CHECK (rating_basis IN ('site_visit', 'compliance_check', 'document_review', 'union_knowledge', 'hybrid')) DEFAULT 'hybrid',
    next_review_date DATE,

    -- Change tracking
    previous_rating INTEGER CHECK (previous_rating BETWEEN 1 AND 4),
    previous_rating_label four_point_rating_label CHECK (previous_rating_label IN ('red', 'amber', 'yellow', 'green')),
    rating_change_reason TEXT,
    changed_by uuid REFERENCES profiles(id),

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security for all new tables
ALTER TABLE union_respect_assessments_4point ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_assessments_4point ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_assessments_4point ENABLE ROW LEVEL SECURITY;
ALTER TABLE employer_ratings_4point ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist, then create them
DROP POLICY IF EXISTS "Union Respect Assessments 4Point - Read access for authenticated users" ON union_respect_assessments_4point;
DROP POLICY IF EXISTS "Union Respect Assessments 4Point - Insert access for authenticated users" ON union_respect_assessments_4point;
DROP POLICY IF EXISTS "Union Respect Assessments 4Point - Update access for authenticated users" ON union_respect_assessments_4point;
DROP POLICY IF EXISTS "Union Respect Assessments 4Point - Delete access for authenticated users" ON union_respect_assessments_4point;

-- Create RLS policies for Union Respect assessments
CREATE POLICY "Union Respect Assessments 4Point - Read access for authenticated users" ON union_respect_assessments_4point
    FOR SELECT USING (true);
CREATE POLICY "Union Respect Assessments 4Point - Insert access for authenticated users" ON union_respect_assessments_4point
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Union Respect Assessments 4Point - Update access for authenticated users" ON union_respect_assessments_4point
    FOR UPDATE USING (true);
CREATE POLICY "Union Respect Assessments 4Point - Delete access for authenticated users" ON union_respect_assessments_4point
    FOR DELETE USING (true);

-- Drop policies if they exist, then create them for Safety assessments
DROP POLICY IF EXISTS "Safety Assessments 4Point - Read access for authenticated users" ON safety_assessments_4point;
DROP POLICY IF EXISTS "Safety Assessments 4Point - Insert access for authenticated users" ON safety_assessments_4point;
DROP POLICY IF EXISTS "Safety Assessments 4Point - Update access for authenticated users" ON safety_assessments_4point;
DROP POLICY IF EXISTS "Safety Assessments 4Point - Delete access for authenticated users" ON safety_assessments_4point;

CREATE POLICY "Safety Assessments 4Point - Read access for authenticated users" ON safety_assessments_4point
    FOR SELECT USING (true);
CREATE POLICY "Safety Assessments 4Point - Insert access for authenticated users" ON safety_assessments_4point
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Safety Assessments 4Point - Update access for authenticated users" ON safety_assessments_4point
    FOR UPDATE USING (true);
CREATE POLICY "Safety Assessments 4Point - Delete access for authenticated users" ON safety_assessments_4point
    FOR DELETE USING (true);

-- Drop policies if they exist, then create them for Subcontractor assessments
DROP POLICY IF EXISTS "Subcontractor Assessments 4Point - Read access for authenticated users" ON subcontractor_assessments_4point;
DROP POLICY IF EXISTS "Subcontractor Assessments 4Point - Insert access for authenticated users" ON subcontractor_assessments_4point;
DROP POLICY IF EXISTS "Subcontractor Assessments 4Point - Update access for authenticated users" ON subcontractor_assessments_4point;
DROP POLICY IF EXISTS "Subcontractor Assessments 4Point - Delete access for authenticated users" ON subcontractor_assessments_4point;

CREATE POLICY "Subcontractor Assessments 4Point - Read access for authenticated users" ON subcontractor_assessments_4point
    FOR SELECT USING (true);
CREATE POLICY "Subcontractor Assessments 4Point - Insert access for authenticated users" ON subcontractor_assessments_4point
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Subcontractor Assessments 4Point - Update access for authenticated users" ON subcontractor_assessments_4point
    FOR UPDATE USING (true);
CREATE POLICY "Subcontractor Assessments 4Point - Delete access for authenticated users" ON subcontractor_assessments_4point
    FOR DELETE USING (true);

-- Drop policies if they exist, then create them for Employer ratings
DROP POLICY IF EXISTS "Employer Ratings 4Point - Read access for authenticated users" ON employer_ratings_4point;
DROP POLICY IF EXISTS "Employer Ratings 4Point - Insert access for authenticated users" ON employer_ratings_4point;
DROP POLICY IF EXISTS "Employer Ratings 4Point - Update access for authenticated users" ON employer_ratings_4point;
DROP POLICY IF EXISTS "Employer Ratings 4Point - Delete access for authenticated users" ON employer_ratings_4point;

CREATE POLICY "Employer Ratings 4Point - Read access for authenticated users" ON employer_ratings_4point
    FOR SELECT USING (true);
CREATE POLICY "Employer Ratings 4Point - Insert access for authenticated users" ON employer_ratings_4point
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Employer Ratings 4Point - Update access for authenticated users" ON employer_ratings_4point
    FOR UPDATE USING (true);
CREATE POLICY "Employer Ratings 4Point - Delete access for authenticated users" ON employer_ratings_4point
    FOR DELETE USING (true);

-- Grant permissions to authenticated users
GRANT ALL ON union_respect_assessments_4point TO authenticated;
GRANT ALL ON safety_assessments_4point TO authenticated;
GRANT ALL ON subcontractor_assessments_4point TO authenticated;
GRANT ALL ON employer_ratings_4point TO authenticated;

-- Create triggers for automatic rating calculations
CREATE OR REPLACE FUNCTION calculate_union_respect_overall_rating_4point()
RETURNS TRIGGER AS $$
BEGIN
    NEW.overall_union_respect_rating := ROUND((
        NEW.right_of_entry_rating +
        NEW.delegate_accommodation_rating +
        NEW.access_to_information_rating +
        NEW.access_to_inductions_rating +
        NEW.eba_status_rating
    ) / 5.0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_safety_overall_rating_4point()
RETURNS TRIGGER AS $$
BEGIN
    NEW.overall_safety_rating := ROUND((
        NEW.hsr_respect_rating +
        NEW.general_safety_rating +
        NEW.safety_incidents_rating
    ) / 3.0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers (drop if they exist first)
DROP TRIGGER IF EXISTS union_respect_assessments_4point_overall_rating_trigger ON union_respect_assessments_4point;
CREATE TRIGGER union_respect_assessments_4point_overall_rating_trigger
    BEFORE INSERT OR UPDATE ON union_respect_assessments_4point
    FOR EACH ROW
    EXECUTE FUNCTION calculate_union_respect_overall_rating_4point();

DROP TRIGGER IF EXISTS safety_assessments_4point_overall_rating_trigger ON safety_assessments_4point;
CREATE TRIGGER safety_assessments_4point_overall_rating_trigger
    BEFORE INSERT OR UPDATE ON safety_assessments_4point
    FOR EACH ROW
    EXECUTE FUNCTION calculate_safety_overall_rating_4point();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_assessment_updated_at_4point()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at triggers (drop if they exist first)
DROP TRIGGER IF EXISTS union_respect_assessments_4point_updated_at ON union_respect_assessments_4point;
CREATE TRIGGER union_respect_assessments_4point_updated_at
    BEFORE UPDATE ON union_respect_assessments_4point
    FOR EACH ROW
    EXECUTE FUNCTION update_assessment_updated_at_4point();

DROP TRIGGER IF EXISTS safety_assessments_4point_updated_at ON safety_assessments_4point;
CREATE TRIGGER safety_assessments_4point_updated_at
    BEFORE UPDATE ON safety_assessments_4point
    FOR EACH ROW
    EXECUTE FUNCTION update_assessment_updated_at_4point();

DROP TRIGGER IF EXISTS subcontractor_assessments_4point_updated_at ON subcontractor_assessments_4point;
CREATE TRIGGER subcontractor_assessments_4point_updated_at
    BEFORE UPDATE ON subcontractor_assessments_4point
    FOR EACH ROW
    EXECUTE FUNCTION update_assessment_updated_at_4point();

DROP TRIGGER IF EXISTS employer_ratings_4point_updated_at ON employer_ratings_4point;
CREATE TRIGGER employer_ratings_4point_updated_at
    BEFORE UPDATE ON employer_ratings_4point
    FOR EACH ROW
    EXECUTE FUNCTION update_assessment_updated_at_4point();

-- Create main 4-point rating calculation function
CREATE OR REPLACE FUNCTION calculate_employer_rating_4point(
    p_employer_id uuid,
    p_project_id uuid DEFAULT NULL,
    p_weights JSONB DEFAULT NULL
)
RETURNS TABLE (
    overall_rating INTEGER,
    overall_rating_label four_point_rating_label,
    eba_status_rating INTEGER,
    union_respect_rating INTEGER,
    safety_rating INTEGER,
    subcontractor_rating INTEGER,
    calculation_details JSONB
) AS $$
DECLARE
    v_eba_rating INTEGER := 1;
    v_union_respect_rating INTEGER := 3;
    v_safety_rating INTEGER := 3;
    v_subcontractor_rating INTEGER := 3;
    v_overall_rating INTEGER;
    v_overall_label four_point_rating_label;
    v_weights JSONB;
    v_calculation_details JSONB;
BEGIN
    -- Use default weights if none provided
    v_weights := COALESCE(p_weights, '{
        "eba_status": 0.30,
        "union_respect": 0.25,
        "safety": 0.25,
        "subcontractor": 0.20
    }'::jsonb);

    -- 1. Get EBA status baseline (critical factor)
    v_eba_rating := get_employer_eba_rating_4point(p_employer_id);

    -- 2. Get latest assessment ratings
    SELECT overall_union_respect_rating, overall_safety_rating, usage_rating
    INTO v_union_respect_rating, v_safety_rating, v_subcontractor_rating
    FROM (
        SELECT
            ura.overall_union_respect_rating,
            sa.overall_safety_rating,
            sua.usage_rating
        FROM employers e
        LEFT JOIN LATERAL (
            SELECT overall_union_respect_rating
            FROM union_respect_assessments_4point
            WHERE employer_id = e.id
            ORDER BY assessment_date DESC
            LIMIT 1
        ) ura ON true
        LEFT JOIN LATERAL (
            SELECT overall_safety_rating
            FROM safety_assessments_4point
            WHERE employer_id = e.id
            ORDER BY assessment_date DESC
            LIMIT 1
        ) sa ON true
        LEFT JOIN LATERAL (
            SELECT usage_rating
            FROM subcontractor_assessments_4point
            WHERE employer_id = e.id
            ORDER BY assessment_date DESC
            LIMIT 1
        ) sua ON true
        WHERE e.id = p_employer_id
    ) latest_assessments;

    -- Default values if no assessments found
    IF v_union_respect_rating IS NULL THEN v_union_respect_rating := 3; END IF;
    IF v_safety_rating IS NULL THEN v_safety_rating := 3; END IF;
    IF v_subcontractor_rating IS NULL THEN v_subcontractor_rating := 3; END IF;

    -- 3. Calculate overall rating using weighted average
    -- EBA status is a gating factor - if no EBA, rating is capped at 1 (red)
    IF v_eba_rating = 1 THEN
        v_overall_rating := 1; -- No EBA = automatic red
    ELSE
        v_overall_rating := ROUND(
            (v_eba_rating * (v_weights->>'eba_status')::decimal +
             v_union_respect_rating * (v_weights->>'union_respect')::decimal +
             v_safety_rating * (v_weights->>'safety')::decimal +
             v_subcontractor_rating * (v_weights->>'subcontractor')::decimal)
        );

        -- Ensure rating is capped by EBA status (expired EBA = max 2)
        IF v_eba_rating = 2 AND v_overall_rating > 2 THEN
            v_overall_rating := 2;
        END IF;
    END IF;

    -- 4. Convert numeric rating to label
    CASE v_overall_rating
        WHEN 1 THEN v_overall_label := 'red';
        WHEN 2 THEN v_overall_label := 'amber';
        WHEN 3 THEN v_overall_label := 'yellow';
        WHEN 4 THEN v_overall_label := 'green';
        ELSE v_overall_label := 'red';
    END CASE;

    -- 5. Build calculation details
    v_calculation_details := jsonb_build_object(
        'eba_status', jsonb_build_object(
            'rating', v_eba_rating,
            'weight', (v_weights->>'eba_status')::decimal
        ),
        'union_respect', jsonb_build_object(
            'rating', v_union_respect_rating,
            'weight', (v_weights->>'union_respect')::decimal
        ),
        'safety', jsonb_build_object(
            'rating', v_safety_rating,
            'weight', (v_weights->>'safety')::decimal
        ),
        'subcontractor', jsonb_build_object(
            'rating', v_subcontractor_rating,
            'weight', (v_weights->>'subcontractor')::decimal
        ),
        'final_rating', v_overall_rating
    );

    RETURN QUERY SELECT
        v_overall_rating,
        v_overall_label,
        v_eba_rating,
        v_union_respect_rating,
        v_safety_rating,
        v_subcontractor_rating,
        v_calculation_details;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION calculate_employer_rating_4point(uuid, uuid, jsonb) TO authenticated;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_union_respect_assessments_4point_employer_date ON union_respect_assessments_4point(employer_id, assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_safety_assessments_4point_employer_date ON safety_assessments_4point(employer_id, assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_subcontractor_assessments_4point_employer_date ON subcontractor_assessments_4point(employer_id, assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_employer_ratings_4point_employer_date ON employer_ratings_4point(employer_id, rating_date DESC);

-- Create view for current 4-point ratings
DROP VIEW IF EXISTS current_employer_ratings_4point;
CREATE VIEW current_employer_ratings_4point AS
SELECT DISTINCT ON (employer_id)
    id,
    employer_id,
    project_id,
    overall_rating,
    overall_rating_label,
    eba_status_rating,
    union_respect_rating,
    safety_rating,
    subcontractor_rating,
    overall_confidence_level,
    rating_basis,
    rating_date,
    next_review_date,
    previous_rating,
    previous_rating_label,
    calculation_method,
    rating_factors,
    created_at,
    updated_at
FROM employer_ratings_4point
ORDER BY employer_id, rating_date DESC, created_at DESC;

GRANT SELECT ON current_employer_ratings_4point TO authenticated;

-- Add comments
COMMENT ON TYPE four_point_rating_label IS 'Rating labels for the 4-point CFMEU rating system.';
COMMENT ON FUNCTION get_employer_eba_status_4point(uuid) IS 'Assesses EBA status for 4-point rating system. Returns red, amber, yellow, or green based on EBA coverage and expiry.';
COMMENT ON FUNCTION get_employer_eba_rating_4point(uuid) IS 'Returns numeric rating (1-4) for EBA status assessment.';
COMMENT ON TABLE union_respect_assessments_4point IS 'Union Respect assessments using 4-point scale (1=good, 4=terrible) across 5 criteria.';
COMMENT ON TABLE safety_assessments_4point IS 'Safety assessments using 4-point scale (1=good, 4=terrible) across 3 criteria.';
COMMENT ON TABLE subcontractor_assessments_4point IS 'Subcontractor usage assessments using 4-point scale (1=good, 4=terrible).';
COMMENT ON TABLE employer_ratings_4point IS 'Final calculated ratings for employers using 4-point system. Stores both overall and component ratings with full audit trail.';
COMMENT ON FUNCTION calculate_employer_rating_4point(uuid, uuid, jsonb) IS 'Comprehensive rating calculation using weighted average of all assessment components.';
COMMENT ON VIEW current_employer_ratings_4point IS 'Current 4-point rating for each employer (most recent rating per employer).';

-- Migration completed successfully