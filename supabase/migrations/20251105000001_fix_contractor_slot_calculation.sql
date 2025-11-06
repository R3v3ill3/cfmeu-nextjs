-- Fix contractor slot calculation to be dynamic based on canonical key contractor list
-- Replaces hardcoded COUNT(*) * 9 with dynamic calculation from key_contractor_trades table

CREATE OR REPLACE FUNCTION public.calculate_organizing_universe_metrics(
  p_patch_ids UUID[] DEFAULT NULL,
  p_tier TEXT DEFAULT NULL,
  p_stage TEXT DEFAULT NULL,
  p_universe TEXT DEFAULT 'active',
  p_eba_filter TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_user_role TEXT DEFAULT NULL
)
RETURNS TABLE (
  eba_projects_percentage INTEGER,
  eba_projects_count INTEGER,
  total_active_projects INTEGER,
  known_builder_percentage INTEGER,
  known_builder_count INTEGER,
  key_contractor_coverage_percentage INTEGER,
  mapped_key_contractors INTEGER,
  total_key_contractor_slots INTEGER,
  key_contractor_eba_builder_percentage INTEGER,
  key_contractors_on_eba_builder_projects INTEGER,
  total_key_contractors_on_eba_builder_projects INTEGER,
  key_contractor_eba_percentage INTEGER,
  key_contractors_with_eba INTEGER,
  total_mapped_key_contractors INTEGER
) AS $$
DECLARE
  -- Dynamic key contractor trades from database
  v_key_contractor_trades TEXT[];
  key_contractor_roles TEXT[] := ARRAY['head_contractor', 'builder'];
  key_trades_count INTEGER;
  key_roles_count INTEGER := 2; -- head_contractor, builder
  total_key_categories INTEGER;
  
  allowed_roles CONSTANT TEXT[] := ARRAY['organiser', 'lead_organiser', 'admin'];
  active_user_id UUID;
  session_role TEXT;
  effective_user_id UUID;
  effective_role TEXT;
  patch_ids_filter UUID[];
  requested_patch_ids UUID[];
  final_patch_ids UUID[];
  sanitized_universe TEXT;
  sanitized_tier TEXT;
  sanitized_stage TEXT;
  requested_role_param TEXT := NULLIF(p_user_role, '');
  shared_lead_ids UUID[];
BEGIN
  PERFORM set_config('search_path', 'public', true);

  -- Get active key contractor trades from database
  SELECT ARRAY_AGG(kct.trade_type ORDER BY kct.display_order)
  INTO v_key_contractor_trades
  FROM key_contractor_trades kct
  WHERE kct.is_active = true;
  
  -- Fallback to hardcoded list if table is empty or query fails
  IF v_key_contractor_trades IS NULL OR array_length(v_key_contractor_trades, 1) IS NULL THEN
    v_key_contractor_trades := ARRAY['demolition', 'piling', 'concreting', 'form_work', 'scaffolding', 'tower_crane', 'mobile_crane'];
  END IF;
  
  -- Get count for slot calculation
  SELECT COUNT(*) INTO key_trades_count
  FROM key_contractor_trades kct
  WHERE kct.is_active = true;
  
  -- Fallback count if query fails
  IF key_trades_count IS NULL OR key_trades_count = 0 THEN
    key_trades_count := 7; -- Default to previous hardcoded count
  END IF;
  
  -- Calculate total key categories (trades + roles)
  total_key_categories := key_trades_count + key_roles_count;

  active_user_id := auth.uid();
  IF active_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
  END IF;

  SELECT role INTO session_role FROM profiles WHERE id = active_user_id;
  IF session_role IS NULL OR session_role <> ALL(allowed_roles) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Role not permitted to view organizing metrics';
  END IF;

  effective_user_id := active_user_id;
  IF session_role = 'admin' AND p_user_id IS NOT NULL THEN
    effective_user_id := p_user_id;
  END IF;

  IF session_role <> 'admin' AND effective_user_id <> active_user_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Impersonation is not permitted';
  END IF;

  IF session_role = 'admin' AND requested_role_param IS NOT NULL THEN
    IF requested_role_param <> ALL(allowed_roles) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid role override requested';
    END IF;
    effective_role := requested_role_param;
  END IF;

  IF effective_role IS NULL THEN
    IF effective_user_id IS NULL THEN
      effective_role := session_role;
    ELSE
      SELECT role INTO effective_role FROM profiles WHERE id = effective_user_id;
      IF effective_role IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Target profile could not be resolved';
      END IF;
    END IF;
  END IF;

  IF effective_role <> ALL(allowed_roles) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Role not permitted to view organizing metrics';
  END IF;

  patch_ids_filter := NULL;
  IF effective_role = 'admin' OR effective_role = 'lead_organiser' THEN
    patch_ids_filter := NULL; -- full access
  ELSE
    SELECT ARRAY_AGG(DISTINCT lopa.lead_organiser_id) INTO shared_lead_ids
    FROM lead_organiser_patch_assignments lopa
    JOIN organiser_patch_assignments opa
      ON opa.patch_id = lopa.patch_id
     AND opa.effective_to IS NULL
    WHERE opa.organiser_id = effective_user_id
      AND lopa.effective_to IS NULL;

    WITH organiser_patches AS (
      SELECT DISTINCT opa.patch_id
      FROM organiser_patch_assignments opa
      WHERE opa.organiser_id = effective_user_id
        AND opa.effective_to IS NULL
    ),
    peer_patches AS (
      SELECT DISTINCT lopa.patch_id
      FROM lead_organiser_patch_assignments lopa
      WHERE lopa.effective_to IS NULL
        AND shared_lead_ids IS NOT NULL
        AND lopa.lead_organiser_id = ANY(shared_lead_ids)
    )
    SELECT ARRAY_AGG(DISTINCT patch_id) INTO patch_ids_filter
    FROM (
      SELECT patch_id FROM organiser_patches
      UNION
      SELECT patch_id FROM peer_patches
    ) s;

    IF patch_ids_filter IS NULL THEN
      patch_ids_filter := ARRAY[]::UUID[];
    END IF;
  END IF;

  requested_patch_ids := NULL;
  IF p_patch_ids IS NOT NULL THEN
    SELECT ARRAY_AGG(DISTINCT pid)
    INTO requested_patch_ids
    FROM UNNEST(p_patch_ids) AS pid;
  END IF;

  IF patch_ids_filter IS NULL THEN
    final_patch_ids := requested_patch_ids;
  ELSIF requested_patch_ids IS NULL THEN
    final_patch_ids := patch_ids_filter;
  ELSE
    SELECT ARRAY_AGG(DISTINCT scope_id)
    INTO final_patch_ids
    FROM UNNEST(patch_ids_filter) AS scope_id
    WHERE scope_id = ANY(requested_patch_ids);

    IF final_patch_ids IS NULL THEN
      final_patch_ids := ARRAY[]::UUID[];
    END IF;
  END IF;

  sanitized_universe := COALESCE(p_universe, 'active');
  sanitized_tier := NULLIF(p_tier, '');
  sanitized_stage := NULLIF(p_stage, '');

  RETURN QUERY
  WITH patch_scoped_projects AS (
    SELECT DISTINCT ppmv.project_id
    FROM patch_project_mapping_view ppmv
    WHERE final_patch_ids IS NOT NULL
      AND ppmv.patch_id = ANY(final_patch_ids)
  ),
  filtered_projects AS (
    SELECT p.id, p.organising_universe, p.stage_class, p.tier
    FROM projects p
    WHERE p.organising_universe::text = sanitized_universe
      AND (sanitized_tier IS NULL OR p.tier::text = sanitized_tier)
      AND (sanitized_stage IS NULL OR p.stage_class::text = sanitized_stage)
      AND (
        final_patch_ids IS NULL OR COALESCE(array_length(final_patch_ids, 1), 0) = 0
        OR p.id IN (SELECT project_id FROM patch_scoped_projects)
      )
  ),
  builder_assignments AS (
    SELECT
      pa.project_id,
      bool_or(pa.employer_id IS NOT NULL) AS has_primary_for_role,
      bool_or(mv.employer_id IS NOT NULL) AS primary_has_eba
    FROM project_assignments pa
    LEFT JOIN contractor_role_types crt ON crt.id = pa.contractor_role_type_id
    LEFT JOIN mv_active_eba_employers mv ON mv.employer_id = pa.employer_id
    WHERE pa.project_id IN (SELECT id FROM filtered_projects)
      AND pa.assignment_type = 'contractor_role'
      AND pa.is_primary_for_role = TRUE
      AND crt.code = ANY(key_contractor_roles)
    GROUP BY pa.project_id
  ),
  key_assignments AS (
    SELECT
      pa.project_id,
      COALESCE(pa.contractor_role_type_id::text, pa.trade_type_id::text) AS slot_id,
      mv.employer_id IS NOT NULL AS has_active_eba
    FROM project_assignments pa
    LEFT JOIN contractor_role_types crt ON crt.id = pa.contractor_role_type_id
    LEFT JOIN trade_types tt ON tt.id = pa.trade_type_id
    LEFT JOIN mv_active_eba_employers mv ON mv.employer_id = pa.employer_id
    WHERE pa.project_id IN (SELECT id FROM filtered_projects)
      AND (
        (pa.assignment_type = 'contractor_role' AND crt.code = ANY(key_contractor_roles))
        OR (pa.assignment_type = 'trade_work' AND tt.code = ANY(v_key_contractor_trades))
      )
      AND COALESCE(pa.contractor_role_type_id::text, pa.trade_type_id::text) IS NOT NULL
  ),
  key_rollup AS (
    SELECT
      project_id,
      COUNT(DISTINCT slot_id) AS total_key_contractors,
      COUNT(DISTINCT slot_id) FILTER (WHERE has_active_eba) AS key_contractors_with_eba
    FROM key_assignments
    GROUP BY project_id
  ),
  project_metrics AS (
    SELECT
      fp.id AS project_id,
      CASE WHEN COALESCE(ba.primary_has_eba, FALSE) THEN 1 ELSE 0 END AS is_eba_project,
      CASE WHEN COALESCE(ba.has_primary_for_role, FALSE) THEN 1 ELSE 0 END AS has_known_builder,
      COALESCE(kr.total_key_contractors, 0) AS mapped_key_contractors_count,
      COALESCE(kr.key_contractors_with_eba, 0) AS key_contractors_with_eba_count,
      CASE WHEN COALESCE(ba.primary_has_eba, FALSE) THEN COALESCE(kr.total_key_contractors, 0) ELSE 0 END AS key_contractors_on_eba_builder_project,
      CASE WHEN COALESCE(ba.primary_has_eba, FALSE) THEN COALESCE(kr.key_contractors_with_eba, 0) ELSE 0 END AS key_contractors_with_eba_on_eba_builder_project
    FROM filtered_projects fp
    LEFT JOIN builder_assignments ba ON ba.project_id = fp.id
    LEFT JOIN key_rollup kr ON kr.project_id = fp.id
    WHERE (
      p_eba_filter IS NULL OR p_eba_filter = '' OR p_eba_filter = 'all'
      OR (
        p_eba_filter = 'eba_active' AND COALESCE(ba.primary_has_eba, FALSE)
      )
      OR (
        p_eba_filter = 'eba_inactive' AND COALESCE(ba.has_primary_for_role, FALSE) AND NOT COALESCE(ba.primary_has_eba, FALSE)
      )
      OR (
        p_eba_filter = 'builder_unknown' AND NOT COALESCE(ba.has_primary_for_role, FALSE)
      )
    )
  ),
  aggregated_metrics AS (
    SELECT
      COUNT(*) AS total_projects,
      SUM(is_eba_project) AS eba_projects,
      SUM(has_known_builder) AS known_builders,
      SUM(mapped_key_contractors_count) AS total_mapped_key_contractors,
      SUM(key_contractors_with_eba_count) AS total_key_contractors_with_eba,
      SUM(key_contractors_on_eba_builder_project) AS total_key_contractors_on_eba_projects,
      SUM(key_contractors_with_eba_on_eba_builder_project) AS total_key_contractors_eba_on_eba_projects,
      -- DYNAMIC CALCULATION: (key_trades_count + key_roles_count) * project_count
      COUNT(*) * total_key_categories AS total_key_contractor_slots
    FROM project_metrics
  )
  SELECT
    CASE WHEN am.total_projects > 0 THEN ROUND((am.eba_projects::DECIMAL / am.total_projects) * 100) ELSE 0 END::INTEGER,
    COALESCE(am.eba_projects, 0)::INTEGER,
    COALESCE(am.total_projects, 0)::INTEGER,
    CASE WHEN am.total_projects > 0 THEN ROUND((am.known_builders::DECIMAL / am.total_projects) * 100) ELSE 0 END::INTEGER,
    COALESCE(am.known_builders, 0)::INTEGER,
    CASE WHEN am.total_key_contractor_slots > 0 THEN ROUND((am.total_mapped_key_contractors::DECIMAL / am.total_key_contractor_slots) * 100) ELSE 0 END::INTEGER,
    COALESCE(am.total_mapped_key_contractors, 0)::INTEGER,
    COALESCE(am.total_key_contractor_slots, 0)::INTEGER,
    CASE WHEN am.total_key_contractors_on_eba_projects > 0 THEN ROUND((am.total_key_contractors_eba_on_eba_projects::DECIMAL / am.total_key_contractors_on_eba_projects) * 100) ELSE 0 END::INTEGER,
    COALESCE(am.total_key_contractors_eba_on_eba_projects, 0)::INTEGER,
    COALESCE(am.total_key_contractors_on_eba_projects, 0)::INTEGER,
    CASE WHEN am.total_mapped_key_contractors > 0 THEN ROUND((am.total_key_contractors_with_eba::DECIMAL / am.total_mapped_key_contractors) * 100) ELSE 0 END::INTEGER,
    COALESCE(am.total_key_contractors_with_eba, 0)::INTEGER,
    COALESCE(am.total_mapped_key_contractors, 0)::INTEGER
  FROM aggregated_metrics am;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.calculate_organizing_universe_metrics TO authenticated, service_role;

COMMENT ON FUNCTION public.calculate_organizing_universe_metrics IS 
  'Calculate organizing universe metrics with dynamic contractor slot calculation based on key_contractor_trades table';

