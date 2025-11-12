-- Migration: Enhance Delegated Tasks Tracking
-- Adds comprehensive tracking and analytics for delegated tasks (webforms)
-- Supports three-level drill-down: Summary → Links → Content

-- ==========================================
-- 1. Enhance secure_access_tokens Table
-- ==========================================

-- Add tracking fields
ALTER TABLE secure_access_tokens 
ADD COLUMN IF NOT EXISTS submitted_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS submission_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS viewed_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS submission_data jsonb NULL;

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_secure_access_tokens_created_by_created_at 
  ON secure_access_tokens(created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_secure_access_tokens_resource_type_created_at 
  ON secure_access_tokens(resource_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_secure_access_tokens_submitted_at 
  ON secure_access_tokens(submitted_at) WHERE submitted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_secure_access_tokens_resource_id_type 
  ON secure_access_tokens(resource_id, resource_type);

-- Add comments
COMMENT ON COLUMN secure_access_tokens.submitted_at IS 'When the form was successfully submitted (separate from used_at for granular tracking)';
COMMENT ON COLUMN secure_access_tokens.submission_count IS 'Number of times form was submitted (for multi-submission support)';
COMMENT ON COLUMN secure_access_tokens.viewed_at IS 'First time token was accessed/viewed';
COMMENT ON COLUMN secure_access_tokens.view_count IS 'Number of times form was viewed';
COMMENT ON COLUMN secure_access_tokens.submission_data IS 'Stores the actual submitted form content for later viewing';

-- ==========================================
-- 2. Create Analytics Views
-- ==========================================

-- View: Organiser-level analytics
CREATE OR REPLACE VIEW delegated_tasks_organiser_view AS
SELECT 
  sat.created_by AS organiser_id,
  p.full_name AS organiser_name,
  sat.resource_type,
  COUNT(*) FILTER (WHERE sat.created_at >= CURRENT_DATE - INTERVAL '7 days') AS generated_week,
  COUNT(*) FILTER (WHERE sat.created_at >= CURRENT_DATE - INTERVAL '30 days') AS generated_month,
  COUNT(*) FILTER (WHERE sat.created_at >= CURRENT_DATE - INTERVAL '90 days') AS generated_3months,
  COUNT(*) FILTER (WHERE sat.submitted_at IS NOT NULL AND sat.created_at >= CURRENT_DATE - INTERVAL '7 days') AS submitted_week,
  COUNT(*) FILTER (WHERE sat.submitted_at IS NOT NULL AND sat.created_at >= CURRENT_DATE - INTERVAL '30 days') AS submitted_month,
  COUNT(*) FILTER (WHERE sat.submitted_at IS NOT NULL AND sat.created_at >= CURRENT_DATE - INTERVAL '90 days') AS submitted_3months
FROM secure_access_tokens sat
LEFT JOIN profiles p ON p.id = sat.created_by
WHERE sat.resource_type IN ('PROJECT_AUDIT_COMPLIANCE', 'PROJECT_MAPPING_SHEET')
GROUP BY sat.created_by, p.full_name, sat.resource_type;

COMMENT ON VIEW delegated_tasks_organiser_view IS 'Aggregates delegated task stats per organiser by time period';

-- View: Team-level analytics (grouped by lead organiser)
CREATE OR REPLACE VIEW delegated_tasks_team_view AS
SELECT 
  rh.parent_user_id AS lead_organiser_id,
  lead_p.full_name AS lead_organiser_name,
  sat.resource_type,
  COUNT(DISTINCT rh.child_user_id) AS team_size,
  COUNT(*) FILTER (WHERE sat.created_at >= CURRENT_DATE - INTERVAL '7 days') AS generated_week,
  COUNT(*) FILTER (WHERE sat.created_at >= CURRENT_DATE - INTERVAL '30 days') AS generated_month,
  COUNT(*) FILTER (WHERE sat.created_at >= CURRENT_DATE - INTERVAL '90 days') AS generated_3months,
  COUNT(*) FILTER (WHERE sat.submitted_at IS NOT NULL AND sat.created_at >= CURRENT_DATE - INTERVAL '7 days') AS submitted_week,
  COUNT(*) FILTER (WHERE sat.submitted_at IS NOT NULL AND sat.created_at >= CURRENT_DATE - INTERVAL '30 days') AS submitted_month,
  COUNT(*) FILTER (WHERE sat.submitted_at IS NOT NULL AND sat.created_at >= CURRENT_DATE - INTERVAL '90 days') AS submitted_3months
FROM secure_access_tokens sat
INNER JOIN role_hierarchy rh ON rh.child_user_id = sat.created_by
INNER JOIN profiles lead_p ON lead_p.id = rh.parent_user_id
WHERE sat.resource_type IN ('PROJECT_AUDIT_COMPLIANCE', 'PROJECT_MAPPING_SHEET')
  AND rh.is_active = true
  AND (rh.end_date IS NULL OR rh.end_date >= CURRENT_DATE)
GROUP BY rh.parent_user_id, lead_p.full_name, sat.resource_type;

COMMENT ON VIEW delegated_tasks_team_view IS 'Aggregates delegated task stats per lead organiser team';

-- View: Universe-level analytics
CREATE OR REPLACE VIEW delegated_tasks_universe_view AS
SELECT 
  sat.resource_type,
  COUNT(*) FILTER (WHERE sat.created_at >= CURRENT_DATE - INTERVAL '7 days') AS generated_week,
  COUNT(*) FILTER (WHERE sat.created_at >= CURRENT_DATE - INTERVAL '30 days') AS generated_month,
  COUNT(*) FILTER (WHERE sat.created_at >= CURRENT_DATE - INTERVAL '90 days') AS generated_3months,
  COUNT(*) FILTER (WHERE sat.submitted_at IS NOT NULL AND sat.created_at >= CURRENT_DATE - INTERVAL '7 days') AS submitted_week,
  COUNT(*) FILTER (WHERE sat.submitted_at IS NOT NULL AND sat.created_at >= CURRENT_DATE - INTERVAL '30 days') AS submitted_month,
  COUNT(*) FILTER (WHERE sat.submitted_at IS NOT NULL AND sat.created_at >= CURRENT_DATE - INTERVAL '90 days') AS submitted_3months,
  COUNT(DISTINCT sat.created_by) FILTER (WHERE sat.created_at >= CURRENT_DATE - INTERVAL '90 days') AS unique_organisers,
  COUNT(DISTINCT rh.parent_user_id) FILTER (WHERE sat.created_at >= CURRENT_DATE - INTERVAL '90 days') AS unique_teams
FROM secure_access_tokens sat
LEFT JOIN role_hierarchy rh ON rh.child_user_id = sat.created_by AND rh.is_active = true
WHERE sat.resource_type IN ('PROJECT_AUDIT_COMPLIANCE', 'PROJECT_MAPPING_SHEET')
GROUP BY sat.resource_type;

COMMENT ON VIEW delegated_tasks_universe_view IS 'Universe-wide delegated task statistics';

-- ==========================================
-- 3. Create RPC Functions for Analytics
-- ==========================================

-- Function: Get organiser analytics
CREATE OR REPLACE FUNCTION get_delegated_tasks_organiser(
  p_user_id uuid,
  p_period text DEFAULT 'month',
  p_resource_type text DEFAULT 'PROJECT_AUDIT_COMPLIANCE'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_start timestamptz;
  v_generated_count integer;
  v_submitted_count integer;
  v_pending_count integer;
  v_submission_rate numeric;
  v_links jsonb;
BEGIN
  -- Calculate period start date
  CASE p_period
    WHEN 'week' THEN v_period_start := CURRENT_DATE - INTERVAL '7 days';
    WHEN 'month' THEN v_period_start := CURRENT_DATE - INTERVAL '30 days';
    WHEN '3months' THEN v_period_start := CURRENT_DATE - INTERVAL '90 days';
    ELSE v_period_start := CURRENT_DATE - INTERVAL '30 days';
  END CASE;

  -- Get counts
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE submitted_at IS NOT NULL),
    COUNT(*) FILTER (WHERE submitted_at IS NULL AND expires_at > now())
  INTO v_generated_count, v_submitted_count, v_pending_count
  FROM secure_access_tokens
  WHERE created_by = p_user_id
    AND resource_type = p_resource_type
    AND created_at >= v_period_start;

  -- Calculate submission rate
  v_submission_rate := CASE 
    WHEN v_generated_count > 0 THEN ROUND((v_submitted_count::numeric / v_generated_count::numeric * 100), 2)
    ELSE 0
  END;

  -- Get links list
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'token', token,
      'projectId', resource_id,
      'projectName', (SELECT name FROM projects WHERE id = resource_id),
      'createdAt', created_at,
      'expiresAt', expires_at,
      'submittedAt', submitted_at,
      'viewedAt', viewed_at,
      'viewCount', view_count,
      'status', CASE
        WHEN submitted_at IS NOT NULL THEN 'submitted'
        WHEN expires_at < now() THEN 'expired'
        ELSE 'pending'
      END
    ) ORDER BY created_at DESC
  )
  INTO v_links
  FROM secure_access_tokens
  WHERE created_by = p_user_id
    AND resource_type = p_resource_type
    AND created_at >= v_period_start;

  RETURN jsonb_build_object(
    'generated', v_generated_count,
    'submitted', v_submitted_count,
    'pending', v_pending_count,
    'submissionRate', v_submission_rate,
    'links', COALESCE(v_links, '[]'::jsonb)
  );
END;
$$;

-- Function: Get team analytics (for lead organisers)
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

  -- Get per-organiser breakdown
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

-- Function: Get universe analytics (for admins and lead organisers)
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

  -- Get team breakdowns
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

  -- Get organiser breakdowns
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

-- Function: Get submission content for a specific token
CREATE OR REPLACE FUNCTION get_delegated_tasks_submission_content(
  p_token text,
  p_requesting_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_record RECORD;
  v_project_name text;
  v_has_permission boolean := false;
  v_result jsonb;
BEGIN
  -- Get token record
  SELECT * INTO v_token_record
  FROM secure_access_tokens
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Token not found', 'status', 404);
  END IF;

  -- Check permissions
  -- User can view if:
  -- 1. They created the token (organiser)
  -- 2. They are the lead organiser of the organiser who created it
  -- 3. They are an admin
  IF v_token_record.created_by = p_requesting_user_id THEN
    v_has_permission := true;
  ELSIF EXISTS (
    SELECT 1 FROM role_hierarchy rh
    WHERE rh.parent_user_id = p_requesting_user_id
      AND rh.child_user_id = v_token_record.created_by
      AND rh.is_active = true
      AND (rh.end_date IS NULL OR rh.end_date >= CURRENT_DATE)
  ) THEN
    v_has_permission := true;
  ELSIF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_requesting_user_id AND role = 'admin'
  ) THEN
    v_has_permission := true;
  END IF;

  IF NOT v_has_permission THEN
    RETURN jsonb_build_object('error', 'Unauthorized', 'status', 403);
  END IF;

  -- Get project name
  SELECT name INTO v_project_name
  FROM projects
  WHERE id = v_token_record.resource_id;

  -- Build result
  v_result := jsonb_build_object(
    'token', p_token,
    'projectId', v_token_record.resource_id,
    'projectName', COALESCE(v_project_name, 'Unknown Project'),
    'resourceType', v_token_record.resource_type,
    'createdAt', v_token_record.created_at,
    'expiresAt', v_token_record.expires_at,
    'submittedAt', v_token_record.submitted_at,
    'submissionData', v_token_record.submission_data,
    'metadata', v_token_record.metadata
  );

  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_delegated_tasks_organiser(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_delegated_tasks_team(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_delegated_tasks_universe(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_delegated_tasks_submission_content(text, uuid) TO authenticated;

-- ==========================================
-- 4. Update RLS Policies
-- ==========================================

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can view their own tokens" ON secure_access_tokens;

-- New policy: Users can view their own tokens
CREATE POLICY "Users can view their own tokens" ON secure_access_tokens
  FOR SELECT USING (auth.uid() = created_by);

-- Policy: Lead organisers can view their team's tokens
CREATE POLICY "Lead organisers can view team tokens" ON secure_access_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM role_hierarchy rh
      WHERE rh.parent_user_id = auth.uid()
        AND rh.child_user_id = secure_access_tokens.created_by
        AND rh.is_active = true
        AND (rh.end_date IS NULL OR rh.end_date >= CURRENT_DATE)
    )
  );

-- Policy: Admins can view all tokens
CREATE POLICY "Admins can view all tokens" ON secure_access_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Keep existing policies for INSERT and UPDATE
-- (These remain unchanged - users can only create/update their own tokens)

