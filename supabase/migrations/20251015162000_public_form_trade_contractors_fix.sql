-- Update public form trade contractor RPC to include legacy data and key trade placeholders
CREATE OR REPLACE FUNCTION get_public_form_trade_contractors(
  p_token text,
  p_project_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_validation RECORD;
  v_main_job_site_id uuid;
BEGIN
  -- Validate token and ensure it matches the project
  SELECT * INTO v_validation
  FROM validate_public_token(p_token)
  LIMIT 1;

  IF NOT v_validation.valid OR v_validation.resource_id != p_project_id THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Fetch the project's main job site for legacy site trade lookups
  SELECT main_job_site_id INTO v_main_job_site_id
  FROM projects
  WHERE id = p_project_id;

  RETURN COALESCE(
    (
      WITH assignment_trades AS (
        SELECT
          'assignment_trade:' || pa.id::text AS id,
          pa.employer_id,
          COALESCE(e.name, 'Unknown') AS employer_name,
          LOWER(COALESCE(tt.code, pa.trade_type, 'other')) AS trade_type,
          COALESCE(tt.name, INITCAP(REPLACE(COALESCE(tt.code, pa.trade_type, 'other'), '_', ' '))) AS trade_label,
          CASE
            WHEN LOWER(COALESCE(tt.code, pa.trade_type, 'other')) IN ('demolition', 'earthworks', 'piling', 'excavations', 'scaffolding', 'traffic_control', 'traffic_management', 'waste_management', 'cleaning', 'labour_hire') THEN 'early_works'
            WHEN LOWER(COALESCE(tt.code, pa.trade_type, 'other')) IN ('tower_crane', 'mobile_crane', 'crane_and_rigging', 'concrete', 'concreting', 'form_work', 'reinforcing_steel', 'steel_fixing', 'post_tensioning', 'structural_steel', 'bricklaying', 'foundations') THEN 'structure'
            WHEN LOWER(COALESCE(tt.code, pa.trade_type, 'other')) IN ('carpentry', 'electrical', 'plumbing', 'mechanical_services', 'painting', 'plastering', 'waterproofing', 'tiling', 'flooring', 'roofing', 'windows', 'facade', 'glazing', 'kitchens', 'landscaping', 'final_clean', 'insulation', 'internal_walls', 'ceilings', 'stairs_balustrades', 'fire_protection', 'security_systems', 'building_services', 'fitout', 'technology') THEN 'finishing'
            ELSE 'other'
          END AS stage,
          CASE
            WHEN LOWER(COALESCE(tt.code, pa.trade_type, 'other')) IN ('demolition', 'earthworks', 'piling', 'excavations', 'scaffolding', 'traffic_control', 'traffic_management', 'waste_management', 'cleaning', 'labour_hire') THEN 1
            WHEN LOWER(COALESCE(tt.code, pa.trade_type, 'other')) IN ('tower_crane', 'mobile_crane', 'crane_and_rigging', 'concrete', 'concreting', 'form_work', 'reinforcing_steel', 'steel_fixing', 'post_tensioning', 'structural_steel', 'bricklaying', 'foundations') THEN 2
            WHEN LOWER(COALESCE(tt.code, pa.trade_type, 'other')) IN ('carpentry', 'electrical', 'plumbing', 'mechanical_services', 'painting', 'plastering', 'waterproofing', 'tiling', 'flooring', 'roofing', 'windows', 'facade', 'glazing', 'kitchens', 'landscaping', 'final_clean', 'insulation', 'internal_walls', 'ceilings', 'stairs_balustrades', 'fire_protection', 'security_systems', 'building_services', 'fitout', 'technology') THEN 3
            ELSE 4
          END AS stage_sort,
          pa.estimated_workforce,
          CASE WHEN e.enterprise_agreement_status IS FALSE THEN FALSE ELSE TRUE END AS eba_status,
          pa.source AS data_source,
          pa.match_status,
          pa.match_confidence,
          pa.matched_at,
          pa.confirmed_at,
          pa.match_notes
        FROM project_assignments pa
        LEFT JOIN employers e ON e.id = pa.employer_id
        LEFT JOIN trade_types tt ON tt.id = pa.trade_type_id
        WHERE pa.project_id = p_project_id
          AND pa.assignment_type = 'trade_work'
      ),
      project_trades AS (
        SELECT
          'project_trade:' || pt.id::text AS id,
          pt.employer_id,
          COALESCE(e.name, 'Unknown') AS employer_name,
          LOWER(COALESCE(NULLIF(pt.trade_type, ''), 'other')) AS trade_type,
          COALESCE(tt.name, INITCAP(REPLACE(COALESCE(NULLIF(pt.trade_type, ''), 'other'), '_', ' '))) AS trade_label,
          COALESCE(NULLIF(LOWER(REPLACE(pt.stage, ' ', '_')), ''),
            CASE
              WHEN LOWER(COALESCE(NULLIF(pt.trade_type, ''), 'other')) IN ('demolition', 'earthworks', 'piling', 'excavations', 'scaffolding', 'traffic_control', 'traffic_management', 'waste_management', 'cleaning', 'labour_hire') THEN 'early_works'
              WHEN LOWER(COALESCE(NULLIF(pt.trade_type, ''), 'other')) IN ('tower_crane', 'mobile_crane', 'crane_and_rigging', 'concrete', 'concreting', 'form_work', 'reinforcing_steel', 'steel_fixing', 'post_tensioning', 'structural_steel', 'bricklaying', 'foundations') THEN 'structure'
              WHEN LOWER(COALESCE(NULLIF(pt.trade_type, ''), 'other')) IN ('carpentry', 'electrical', 'plumbing', 'mechanical_services', 'painting', 'plastering', 'waterproofing', 'tiling', 'flooring', 'roofing', 'windows', 'facade', 'glazing', 'kitchens', 'landscaping', 'final_clean', 'insulation', 'internal_walls', 'ceilings', 'stairs_balustrades', 'fire_protection', 'security_systems', 'building_services', 'fitout', 'technology') THEN 'finishing'
              ELSE 'other'
            END
          ) AS stage,
          CASE
            WHEN COALESCE(NULLIF(LOWER(REPLACE(pt.stage, ' ', '_')), ''), 'early_works') = 'early_works' THEN 1
            WHEN COALESCE(NULLIF(LOWER(REPLACE(pt.stage, ' ', '_')), ''), 'structure') = 'structure' THEN 2
            WHEN COALESCE(NULLIF(LOWER(REPLACE(pt.stage, ' ', '_')), ''), 'finishing') = 'finishing' THEN 3
            ELSE 4
          END AS stage_sort,
          pt.estimated_project_workforce AS estimated_workforce,
          CASE WHEN e.enterprise_agreement_status IS FALSE THEN FALSE ELSE TRUE END AS eba_status,
          pt.source AS data_source,
          pt.match_status,
          pt.match_confidence,
          pt.matched_at,
          pt.confirmed_at,
          pt.match_notes
        FROM project_contractor_trades pt
        LEFT JOIN employers e ON e.id = pt.employer_id
        LEFT JOIN trade_types tt ON tt.code = LOWER(COALESCE(NULLIF(pt.trade_type, ''), 'other'))
        WHERE pt.project_id = p_project_id
          AND pt.employer_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM assignment_trades at
            WHERE at.trade_type = LOWER(COALESCE(NULLIF(pt.trade_type, ''), 'other'))
              AND at.employer_id = pt.employer_id
          )
      ),
      site_trades AS (
        SELECT
          'site_trade:' || st.id::text AS id,
          st.employer_id,
          COALESCE(e.name, 'Unknown') AS employer_name,
          LOWER(COALESCE(NULLIF(st.trade_type, ''), 'other')) AS trade_type,
          COALESCE(tt.name, INITCAP(REPLACE(COALESCE(NULLIF(st.trade_type, ''), 'other'), '_', ' '))) AS trade_label,
          CASE
            WHEN LOWER(COALESCE(NULLIF(st.trade_type, ''), 'other')) IN ('demolition', 'earthworks', 'piling', 'excavations', 'scaffolding', 'traffic_control', 'traffic_management', 'waste_management', 'cleaning', 'labour_hire') THEN 'early_works'
            WHEN LOWER(COALESCE(NULLIF(st.trade_type, ''), 'other')) IN ('tower_crane', 'mobile_crane', 'crane_and_rigging', 'concrete', 'concreting', 'form_work', 'reinforcing_steel', 'steel_fixing', 'post_tensioning', 'structural_steel', 'bricklaying', 'foundations') THEN 'structure'
            WHEN LOWER(COALESCE(NULLIF(st.trade_type, ''), 'other')) IN ('carpentry', 'electrical', 'plumbing', 'mechanical_services', 'painting', 'plastering', 'waterproofing', 'tiling', 'flooring', 'roofing', 'windows', 'facade', 'glazing', 'kitchens', 'landscaping', 'final_clean', 'insulation', 'internal_walls', 'ceilings', 'stairs_balustrades', 'fire_protection', 'security_systems', 'building_services', 'fitout', 'technology') THEN 'finishing'
            ELSE 'other'
          END AS stage,
          CASE
            WHEN LOWER(COALESCE(NULLIF(st.trade_type, ''), 'other')) IN ('demolition', 'earthworks', 'piling', 'excavations', 'scaffolding', 'traffic_control', 'traffic_management', 'waste_management', 'cleaning', 'labour_hire') THEN 1
            WHEN LOWER(COALESCE(NULLIF(st.trade_type, ''), 'other')) IN ('tower_crane', 'mobile_crane', 'crane_and_rigging', 'concrete', 'concreting', 'form_work', 'reinforcing_steel', 'steel_fixing', 'post_tensioning', 'structural_steel', 'bricklaying', 'foundations') THEN 2
            WHEN LOWER(COALESCE(NULLIF(st.trade_type, ''), 'other')) IN ('carpentry', 'electrical', 'plumbing', 'mechanical_services', 'painting', 'plastering', 'waterproofing', 'tiling', 'flooring', 'roofing', 'windows', 'facade', 'glazing', 'kitchens', 'landscaping', 'final_clean', 'insulation', 'internal_walls', 'ceilings', 'stairs_balustrades', 'fire_protection', 'security_systems', 'building_services', 'fitout', 'technology') THEN 3
            ELSE 4
          END AS stage_sort,
          NULL::numeric AS estimated_workforce,
          CASE WHEN e.enterprise_agreement_status IS FALSE THEN FALSE ELSE TRUE END AS eba_status,
          'legacy_site_trades' AS data_source,
          NULL::text AS match_status,
          NULL::numeric AS match_confidence,
          NULL::timestamptz AS matched_at,
          NULL::timestamptz AS confirmed_at,
          NULL::text AS match_notes
        FROM site_contractor_trades st
        LEFT JOIN employers e ON e.id = st.employer_id
        LEFT JOIN trade_types tt ON tt.code = LOWER(COALESCE(NULLIF(st.trade_type, ''), 'other'))
        WHERE v_main_job_site_id IS NOT NULL
          AND st.job_site_id = v_main_job_site_id
          AND st.employer_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM assignment_trades at
            WHERE at.trade_type = LOWER(COALESCE(NULLIF(st.trade_type, ''), 'other'))
              AND at.employer_id = st.employer_id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM project_trades pt
            WHERE pt.trade_type = LOWER(COALESCE(NULLIF(st.trade_type, ''), 'other'))
              AND pt.employer_id = st.employer_id
          )
      ),
      actual_trades AS (
        SELECT * FROM assignment_trades
        UNION ALL
        SELECT * FROM project_trades
        UNION ALL
        SELECT * FROM site_trades
      ),
      key_trade_types AS (
        SELECT unnest(ARRAY['demolition', 'piling', 'concrete', 'scaffolding', 'form_work', 'tower_crane', 'mobile_crane', 'labour_hire', 'earthworks', 'traffic_control']) AS trade_code
      ),
      key_trades AS (
        SELECT
          'empty_key_trade:' || kt.trade_code AS id,
          NULL::uuid AS employer_id,
          NULL::text AS employer_name,
          kt.trade_code AS trade_type,
          INITCAP(REPLACE(kt.trade_code, '_', ' ')) AS trade_label,
          CASE
            WHEN kt.trade_code IN ('demolition', 'earthworks', 'piling', 'excavations', 'scaffolding', 'traffic_control', 'traffic_management', 'waste_management', 'cleaning', 'labour_hire') THEN 'early_works'
            WHEN kt.trade_code IN ('tower_crane', 'mobile_crane', 'crane_and_rigging', 'concrete', 'concreting', 'form_work', 'reinforcing_steel', 'steel_fixing', 'post_tensioning', 'structural_steel', 'bricklaying', 'foundations') THEN 'structure'
            WHEN kt.trade_code IN ('carpentry', 'electrical', 'plumbing', 'mechanical_services', 'painting', 'plastering', 'waterproofing', 'tiling', 'flooring', 'roofing', 'windows', 'facade', 'glazing', 'kitchens', 'landscaping', 'final_clean', 'insulation', 'internal_walls', 'ceilings', 'stairs_balustrades', 'fire_protection', 'security_systems', 'building_services', 'fitout', 'technology') THEN 'finishing'
            ELSE 'other'
          END AS stage,
          CASE
            WHEN kt.trade_code IN ('demolition', 'earthworks', 'piling', 'excavations', 'scaffolding', 'traffic_control', 'traffic_management', 'waste_management', 'cleaning', 'labour_hire') THEN 1
            WHEN kt.trade_code IN ('tower_crane', 'mobile_crane', 'crane_and_rigging', 'concrete', 'concreting', 'form_work', 'reinforcing_steel', 'steel_fixing', 'post_tensioning', 'structural_steel', 'bricklaying', 'foundations') THEN 2
            WHEN kt.trade_code IN ('carpentry', 'electrical', 'plumbing', 'mechanical_services', 'painting', 'plastering', 'waterproofing', 'tiling', 'flooring', 'roofing', 'windows', 'facade', 'glazing', 'kitchens', 'landscaping', 'final_clean', 'insulation', 'internal_walls', 'ceilings', 'stairs_balustrades', 'fire_protection', 'security_systems', 'building_services', 'fitout', 'technology') THEN 3
            ELSE 4
          END AS stage_sort,
          NULL::numeric AS estimated_workforce,
          NULL::boolean AS eba_status,
          NULL::text AS data_source,
          NULL::text AS match_status,
          NULL::numeric AS match_confidence,
          NULL::timestamptz AS matched_at,
          NULL::timestamptz AS confirmed_at,
          NULL::text AS match_notes
        FROM key_trade_types kt
        LEFT JOIN (
          SELECT DISTINCT trade_type
          FROM actual_trades
        ) existing ON existing.trade_type = kt.trade_code
        WHERE existing.trade_type IS NULL
      ),
      combined AS (
        SELECT * FROM actual_trades
        UNION ALL
        SELECT * FROM key_trades
      ),
      rows AS (
        SELECT
          jsonb_build_object(
            'id', c.id,
            'employerId', c.employer_id,
            'employerName', c.employer_name,
            'tradeType', c.trade_type,
            'tradeLabel', c.trade_label,
            'stage', c.stage,
            'estimatedWorkforce', c.estimated_workforce,
            'ebaStatus', c.eba_status,
            'dataSource', c.data_source,
            'matchStatus', c.match_status,
            'matchConfidence', c.match_confidence,
            'matchedAt', c.matched_at,
            'confirmedAt', c.confirmed_at,
            'matchNotes', c.match_notes
          ) AS row_data,
          c.stage_sort,
          c.trade_label,
          c.id
        FROM combined c
      )
      SELECT jsonb_agg(rows.row_data ORDER BY rows.stage_sort, rows.trade_label, rows.id)
      FROM rows
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_form_trade_contractors(text, uuid) TO anon;


