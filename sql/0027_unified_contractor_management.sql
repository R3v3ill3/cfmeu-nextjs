-- Unified contractor management functions and improvements
-- This migration adds functions to maintain consistency between project and site contractor assignments

-- 1. Function to sync employer assignments between site_contractor_trades and project_employer_roles
CREATE OR REPLACE FUNCTION public.sync_employer_project_site_assignments()
RETURNS TABLE (
  synced_count integer,
  error_count integer,
  details text
) 
LANGUAGE plpgsql
AS $$
DECLARE
  sync_count integer := 0;
  err_count integer := 0;
  detail_msg text := '';
BEGIN
  -- Ensure all employers in site_contractor_trades are also in project_employer_roles
  INSERT INTO public.project_employer_roles (project_id, employer_id, role, start_date)
  SELECT DISTINCT 
    js.project_id,
    sct.employer_id,
    'contractor' as role,
    CURRENT_DATE as start_date
  FROM public.site_contractor_trades sct
  JOIN public.job_sites js ON js.id = sct.job_site_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.project_employer_roles per
    WHERE per.project_id = js.project_id 
    AND per.employer_id = sct.employer_id
  )
  ON CONFLICT (project_id, employer_id, role) DO NOTHING;
  
  GET DIAGNOSTICS sync_count = ROW_COUNT;
  
  detail_msg := format('Synced %s employer assignments from sites to projects', sync_count);
  
  RETURN QUERY SELECT sync_count, err_count, detail_msg;
END;
$$;

-- 2. Function to consolidate duplicate contractor assignments
CREATE OR REPLACE FUNCTION public.consolidate_duplicate_assignments()
RETURNS TABLE (
  duplicates_removed integer,
  assignments_merged integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  dupe_count integer := 0;
  merge_count integer := 0;
BEGIN
  -- Remove exact duplicates in site_contractor_trades (keeping the first one)
  DELETE FROM public.site_contractor_trades sct1
  WHERE EXISTS (
    SELECT 1 FROM public.site_contractor_trades sct2
    WHERE sct2.job_site_id = sct1.job_site_id
    AND sct2.employer_id = sct1.employer_id
    AND sct2.trade_type = sct1.trade_type
    AND sct2.id < sct1.id  -- Keep the older record
  );
  
  GET DIAGNOSTICS dupe_count = ROW_COUNT;
  
  -- Merge project_contractor_trades with same employer/project/trade but different stages
  -- This is more complex - for now, we'll just identify them
  -- TODO: Implement intelligent merging logic based on business rules
  
  RETURN QUERY SELECT dupe_count, merge_count;
END;
$$;

-- 3. Function to validate contractor assignments
CREATE OR REPLACE FUNCTION public.validate_contractor_assignments()
RETURNS TABLE (
  validation_type text,
  issue_count integer,
  details text
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check for site contractors not in project roles
  RETURN QUERY
  SELECT 
    'missing_project_role' as validation_type,
    COUNT(*)::integer as issue_count,
    'Site contractors without project role assignments' as details
  FROM public.site_contractor_trades sct
  JOIN public.job_sites js ON js.id = sct.job_site_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.project_employer_roles per
    WHERE per.project_id = js.project_id 
    AND per.employer_id = sct.employer_id
  );
  
  -- Check for orphaned project contractor trades (employer doesn't exist)
  RETURN QUERY
  SELECT 
    'orphaned_project_trades' as validation_type,
    COUNT(*)::integer as issue_count,
    'Project contractor trades with non-existent employers' as details
  FROM public.project_contractor_trades pct
  WHERE NOT EXISTS (
    SELECT 1 FROM public.employers e
    WHERE e.id = pct.employer_id
  );
  
  -- Check for orphaned site contractor trades
  RETURN QUERY
  SELECT 
    'orphaned_site_trades' as validation_type,
    COUNT(*)::integer as issue_count,
    'Site contractor trades with non-existent employers or sites' as details
  FROM public.site_contractor_trades sct
  WHERE NOT EXISTS (
    SELECT 1 FROM public.employers e
    WHERE e.id = sct.employer_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.job_sites js
    WHERE js.id = sct.job_site_id
  );
END;
$$;

-- 4. Enhanced function to assign contractor to both project and site
CREATE OR REPLACE FUNCTION public.assign_contractor_unified(
  p_project_id uuid,
  p_job_site_id uuid,
  p_employer_id uuid,
  p_trade_type text,
  p_estimated_workforce integer DEFAULT NULL,
  p_eba_signatory text DEFAULT 'not_specified',
  p_stage text DEFAULT 'structure'
)
RETURNS TABLE (
  success boolean,
  project_role_id uuid,
  site_trade_id uuid,
  project_trade_id uuid,
  message text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_project_role_id uuid;
  v_site_trade_id uuid;
  v_project_trade_id uuid;
  v_message text := 'Successfully assigned contractor';
BEGIN
  -- Validate inputs
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id) THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::uuid, 'Project not found';
    RETURN;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.job_sites WHERE id = p_job_site_id AND project_id = p_project_id) THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::uuid, 'Job site not found or not part of project';
    RETURN;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.employers WHERE id = p_employer_id) THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::uuid, 'Employer not found';
    RETURN;
  END IF;
  
  -- 1. Assign to project_employer_roles (if not already assigned)
  INSERT INTO public.project_employer_roles (project_id, employer_id, role, start_date)
  VALUES (p_project_id, p_employer_id, 'contractor', CURRENT_DATE)
  ON CONFLICT (project_id, employer_id, role) DO NOTHING
  RETURNING id INTO v_project_role_id;
  
  -- If no ID returned, get the existing one
  IF v_project_role_id IS NULL THEN
    SELECT id INTO v_project_role_id 
    FROM public.project_employer_roles 
    WHERE project_id = p_project_id AND employer_id = p_employer_id AND role = 'contractor';
  END IF;
  
  -- 2. Assign to site_contractor_trades
  INSERT INTO public.site_contractor_trades (job_site_id, employer_id, trade_type, eba_signatory)
  VALUES (p_job_site_id, p_employer_id, p_trade_type::public.trade_type, p_eba_signatory::public.eba_signatory_status)
  ON CONFLICT (job_site_id, employer_id, trade_type) DO UPDATE SET
    eba_signatory = EXCLUDED.eba_signatory,
    updated_at = NOW()
  RETURNING id INTO v_site_trade_id;
  
  -- 3. Assign to project_contractor_trades (if estimated workforce provided)
  IF p_estimated_workforce IS NOT NULL AND p_estimated_workforce > 0 THEN
    INSERT INTO public.project_contractor_trades (
      project_id, employer_id, trade_type, stage, estimated_project_workforce, eba_signatory
    )
    VALUES (
      p_project_id, p_employer_id, p_trade_type::public.trade_type, 
      p_stage::public.trade_stage, p_estimated_workforce, p_eba_signatory::public.eba_signatory_status
    )
    ON CONFLICT (project_id, employer_id, trade_type, stage) DO UPDATE SET
      estimated_project_workforce = EXCLUDED.estimated_project_workforce,
      eba_signatory = EXCLUDED.eba_signatory,
      updated_at = NOW()
    RETURNING id INTO v_project_trade_id;
    
    v_message := format('Successfully assigned contractor with %s estimated workers', p_estimated_workforce);
  END IF;
  
  RETURN QUERY SELECT true, v_project_role_id, v_site_trade_id, v_project_trade_id, v_message;
END;
$$;

-- 5. Function to get unified contractor view for a project
CREATE OR REPLACE FUNCTION public.get_unified_contractors(p_project_id uuid)
RETURNS TABLE (
  employer_id uuid,
  employer_name text,
  assignments jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH contractor_assignments AS (
    -- Project roles
    SELECT 
      per.employer_id,
      e.name as employer_name,
      jsonb_build_object(
        'type', 'project_role',
        'role', per.role,
        'start_date', per.start_date,
        'end_date', per.end_date
      ) as assignment
    FROM public.project_employer_roles per
    JOIN public.employers e ON e.id = per.employer_id
    WHERE per.project_id = p_project_id
    
    UNION ALL
    
    -- Site trades
    SELECT 
      sct.employer_id,
      e.name as employer_name,
      jsonb_build_object(
        'type', 'site_trade',
        'trade_type', sct.trade_type,
        'site_id', sct.job_site_id,
        'site_name', js.name,
        'eba_signatory', sct.eba_signatory
      ) as assignment
    FROM public.site_contractor_trades sct
    JOIN public.job_sites js ON js.id = sct.job_site_id
    JOIN public.employers e ON e.id = sct.employer_id
    WHERE js.project_id = p_project_id
    
    UNION ALL
    
    -- Project trades
    SELECT 
      pct.employer_id,
      e.name as employer_name,
      jsonb_build_object(
        'type', 'project_trade',
        'trade_type', pct.trade_type,
        'stage', pct.stage,
        'estimated_workforce', pct.estimated_project_workforce,
        'eba_signatory', pct.eba_signatory
      ) as assignment
    FROM public.project_contractor_trades pct
    JOIN public.employers e ON e.id = pct.employer_id
    WHERE pct.project_id = p_project_id
  )
  SELECT 
    ca.employer_id,
    ca.employer_name,
    jsonb_agg(ca.assignment ORDER BY ca.assignment->>'type') as assignments
  FROM contractor_assignments ca
  GROUP BY ca.employer_id, ca.employer_name
  ORDER BY ca.employer_name;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.sync_employer_project_site_assignments() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consolidate_duplicate_assignments() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_contractor_assignments() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_contractor_unified(uuid, uuid, uuid, text, integer, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_unified_contractors(uuid) TO authenticated, service_role;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_site_contractor_trades_composite 
  ON public.site_contractor_trades(job_site_id, employer_id, trade_type);

CREATE INDEX IF NOT EXISTS idx_project_contractor_trades_composite 
  ON public.project_contractor_trades(project_id, employer_id, trade_type, stage);

CREATE INDEX IF NOT EXISTS idx_project_employer_roles_composite 
  ON public.project_employer_roles(project_id, employer_id, role);

-- Add helpful comments
COMMENT ON FUNCTION public.assign_contractor_unified IS 'Unified function to assign a contractor to both project and site with proper data consistency';
COMMENT ON FUNCTION public.get_unified_contractors IS 'Returns all contractor assignments for a project in a unified format';
