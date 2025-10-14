-- Update create_batch_upload_with_scans to handle selected_pages

CREATE OR REPLACE FUNCTION create_batch_upload_with_scans(
  p_user_id uuid,
  p_batch_data jsonb,
  p_scans jsonb  -- Array of scan records to create
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch_id uuid;
  v_scan jsonb;
  v_scan_id uuid;
  v_scan_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'error', 'Unauthorized',
      'status', 403
    );
  END IF;

  -- Create batch record
  INSERT INTO batch_uploads (
    uploaded_by,
    original_file_url,
    original_file_name,
    original_file_size_bytes,
    total_pages,
    total_projects,
    project_definitions,
    status,
    processing_started_at
  ) VALUES (
    p_user_id,
    p_batch_data->>'original_file_url',
    p_batch_data->>'original_file_name',
    (p_batch_data->>'original_file_size_bytes')::bigint,
    (p_batch_data->>'total_pages')::integer,
    (p_batch_data->>'total_projects')::integer,
    p_batch_data->'project_definitions',
    'processing',
    now()
  )
  RETURNING id INTO v_batch_id;

  -- Create scan records for each project
  FOR v_scan IN SELECT * FROM jsonb_array_elements(p_scans)
  LOOP
    INSERT INTO mapping_sheet_scans (
      batch_id,
      project_id,
      uploaded_by,
      file_url,
      file_name,
      file_size_bytes,
      status,
      upload_mode,
      notes,
      page_count,
      selected_pages  -- NEW: Store selected pages
    ) VALUES (
      v_batch_id,
      (v_scan->>'project_id')::uuid,  -- NULL for new projects
      p_user_id,
      v_scan->>'file_url',
      v_scan->>'file_name',
      (v_scan->>'file_size_bytes')::bigint,
      'pending',
      v_scan->>'upload_mode',
      v_scan->>'notes',
      (v_scan->>'page_count')::integer,
      -- Parse selected_pages from JSON array to integer array
      CASE
        WHEN v_scan->'selected_pages' IS NOT NULL
        THEN (
          SELECT array_agg((value)::integer)
          FROM jsonb_array_elements_text(v_scan->'selected_pages')
        )
        ELSE NULL
      END
    )
    RETURNING id INTO v_scan_id;

    v_scan_ids := array_append(v_scan_ids, v_scan_id);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'batchId', v_batch_id,
    'scanIds', to_jsonb(v_scan_ids)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'status', 500
    );
END;
$$;

COMMENT ON FUNCTION create_batch_upload_with_scans(uuid, jsonb, jsonb) IS 'Creates batch upload record and all child scan records with selected_pages support';
