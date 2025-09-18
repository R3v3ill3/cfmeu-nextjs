CREATE OR REPLACE FUNCTION link_eba_to_employer(
    p_employer_id UUID,
    p_eba_data JSONB
)
RETURNS void AS $$
DECLARE
    v_lodgement_number TEXT;
    v_certified DATE;
    v_nominal DATE;
    v_existing_record_id UUID;
BEGIN
    v_lodgement_number := NULLIF(TRIM(p_eba_data->>'lodgementNumber'), '');
    v_certified := NULLIF(TRIM(p_eba_data->>'approvedDate'), '')::DATE;
    v_nominal := NULLIF(TRIM(p_eba_data->>'expiryDate'), '')::DATE;

    -- Check if there's an existing record for this employer
    SELECT id INTO v_existing_record_id
    FROM company_eba_records 
    WHERE employer_id = p_employer_id 
    ORDER BY updated_at DESC 
    LIMIT 1;

    IF v_existing_record_id IS NOT NULL THEN
        -- Update the most recent existing record
        UPDATE company_eba_records SET
            agreement_title = NULLIF(p_eba_data->>'title', ''),
            status = NULLIF(p_eba_data->>'status', ''),
            fwc_certified_date = v_certified,
            nominal_expiry_date = v_nominal,
            fwc_document_url = NULLIF(p_eba_data->>'documentUrl', ''),
            summary_url = NULLIF(p_eba_data->>'summaryUrl', ''),
            fwc_lodgement_number = v_lodgement_number,
            updated_at = NOW()
        WHERE id = v_existing_record_id;
    ELSE
        -- Insert a new record
        INSERT INTO company_eba_records (
            employer_id,
            agreement_title,
            status,
            fwc_certified_date,
            nominal_expiry_date,
            fwc_document_url,
            summary_url,
            fwc_lodgement_number
        )
        VALUES (
            p_employer_id,
            NULLIF(p_eba_data->>'title', ''),
            NULLIF(p_eba_data->>'status', ''),
            v_certified,
            v_nominal,
            NULLIF(p_eba_data->>'documentUrl', ''),
            NULLIF(p_eba_data->>'summaryUrl', ''),
            v_lodgement_number
        );
    END IF;

    -- Refresh materialized views and derived employer status so the UI sees new data immediately
    PERFORM refresh_employer_eba_status(p_employer_id);
    PERFORM refresh_employer_related_views();
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;
