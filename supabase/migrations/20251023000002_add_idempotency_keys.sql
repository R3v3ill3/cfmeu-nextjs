-- Add idempotency keys to prevent duplicate job creation
-- This ensures exactly-once semantics for batch uploads and scraper jobs

-- 1. Add idempotency_key to batch_uploads
ALTER TABLE batch_uploads
ADD COLUMN idempotency_key text;

-- Create unique index on idempotency_key (allows NULL for backwards compatibility)
CREATE UNIQUE INDEX idx_batch_uploads_idempotency_key
ON batch_uploads(idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- Add index for faster lookups
CREATE INDEX idx_batch_uploads_idempotency_lookup
ON batch_uploads(uploaded_by, idempotency_key)
WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN batch_uploads.idempotency_key IS
'Deterministic hash for idempotency: SHA256(userId + fileName + fileSize + totalPages + projectDefinitions). Prevents duplicate batch creation on network retries.';

-- 2. Add idempotency_key to scraper_jobs
ALTER TABLE scraper_jobs
ADD COLUMN idempotency_key text;

-- Create unique index on idempotency_key (allows NULL for backwards compatibility)
CREATE UNIQUE INDEX idx_scraper_jobs_idempotency_key
ON scraper_jobs(idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- Add index for faster lookups
CREATE INDEX idx_scraper_jobs_idempotency_lookup
ON scraper_jobs(created_by, idempotency_key)
WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN scraper_jobs.idempotency_key IS
'Deterministic hash for idempotency: SHA256(userId + scanId + jobType + payload). Prevents duplicate job creation on network retries or concurrent requests.';

-- 3. Helper function to check for existing batch by idempotency key
CREATE OR REPLACE FUNCTION get_batch_by_idempotency_key(
  p_user_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch_record batch_uploads%ROWTYPE;
  v_scan_ids uuid[];
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'error', 'Unauthorized',
      'status', 403
    );
  END IF;

  -- Find existing batch
  SELECT * INTO v_batch_record
  FROM batch_uploads
  WHERE uploaded_by = p_user_id
    AND idempotency_key = p_idempotency_key;

  -- Return null if not found
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Get associated scan IDs
  SELECT ARRAY_AGG(id ORDER BY created_at)
  INTO v_scan_ids
  FROM mapping_sheet_scans
  WHERE batch_id = v_batch_record.id;

  -- Return existing batch info
  RETURN jsonb_build_object(
    'batchId', v_batch_record.id,
    'scanIds', to_jsonb(COALESCE(v_scan_ids, ARRAY[]::uuid[])),
    'status', v_batch_record.status,
    'createdAt', v_batch_record.created_at,
    'isExisting', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_batch_by_idempotency_key(uuid, text) TO authenticated;

COMMENT ON FUNCTION get_batch_by_idempotency_key(uuid, text) IS
'Checks for existing batch upload by idempotency key. Returns batch info if found, NULL otherwise. Prevents duplicate batch creation.';

-- 4. Update create_batch_upload_with_scans to accept and use idempotency_key
CREATE OR REPLACE FUNCTION create_batch_upload_with_scans(
  p_user_id uuid,
  p_batch_data jsonb,
  p_scans jsonb,
  p_idempotency_key text DEFAULT NULL
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
  v_existing_batch jsonb;
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'error', 'Unauthorized',
      'status', 403
    );
  END IF;

  -- Check for existing batch if idempotency key provided
  IF p_idempotency_key IS NOT NULL THEN
    v_existing_batch := get_batch_by_idempotency_key(p_user_id, p_idempotency_key);

    IF v_existing_batch IS NOT NULL THEN
      -- Return existing batch (idempotent response)
      RETURN v_existing_batch;
    END IF;
  END IF;

  -- Create batch record with idempotency key
  INSERT INTO batch_uploads (
    uploaded_by,
    original_file_url,
    original_file_name,
    original_file_size_bytes,
    total_pages,
    total_projects,
    project_definitions,
    status,
    processing_started_at,
    idempotency_key
  ) VALUES (
    p_user_id,
    p_batch_data->>'original_file_url',
    p_batch_data->>'original_file_name',
    (p_batch_data->>'original_file_size_bytes')::bigint,
    (p_batch_data->>'total_pages')::integer,
    (p_batch_data->>'total_projects')::integer,
    p_batch_data->'project_definitions',
    'processing',
    now(),
    p_idempotency_key
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
      page_count
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
      (v_scan->>'page_count')::integer
    )
    RETURNING id INTO v_scan_id;

    v_scan_ids := array_append(v_scan_ids, v_scan_id);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'batchId', v_batch_id,
    'scanIds', to_jsonb(v_scan_ids),
    'isExisting', false
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Handle race condition: another request created batch with same idempotency key
    IF p_idempotency_key IS NOT NULL THEN
      v_existing_batch := get_batch_by_idempotency_key(p_user_id, p_idempotency_key);
      IF v_existing_batch IS NOT NULL THEN
        RETURN v_existing_batch;
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'error', 'Duplicate batch upload detected',
      'status', 409
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'status', 500
    );
END;
$$;

GRANT EXECUTE ON FUNCTION create_batch_upload_with_scans(uuid, jsonb, jsonb, text) TO authenticated;

COMMENT ON FUNCTION create_batch_upload_with_scans(uuid, jsonb, jsonb, text) IS
'Creates batch upload record and all child scan records in a transaction with idempotency support. Returns existing batch if idempotency key matches.';
