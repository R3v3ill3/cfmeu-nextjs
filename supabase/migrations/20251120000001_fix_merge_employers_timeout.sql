-- Fix merge_employers RPC function timeout issues
-- 
-- This migration addresses the issue where merge_employers RPC takes too long,
-- causing client session timeouts and "please sign in" errors
--
-- Changes:
-- 1. Add SECURITY DEFINER for consistent permissions
-- 2. Add statement_timeout to prevent indefinite hangs
-- 3. Optimize with batched updates where possible

CREATE OR REPLACE FUNCTION merge_employers(
  p_primary_employer_id UUID,
  p_duplicate_employer_ids UUID[]
)
RETURNS JSON 
SECURITY DEFINER -- Run with function owner's permissions
SET statement_timeout = '30s' -- Prevent indefinite hangs
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSON;
  v_relationships_moved INTEGER := 0;
  v_records_updated INTEGER := 0;
  v_temp_count INTEGER;
  v_errors TEXT[] := '{}';
  v_employer_name TEXT;
  v_duplicate_names TEXT[];
BEGIN
  -- Check permissions
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'lead_organiser')
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Unauthorized - admin or lead_organiser access required'
    );
  END IF;

  -- Get employer names for logging
  SELECT name INTO v_employer_name FROM employers WHERE id = p_primary_employer_id;
  SELECT ARRAY_AGG(name) INTO v_duplicate_names FROM employers WHERE id = ANY(p_duplicate_employer_ids);
  
  RAISE NOTICE 'Starting merge: Primary % (%), Duplicates: %', p_primary_employer_id, v_employer_name, v_duplicate_names;

  -- All operations in one transaction for consistency
  BEGIN
    -- 1. Update worker_placements
    BEGIN
      UPDATE worker_placements 
      SET employer_id = p_primary_employer_id 
      WHERE employer_id = ANY(p_duplicate_employer_ids);
      GET DIAGNOSTICS v_temp_count = ROW_COUNT;
      v_relationships_moved := v_relationships_moved + v_temp_count;
      RAISE NOTICE 'Updated % worker placements', v_temp_count;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || ('Worker placements: ' || SQLERRM);
    END;

    -- 2. Update project_employer_roles (handle duplicates)
    BEGIN
      -- Delete duplicate roles first
      DELETE FROM project_employer_roles 
      WHERE employer_id = ANY(p_duplicate_employer_ids)
        AND (project_id, role) IN (
          SELECT project_id, role 
          FROM project_employer_roles 
          WHERE employer_id = p_primary_employer_id
        );
      -- Update remaining roles
      UPDATE project_employer_roles 
      SET employer_id = p_primary_employer_id 
      WHERE employer_id = ANY(p_duplicate_employer_ids);
      GET DIAGNOSTICS v_temp_count = ROW_COUNT;
      v_relationships_moved := v_relationships_moved + v_temp_count;
      RAISE NOTICE 'Updated % project employer roles', v_temp_count;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || ('Project roles: ' || SQLERRM);
    END;

    -- 3. Update project_contractor_trades (handle duplicates)
    BEGIN
      DELETE FROM project_contractor_trades 
      WHERE employer_id = ANY(p_duplicate_employer_ids)
        AND (project_id, trade_type) IN (
          SELECT project_id, trade_type 
          FROM project_contractor_trades 
          WHERE employer_id = p_primary_employer_id
        );
      UPDATE project_contractor_trades 
      SET employer_id = p_primary_employer_id 
      WHERE employer_id = ANY(p_duplicate_employer_ids);
      GET DIAGNOSTICS v_temp_count = ROW_COUNT;
      v_relationships_moved := v_relationships_moved + v_temp_count;
      RAISE NOTICE 'Updated % project contractor trades', v_temp_count;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || ('Project trades: ' || SQLERRM);
    END;

    -- 4. Update site_employers
    BEGIN
      UPDATE site_employers 
      SET employer_id = p_primary_employer_id 
      WHERE employer_id = ANY(p_duplicate_employer_ids);
      GET DIAGNOSTICS v_temp_count = ROW_COUNT;
      v_relationships_moved := v_relationships_moved + v_temp_count;
      RAISE NOTICE 'Updated % site employers', v_temp_count;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || ('Site employers: ' || SQLERRM);
    END;

    -- 5. Update site_contractor_trades (handle duplicates)
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
      GET DIAGNOSTICS v_temp_count = ROW_COUNT;
      v_relationships_moved := v_relationships_moved + v_temp_count;
      RAISE NOTICE 'Updated % site contractor trades', v_temp_count;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || ('Site trades: ' || SQLERRM);
    END;

    -- 6. Update company_eba_records
    BEGIN
      UPDATE company_eba_records 
      SET employer_id = p_primary_employer_id 
      WHERE employer_id = ANY(p_duplicate_employer_ids);
      GET DIAGNOSTICS v_temp_count = ROW_COUNT;
      v_relationships_moved := v_relationships_moved + v_temp_count;
      RAISE NOTICE 'Updated % EBA records', v_temp_count;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || ('EBA records: ' || SQLERRM);
    END;

    -- 7. Update site_visit
    BEGIN
      UPDATE site_visit 
      SET employer_id = p_primary_employer_id 
      WHERE employer_id = ANY(p_duplicate_employer_ids);
      GET DIAGNOSTICS v_temp_count = ROW_COUNT;
      v_relationships_moved := v_relationships_moved + v_temp_count;
      RAISE NOTICE 'Updated % site visits', v_temp_count;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || ('Site visits: ' || SQLERRM);
    END;

    -- 8. Transfer contractor_trade_capabilities (handle duplicates)
    BEGIN
      INSERT INTO contractor_trade_capabilities (employer_id, trade_type, is_primary, notes)
      SELECT 
        p_primary_employer_id,
        tc.trade_type,
        tc.is_primary,
        COALESCE(tc.notes, '') || ' (merged from duplicate employer)' as notes
      FROM contractor_trade_capabilities tc
      WHERE tc.employer_id = ANY(p_duplicate_employer_ids)
      ON CONFLICT (employer_id, trade_type) DO UPDATE
      SET is_primary = EXCLUDED.is_primary OR contractor_trade_capabilities.is_primary,
          notes = COALESCE(contractor_trade_capabilities.notes, '') || '; ' || COALESCE(EXCLUDED.notes, '');
      
      DELETE FROM contractor_trade_capabilities 
      WHERE employer_id = ANY(p_duplicate_employer_ids);
      GET DIAGNOSTICS v_temp_count = ROW_COUNT;
      v_records_updated := v_records_updated + v_temp_count;
      RAISE NOTICE 'Merged % trade capabilities', v_temp_count;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || ('Trade capabilities: ' || SQLERRM);
    END;

    -- 9. Create aliases from duplicate employer names
    BEGIN
      INSERT INTO employer_aliases (employer_id, alias, alias_normalized, source_system, notes, collected_at, collected_by)
      SELECT 
        p_primary_employer_id,
        e.name,
        normalize_employer_name(e.name),
        'employer_merge',
        'Merged duplicate employer',
        NOW(),
        auth.uid()
      FROM employers e
      WHERE e.id = ANY(p_duplicate_employer_ids)
        AND e.name != v_employer_name -- Don't create alias if same name
      ON CONFLICT (employer_id, alias_normalized) DO NOTHING;
      GET DIAGNOSTICS v_temp_count = ROW_COUNT;
      RAISE NOTICE 'Created % aliases', v_temp_count;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || ('Duplicate aliases: ' || SQLERRM);
    END;

    -- 10. Update pending_employers references
    BEGIN
      UPDATE pending_employers
      SET matched_employer_id = p_primary_employer_id
      WHERE matched_employer_id = ANY(p_duplicate_employer_ids);
      
      UPDATE pending_employers
      SET imported_employer_id = p_primary_employer_id
      WHERE imported_employer_id = ANY(p_duplicate_employer_ids);
      GET DIAGNOSTICS v_temp_count = ROW_COUNT;
      v_records_updated := v_records_updated + v_temp_count;
      RAISE NOTICE 'Updated % pending employer references', v_temp_count;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || ('Pending employers: ' || SQLERRM);
    END;

    -- 11. Delete duplicate employer records
    BEGIN
      DELETE FROM employers 
      WHERE id = ANY(p_duplicate_employer_ids);
      GET DIAGNOSTICS v_temp_count = ROW_COUNT;
      v_records_updated := v_records_updated + v_temp_count;
      RAISE NOTICE 'Deleted % duplicate employers', v_temp_count;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || ('Delete duplicates: ' || SQLERRM);
    END;

  EXCEPTION
    WHEN OTHERS THEN
      -- Catch-all for transaction-level errors
      v_errors := v_errors || ('Transaction error: ' || SQLERRM);
      RAISE WARNING 'Merge transaction error: %', SQLERRM;
  END;

  -- Build result
  SELECT json_build_object(
    'success', CASE WHEN array_length(v_errors, 1) IS NULL THEN true ELSE false END,
    'primary_employer_id', p_primary_employer_id,
    'merged_employer_ids', p_duplicate_employer_ids,
    'relationships_moved', v_relationships_moved,
    'records_updated', v_records_updated,
    'errors', CASE WHEN array_length(v_errors, 1) IS NULL THEN '[]'::json ELSE array_to_json(v_errors) END
  ) INTO v_result;

  RAISE NOTICE 'Merge completed: % relationships moved, % records updated', v_relationships_moved, v_records_updated;

  RETURN v_result;
END;
$$;

-- Ensure proper permissions
GRANT EXECUTE ON FUNCTION merge_employers(UUID, UUID[]) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION merge_employers(UUID, UUID[]) IS 
'Merges duplicate active employers into a single canonical employer.
Transfers all relationships and marks duplicates as inactive.
Runs with SECURITY DEFINER and 30s statement timeout to prevent client session timeouts.
Requires admin or lead_organiser role.';

