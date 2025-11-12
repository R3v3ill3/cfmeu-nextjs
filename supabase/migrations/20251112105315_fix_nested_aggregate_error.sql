-- Migration: Fix nested aggregate function error
-- Fixes "aggregate function calls cannot be nested" error in delegated tasks RPC functions
-- This replaces the functions with corrected versions that use subqueries

-- Fix get_delegated_tasks_team function
CREATE OR REPLACE FUNCTION get_delegated_tasks_team(
  p_lead_user_id uuid,
  p_period text DEFAULT 'month',
  p_resource_type text DEFAULT 'PROJECT_AUDIT_COMPLIANCE'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_start timestamptz;
  v_team_totals jsonb;
  v_organisers jsonb;
BEGIN
  -- Calculate period start date
  CASE p_period
    WHEN 'week' THEN v_period_start := CURRENT_DATE - INTERVAL '7 days';
    WHEN 'month' THEN v_period_start := CURRENT_DATE - INTERVAL '30 days';
    WHEN '3months' THEN v_period_start := CURRENT_DATE - INTERVAL '90 days';
    ELSE v_period_start := CURRENT_DATE - INTERVAL '30 days';
  END CASE;

  -- Get team totals
  SELECT jsonb_build_object(
    'generated', COUNT(*),
    'submitted', COUNT(*) FILTER (WHERE submitted_at IS NOT NULL),
    'submissionRate', CASE 
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE submitted_at IS NOT NULL)::numeric / COUNT(*)::numeric * 100), 2)
      ELSE 0
    END
  )
  INTO v_team_totals
  FROM secure_access_tokens sat
  INNER JOIN role_hierarchy rh ON rh.child_user_id = sat.created_by
  WHERE rh.parent_user_id = p_lead_user_id
    AND rh.is_active = true
    AND (rh.end_date IS NULL OR rh.end_date >= CURRENT_DATE)
    AND sat.resource_type = p_resource_type
    AND sat.created_at >= v_period_start;

  -- Get per-organiser breakdown (using subquery to avoid nested aggregates)
  SELECT jsonb_agg(
    jsonb_build_object(
      'organiserId', organiser_id,
      'organiserName', organiser_name,
      'generated', generated_count,
      'submitted', submitted_count,
      'submissionRate', submission_rate
    ) ORDER BY generated_count DESC
  )
  INTO v_organisers
  FROM (
    SELECT 
      sat.created_by AS organiser_id,
      p.full_name AS organiser_name,
      COUNT(*) AS generated_count,
      COUNT(*) FILTER (WHERE sat.submitted_at IS NOT NULL) AS submitted_count,
      CASE 
        WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE sat.submitted_at IS NOT NULL)::numeric / COUNT(*)::numeric * 100), 2)
        ELSE 0
      END AS submission_rate
    FROM secure_access_tokens sat
    INNER JOIN role_hierarchy rh ON rh.child_user_id = sat.created_by
    INNER JOIN profiles p ON p.id = sat.created_by
    WHERE rh.parent_user_id = p_lead_user_id
      AND rh.is_active = true
      AND (rh.end_date IS NULL OR rh.end_date >= CURRENT_DATE)
      AND sat.resource_type = p_resource_type
      AND sat.created_at >= v_period_start
    GROUP BY sat.created_by, p.full_name
  ) subq;

  RETURN jsonb_build_object(
    'teamTotals', COALESCE(v_team_totals, jsonb_build_object('generated', 0, 'submitted', 0, 'submissionRate', 0)),
    'organisers', COALESCE(v_organisers, '[]'::jsonb)
  );
END;
$$;

-- Fix get_delegated_tasks_universe function
CREATE OR REPLACE FUNCTION get_delegated_tasks_universe(
  p_period text DEFAULT 'month',
  p_resource_type text DEFAULT 'PROJECT_AUDIT_COMPLIANCE'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_start timestamptz;
  v_universe_stats jsonb;
  v_teams jsonb;
  v_organisers jsonb;
BEGIN
  -- Calculate period start date
  CASE p_period
    WHEN 'week' THEN v_period_start := CURRENT_DATE - INTERVAL '7 days';
    WHEN 'month' THEN v_period_start := CURRENT_DATE - INTERVAL '30 days';
    WHEN '3months' THEN v_period_start := CURRENT_DATE - INTERVAL '90 days';
    ELSE v_period_start := CURRENT_DATE - INTERVAL '30 days';
  END CASE;

  -- Get universe totals
  SELECT jsonb_build_object(
    'generated', COUNT(*),
    'submitted', COUNT(*) FILTER (WHERE submitted_at IS NOT NULL),
    'submissionRate', CASE 
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE submitted_at IS NOT NULL)::numeric / COUNT(*)::numeric * 100), 2)
      ELSE 0
    END,
    'uniqueOrganisers', COUNT(DISTINCT created_by),
    'uniqueTeams', COUNT(DISTINCT rh.parent_user_id)
  )
  INTO v_universe_stats
  FROM secure_access_tokens sat
  LEFT JOIN role_hierarchy rh ON rh.child_user_id = sat.created_by 
    AND rh.is_active = true 
    AND (rh.end_date IS NULL OR rh.end_date >= CURRENT_DATE)
  WHERE sat.resource_type = p_resource_type
    AND sat.created_at >= v_period_start;

  -- Get team breakdowns (using subquery to avoid nested aggregates)
  SELECT jsonb_agg(
    jsonb_build_object(
      'leadOrganiserId', lead_organiser_id,
      'leadOrganiserName', lead_organiser_name,
      'generated', generated_count,
      'submitted', submitted_count,
      'submissionRate', submission_rate,
      'organiserCount', organiser_count
    ) ORDER BY generated_count DESC
  )
  INTO v_teams
  FROM (
    SELECT 
      rh.parent_user_id AS lead_organiser_id,
      p.full_name AS lead_organiser_name,
      COUNT(*) AS generated_count,
      COUNT(*) FILTER (WHERE sat.submitted_at IS NOT NULL) AS submitted_count,
      CASE 
        WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE sat.submitted_at IS NOT NULL)::numeric / COUNT(*)::numeric * 100), 2)
        ELSE 0
      END AS submission_rate,
      COUNT(DISTINCT sat.created_by) AS organiser_count
    FROM secure_access_tokens sat
    INNER JOIN role_hierarchy rh ON rh.child_user_id = sat.created_by
    INNER JOIN profiles p ON p.id = rh.parent_user_id
    WHERE sat.resource_type = p_resource_type
      AND sat.created_at >= v_period_start
      AND rh.is_active = true
      AND (rh.end_date IS NULL OR rh.end_date >= CURRENT_DATE)
    GROUP BY rh.parent_user_id, p.full_name
  ) subq;

  -- Get organiser breakdowns (using subquery to avoid nested aggregates)
  SELECT jsonb_agg(
    jsonb_build_object(
      'organiserId', organiser_id,
      'organiserName', organiser_name,
      'generated', generated_count,
      'submitted', submitted_count,
      'submissionRate', submission_rate,
      'teamLeadId', team_lead_id,
      'teamLeadName', team_lead_name
    ) ORDER BY generated_count DESC
  )
  INTO v_organisers
  FROM (
    SELECT 
      sat.created_by AS organiser_id,
      p.full_name AS organiser_name,
      COUNT(*) AS generated_count,
      COUNT(*) FILTER (WHERE sat.submitted_at IS NOT NULL) AS submitted_count,
      CASE 
        WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE sat.submitted_at IS NOT NULL)::numeric / COUNT(*)::numeric * 100), 2)
        ELSE 0
      END AS submission_rate,
      rh.parent_user_id AS team_lead_id,
      lead_p.full_name AS team_lead_name
    FROM secure_access_tokens sat
    INNER JOIN profiles p ON p.id = sat.created_by
    LEFT JOIN role_hierarchy rh ON rh.child_user_id = sat.created_by 
      AND rh.is_active = true 
      AND (rh.end_date IS NULL OR rh.end_date >= CURRENT_DATE)
    LEFT JOIN profiles lead_p ON lead_p.id = rh.parent_user_id
    WHERE sat.resource_type = p_resource_type
      AND sat.created_at >= v_period_start
    GROUP BY sat.created_by, p.full_name, rh.parent_user_id, lead_p.full_name
  ) subq;

  RETURN jsonb_build_object(
    'universe', COALESCE(v_universe_stats, jsonb_build_object('generated', 0, 'submitted', 0, 'submissionRate', 0, 'uniqueOrganisers', 0, 'uniqueTeams', 0)),
    'teams', COALESCE(v_teams, '[]'::jsonb),
    'organisers', COALESCE(v_organisers, '[]'::jsonb)
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_delegated_tasks_team(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_delegated_tasks_universe(text, text) TO authenticated;

