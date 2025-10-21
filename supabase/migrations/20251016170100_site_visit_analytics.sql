-- Site Visit Analytics Views
-- Provides aggregated reporting data for last visit dates and visit frequency

-- =============================================
-- 1. View for project last visit dates
-- =============================================

CREATE OR REPLACE VIEW public.v_project_last_visit AS
SELECT
  p.id AS project_id,
  MAX(sv.date) AS last_visit_date,
  COUNT(sv.id) AS total_visits,
  COUNT(DISTINCT sv.organiser_id) AS unique_organisers
FROM public.projects p
LEFT JOIN public.job_sites js ON js.project_id = p.id
LEFT JOIN public.site_visit sv ON sv.job_site_id = js.id 
  AND sv.visit_status = 'completed'
GROUP BY p.id;

COMMENT ON VIEW public.v_project_last_visit IS 'Aggregated site visit data per project for last visit tracking';

-- =============================================
-- 2. View for project visit frequency
-- =============================================

CREATE OR REPLACE VIEW public.v_project_visit_frequency AS
SELECT
  p.id AS project_id,
  COUNT(CASE WHEN sv.date >= CURRENT_DATE - INTERVAL '3 months' AND sv.visit_status = 'completed' 
    THEN 1 END) AS visits_last_3_months,
  COUNT(CASE WHEN sv.date >= CURRENT_DATE - INTERVAL '6 months' AND sv.visit_status = 'completed' 
    THEN 1 END) AS visits_last_6_months,
  COUNT(CASE WHEN sv.date >= CURRENT_DATE - INTERVAL '12 months' AND sv.visit_status = 'completed' 
    THEN 1 END) AS visits_last_12_months,
  COUNT(CASE WHEN sv.visit_status = 'completed' THEN 1 END) AS total_completed_visits,
  COUNT(CASE WHEN sv.visit_status = 'draft' THEN 1 END) AS draft_visits,
  MAX(CASE WHEN sv.visit_status = 'completed' THEN sv.date END) AS last_completed_visit_date
FROM public.projects p
LEFT JOIN public.job_sites js ON js.project_id = p.id
LEFT JOIN public.site_visit sv ON sv.job_site_id = js.id
GROUP BY p.id;

COMMENT ON VIEW public.v_project_visit_frequency IS 'Visit frequency counts by time period for project reporting';

-- =============================================
-- 3. View for employer visit history
-- =============================================

CREATE OR REPLACE VIEW public.v_employer_last_visit AS
SELECT
  e.id AS employer_id,
  MAX(sv.date) AS last_visit_date,
  COUNT(sv.id) AS total_visits,
  COUNT(CASE WHEN sv.date >= CURRENT_DATE - INTERVAL '3 months' AND sv.visit_status = 'completed' 
    THEN 1 END) AS visits_last_3_months,
  COUNT(CASE WHEN sv.date >= CURRENT_DATE - INTERVAL '6 months' AND sv.visit_status = 'completed' 
    THEN 1 END) AS visits_last_6_months,
  COUNT(CASE WHEN sv.date >= CURRENT_DATE - INTERVAL '12 months' AND sv.visit_status = 'completed' 
    THEN 1 END) AS visits_last_12_months
FROM public.employers e
LEFT JOIN public.site_visit sv ON sv.employer_id = e.id AND sv.visit_status = 'completed'
GROUP BY e.id;

COMMENT ON VIEW public.v_employer_last_visit IS 'Visit tracking for employers across all their projects';

-- =============================================
-- 4. View for job site visit history
-- =============================================

CREATE OR REPLACE VIEW public.v_job_site_last_visit AS
SELECT
  js.id AS job_site_id,
  js.project_id,
  MAX(sv.date) AS last_visit_date,
  COUNT(sv.id) AS total_visits,
  COUNT(CASE WHEN sv.date >= CURRENT_DATE - INTERVAL '3 months' AND sv.visit_status = 'completed' 
    THEN 1 END) AS visits_last_3_months,
  COUNT(CASE WHEN sv.date >= CURRENT_DATE - INTERVAL '6 months' AND sv.visit_status = 'completed' 
    THEN 1 END) AS visits_last_6_months,
  COUNT(CASE WHEN sv.date >= CURRENT_DATE - INTERVAL '12 months' AND sv.visit_status = 'completed' 
    THEN 1 END) AS visits_last_12_months
FROM public.job_sites js
LEFT JOIN public.site_visit sv ON sv.job_site_id = js.id AND sv.visit_status = 'completed'
GROUP BY js.id, js.project_id;

COMMENT ON VIEW public.v_job_site_last_visit IS 'Visit tracking for individual job sites';

-- =============================================
-- 5. View for patch visit coverage
-- =============================================

CREATE OR REPLACE VIEW public.v_patch_visit_coverage AS
SELECT
  patch.id AS patch_id,
  patch.name AS patch_name,
  COUNT(DISTINCT p.id) AS total_projects,
  COUNT(DISTINCT CASE WHEN plv.last_visit_date >= CURRENT_DATE - INTERVAL '3 months' 
    THEN p.id END) AS projects_visited_3m,
  COUNT(DISTINCT CASE WHEN plv.last_visit_date >= CURRENT_DATE - INTERVAL '6 months' 
    THEN p.id END) AS projects_visited_6m,
  COUNT(DISTINCT CASE WHEN plv.last_visit_date >= CURRENT_DATE - INTERVAL '12 months' 
    THEN p.id END) AS projects_visited_12m,
  COUNT(DISTINCT CASE WHEN plv.last_visit_date IS NULL 
    THEN p.id END) AS projects_never_visited,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN plv.last_visit_date >= CURRENT_DATE - INTERVAL '3 months' 
    THEN p.id END) / NULLIF(COUNT(DISTINCT p.id), 0), 1) AS pct_visited_3m,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN plv.last_visit_date >= CURRENT_DATE - INTERVAL '6 months' 
    THEN p.id END) / NULLIF(COUNT(DISTINCT p.id), 0), 1) AS pct_visited_6m,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN plv.last_visit_date >= CURRENT_DATE - INTERVAL '12 months' 
    THEN p.id END) / NULLIF(COUNT(DISTINCT p.id), 0), 1) AS pct_visited_12m
FROM public.patches patch
INNER JOIN public.v_patch_sites_current psc ON psc.patch_id = patch.id
INNER JOIN public.job_sites js ON js.id = psc.job_site_id
INNER JOIN public.projects p ON p.id = js.project_id
LEFT JOIN public.v_project_last_visit plv ON plv.project_id = p.id
GROUP BY patch.id, patch.name;

COMMENT ON VIEW public.v_patch_visit_coverage IS 'Visit coverage statistics per patch for dashboard reporting';

-- =============================================
-- 6. View for lead organiser visit summary
-- =============================================

CREATE OR REPLACE VIEW public.v_lead_organiser_visit_summary AS
SELECT
  lead_profile.id AS lead_organiser_id,
  lead_profile.full_name AS lead_organiser_name,
  COUNT(DISTINCT p.id) AS total_projects_in_scope,
  COUNT(DISTINCT CASE WHEN plv.last_visit_date >= CURRENT_DATE - INTERVAL '3 months' 
    THEN p.id END) AS projects_visited_3m,
  COUNT(DISTINCT CASE WHEN plv.last_visit_date >= CURRENT_DATE - INTERVAL '6 months' 
    THEN p.id END) AS projects_visited_6m,
  COUNT(DISTINCT CASE WHEN plv.last_visit_date >= CURRENT_DATE - INTERVAL '12 months' 
    THEN p.id END) AS projects_visited_12m,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN plv.last_visit_date >= CURRENT_DATE - INTERVAL '3 months' 
    THEN p.id END) / NULLIF(COUNT(DISTINCT p.id), 0), 1) AS pct_visited_3m,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN plv.last_visit_date >= CURRENT_DATE - INTERVAL '6 months' 
    THEN p.id END) / NULLIF(COUNT(DISTINCT p.id), 0), 1) AS pct_visited_6m,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN plv.last_visit_date >= CURRENT_DATE - INTERVAL '12 months' 
    THEN p.id END) / NULLIF(COUNT(DISTINCT p.id), 0), 1) AS pct_visited_12m,
  COUNT(DISTINCT sv.id) FILTER (WHERE sv.date >= CURRENT_DATE - INTERVAL '1 month' 
    AND sv.visit_status = 'completed') AS visits_this_month,
  COUNT(DISTINCT sv.organiser_id) AS team_organisers_count
FROM public.profiles lead_profile
-- Get patches managed by this lead organiser
INNER JOIN public.lead_organiser_patch_assignments lopa 
  ON lopa.lead_organiser_id = lead_profile.id AND lopa.effective_to IS NULL
-- Get job sites in those patches
INNER JOIN public.v_patch_sites_current psc ON psc.patch_id = lopa.patch_id
INNER JOIN public.job_sites js ON js.id = psc.job_site_id
INNER JOIN public.projects p ON p.id = js.project_id
-- Get visit data
LEFT JOIN public.v_project_last_visit plv ON plv.project_id = p.id
LEFT JOIN public.site_visit sv ON sv.job_site_id = js.id
-- Get team organisers (those assigned to patches under this lead)
LEFT JOIN public.v_organiser_patches_current opc ON opc.patch_id = lopa.patch_id
WHERE lead_profile.role = 'lead_organiser'
GROUP BY lead_profile.id, lead_profile.full_name;

COMMENT ON VIEW public.v_lead_organiser_visit_summary IS 'Visit coverage summary for lead organisers across their team';

-- =============================================
-- 7. View for visit reasons summary
-- =============================================

CREATE OR REPLACE VIEW public.v_visit_reasons_summary AS
SELECT
  svrd.id AS reason_id,
  svrd.name AS reason_name,
  svrd.display_name,
  svrd.is_global,
  COUNT(svr.id) AS total_uses,
  COUNT(DISTINCT svr.visit_id) AS visits_with_reason,
  COUNT(DISTINCT sv.project_id) AS projects_with_reason,
  MAX(sv.date) AS last_used_date
FROM public.site_visit_reason_definitions svrd
LEFT JOIN public.site_visit_reasons svr ON svr.reason_definition_id = svrd.id
LEFT JOIN public.site_visit sv ON sv.id = svr.visit_id AND sv.visit_status = 'completed'
WHERE svrd.is_active = true
GROUP BY svrd.id, svrd.name, svrd.display_name, svrd.is_global;

COMMENT ON VIEW public.v_visit_reasons_summary IS 'Usage statistics for visit reasons';

-- =============================================
-- 8. Function to get visit color code
-- =============================================

CREATE OR REPLACE FUNCTION public.get_visit_recency_color(last_visit_date timestamptz)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF last_visit_date IS NULL THEN
    RETURN 'grey'; -- never visited
  ELSIF last_visit_date < CURRENT_DATE - INTERVAL '12 months' THEN
    RETURN 'red'; -- > 12 months
  ELSIF last_visit_date < CURRENT_DATE - INTERVAL '6 months' THEN
    RETURN 'orange'; -- 6-12 months
  ELSIF last_visit_date < CURRENT_DATE - INTERVAL '3 months' THEN
    RETURN 'light-green'; -- 3-6 months
  ELSE
    RETURN 'bright-green'; -- < 3 months
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_visit_recency_color(timestamptz) IS 'Returns color code for visit recency badge';

-- =============================================
-- 9. Performance indexes for analytics views
-- =============================================

-- These indexes support the view queries for better performance
CREATE INDEX IF NOT EXISTS idx_site_visit_date_status 
  ON public.site_visit(date DESC, visit_status) 
  WHERE visit_status = 'completed';

CREATE INDEX IF NOT EXISTS idx_site_visit_project_date 
  ON public.site_visit(project_id, date DESC) 
  WHERE visit_status = 'completed';

CREATE INDEX IF NOT EXISTS idx_site_visit_employer_date 
  ON public.site_visit(employer_id, date DESC) 
  WHERE visit_status = 'completed';

CREATE INDEX IF NOT EXISTS idx_job_sites_project 
  ON public.job_sites(project_id);

