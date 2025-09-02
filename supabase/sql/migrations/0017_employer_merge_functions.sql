-- Functions for safe employer merging and duplicate management

-- Helper function to get employer merge impact analysis
CREATE OR REPLACE FUNCTION get_employer_merge_impact(
  p_employer_ids UUID[]
)
RETURNS TABLE (
  employer_id UUID,
  employer_name TEXT,
  worker_placements_count INTEGER,
  project_roles_count INTEGER,
  project_trades_count INTEGER,
  site_trades_count INTEGER,
  eba_records_count INTEGER,
  site_visits_count INTEGER,
  trade_capabilities_count INTEGER,
  aliases_count INTEGER,
  builder_projects_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id as employer_id,
    e.name as employer_name,
    COALESCE(wp.count, 0)::INTEGER as worker_placements_count,
    COALESCE(per.count, 0)::INTEGER as project_roles_count,
    COALESCE(pct.count, 0)::INTEGER as project_trades_count,
    COALESCE(sct.count, 0)::INTEGER as site_trades_count,
    COALESCE(eba.count, 0)::INTEGER as eba_records_count,
    COALESCE(sv.count, 0)::INTEGER as site_visits_count,
    COALESCE(tc.count, 0)::INTEGER as trade_capabilities_count,
    COALESCE(ea.count, 0)::INTEGER as aliases_count,
    COALESCE(bp.count, 0)::INTEGER as builder_projects_count
  FROM employers e
  LEFT JOIN (
    SELECT employer_id, COUNT(*) as count 
    FROM worker_placements 
    WHERE employer_id = ANY(p_employer_ids)
    GROUP BY employer_id
  ) wp ON e.id = wp.employer_id
  LEFT JOIN (
    SELECT employer_id, COUNT(*) as count 
    FROM project_employer_roles 
    WHERE employer_id = ANY(p_employer_ids)
    GROUP BY employer_id
  ) per ON e.id = per.employer_id
  LEFT JOIN (
    SELECT employer_id, COUNT(*) as count 
    FROM project_contractor_trades 
    WHERE employer_id = ANY(p_employer_ids)
    GROUP BY employer_id
  ) pct ON e.id = pct.employer_id
  LEFT JOIN (
    SELECT employer_id, COUNT(*) as count 
    FROM site_contractor_trades 
    WHERE employer_id = ANY(p_employer_ids)
    GROUP BY employer_id
  ) sct ON e.id = sct.employer_id
  LEFT JOIN (
    SELECT employer_id, COUNT(*) as count 
    FROM company_eba_records 
    WHERE employer_id = ANY(p_employer_ids)
    GROUP BY employer_id
  ) eba ON e.id = eba.employer_id
  LEFT JOIN (
    SELECT employer_id, COUNT(*) as count 
    FROM site_visit 
    WHERE employer_id = ANY(p_employer_ids)
    GROUP BY employer_id
  ) sv ON e.id = sv.employer_id
  LEFT JOIN (
    SELECT employer_id, COUNT(*) as count 
    FROM contractor_trade_capabilities 
    WHERE employer_id = ANY(p_employer_ids)
    GROUP BY employer_id
  ) tc ON e.id = tc.employer_id
  LEFT JOIN (
    SELECT employer_id, COUNT(*) as count 
    FROM employer_aliases 
    WHERE employer_id = ANY(p_employer_ids)
    GROUP BY employer_id
  ) ea ON e.id = ea.employer_id
  LEFT JOIN (
    SELECT builder_id as employer_id, COUNT(*) as count 
    FROM projects 
    WHERE builder_id = ANY(p_employer_ids)
    GROUP BY builder_id
  ) bp ON e.id = bp.employer_id
  WHERE e.id = ANY(p_employer_ids)
  ORDER BY e.name;
END;
$$ LANGUAGE plpgsql;

-- Function to safely merge employers
CREATE OR REPLACE FUNCTION merge_employers(
  p_primary_employer_id UUID,
  p_duplicate_employer_ids UUID[]
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_relationships_moved INTEGER := 0;
  v_records_updated INTEGER := 0;
  v_errors TEXT[] := '{}';
  v_employer_name TEXT;
  v_duplicate_names TEXT[];
BEGIN
  -- Get employer names for logging
  SELECT name INTO v_employer_name FROM employers WHERE id = p_primary_employer_id;
  SELECT ARRAY_AGG(name) INTO v_duplicate_names FROM employers WHERE id = ANY(p_duplicate_employer_ids);
  
  -- Log the merge operation
  RAISE NOTICE 'Starting merge: Primary % (%), Duplicates: %', p_primary_employer_id, v_employer_name, v_duplicate_names;
  
  -- 1. Update worker_placements
  BEGIN
    UPDATE worker_placements 
    SET employer_id = p_primary_employer_id 
    WHERE employer_id = ANY(p_duplicate_employer_ids);
    
    GET DIAGNOSTICS v_relationships_moved = ROW_COUNT;
    RAISE NOTICE 'Updated % worker placements', v_relationships_moved;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || ('Worker placements: ' || SQLERRM);
  END;
  
  -- 2. Update project_employer_roles (handle duplicates)
  BEGIN
    -- First, delete any roles that would create duplicates
    DELETE FROM project_employer_roles 
    WHERE employer_id = ANY(p_duplicate_employer_ids)
    AND (project_id, role) IN (
      SELECT project_id, role 
      FROM project_employer_roles 
      WHERE employer_id = p_primary_employer_id
    );
    
    -- Then update remaining roles
    UPDATE project_employer_roles 
    SET employer_id = p_primary_employer_id 
    WHERE employer_id = ANY(p_duplicate_employer_ids);
    
    GET DIAGNOSTICS v_relationships_moved = ROW_COUNT;
    RAISE NOTICE 'Updated % project employer roles', v_relationships_moved;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || ('Project roles: ' || SQLERRM);
  END;
  
  -- 3. Update project_contractor_trades (handle duplicates)
  BEGIN
    -- Delete trades that would create duplicates
    DELETE FROM project_contractor_trades 
    WHERE employer_id = ANY(p_duplicate_employer_ids)
    AND (project_id, trade_type) IN (
      SELECT project_id, trade_type 
      FROM project_contractor_trades 
      WHERE employer_id = p_primary_employer_id
    );
    
    -- Update remaining trades
    UPDATE project_contractor_trades 
    SET employer_id = p_primary_employer_id 
    WHERE employer_id = ANY(p_duplicate_employer_ids);
    
    GET DIAGNOSTICS v_relationships_moved = ROW_COUNT;
    RAISE NOTICE 'Updated % project contractor trades', v_relationships_moved;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || ('Project trades: ' || SQLERRM);
  END;
  
  -- 4. Update site_contractor_trades (handle duplicates)
  BEGIN
    DELETE FROM site_contractor_trades 
    WHERE employer_id = ANY(p_duplicate_employer_ids)
    AND (job_site_id, trade_type) IN (
      SELECT job_site_id, trade_type 
      FROM site_contractor_trades 
      WHERE employer_id = p_primary_employer_id
    );
    
    UPDATE site_contractor_trades 
    SET employer_id = p_primary_employer_id 
    WHERE employer_id = ANY(p_duplicate_employer_ids);
    
    GET DIAGNOSTICS v_relationships_moved = ROW_COUNT;
    RAISE NOTICE 'Updated % site contractor trades', v_relationships_moved;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || ('Site trades: ' || SQLERRM);
  END;
  
  -- 5. Update company_eba_records
  BEGIN
    UPDATE company_eba_records 
    SET employer_id = p_primary_employer_id 
    WHERE employer_id = ANY(p_duplicate_employer_ids);
    
    GET DIAGNOSTICS v_relationships_moved = ROW_COUNT;
    RAISE NOTICE 'Updated % EBA records', v_relationships_moved;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || ('EBA records: ' || SQLERRM);
  END;
  
  -- 6. Update site_visit
  BEGIN
    UPDATE site_visit 
    SET employer_id = p_primary_employer_id 
    WHERE employer_id = ANY(p_duplicate_employer_ids);
    
    GET DIAGNOSTICS v_relationships_moved = ROW_COUNT;
    RAISE NOTICE 'Updated % site visits', v_relationships_moved;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || ('Site visits: ' || SQLERRM);
  END;
  
  -- 7. Handle contractor_trade_capabilities (merge unique trades)
  BEGIN
    -- Insert unique trade capabilities from duplicates
    INSERT INTO contractor_trade_capabilities (employer_id, trade_type, is_primary, notes)
    SELECT 
      p_primary_employer_id,
      tc.trade_type,
      tc.is_primary,
      COALESCE(tc.notes, '') || ' (merged from duplicate employer)' as notes
    FROM contractor_trade_capabilities tc
    WHERE tc.employer_id = ANY(p_duplicate_employer_ids)
    AND NOT EXISTS (
      SELECT 1 FROM contractor_trade_capabilities existing
      WHERE existing.employer_id = p_primary_employer_id
      AND existing.trade_type = tc.trade_type
    );
    
    GET DIAGNOSTICS v_records_updated = ROW_COUNT;
    RAISE NOTICE 'Added % unique trade capabilities', v_records_updated;
    
    -- Delete duplicate trade capabilities
    DELETE FROM contractor_trade_capabilities 
    WHERE employer_id = ANY(p_duplicate_employer_ids);
    
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || ('Trade capabilities: ' || SQLERRM);
  END;
  
  -- 8. Update employer_aliases
  BEGIN
    UPDATE employer_aliases 
    SET employer_id = p_primary_employer_id 
    WHERE employer_id = ANY(p_duplicate_employer_ids);
    
    GET DIAGNOSTICS v_relationships_moved = ROW_COUNT;
    RAISE NOTICE 'Updated % employer aliases', v_relationships_moved;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || ('Aliases: ' || SQLERRM);
  END;
  
  -- 9. Update projects.builder_id
  BEGIN
    UPDATE projects 
    SET builder_id = p_primary_employer_id 
    WHERE builder_id = ANY(p_duplicate_employer_ids);
    
    GET DIAGNOSTICS v_relationships_moved = ROW_COUNT;
    RAISE NOTICE 'Updated % project builder references', v_relationships_moved;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || ('Project builders: ' || SQLERRM);
  END;
  
  -- 10. Create aliases for merged employer names
  BEGIN
    INSERT INTO employer_aliases (alias, alias_normalized, employer_id)
    SELECT 
      e.name as alias,
      LOWER(REGEXP_REPLACE(e.name, '[^a-zA-Z0-9\s]', '', 'g')) as alias_normalized,
      p_primary_employer_id
    FROM employers e
    WHERE e.id = ANY(p_duplicate_employer_ids)
    ON CONFLICT (alias_normalized) DO NOTHING;
    
    GET DIAGNOSTICS v_records_updated = ROW_COUNT;
    RAISE NOTICE 'Created % new aliases', v_records_updated;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || ('New aliases: ' || SQLERRM);
  END;
  
  -- 11. Finally, delete the duplicate employer records
  BEGIN
    DELETE FROM employers 
    WHERE id = ANY(p_duplicate_employer_ids);
    
    GET DIAGNOSTICS v_records_updated = ROW_COUNT;
    RAISE NOTICE 'Deleted % duplicate employer records', v_records_updated;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || ('Delete duplicates: ' || SQLERRM);
  END;
  
  -- Return merge results
  SELECT json_build_object(
    'success', CASE WHEN array_length(v_errors, 1) IS NULL THEN true ELSE false END,
    'primary_employer_id', p_primary_employer_id,
    'merged_employer_ids', p_duplicate_employer_ids,
    'relationships_moved', v_relationships_moved,
    'records_updated', v_records_updated,
    'errors', v_errors
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_employer_merge_impact(UUID[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION merge_employers(UUID, UUID[]) TO authenticated, service_role;

-- Add comments for documentation
COMMENT ON FUNCTION get_employer_merge_impact(UUID[]) IS 'Analyzes the impact of merging specified employers, showing relationship counts';
COMMENT ON FUNCTION merge_employers(UUID, UUID[]) IS 'Safely merges duplicate employers by moving all relationships to primary employer and deleting duplicates';
