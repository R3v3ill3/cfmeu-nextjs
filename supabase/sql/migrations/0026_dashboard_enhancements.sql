-- Dashboard enhancements: Health & Safety committee and Financial audit activity
-- Adds support for H&S committee goals and roles, plus financial audit activities

-- Add health_safety_committee_goal to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS health_safety_committee_goal integer DEFAULT 0 
CHECK (health_safety_committee_goal >= 0);

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_projects_hs_committee_goal ON projects(health_safety_committee_goal) 
WHERE health_safety_committee_goal > 0;

-- Add health_safety_committee to union_role_type enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'health_safety_committee' AND enumtypid = 'union_role_type'::regtype) THEN
        ALTER TYPE union_role_type ADD VALUE 'health_safety_committee';
    END IF;
END $$;

-- Add financial_standing_list_audit to activity_type enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'financial_standing_list_audit' AND enumtypid = 'activity_type'::regtype) THEN
        ALTER TYPE activity_type ADD VALUE 'financial_standing_list_audit';
    END IF;
END $$;

-- Create a view for dashboard project metrics to optimize queries
CREATE OR REPLACE VIEW dashboard_project_metrics AS
WITH project_workers AS (
  SELECT 
    p.id as project_id,
    COUNT(DISTINCT wp.worker_id) as total_workers,
    COUNT(DISTINCT CASE WHEN w.union_membership_status = 'member' THEN wp.worker_id END) as total_members,
    AVG(CASE WHEN pct.estimated_project_workforce > 0 THEN pct.estimated_project_workforce END) as avg_estimated_workers
  FROM projects p
  LEFT JOIN job_sites js ON js.project_id = p.id
  LEFT JOIN worker_placements wp ON wp.job_site_id = js.id
  LEFT JOIN workers w ON w.id = wp.worker_id
  LEFT JOIN project_contractor_trades pct ON pct.project_id = p.id
  GROUP BY p.id
),
project_delegates AS (
  SELECT 
    p.id as project_id,
    COUNT(DISTINCT CASE WHEN ur.name = 'site_delegate' THEN ur.worker_id END) as site_delegates,
    COUNT(DISTINCT CASE WHEN ur.name = 'company_delegate' THEN ur.worker_id END) as company_delegates,
    COUNT(DISTINCT CASE WHEN ur.name = 'hsr' THEN ur.worker_id END) as hsrs,
    COUNT(DISTINCT CASE WHEN ur.name = 'health_safety_committee' THEN ur.worker_id END) as hs_committee_members
  FROM projects p
  LEFT JOIN job_sites js ON js.project_id = p.id
  LEFT JOIN union_roles ur ON ur.job_site_id = js.id AND ur.end_date IS NULL
  GROUP BY p.id
),
project_employers AS (
  SELECT 
    p.id as project_id,
    COUNT(DISTINCT sct.employer_id) as total_employers,
    COUNT(DISTINCT CASE WHEN cer.id IS NOT NULL THEN sct.employer_id END) as eba_employers,
    -- Core CFMEU trades
    COUNT(DISTINCT CASE WHEN sct.trade_type = 'demolition' THEN sct.employer_id END) as demolition_employers,
    COUNT(DISTINCT CASE WHEN sct.trade_type = 'piling' THEN sct.employer_id END) as piling_employers,
    COUNT(DISTINCT CASE WHEN sct.trade_type IN ('concreting', 'concrete') THEN sct.employer_id END) as concreting_employers,
    COUNT(DISTINCT CASE WHEN sct.trade_type = 'form_work' THEN sct.employer_id END) as formwork_employers,
    COUNT(DISTINCT CASE WHEN sct.trade_type = 'scaffolding' THEN sct.employer_id END) as scaffold_employers,
    COUNT(DISTINCT CASE WHEN sct.trade_type IN ('tower_crane', 'mobile_crane', 'crane_and_rigging') THEN sct.employer_id END) as crane_employers
  FROM projects p
  LEFT JOIN job_sites js ON js.project_id = p.id
  LEFT JOIN site_contractor_trades sct ON sct.job_site_id = js.id
  LEFT JOIN company_eba_records cer ON cer.employer_id = sct.employer_id
  GROUP BY p.id
),
project_builders AS (
  SELECT 
    p.id as project_id,
    COUNT(DISTINCT per.employer_id) as total_builders,
    COUNT(DISTINCT CASE WHEN cer.id IS NOT NULL THEN per.employer_id END) as eba_builders
  FROM projects p
  LEFT JOIN project_employer_roles per ON per.project_id = p.id AND per.role IN ('builder', 'head_contractor')
  LEFT JOIN company_eba_records cer ON cer.employer_id = per.employer_id
  GROUP BY p.id
)
SELECT 
  p.id,
  p.name,
  p.organising_universe,
  p.stage_class,
  p.value,
  p.health_safety_committee_goal,
  
  -- Worker metrics
  COALESCE(pw.total_workers, 0) as total_workers,
  COALESCE(pw.total_members, 0) as total_members,
  COALESCE(pw.avg_estimated_workers, 0) as avg_estimated_workers,
  
  -- Delegate metrics
  COALESCE(pd.site_delegates, 0) as site_delegates,
  COALESCE(pd.company_delegates, 0) as company_delegates,
  COALESCE(pd.hsrs, 0) as hsrs,
  COALESCE(pd.hs_committee_members, 0) as hs_committee_members,
  
  -- H&S committee status
  CASE 
    WHEN p.health_safety_committee_goal > 0 AND COALESCE(pd.hsrs, 0) >= p.health_safety_committee_goal 
    THEN 'full' 
    ELSE 'partial' 
  END as hs_committee_status,
  
  -- Employer metrics
  COALESCE(pe.total_employers, 0) as total_employers,
  COALESCE(pe.eba_employers, 0) as eba_employers,
  CASE 
    WHEN COALESCE(pe.total_employers, 0) > 0 
    THEN ROUND((COALESCE(pe.eba_employers, 0)::numeric / pe.total_employers * 100), 1)
    ELSE 0 
  END as eba_employer_percentage,
  
  -- Builder metrics
  COALESCE(pb.total_builders, 0) as total_builders,
  COALESCE(pb.eba_builders, 0) as eba_builders,
  CASE 
    WHEN COALESCE(pb.total_builders, 0) > 0 
    THEN ROUND((COALESCE(pb.eba_builders, 0)::numeric / pb.total_builders * 100), 1)
    ELSE 0 
  END as eba_builder_percentage,
  
  -- Core CFMEU trades
  COALESCE(pe.demolition_employers, 0) as demolition_employers,
  COALESCE(pe.piling_employers, 0) as piling_employers,
  COALESCE(pe.concreting_employers, 0) as concreting_employers,
  COALESCE(pe.formwork_employers, 0) as formwork_employers,
  COALESCE(pe.scaffold_employers, 0) as scaffold_employers,
  COALESCE(pe.crane_employers, 0) as crane_employers,
  
  -- Boolean flags for filtering
  (COALESCE(pd.site_delegates, 0) > 0) as has_site_delegates,
  (COALESCE(pd.company_delegates, 0) > 0) as has_company_delegates,
  (COALESCE(pd.hsrs, 0) > 0) as has_hsrs,
  (EXISTS(
    SELECT 1 FROM union_roles ur 
    JOIN job_sites js ON js.id = ur.job_site_id 
    WHERE js.project_id = p.id 
    AND ur.name = 'hsr' 
    AND ur.is_senior = true 
    AND ur.end_date IS NULL
  )) as has_hsr_chair_delegate

FROM projects p
LEFT JOIN project_workers pw ON pw.project_id = p.id
LEFT JOIN project_delegates pd ON pd.project_id = p.id
LEFT JOIN project_employers pe ON pe.project_id = p.id
LEFT JOIN project_builders pb ON pb.project_id = p.id;

-- Grant access to the view
GRANT SELECT ON dashboard_project_metrics TO anon, authenticated, service_role;

-- Create indexes for efficient dashboard queries
CREATE INDEX IF NOT EXISTS idx_dashboard_organising_universe_stage 
ON projects(organising_universe, stage_class) 
WHERE organising_universe IS NOT NULL AND stage_class IS NOT NULL;

-- Add comment for documentation
COMMENT ON VIEW dashboard_project_metrics IS 
'Optimized view for dashboard queries containing all project metrics including workers, delegates, employers, EBA coverage, and core CFMEU trades';

COMMENT ON COLUMN projects.health_safety_committee_goal IS 
'Target number of HSRs needed for a "full" Health & Safety committee. When HSR count >= goal, committee status is "full"';
