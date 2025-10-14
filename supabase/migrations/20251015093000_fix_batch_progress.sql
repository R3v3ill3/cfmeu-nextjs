-- Ensure batch progress treats review-ready scans as completed work
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
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('completed', 'review_new_project', 'under_review', 'confirmed')),
    COUNT(*) FILTER (WHERE status = 'failed')
  INTO v_total, v_completed, v_failed
  FROM mapping_sheet_scans
  WHERE batch_id = p_batch_id;

  IF v_total = 0 THEN
    v_new_status := 'processing';
  ELSIF v_completed = v_total THEN
    v_new_status := 'completed';
  ELSIF v_failed > 0 AND (v_completed + v_failed) = v_total THEN
    v_new_status := 'partial';
  ELSIF v_completed > 0 OR v_failed > 0 THEN
    v_new_status := 'in_progress';
  ELSE
    v_new_status := 'processing';
  END IF;

  UPDATE batch_uploads
  SET
    projects_completed = v_completed,
    status = v_new_status,
    processing_completed_at = CASE WHEN v_new_status IN ('completed', 'partial') THEN now() ELSE NULL END
  WHERE id = p_batch_id;
END;
$$;

COMMENT ON FUNCTION update_batch_progress(uuid) IS 'Updates batch upload progress based on child scan statuses';
