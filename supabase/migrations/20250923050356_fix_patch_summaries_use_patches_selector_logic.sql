-- Fix: Update get_patch_summaries_for_user to use the same logic as the working patches selector
-- This ensures coordinator dashboard data shows correct coordinator-specific patches

CREATE OR REPLACE FUNCTION public.get_patch_summaries_for_user(
  p_user_id UUID DEFAULT NULL,
  p_user_role TEXT DEFAULT NULL,
  p_lead_organiser_id UUID DEFAULT NULL,
  p_filters JSONB DEFAULT NULL
)
RETURNS TABLE (
  patch_id UUID,
  patch_name TEXT,
  organiser_names TEXT[],
  project_count INTEGER,
  eba_projects_count INTEGER,
  eba_projects_percentage INTEGER,
  known_builder_count INTEGER,
  known_builder_percentage INTEGER,
  key_contractor_coverage INTEGER,
  key_contractor_eba_percentage INTEGER,
  last_updated TIMESTAMPTZ
) AS $$
DECLARE
  active_user_id UUID;
  session_role TEXT;
  effective_user_id UUID;
  effective_role TEXT;
  lead_filter UUID;
  patch_ids_filter UUID[];
  final_patch_ids UUID[];
  shared_lead_ids UUID[];
  allowed_roles CONSTANT TEXT[] := ARRAY['organiser', 'lead_organiser', 'admin'];
BEGIN
  PERFORM set_config('search_path', 'public', true);

  active_user_id := auth.uid();
  IF active_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
  END IF;

  SELECT role INTO session_role FROM profiles WHERE id = active_user_id;
  IF session_role IS NULL OR session_role <> ALL(allowed_roles) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Role not permitted to view patch summaries';
  END IF;

  effective_user_id := active_user_id;
  IF session_role = 'admin' AND p_user_id IS NOT NULL THEN
    effective_user_id := p_user_id;
  END IF;

  IF session_role <> 'admin' AND effective_user_id <> active_user_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Impersonation is not permitted';
  END IF;

  IF session_role = 'admin' AND p_user_role IS NOT NULL THEN
    IF p_user_role <> ALL(allowed_roles) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid role override requested';
    END IF;
    effective_role := p_user_role;
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
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Role not permitted to view patch summaries';
  END IF;

  lead_filter := p_lead_organiser_id;

  IF lead_filter IS NOT NULL THEN
    IF session_role = 'admin' THEN
      NULL; -- Admin can view any lead organizer
    ELSIF effective_role = 'lead_organiser' THEN
      IF effective_user_id IS NULL OR lead_filter <> effective_user_id THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Lead organiser filter not permitted';
      END IF;
    ELSE
      SELECT ARRAY_AGG(DISTINCT lopa.lead_organiser_id) INTO shared_lead_ids
      FROM lead_organiser_patch_assignments lopa
      JOIN organiser_patch_assignments opa
        ON opa.patch_id = lopa.patch_id
       AND opa.effective_to IS NULL
      WHERE opa.organiser_id = effective_user_id
        AND lopa.effective_to IS NULL;

      IF shared_lead_ids IS NULL OR NOT lead_filter = ANY(shared_lead_ids) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Lead organiser filter not permitted';
      END IF;
    END IF;
  END IF;

  -- 🔧 FIX: Use the same logic as the working patches selector
  patch_ids_filter := NULL;

  IF effective_role = 'admin' THEN
    IF lead_filter IS NOT NULL THEN
      -- Use patches selector logic: Check if it's a live or draft lead organizer
      DECLARE
        is_live_lead BOOLEAN := FALSE;
        is_draft_lead BOOLEAN := FALSE;
        live_organiser_ids UUID[];
        draft_organiser_ids UUID[];
        live_patches UUID[];
        draft_patches UUID[];
        all_coordinator_patches UUID[];
      BEGIN
        -- Check if it's a live lead organizer
        SELECT EXISTS(
          SELECT 1 FROM profiles 
          WHERE id = lead_filter AND role = 'lead_organiser'
        ) INTO is_live_lead;

        -- Check if it's a draft lead organizer  
        SELECT EXISTS(
          SELECT 1 FROM pending_users 
          WHERE id = lead_filter AND role = 'lead_organiser'
        ) INTO is_draft_lead;

        IF is_live_lead THEN
          -- Live lead → get patches via child organizers (same logic as patches selector)
          
          -- Get live organizers under this lead via role_hierarchy
          SELECT ARRAY_AGG(DISTINCT rh.child_user_id)
          INTO live_organiser_ids
          FROM role_hierarchy rh
          WHERE rh.parent_user_id = lead_filter 
            AND rh.end_date IS NULL;

          -- Get draft organizers under this lead via lead_draft_organiser_links
          SELECT ARRAY_AGG(DISTINCT ldol.pending_user_id)
          INTO draft_organiser_ids
          FROM lead_draft_organiser_links ldol
          WHERE ldol.lead_user_id = lead_filter 
            AND ldol.is_active = true;

          -- Get patches from live organizers
          IF live_organiser_ids IS NOT NULL AND array_length(live_organiser_ids, 1) > 0 THEN
            SELECT ARRAY_AGG(DISTINCT opa.patch_id)
            INTO live_patches
            FROM organiser_patch_assignments opa
            WHERE opa.organiser_id = ANY(live_organiser_ids)
              AND opa.effective_to IS NULL;
          END IF;

          -- Get patches from draft organizers under this lead
          IF draft_organiser_ids IS NOT NULL AND array_length(draft_organiser_ids, 1) > 0 THEN
            SELECT ARRAY_AGG(DISTINCT patch_id)
            INTO draft_patches
            FROM (
              SELECT UNNEST(pu.assigned_patch_ids) as patch_id
              FROM pending_users pu
              WHERE pu.id = ANY(draft_organiser_ids)
                AND pu.assigned_patch_ids IS NOT NULL
            ) sub;
          END IF;

          -- Combine live and draft patches
          SELECT ARRAY_AGG(DISTINCT patch_id)
          INTO all_coordinator_patches
          FROM (
            SELECT UNNEST(COALESCE(live_patches, ARRAY[]::UUID[])) as patch_id
            UNION
            SELECT UNNEST(COALESCE(draft_patches, ARRAY[]::UUID[])) as patch_id
          ) combined_patches;

        ELSIF is_draft_lead THEN
          -- Draft lead → get patches directly from assigned_patch_ids
          SELECT assigned_patch_ids
          INTO all_coordinator_patches
          FROM pending_users
          WHERE id = lead_filter;

        END IF;

        patch_ids_filter := all_coordinator_patches;
        
        -- If no patches found, return empty array (not NULL)
        IF patch_ids_filter IS NULL THEN
          patch_ids_filter := ARRAY[]::UUID[];
        END IF;
      END;
    ELSE
      patch_ids_filter := NULL; -- Full access when no lead filter
    END IF;
  ELSIF effective_role = 'lead_organiser' THEN
    IF lead_filter IS NOT NULL THEN
      -- Same patches selector logic for lead organizers viewing themselves
      DECLARE
        is_live_lead BOOLEAN := FALSE;
        is_draft_lead BOOLEAN := FALSE;
        live_organiser_ids UUID[];
        draft_organiser_ids UUID[];
        live_patches UUID[];
        draft_patches UUID[];
        all_coordinator_patches UUID[];
      BEGIN
        -- Check if it's a live lead organizer
        SELECT EXISTS(
          SELECT 1 FROM profiles 
          WHERE id = lead_filter AND role = 'lead_organiser'
        ) INTO is_live_lead;

        -- Check if it's a draft lead organizer  
        SELECT EXISTS(
          SELECT 1 FROM pending_users 
          WHERE id = lead_filter AND role = 'lead_organiser'
        ) INTO is_draft_lead;

        IF is_live_lead THEN
          -- Get live organizers under this lead
          SELECT ARRAY_AGG(DISTINCT rh.child_user_id)
          INTO live_organiser_ids
          FROM role_hierarchy rh
          WHERE rh.parent_user_id = lead_filter 
            AND rh.end_date IS NULL;

          -- Get draft organizers under this lead
          SELECT ARRAY_AGG(DISTINCT ldol.pending_user_id)
          INTO draft_organiser_ids
          FROM lead_draft_organiser_links ldol
          WHERE ldol.lead_user_id = lead_filter 
            AND ldol.is_active = true;

          -- Get patches from live organizers
          IF live_organiser_ids IS NOT NULL AND array_length(live_organiser_ids, 1) > 0 THEN
            SELECT ARRAY_AGG(DISTINCT opa.patch_id)
            INTO live_patches
            FROM organiser_patch_assignments opa
            WHERE opa.organiser_id = ANY(live_organiser_ids)
              AND opa.effective_to IS NULL;
          END IF;

          -- Get patches from draft organizers
          IF draft_organiser_ids IS NOT NULL AND array_length(draft_organiser_ids, 1) > 0 THEN
            SELECT ARRAY_AGG(DISTINCT patch_id)
            INTO draft_patches
            FROM (
              SELECT UNNEST(pu.assigned_patch_ids) as patch_id
              FROM pending_users pu
              WHERE pu.id = ANY(draft_organiser_ids)
                AND pu.assigned_patch_ids IS NOT NULL
            ) sub;
          END IF;

          -- Combine patches
          SELECT ARRAY_AGG(DISTINCT patch_id)
          INTO all_coordinator_patches
          FROM (
            SELECT UNNEST(COALESCE(live_patches, ARRAY[]::UUID[])) as patch_id
            UNION
            SELECT UNNEST(COALESCE(draft_patches, ARRAY[]::UUID[])) as patch_id
          ) combined_patches;

        ELSIF is_draft_lead THEN
          -- Draft lead → get patches from assigned_patch_ids
          SELECT assigned_patch_ids
          INTO all_coordinator_patches
          FROM pending_users
          WHERE id = lead_filter;

        END IF;

        patch_ids_filter := all_coordinator_patches;
        
        IF patch_ids_filter IS NULL THEN
          patch_ids_filter := ARRAY[]::UUID[];
        END IF;
      END;
    ELSE
      patch_ids_filter := NULL; -- Full access when no lead filter
    END IF;
  ELSE
    -- Original organiser logic (unchanged)
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
        AND (lead_filter IS NULL OR lopa.lead_organiser_id = lead_filter)
        AND (
          lead_filter IS NOT NULL
          OR (shared_lead_ids IS NOT NULL AND lopa.lead_organiser_id = ANY(shared_lead_ids))
        )
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

  final_patch_ids := patch_ids_filter;
  IF final_patch_ids IS NOT NULL AND array_length(final_patch_ids, 1) = 0 THEN
    RETURN; -- Return empty if no patches found
  END IF;

  RETURN QUERY
  WITH patch_scope AS (
    SELECT p.id, p.name
    FROM patches p
    WHERE final_patch_ids IS NULL OR p.id = ANY(final_patch_ids)
  ),
  patch_projects AS (
    SELECT
      ps.id AS patch_id,
      ps.name AS patch_name,
      COUNT(DISTINCT proj.id) AS total_projects,
      COUNT(DISTINCT CASE
        WHEN EXISTS (
          SELECT 1
          FROM project_assignments pa
          WHERE pa.project_id = proj.id
            AND pa.assignment_type = 'contractor_role'
            AND pa.is_primary_for_role = TRUE
            AND EXISTS (
              SELECT 1
              FROM company_eba_records cer
              WHERE cer.employer_id = pa.employer_id
                AND cer.fwc_certified_date IS NOT NULL
            )
        ) THEN proj.id END) AS eba_projects,
      COUNT(DISTINCT CASE
        WHEN EXISTS (
          SELECT 1
          FROM project_assignments pa
          WHERE pa.project_id = proj.id
            AND pa.assignment_type = 'contractor_role'
            AND pa.is_primary_for_role = TRUE
        ) THEN proj.id END) AS known_builder_projects
    FROM patch_scope ps
    LEFT JOIN patch_job_sites pjs
      ON pjs.patch_id = ps.id
     AND pjs.effective_to IS NULL
    LEFT JOIN job_sites js
      ON js.id = pjs.job_site_id
    LEFT JOIN projects proj
      ON proj.id = js.project_id
    WHERE proj.organising_universe::text = 'active'
      AND (
        p_filters IS NULL OR (
          (p_filters->>'tier' IS NULL OR proj.tier::text = p_filters->>'tier')
          AND (p_filters->>'stage' IS NULL OR proj.stage_class::text = p_filters->>'stage')
          AND (p_filters->>'universe' IS NULL OR proj.organising_universe::text = p_filters->>'universe')
        )
      )
    GROUP BY ps.id, ps.name
  ),
  patch_organisers AS (
    SELECT
      ps.id AS patch_id,
      ARRAY_AGG(DISTINCT pr.full_name ORDER BY pr.full_name) AS organiser_names
    FROM patch_scope ps
    LEFT JOIN organiser_patch_assignments opa
      ON opa.patch_id = ps.id
     AND opa.effective_to IS NULL
    LEFT JOIN profiles pr
      ON pr.id = opa.organiser_id
    GROUP BY ps.id
  )
  SELECT
    pp.patch_id,
    pp.patch_name,
    COALESCE(po.organiser_names, ARRAY[]::TEXT[]),
    pp.total_projects::INTEGER,
    pp.eba_projects::INTEGER,
    CASE WHEN pp.total_projects > 0 THEN ROUND((pp.eba_projects::DECIMAL / pp.total_projects) * 100) ELSE 0 END::INTEGER,
    pp.known_builder_projects::INTEGER,
    CASE WHEN pp.total_projects > 0 THEN ROUND((pp.known_builder_projects::DECIMAL / pp.total_projects) * 100) ELSE 0 END::INTEGER,
    0::INTEGER,
    0::INTEGER,
    NOW() AS last_updated
  FROM patch_projects pp
  LEFT JOIN patch_organisers po ON po.patch_id = pp.patch_id
  ORDER BY pp.patch_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_patch_summaries_for_user IS
  'Role-aware patch summaries using patches selector logic for coordinator filtering';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_patch_summaries_for_user TO authenticated, service_role;
