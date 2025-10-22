-- Test query to verify current view state
SELECT
  name,
  enterprise_agreement_status,
  eba_category,
  company_eba_records_json::jsonb->0->>'fwc_certified_date' as fwc_cert
FROM public.employers_search_optimized
WHERE enterprise_agreement_status = true
LIMIT 5;
