-- Fix duplicate roles and trades in employers_list_comprehensive
-- Issue: jsonb_agg was creating duplicate entries from v_employer_contractor_categories
-- Fix: Use DISTINCT ON to deduplicate by category_code before aggregating

DROP MATERIALIZED VIEW IF EXISTS employers_list_comprehensive CASCADE;

-- Recreate with fixed roles/trades aggregation
CREATE MATERIALIZED VIEW employers_list_comprehensive AS
SELECT
  -- Base employer fields
  e.id,
  e.name,
  e.abn,
  e.employer_type,
  e.website,
  e.email,
  e.phone,
  e.estimated_worker_count,
  e.incolink_id,
  e.bci_company_id,
  e.enterprise_agreement_status,
  e.eba_status_source,
  e.eba_status_updated_at,
  e.eba_status_notes,
  e.incolink_last_matched,
  e.address_line_1,
  e.address_line_2,
  e.suburb,
  e.state,
  e.postcode,
  e.primary_contact_name,
  e.contact_notes,
  e.parent_employer_id,
  e.created_at,
  e.updated_at,

  -- Precomputed analytics
  (
    EXISTS(SELECT 1 FROM worker_placements wp WHERE wp.employer_id = e.id LIMIT 1)
    OR EXISTS(SELECT 1 FROM project_assignments pa WHERE pa.employer_id = e.id LIMIT 1)
  ) as is_engaged,

  (SELECT COUNT(*)::int FROM worker_placements wp WHERE wp.employer_id = e.id)
    as actual_worker_count,
  (SELECT COUNT(*)::int FROM project_assignments pa WHERE pa.employer_id = e.id)
    as project_count,

  CASE
    WHEN e.enterprise_agreement_status = true THEN 'active'
    WHEN EXISTS(
      SELECT 1 FROM company_eba_records r
      WHERE r.employer_id = e.id
      AND r.fwc_certified_date > (CURRENT_DATE - INTERVAL '4 years')
      LIMIT 1
    ) THEN 'active'
    WHEN EXISTS(
      SELECT 1 FROM company_eba_records r
      WHERE r.employer_id = e.id
      AND r.eba_lodged_fwc > (CURRENT_DATE - INTERVAL '1 year')
      LIMIT 1
    ) THEN 'lodged'
    WHEN EXISTS(
      SELECT 1 FROM company_eba_records r
      WHERE r.employer_id = e.id
      AND (
        r.date_eba_signed > (CURRENT_DATE - INTERVAL '6 months')
        OR r.date_vote_occurred > (CURRENT_DATE - INTERVAL '6 months')
        OR r.eba_data_form_received IS NOT NULL
        OR r.date_draft_signing_sent IS NOT NULL
        OR r.date_barg_docs_sent IS NOT NULL
      )
      LIMIT 1
    ) THEN 'pending'
    ELSE 'no'
  END as eba_category,

  COALESCE((
    SELECT MAX(GREATEST(
      EXTRACT(EPOCH FROM r.fwc_certified_date),
      EXTRACT(EPOCH FROM r.eba_lodged_fwc),
      EXTRACT(EPOCH FROM r.date_eba_signed),
      EXTRACT(EPOCH FROM r.date_vote_occurred)
    ))
    FROM company_eba_records r
    WHERE r.employer_id = e.id
  ), 0) as eba_recency_score,

  (
    SELECT MAX(GREATEST(
      r.fwc_certified_date,
      r.eba_lodged_fwc,
      r.date_eba_signed,
      r.date_vote_occurred
    ))
    FROM company_eba_records r
    WHERE r.employer_id = e.id
  ) as most_recent_eba_date,

  -- Relationship data
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'status', r.status,
        'nominal_expiry_date', r.nominal_expiry_date,
        'fwc_certified_date', r.fwc_certified_date,
        'eba_lodged_fwc', r.eba_lodged_fwc,
        'date_eba_signed', r.date_eba_signed,
        'date_vote_occurred', r.date_vote_occurred,
        'eba_data_form_received', r.eba_data_form_received,
        'date_draft_signing_sent', r.date_draft_signing_sent,
        'date_barg_docs_sent', r.date_barg_docs_sent
      ) ORDER BY GREATEST(
        r.fwc_certified_date,
        r.eba_lodged_fwc,
        r.date_eba_signed,
        r.date_vote_occurred
      ) DESC NULLS LAST
    )
    FROM company_eba_records r
    WHERE r.employer_id = e.id
  ), '[]'::jsonb) as company_eba_records_json,

  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', wp.id))
    FROM worker_placements wp
    WHERE wp.employer_id = e.id
    LIMIT 1000
  ), '[]'::jsonb) as worker_placements_json,

  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', pa.id))
    FROM project_assignments pa
    WHERE pa.employer_id = e.id
    LIMIT 1000
  ), '[]'::jsonb) as project_assignments_json,

  -- Projects with roles and trades
  COALESCE((
    SELECT jsonb_agg(DISTINCT
      jsonb_build_object(
        'id', p.project_id,
        'name', p.project_name,
        'tier', p.tier,
        'roles', p.roles,
        'trades', p.trades
      )
    )
    FROM (
      SELECT
        proj.id as project_id,
        proj.name as project_name,
        proj.tier,
        COALESCE((
          SELECT array_agg(DISTINCT crt.code)
          FROM project_assignments pa2
          JOIN contractor_role_types crt ON pa2.contractor_role_type_id = crt.id
          WHERE pa2.employer_id = e.id
          AND pa2.project_id = proj.id
          AND pa2.assignment_type = 'contractor_role'
          AND crt.code IS NOT NULL
        ), ARRAY[]::text[]) as roles,
        COALESCE((
          SELECT array_agg(DISTINCT tt.code)
          FROM project_assignments pa3
          JOIN trade_types tt ON pa3.trade_type_id = tt.id
          WHERE pa3.employer_id = e.id
          AND pa3.project_id = proj.id
          AND pa3.assignment_type = 'trade_work'
          AND tt.code IS NOT NULL
        ), ARRAY[]::text[]) as trades
      FROM project_assignments pa
      JOIN projects proj ON pa.project_id = proj.id
      WHERE pa.employer_id = e.id
      GROUP BY proj.id, proj.name, proj.tier
    ) p
  ), '[]'::jsonb) as projects_json,

  -- Organisers
  COALESCE((
    SELECT jsonb_agg(DISTINCT
      jsonb_build_object(
        'id', o.id,
        'name', o.first_name || ' ' || o.last_name,
        'patch_name', pt.name
      )
    )
    FROM project_assignments pa
    JOIN job_sites js ON pa.project_id = js.project_id
    JOIN patches pt ON js.patch_id = pt.id
    JOIN organiser_patch_assignments opa ON pt.id = opa.patch_id
    JOIN organisers o ON opa.organiser_id = o.id
    WHERE pa.employer_id = e.id
    AND o.id IS NOT NULL
    AND (opa.effective_to IS NULL OR opa.effective_to > NOW())
  ), '[]'::jsonb) as organisers_json,

  -- FIXED: Contractor roles with deduplication by category_code
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'code', category_code,
        'name', category_name,
        'manual', is_manual,
        'derived', is_derived
      )
    )
    FROM (
      SELECT DISTINCT ON (category_code)
        category_code,
        category_name,
        source = 'manual_capability' as is_manual,
        source != 'manual_capability' as is_derived
      FROM v_employer_contractor_categories
      WHERE employer_id = e.id
      AND category_type = 'contractor_role'
      AND is_current = true
      ORDER BY category_code, source  -- Prefer manual over derived if both exist
    ) deduplicated_roles
  ), '[]'::jsonb) as roles_json,

  -- FIXED: Trade categories with deduplication by category_code
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'code', category_code,
        'name', category_name,
        'manual', is_manual,
        'derived', is_derived
      )
    )
    FROM (
      SELECT DISTINCT ON (category_code)
        category_code,
        category_name,
        source = 'manual_capability' as is_manual,
        source != 'manual_capability' as is_derived
      FROM v_employer_contractor_categories
      WHERE employer_id = e.id
      AND category_type = 'trade'
      AND is_current = true
      ORDER BY category_code, source  -- Prefer manual over derived if both exist
    ) deduplicated_trades
  ), '[]'::jsonb) as trades_json,

  LOWER(e.name) as name_lower,
  NOW() as view_refreshed_at

FROM employers e;

-- Recreate indexes
CREATE UNIQUE INDEX idx_emp_comprehensive_id ON employers_list_comprehensive(id);
CREATE INDEX idx_emp_comprehensive_engaged ON employers_list_comprehensive(is_engaged) WHERE is_engaged = true;
CREATE INDEX idx_emp_comprehensive_eba_category ON employers_list_comprehensive(eba_category);
CREATE INDEX idx_emp_comprehensive_employer_type ON employers_list_comprehensive(employer_type);
CREATE INDEX idx_emp_comprehensive_name_lower ON employers_list_comprehensive(name_lower);
CREATE INDEX idx_emp_comprehensive_name_pattern ON employers_list_comprehensive(name text_pattern_ops);
CREATE INDEX idx_emp_comprehensive_name_trgm ON employers_list_comprehensive USING gin(name gin_trgm_ops);
CREATE INDEX idx_emp_comprehensive_estimated_workers ON employers_list_comprehensive(estimated_worker_count DESC NULLS LAST);
CREATE INDEX idx_emp_comprehensive_eba_recency ON employers_list_comprehensive(eba_recency_score DESC);
CREATE INDEX idx_emp_comprehensive_project_count ON employers_list_comprehensive(project_count DESC);
CREATE INDEX idx_emp_comprehensive_abn ON employers_list_comprehensive(abn) WHERE abn IS NOT NULL;
CREATE INDEX idx_emp_comprehensive_bci_id ON employers_list_comprehensive(LOWER(bci_company_id)) WHERE bci_company_id IS NOT NULL;
CREATE INDEX idx_emp_comprehensive_incolink_id ON employers_list_comprehensive(LOWER(incolink_id)) WHERE incolink_id IS NOT NULL;

-- Initial refresh
REFRESH MATERIALIZED VIEW employers_list_comprehensive;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed duplicate roles/trades in employers_list_comprehensive';
  RAISE NOTICE 'Changed: Added DISTINCT ON (category_code) for roles_json and trades_json';
  RAISE NOTICE 'View recreated and refreshed successfully';
END $$;
