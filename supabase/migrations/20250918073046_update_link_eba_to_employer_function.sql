CREATE OR REPLACE FUNCTION link_eba_to_employer(
    p_employer_id UUID,
    p_eba_data JSONB
)
RETURNS void AS $$
DECLARE
    v_lodgement_number TEXT;
    v_certified DATE;
    v_nominal DATE;
BEGIN
    v_lodgement_number := NULLIF(TRIM(p_eba_data->>'lodgementNumber'), '');
    v_certified := NULLIF(TRIM(p_eba_data->>'approvedDate'), '')::DATE;
    v_nominal := NULLIF(TRIM(p_eba_data->>'expiryDate'), '')::DATE;

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
    )
    ON CONFLICT (employer_id) DO UPDATE SET
        agreement_title = EXCLUDED.agreement_title,
        status = EXCLUDED.status,
        fwc_certified_date = EXCLUDED.fwc_certified_date,
        nominal_expiry_date = EXCLUDED.nominal_expiry_date,
        fwc_document_url = EXCLUDED.fwc_document_url,
        summary_url = EXCLUDED.summary_url,
        fwc_lodgement_number = EXCLUDED.fwc_lodgement_number,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
