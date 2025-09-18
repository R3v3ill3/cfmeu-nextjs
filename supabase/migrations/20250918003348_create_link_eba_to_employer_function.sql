CREATE OR REPLACE FUNCTION link_eba_to_employer(
    p_employer_id UUID,
    p_eba_data JSONB
)
RETURNS void AS $$
DECLARE
    v_lodgement_number TEXT;
BEGIN
    v_lodgement_number := p_eba_data->>'lodgementNumber';

    INSERT INTO company_eba_records (
        employer_id,
        fwc_lodgement_number,
        agreement_title,
        status,
        fwc_certified_date,
        nominal_expiry_date,
        fwc_document_url,
        summary_url
    )
    VALUES (
        p_employer_id,
        v_lodgement_number,
        p_eba_data->>'title',
        p_eba_data->>'status',
        (p_eba_data->>'approvedDate')::DATE,
        (p_eba_data->>'expiryDate')::DATE,
        p_eba_data->>'documentUrl',
        p_eba_data->>'summaryUrl'
    )
    ON CONFLICT (employer_id) DO UPDATE SET
        fwc_lodgement_number = EXCLUDED.fwc_lodgement_number,
        agreement_title = EXCLUDED.agreement_title,
        status = EXCLUDED.status,
        fwc_certified_date = EXCLUDED.fwc_certified_date,
        nominal_expiry_date = EXCLUDED.nominal_expiry_date,
        fwc_document_url = EXCLUDED.fwc_document_url,
        summary_url = EXCLUDED.summary_url,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
