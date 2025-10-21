-- Pending Employer Review RPC Functions
-- Part 2: Adding the actual business logic functions

-- ==========================================
-- 1. RPC: Find Duplicate Pending Employers
-- ==========================================

CREATE OR REPLACE FUNCTION find_duplicate_pending_employers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pending_employers RECORD;
  v_compare_employer RECORD;
  v_normalized_name text;
  v_compare_normalized text;
  v_distance integer;
  v_max_length integer;
  v_similarity numeric;
  v_groups jsonb := '[]'::jsonb;
  v_current_group jsonb;
  v_processed_ids uuid[] := '{}';
  v_group_members jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'lead_organiser')
  ) THEN
    RETURN jsonb_build_object(
      'error', 'Unauthorized - admin or lead_organiser role required',
      'status', 403
    );
  END IF;

  FOR v_pending_employers IN 
    SELECT id, name, employer_type, website, created_at, auto_merged, merged_from_pending_ids
    FROM employers
    WHERE approval_status = 'pending'
    AND id != ALL(v_processed_ids)
    ORDER BY created_at DESC
  LOOP
    v_normalized_name := normalize_employer_name(v_pending_employers.name);
    v_group_members := jsonb_build_array(
      jsonb_build_object(
        'id', v_pending_employers.id,
        'name', v_pending_employers.name,
        'employer_type', v_pending_employers.employer_type,
        'website', v_pending_employers.website,
        'created_at', v_pending_employers.created_at,
        'auto_merged', v_pending_employers.auto_merged,
        'merged_from_pending_ids', v_pending_employers.merged_from_pending_ids,
        'similarity', 100
      )
    );
    
    v_processed_ids := array_append(v_processed_ids, v_pending_employers.id);
    
    FOR v_compare_employer IN
      SELECT id, name, employer_type, website, created_at, auto_merged, merged_from_pending_ids
      FROM employers
      WHERE approval_status = 'pending'
      AND id != v_pending_employers.id
      AND id != ALL(v_processed_ids)
    LOOP
      v_compare_normalized := normalize_employer_name(v_compare_employer.name);
      v_distance := levenshtein_distance(v_normalized_name, v_compare_normalized);
      v_max_length := GREATEST(length(v_normalized_name), length(v_compare_normalized));
      
      IF v_max_length > 0 THEN
        v_similarity := ROUND((1.0 - (v_distance::numeric / v_max_length)) * 100, 2);
      ELSE
        v_similarity := 100;
      END IF;
      
      IF v_similarity >= 70 THEN
        v_group_members := v_group_members || jsonb_build_array(
          jsonb_build_object(
            'id', v_compare_employer.id,
            'name', v_compare_employer.name,
            'employer_type', v_compare_employer.employer_type,
            'website', v_compare_employer.website,
            'created_at', v_compare_employer.created_at,
            'auto_merged', v_compare_employer.auto_merged,
            'merged_from_pending_ids', v_compare_employer.merged_from_pending_ids,
            'similarity', v_similarity
          )
        );
        v_processed_ids := array_append(v_processed_ids, v_compare_employer.id);
      END IF;
    END LOOP;
    
    IF jsonb_array_length(v_group_members) > 1 THEN
      v_current_group := jsonb_build_object(
        'canonical_id', v_pending_employers.id,
        'canonical_name', v_pending_employers.name,
        'members', v_group_members,
        'member_count', jsonb_array_length(v_group_members),
        'min_similarity', (
          SELECT MIN((value->>'similarity')::numeric)
          FROM jsonb_array_elements(v_group_members)
        ),
        'max_similarity', (
          SELECT MAX((value->>'similarity')::numeric)
          FROM jsonb_array_elements(v_group_members)
        )
      );
      v_groups := v_groups || jsonb_build_array(v_current_group);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'groups', v_groups,
    'total_groups', jsonb_array_length(v_groups),
    'total_pending', (SELECT COUNT(*) FROM employers WHERE approval_status = 'pending')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION find_duplicate_pending_employers() TO authenticated;

-- ==========================================
-- 2. RPC: Merge Pending Employers
-- ==========================================

CREATE OR REPLACE FUNCTION merge_pending_employers(
  p_canonical_employer_id uuid,
  p_merge_employer_ids uuid[],
  p_conflict_resolutions jsonb DEFAULT '{}'::jsonb,
  p_auto_merge boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_canonical_employer RECORD;
  v_merge_employer RECORD;
  v_merged_ids uuid[] := '{}';
  v_similarity_scores jsonb := '{}'::jsonb;
  v_merge_log_id uuid;
  v_project_count integer := 0;
  v_trade_count integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'lead_organiser')
  ) THEN
    RETURN jsonb_build_object('error', 'Unauthorized', 'status', 403);
  END IF;

  SELECT * INTO v_canonical_employer
  FROM employers
  WHERE id = p_canonical_employer_id AND approval_status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Canonical employer not found or not pending', 'status', 404);
  END IF;

  BEGIN
    FOR v_merge_employer IN
      SELECT * FROM employers
      WHERE id = ANY(p_merge_employer_ids)
      AND approval_status = 'pending'
      AND id != p_canonical_employer_id
    LOOP
      UPDATE project_assignments SET employer_id = p_canonical_employer_id WHERE employer_id = v_merge_employer.id;
      GET DIAGNOSTICS v_project_count = ROW_COUNT;

      INSERT INTO contractor_trade_capabilities (employer_id, trade_type, is_primary, notes)
      SELECT p_canonical_employer_id, trade_type, is_primary, notes
      FROM contractor_trade_capabilities
      WHERE employer_id = v_merge_employer.id
      ON CONFLICT (employer_id, trade_type) DO NOTHING;
      GET DIAGNOSTICS v_trade_count = ROW_COUNT;

      UPDATE employer_aliases SET employer_id = p_canonical_employer_id WHERE employer_id = v_merge_employer.id;

      INSERT INTO employer_aliases (employer_id, alias, alias_normalized, source_system, source_identifier, notes, collected_at, collected_by)
      VALUES (p_canonical_employer_id, v_merge_employer.name, normalize_employer_name(v_merge_employer.name), 
              'pending_employer_merge', v_merge_employer.id::text, 'Auto-merged pending employer variant', now(), auth.uid())
      ON CONFLICT (employer_id, alias_normalized) DO NOTHING;

      v_merged_ids := array_append(v_merged_ids, v_merge_employer.id);

      UPDATE employers
      SET approval_status = 'rejected',
          rejection_reason = 'Merged into: ' || v_canonical_employer.name || ' (ID: ' || p_canonical_employer_id || ')',
          approved_by = auth.uid(), approved_at = now()
      WHERE id = v_merge_employer.id;
    END LOOP;

    UPDATE employers
    SET merged_from_pending_ids = array_cat(COALESCE(merged_from_pending_ids, '{}'), v_merged_ids),
        auto_merged = p_auto_merge, last_reviewed_at = now(), last_reviewed_by = auth.uid()
    WHERE id = p_canonical_employer_id;

    IF p_conflict_resolutions IS NOT NULL AND p_conflict_resolutions != '{}'::jsonb THEN
      IF p_conflict_resolutions ? 'employer_type' THEN
        UPDATE employers SET employer_type = p_conflict_resolutions->>'employer_type' WHERE id = p_canonical_employer_id;
      END IF;
      IF p_conflict_resolutions ? 'name' THEN
        UPDATE employers SET name = p_conflict_resolutions->>'name' WHERE id = p_canonical_employer_id;
      END IF;
    END IF;

    INSERT INTO pending_employer_merge_log (canonical_employer_id, merged_employer_ids, similarity_scores, conflict_resolutions, merged_by, merged_at)
    VALUES (p_canonical_employer_id, v_merged_ids, v_similarity_scores, p_conflict_resolutions, auth.uid(), now())
    RETURNING id INTO v_merge_log_id;

    INSERT INTO approval_history (entity_type, entity_id, action, performed_by, previous_status, new_status, reason, metadata)
    VALUES ('employer', p_canonical_employer_id, 'resubmitted', auth.uid(), 'pending', 'pending',
            'Merged ' || array_length(v_merged_ids, 1) || ' duplicate pending employers',
            jsonb_build_object('merge_log_id', v_merge_log_id, 'merged_ids', v_merged_ids, 
                             'auto_merge', p_auto_merge, 'projects_transferred', v_project_count, 
                             'trades_transferred', v_trade_count));

    RETURN jsonb_build_object('success', true, 'canonical_employer_id', p_canonical_employer_id, 
                             'merged_count', array_length(v_merged_ids, 1), 'merged_ids', v_merged_ids, 
                             'merge_log_id', v_merge_log_id, 'projects_transferred', v_project_count, 
                             'trades_transferred', v_trade_count);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM, 'status', 500);
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION merge_pending_employers(uuid, uuid[], jsonb, boolean) TO authenticated;

-- ==========================================
-- 3. Helper function: array_remove_elements
-- ==========================================

CREATE OR REPLACE FUNCTION array_remove_elements(arr uuid[], elements uuid[])
RETURNS uuid[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  elem uuid;
BEGIN
  FOREACH elem IN ARRAY elements LOOP
    arr := array_remove(arr, elem);
  END LOOP;
  RETURN arr;
END;
$$;

-- ==========================================
-- 4. RPC: Undo Pending Employer Merge
-- ==========================================

CREATE OR REPLACE FUNCTION undo_pending_employer_merge(p_merge_log_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_merge_log RECORD;
  v_restored_count integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'lead_organiser')) THEN
    RETURN jsonb_build_object('error', 'Unauthorized', 'status', 403);
  END IF;

  SELECT * INTO v_merge_log FROM pending_employer_merge_log WHERE id = p_merge_log_id AND undone_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Merge log not found or already undone', 'status', 404);
  END IF;

  BEGIN
    UPDATE employers SET approval_status = 'pending', rejection_reason = NULL, approved_by = NULL, approved_at = NULL
    WHERE id = ANY(v_merge_log.merged_employer_ids);
    GET DIAGNOSTICS v_restored_count = ROW_COUNT;

    UPDATE employers
    SET merged_from_pending_ids = array_remove_elements(merged_from_pending_ids, v_merge_log.merged_employer_ids),
        auto_merged = CASE WHEN array_length(merged_from_pending_ids, 1) <= array_length(v_merge_log.merged_employer_ids, 1) 
                      THEN false ELSE auto_merged END
    WHERE id = v_merge_log.canonical_employer_id;

    UPDATE pending_employer_merge_log SET undone_at = now(), undone_by = auth.uid(), undo_reason = p_reason WHERE id = p_merge_log_id;

    INSERT INTO approval_history (entity_type, entity_id, action, performed_by, previous_status, new_status, reason, metadata)
    VALUES ('employer', v_merge_log.canonical_employer_id, 'resubmitted', auth.uid(), 'pending', 'pending',
            'Undid merge: ' || COALESCE(p_reason, 'No reason provided'),
            jsonb_build_object('merge_log_id', p_merge_log_id, 'restored_ids', v_merge_log.merged_employer_ids, 
                             'restored_count', v_restored_count));

    RETURN jsonb_build_object('success', true, 'restored_count', v_restored_count, 'restored_ids', v_merge_log.merged_employer_ids);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM, 'status', 500);
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION undo_pending_employer_merge(uuid, text) TO authenticated;

-- ==========================================
-- 5. Function: Release Review Lock
-- ==========================================

CREATE OR REPLACE FUNCTION release_stale_review_locks()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_released_count integer;
BEGIN
  UPDATE employers SET currently_reviewed_by = NULL, review_started_at = NULL
  WHERE currently_reviewed_by IS NOT NULL
  AND review_started_at < (now() - interval '30 minutes')
  AND approval_status = 'pending';
  GET DIAGNOSTICS v_released_count = ROW_COUNT;
  RETURN v_released_count;
END;
$$;

COMMENT ON FUNCTION release_stale_review_locks() IS 'Releases review locks on pending employers that have been idle for 30+ minutes';


