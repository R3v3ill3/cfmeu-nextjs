-- Unified contractor categories and EBA-active employer views
-- Add-only, non-destructive views to surface contractor role/trade tags per employer

-- View: v_employer_contractor_categories
-- Columns:
--   employer_id UUID
--   employer_name TEXT
--   category_type TEXT  -- 'contractor_role' | 'trade'
--   category_code TEXT
--   category_name TEXT
--   source TEXT         -- 'project_assignment' | 'builder_id' | 'project_contractor_trades' | 'site_contractor_trades' | 'manual_capability'
--   project_id UUID NULL
--   is_current BOOLEAN
CREATE OR REPLACE VIEW public.v_employer_contractor_categories AS
WITH builder_role AS (
  SELECT
    p.builder_id AS employer_id,
    'contractor_role'::text AS category_type,
    'builder'::text AS category_code,
    COALESCE((SELECT crt.name FROM public.contractor_role_types crt WHERE crt.code = 'builder' LIMIT 1), 'Builder')::text AS category_name,
    'builder_id'::text AS source,
    p.id AS project_id,
    TRUE AS is_current
  FROM public.projects p
  WHERE p.builder_id IS NOT NULL
),
pa_roles AS (
  SELECT
    pa.employer_id,
    'contractor_role'::text AS category_type,
    crt.code AS category_code,
    crt.name AS category_name,
    'project_assignment'::text AS source,
    pa.project_id,
    ((pa.status = 'active') AND (pa.end_date IS NULL OR pa.end_date >= CURRENT_DATE)) AS is_current
  FROM public.project_assignments pa
  JOIN public.contractor_role_types crt ON crt.id = pa.contractor_role_type_id
  WHERE pa.assignment_type = 'contractor_role'
),
pa_trades AS (
  SELECT
    pa.employer_id,
    'trade'::text AS category_type,
    tt.code AS category_code,
    tt.name AS category_name,
    'project_assignment'::text AS source,
    pa.project_id,
    ((pa.status = 'active') AND (pa.end_date IS NULL OR pa.end_date >= CURRENT_DATE)) AS is_current
  FROM public.project_assignments pa
  JOIN public.trade_types tt ON tt.id = pa.trade_type_id
  WHERE pa.assignment_type = 'trade_work'
),
pct AS (
  SELECT
    pct.employer_id,
    'trade'::text AS category_type,
    tt.code AS category_code,
    tt.name AS category_name,
    'project_contractor_trades'::text AS source,
    pct.project_id,
    TRUE AS is_current
  FROM public.project_contractor_trades pct
  LEFT JOIN public.trade_types tt ON tt.code = pct.trade_type::text
),
sct AS (
  SELECT
    sct.employer_id,
    'trade'::text AS category_type,
    tt.code AS category_code,
    tt.name AS category_name,
    'site_contractor_trades'::text AS source,
    js.project_id,
    TRUE AS is_current
  FROM public.site_contractor_trades sct
  LEFT JOIN public.job_sites js ON js.id = sct.job_site_id
  LEFT JOIN public.trade_types tt ON tt.code = sct.trade_type::text
),
manual_roles AS (
  SELECT
    ec.employer_id,
    'contractor_role'::text AS category_type,
    crt.code AS category_code,
    crt.name AS category_name,
    'manual_capability'::text AS source,
    NULL::uuid AS project_id,
    TRUE AS is_current
  FROM public.employer_capabilities ec
  JOIN public.contractor_role_types crt ON crt.id = ec.contractor_role_type_id
  WHERE ec.capability_type = 'contractor_role'
),
manual_trades AS (
  SELECT
    ec.employer_id,
    'trade'::text AS category_type,
    tt.code AS category_code,
    tt.name AS category_name,
    'manual_capability'::text AS source,
    NULL::uuid AS project_id,
    TRUE AS is_current
  FROM public.employer_capabilities ec
  JOIN public.trade_types tt ON tt.id = ec.trade_type_id
  WHERE ec.capability_type = 'trade'
)
SELECT x.employer_id,
       e.name AS employer_name,
       x.category_type,
       x.category_code,
       x.category_name,
       x.source,
       x.project_id,
       x.is_current
FROM (
  SELECT * FROM builder_role
  UNION ALL
  SELECT * FROM pa_roles
  UNION ALL
  SELECT * FROM pa_trades
  UNION ALL
  SELECT * FROM pct
  UNION ALL
  SELECT * FROM sct
  UNION ALL
  SELECT * FROM manual_roles
  UNION ALL
  SELECT * FROM manual_trades
) x
JOIN public.employers e ON e.id = x.employer_id;

COMMENT ON VIEW public.v_employer_contractor_categories IS 'Unified contractor categories per employer from assignments, legacy sources, and manual capabilities. Non-destructive.';

-- View: v_eba_active_employer_categories
-- Filters the above to EBA-active employers using centralized rule with user override fallback
CREATE OR REPLACE VIEW public.v_eba_active_employer_categories AS
SELECT vec.*
FROM public.v_employer_contractor_categories vec
JOIN public.employers e ON e.id = vec.employer_id
WHERE (
  e.enterprise_agreement_status = TRUE
) OR EXISTS (
  SELECT 1
  FROM public.company_eba_records cer
  WHERE cer.employer_id = vec.employer_id
    AND cer.fwc_certified_date IS NOT NULL
    AND (cer.nominal_expiry_date IS NULL OR cer.nominal_expiry_date >= CURRENT_DATE)
);

COMMENT ON VIEW public.v_eba_active_employer_categories IS 'EBA-active employers by contractor categories. Active if certified and not expired OR employer override is true.';

-- View: v_contractor_categories_catalog
-- Catalog of available categories with counts
CREATE OR REPLACE VIEW public.v_contractor_categories_catalog AS
SELECT
  category_type,
  category_code,
  category_name,
  COUNT(DISTINCT employer_id) FILTER (WHERE is_current) AS current_employers,
  COUNT(DISTINCT employer_id) AS total_employers
FROM public.v_employer_contractor_categories
GROUP BY 1,2,3;

COMMENT ON VIEW public.v_contractor_categories_catalog IS 'Distinct contractor categories (roles and trades) with employer counts.';


