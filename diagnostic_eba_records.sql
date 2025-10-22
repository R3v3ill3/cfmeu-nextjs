-- Diagnostic: Examine the EBA records that were skipped
-- Run this in Supabase SQL Editor to understand the data

-- 1. Sample of EBA records for skipped employers
SELECT
  e.name as employer_name,
  e.enterprise_agreement_status as current_eba_status,
  e.eba_status_source,
  cer.eba_file_number,
  cer.fwc_certified_date,
  cer.nominal_expiry_date,
  cer.comments,
  cer.created_at,
  -- Calculate age of certification
  CASE
    WHEN cer.fwc_certified_date IS NULL THEN 'NO CERT DATE'
    ELSE CONCAT(
      EXTRACT(YEAR FROM AGE(CURRENT_DATE, cer.fwc_certified_date))::text,
      ' years, ',
      EXTRACT(MONTH FROM AGE(CURRENT_DATE, cer.fwc_certified_date))::text,
      ' months old'
    )
  END as cert_age
FROM public.company_eba_records cer
INNER JOIN public.employers e ON e.id = cer.employer_id
WHERE e.enterprise_agreement_status IS DISTINCT FROM TRUE
ORDER BY cer.fwc_certified_date DESC NULLS LAST
LIMIT 20;

-- 2. Summary statistics
SELECT
  COUNT(*) as total_eba_records,
  COUNT(fwc_certified_date) as records_with_cert_date,
  COUNT(*) - COUNT(fwc_certified_date) as records_without_cert_date,
  COUNT(*) FILTER (WHERE fwc_certified_date >= CURRENT_DATE - INTERVAL '4 years') as recent_certs_4yr,
  COUNT(*) FILTER (WHERE fwc_certified_date >= CURRENT_DATE - INTERVAL '7 years') as recent_certs_7yr,
  MIN(fwc_certified_date) as oldest_cert,
  MAX(fwc_certified_date) as newest_cert
FROM public.company_eba_records cer
INNER JOIN public.employers e ON e.id = cer.employer_id
WHERE e.enterprise_agreement_status IS DISTINCT FROM TRUE;

-- 3. Check if these are manual uploads (check comments field)
SELECT
  CASE
    WHEN comments LIKE '%Auto-imported%' THEN 'Auto-imported from FWC'
    WHEN comments LIKE '%manual%' THEN 'Manual entry'
    WHEN comments IS NULL THEN 'No comment'
    ELSE 'Other'
  END as source_type,
  COUNT(*) as count
FROM public.company_eba_records cer
INNER JOIN public.employers e ON e.id = cer.employer_id
WHERE e.enterprise_agreement_status IS DISTINCT FROM TRUE
GROUP BY source_type;
