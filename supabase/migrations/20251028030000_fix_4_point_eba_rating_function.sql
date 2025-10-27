-- Fix the 4-point EBA rating function to use the canonical enterprise_agreement_status field
-- This replaces the previous function that incorrectly used company_eba_records

-- Drop the incorrect EBA rating function
DROP FUNCTION IF EXISTS get_employer_eba_status_4point(uuid);

-- Create corrected 4-point EBA status assessment function using canonical enterprise_agreement_status
CREATE OR REPLACE FUNCTION get_employer_eba_status_4point(p_employer_id uuid)
RETURNS TEXT AS $$
DECLARE
    v_eba_status BOOLEAN;
BEGIN
    -- Get EBA status from the canonical enterprise_agreement_status field in employers table
    SELECT enterprise_agreement_status INTO v_eba_status
    FROM employers
    WHERE id = p_employer_id;

    -- Rating logic based on canonical EBA status
    -- This matches the logic used in CfmeuEbaBadge component
    IF v_eba_status IS NULL OR v_eba_status = false THEN
        RETURN 'red';  -- No EBA = automatic red (rating 1)
    ELSE
        -- For EBA status true, we could implement more granular logic here
        -- For now, active EBA = baseline yellow (rating 3)
        -- This can be enhanced later with expiry date logic if available
        RETURN 'yellow';  -- Active EBA = baseline yellow (rating 3)
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create corresponding numeric rating function
CREATE OR REPLACE FUNCTION get_employer_eba_rating_4point(p_employer_id uuid)
RETURNS INTEGER AS $$
DECLARE
    v_eba_status TEXT;
BEGIN
    v_eba_status := get_employer_eba_status_4point(p_employer_id);

    -- Convert text status to numeric rating (1-4 scale where 1=Good, 4=Terrible)
    -- Note: This is inverted for CFMEU rating system where lower numbers are better
    CASE v_eba_status
        WHEN 'red' THEN RETURN 1;    -- No EBA = automatic red = rating 1 (worst)
        WHEN 'amber' THEN RETURN 2;  -- Expired/Old EBA = rating 2
        WHEN 'yellow' THEN RETURN 3; -- Current EBA = rating 3
        WHEN 'green' THEN RETURN 4;  -- Excellent EBA = rating 4 (best)
        ELSE RETURN 1;              -- Default to worst rating
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON FUNCTION get_employer_eba_status_4point(uuid) IS 'Assesses EBA status for 4-point rating system using canonical enterprise_agreement_status field. Returns red, amber, yellow, or green based on EBA coverage.';
COMMENT ON FUNCTION get_employer_eba_rating_4point(uuid) IS 'Returns numeric rating (1-4) for EBA status assessment using canonical enterprise_agreement_status field. 1=Good (has EBA), higher numbers = worse.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_employer_eba_status_4point(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_employer_eba_rating_4point(uuid) TO authenticated;