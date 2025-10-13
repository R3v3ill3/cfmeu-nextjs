-- Add bulk upload support for multiple projects from single PDF

-- 1. Create batch_uploads table
CREATE TABLE batch_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  original_file_url text NOT NULL,
  original_file_name text NOT NULL,
  original_file_size_bytes bigint NOT NULL,
  total_pages integer NOT NULL,
  total_projects integer NOT NULL,
  projects_completed integer DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- User defining boundaries
    'processing',   -- Splitting PDF and creating scans
    'in_progress',  -- Some scans processing
    'completed',    -- All scans processed successfully
    'partial',      -- Some scans failed
    'failed'        -- Batch processing failed
  )),
  project_definitions jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Format: [{ startPage: 1, endPage: 2, tentativeName: "Project A", mode: "new" | "existing", projectId?: uuid }]

  error_message text,
  created_at timestamptz DEFAULT now(),
  processing_started_at timestamptz,
  processing_completed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX idx_batch_uploads_uploaded_by ON batch_uploads(uploaded_by);
CREATE INDEX idx_batch_uploads_status ON batch_uploads(status);
CREATE INDEX idx_batch_uploads_created_at ON batch_uploads(created_at DESC);

COMMENT ON TABLE batch_uploads IS 'Parent records for bulk PDF uploads containing multiple projects';

-- 2. Add batch_id to mapping_sheet_scans
ALTER TABLE mapping_sheet_scans
ADD COLUMN batch_id uuid REFERENCES batch_uploads(id) ON DELETE CASCADE;

CREATE INDEX idx_mapping_sheet_scans_batch_id ON mapping_sheet_scans(batch_id);

COMMENT ON COLUMN mapping_sheet_scans.batch_id IS 'Links scan to parent batch upload if part of bulk upload';

-- 3. RLS for batch_uploads
ALTER TABLE batch_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own batch uploads"
  ON batch_uploads FOR SELECT
  TO authenticated
  USING (uploaded_by = auth.uid());

CREATE POLICY "Users can insert their own batch uploads"
  ON batch_uploads FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Users can update their own batch uploads"
  ON batch_uploads FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Admins can view all batch uploads"
  ON batch_uploads FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'lead_organiser')
  );

GRANT SELECT, INSERT, UPDATE ON batch_uploads TO authenticated;

-- 4. Function to update batch progress
CREATE OR REPLACE FUNCTION update_batch_progress(p_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total integer;
  v_completed integer;
  v_failed integer;
  v_new_status text;
BEGIN
  -- Count scan statuses
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('completed', 'under_review', 'confirmed')),
    COUNT(*) FILTER (WHERE status = 'failed')
  INTO v_total, v_completed, v_failed
  FROM mapping_sheet_scans
  WHERE batch_id = p_batch_id;

  -- Determine batch status
  IF v_completed = v_total THEN
    v_new_status := 'completed';
  ELSIF v_failed > 0 AND (v_completed + v_failed) = v_total THEN
    v_new_status := 'partial';
  ELSIF v_completed > 0 OR v_failed > 0 THEN
    v_new_status := 'in_progress';
  ELSE
    v_new_status := 'processing';
  END IF;

  -- Update batch
  UPDATE batch_uploads
  SET
    projects_completed = v_completed,
    status = v_new_status,
    processing_completed_at = CASE WHEN v_new_status IN ('completed', 'partial') THEN now() ELSE NULL END
  WHERE id = p_batch_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_batch_progress(uuid) TO authenticated;

COMMENT ON FUNCTION update_batch_progress(uuid) IS 'Updates batch upload progress based on child scan statuses';

-- 5. Trigger to auto-update batch progress when scans change
CREATE OR REPLACE FUNCTION trigger_update_batch_progress()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.batch_id IS NOT NULL THEN
    PERFORM update_batch_progress(NEW.batch_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_batch_on_scan_change
  AFTER INSERT OR UPDATE OF status ON mapping_sheet_scans
  FOR EACH ROW
  WHEN (NEW.batch_id IS NOT NULL)
  EXECUTE FUNCTION trigger_update_batch_progress();

COMMENT ON TRIGGER update_batch_on_scan_change ON mapping_sheet_scans IS 'Auto-updates parent batch progress when child scan status changes';

-- 6. Function to initialize batch upload after PDF split
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

GRANT EXECUTE ON FUNCTION create_batch_upload_with_scans(uuid, jsonb, jsonb) TO authenticated;

COMMENT ON FUNCTION create_batch_upload_with_scans(uuid, jsonb, jsonb) IS 'Creates batch upload record and all child scan records in a transaction';
