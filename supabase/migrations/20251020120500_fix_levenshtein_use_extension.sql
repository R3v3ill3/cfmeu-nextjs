-- Fix Levenshtein distance by using built-in fuzzystrmatch extension
-- This replaces our broken custom implementation

-- Enable the fuzzystrmatch extension (provides levenshtein function)
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Drop our broken custom implementation
DROP FUNCTION IF EXISTS levenshtein_distance(text, text);

-- Update the find_duplicate_pending_employers function to use the built-in levenshtein
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
      -- Use built-in levenshtein function from fuzzystrmatch extension
      v_distance := levenshtein(v_normalized_name, v_compare_normalized);
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

COMMENT ON FUNCTION find_duplicate_pending_employers() IS 'Scans pending employers for duplicates using fuzzy name matching with built-in levenshtein from fuzzystrmatch extension.';



