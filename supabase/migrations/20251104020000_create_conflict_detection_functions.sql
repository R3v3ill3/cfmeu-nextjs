-- ===================================
-- ADVANCED CONFLICT DETECTION SYSTEM
-- ===================================
-- This migration creates sophisticated conflict detection and resolution functions
-- for the CFMEU organising database collaboration system

-- ===================================
-- 1. FIELD-LEVEL CONFLICT DETECTION
-- ===================================

-- Function to detect conflicts between two employer records
CREATE OR REPLACE FUNCTION public.detect_field_conflicts(
  p_record_1 jsonb,
  p_record_2 jsonb,
  p_ignore_fields jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE(
  field_name text,
  conflict_type text,
  value_1 text,
  value_2 text,
  severity text,
  auto_resolvable boolean
) AS $$
DECLARE
  v_field text;
  v_val_1 jsonb;
  v_val_2 jsonb;
  v_val_1_text text;
  v_val_2_text text;
BEGIN
  -- Get all keys from both records
  FOR v_field IN
    SELECT DISTINCT key
    FROM jsonb_each_text(
      COALESCE(p_record_1, '{}'::jsonb) ||
      COALESCE(p_record_2, '{}'::jsonb)
    )
  LOOP
    -- Skip ignored fields
    IF v_field = ANY((SELECT jsonb_array_elements_text(p_ignore_fields))) THEN
      CONTINUE;
    END IF;

    -- Skip system fields
    IF v_field IN ('id', 'created_at', 'updated_at', 'version', 'last_known_version',
                   'is_being_edited', 'current_editor_id', 'current_editing_session_id') THEN
      CONTINUE;
    END IF;

    v_val_1 := p_record_1->v_field;
    v_val_2 := p_record_2->v_field;
    v_val_1_text := COALESCE(v_val_1#>>'{}', '');
    v_val_2_text := COALESCE(v_val_2#>>'{}', '');

    -- Skip if values are the same
    IF v_val_1_text = v_val_2_text THEN
      CONTINUE;
    END IF;

    -- Determine conflict type and severity
    field_name := v_field;
    value_1 := v_val_1_text;
    value_2 := v_val_2_text;

    CASE
      WHEN v_val_1 IS NULL OR v_val_2 IS NULL THEN
        conflict_type := 'data_presence';
        severity := 'medium';
        auto_resolvable := true;
      WHEN v_field IN ('phone', 'email', 'website') THEN
        conflict_type := 'contact_info';
        severity := 'low';
        auto_resolvable := true;
      WHEN v_field IN ('name', 'abn') THEN
        conflict_type := 'identity';
        severity := 'high';
        auto_resolvable := false;
      WHEN v_field IN ('estimated_worker_count') THEN
        conflict_type := 'numeric_data';
        severity := 'medium';
        auto_resolvable := true;
      WHEN v_field IN ('enterprise_agreement_status') THEN
        conflict_type := 'boolean_data';
        severity := 'high';
        auto_resolvable := false;
      WHEN v_field IN ('employer_type') THEN
        conflict_type := 'enum_data';
        severity := 'high';
        auto_resolvable := false;
      WHEN v_field LIKE '%address%' OR v_field IN ('suburb', 'state', 'postcode') THEN
        conflict_type := 'location_data';
        severity := 'medium';
        auto_resolvable := true;
      ELSE
        conflict_type := 'general_data';
        severity := 'medium';
        auto_resolvable := false;
    END CASE;

    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to detect conflicts for a specific employer
CREATE OR REPLACE FUNCTION public.detect_employer_conflicts_detailed(
  p_employer_id uuid,
  p_time_window interval DEFAULT interval '10 minutes'
)
RETURNS TABLE(
  conflict_id uuid,
  change_1_id uuid,
  change_2_id uuid,
  change_1_by uuid,
  change_2_by uuid,
  change_1_at timestamptz,
  change_2_at timestamptz,
  conflicting_fields jsonb,
  conflict_severity text,
  conflict_type text,
  auto_resolvable boolean,
  resolution_suggestions jsonb
) AS $$
DECLARE
  v_conflict_record record;
  v_field_conflicts jsonb := '[]'::jsonb;
  v_suggestions jsonb := '{}'::jsonb;
BEGIN
  -- Find recent overlapping changes for the same employer
  FOR v_conflict_record IN
    WITH overlapping_changes AS (
      SELECT
        a1.id as change_1_id,
        a2.id as change_2_id,
        a1.changed_by as change_1_by,
        a2.changed_by as change_2_by,
        a1.changed_at as change_1_at,
        a2.changed_at as change_2_at,
        a1.from_version as version_1_from,
        a1.to_version as version_1_to,
        a2.from_version as version_2_from,
        a2.to_version as version_2_to,
        a1.new_values as values_1,
        a2.new_values as values_2
      FROM public.employer_change_audit a1
      JOIN public.employer_change_audit a2 ON (
        a1.employer_id = a2.employer_id
        AND a1.id < a2.id  -- Prevent duplicate pairs
        AND a1.changed_by <> a2.changed_by  -- Only different users
        AND abs(EXTRACT(EPOCH FROM (a2.changed_at - a1.changed_at))) < EXTRACT(EPOCH FROM p_time_window)
        AND (
          -- Version overlap detection
          (a1.from_version BETWEEN a2.from_version AND a2.to_version) OR
          (a1.to_version BETWEEN a2.from_version AND a2.to_version) OR
          (a2.from_version BETWEEN a1.from_version AND a1.to_version) OR
          (a2.to_version BETWEEN a1.from_version AND a1.to_version)
        )
      )
      WHERE a1.employer_id = p_employer_id
        AND a1.change_type IN ('INSERT', 'UPDATE')
        AND a2.change_type IN ('INSERT', 'UPDATE')
    )
    SELECT * FROM overlapping_changes
  LOOP
    -- Detect field-level conflicts
    SELECT jsonb_agg(
      jsonb_build_object(
        'field', fc.field_name,
        'type', fc.conflict_type,
        'severity', fc.severity,
        'auto_resolvable', fc.auto_resolvable,
        'value_1', fc.value_1,
        'value_2', fc.value_2
      )
    ) INTO v_field_conflicts
    FROM public.detect_field_conflicts(
      v_conflict_record.values_1,
      v_conflict_record.values_2
    ) fc;

    -- Skip if no field conflicts
    IF v_field_conflicts IS NULL OR jsonb_array_length(v_field_conflicts) = 0 THEN
      CONTINUE;
    END IF;

    -- Generate resolution suggestions
    v_suggestions := jsonb_build_object(
      'auto_merge_available', (SELECT COUNT(*) = 0 FROM jsonb_array_elements(v_field_conflicts) WHERE element->>'auto_resolvable' = 'false'),
      'high_conflicts_count', (SELECT COUNT(*) FROM jsonb_array_elements(v_field_conflicts) WHERE element->>'severity' = 'high'),
      'recommended_action', CASE
        WHEN (SELECT COUNT(*) FROM jsonb_array_elements(v_field_conflicts) WHERE element->>'severity' = 'high') > 0 THEN 'manual_review'
        WHEN (SELECT COUNT(*) FROM jsonb_array_elements(v_field_conflicts) WHERE element->>'auto_resolvable' = 'false') = 0 THEN 'auto_merge'
        ELSE 'guided_merge'
      END
    );

    -- Determine overall conflict severity
    DECLARE
      v_max_severity text := 'low';
    BEGIN
      SELECT max(element->>'severity') INTO v_max_severity
      FROM jsonb_array_elements(v_field_conflicts);
    END;

    -- Create or update conflict record
    INSERT INTO public.employer_change_conflicts(
      employer_id,
      conflicting_change_id_1,
      conflicting_change_id_2,
      conflicting_fields,
      conflict_severity
    ) VALUES (
      p_employer_id,
      v_conflict_record.change_1_id,
      v_conflict_record.change_2_id,
      v_field_conflicts,
      v_max_severity
    )
    ON CONFLICT (conflicting_change_id_1, conflicting_change_id_2)
    DO UPDATE SET
      conflicting_fields = EXCLUDED.conflicting_fields,
      conflict_severity = EXCLUDED.conflict_severity,
      updated_at = now()
    RETURNING id INTO conflict_id;

    -- Return conflict details
    change_1_id := v_conflict_record.change_1_id;
    change_2_id := v_conflict_record.change_2_id;
    change_1_by := v_conflict_record.change_1_by;
    change_2_by := v_conflict_record.change_2_by;
    change_1_at := v_conflict_record.change_1_at;
    change_2_at := v_conflict_record.change_2_at;
    conflicting_fields := v_field_conflicts;
    conflict_severity := v_max_severity;
    conflict_type := 'concurrent_editing';
    auto_resolvable := (v_suggestions->>'auto_merge_available')::boolean;
    resolution_suggestions := v_suggestions;

    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ===================================
-- 2. CONFLICT RESOLUTION FUNCTIONS
-- ===================================

-- Function to auto-resolvable conflicts
CREATE OR REPLACE FUNCTION public.auto_resolve_conflicts(
  p_conflict_id uuid,
  p_resolution_strategy text DEFAULT 'prefer_latest' -- 'prefer_latest', 'prefer_first', 'merge_safe'
)
RETURNS TABLE(
  success boolean,
  resolved_employer_data jsonb,
  unresolved_fields jsonb,
  resolution_log jsonb
) AS $$
DECLARE
  v_conflict_record record;
  v_change_1_record jsonb;
  v_change_2_record jsonb;
  v_base_record jsonb;
  v_resolved_data jsonb;
  v_unresolved_fields jsonb := '[]'::jsonb;
  v_resolution_log jsonb := '[]'::jsonb;
  v_log_entry jsonb;
  v_field_record record;
BEGIN
  -- Get conflict details
  SELECT * INTO v_conflict_record
  FROM public.employer_change_conflicts
  WHERE id = p_conflict_id AND resolution_status = 'pending';

  IF v_conflict_record IS NULL THEN
    success := false;
    resolved_employer_data := NULL;
    unresolved_fields := NULL;
    resolution_log := jsonb_build_array(jsonb_build_object(
      'step', 'validation',
      'status', 'error',
      'message', 'Conflict not found or already resolved'
    ));
    RETURN NEXT;
    RETURN;
  END IF;

  -- Get the conflicting change records
  SELECT new_values INTO v_change_1_record
  FROM public.employer_change_audit
  WHERE id = v_conflict_record.conflicting_change_id_1;

  SELECT new_values INTO v_change_2_record
  FROM public.employer_change_audit
  WHERE id = v_conflict_record.conflicting_change_id_2;

  -- Get base record (current employer state)
  SELECT to_jsonb(e) INTO v_base_record
  FROM public.employers e
  WHERE e.id = v_conflict_record.employer_id;

  -- Initialize resolved data with base record
  v_resolved_data := v_base_record;

  -- Log start of resolution
  v_log_entry := jsonb_build_object(
    'step', 'init',
    'status', 'started',
    'strategy', p_resolution_strategy,
    'timestamp', now()
  );
  v_resolution_log := v_resolution_log || v_log_entry;

  -- Process each conflicting field
  FOR v_field_record IN
    SELECT element->>'field' as field_name,
           element->>'type' as conflict_type,
           element->>'severity' as severity,
           element->>'auto_resolvable' as auto_resolvable,
           element->>'value_1' as value_1,
           element->>'value_2' as value_2
    FROM jsonb_array_elements(v_conflict_record.conflicting_fields)
  LOOP
    v_log_entry := jsonb_build_object(
      'step', 'processing_field',
      'field', v_field_record.field_name,
      'conflict_type', v_field_record.conflict_type,
      'severity', v_field_record.severity,
      'auto_resolvable', v_field_record.auto_resolvable,
      'timestamp', now()
    );

    -- Skip non-auto-resolvable conflicts
    IF NOT (v_field_record.auto_resolvable)::boolean THEN
      v_unresolved_fields := v_unresolved_fields || jsonb_build_object(
        'field', v_field_record.field_name,
        'reason', 'manual_resolution_required',
        'value_1', v_field_record.value_1,
        'value_2', v_field_record.value_2
      );

      v_log_entry := v_log_entry || jsonb_build_object('action', 'skipped_manual_required');
      v_resolution_log := v_resolution_log || v_log_entry;
      CONTINUE;
    END IF;

    -- Apply resolution strategy
    CASE p_resolution_strategy
      WHEN 'prefer_latest' THEN
        -- Use value from the latest change
        IF v_conflict_record.conflicting_change_id_2 > v_conflict_record.conflicting_change_id_1 THEN
          v_resolved_data := jsonb_set(v_resolved_data, ARRAY[v_field_record.field_name], to_jsonb(v_field_record.value_2));
          v_log_entry := v_log_entry || jsonb_build_object('action', 'used_latest', 'value', v_field_record.value_2);
        ELSE
          v_resolved_data := jsonb_set(v_resolved_data, ARRAY[v_field_record.field_name], to_jsonb(v_field_record.value_1));
          v_log_entry := v_log_entry || jsonb_build_object('action', 'used_first', 'value', v_field_record.value_1);
        END IF;

      WHEN 'prefer_first' THEN
        -- Use value from the first change
        v_resolved_data := jsonb_set(v_resolved_data, ARRAY[v_field_record.field_name], to_jsonb(v_field_record.value_1));
        v_log_entry := v_log_entry || jsonb_build_object('action', 'used_first', 'value', v_field_record.value_1);

      WHEN 'merge_safe' THEN
        -- Use most complete non-null value
        CASE v_field_record.conflict_type
          WHEN 'data_presence' THEN
            -- Prefer non-null value
            IF v_field_record.value_1 IS NOT NULL AND v_field_record.value_1 <> '' THEN
              v_resolved_data := jsonb_set(v_resolved_data, ARRAY[v_field_record.field_name], to_jsonb(v_field_record.value_1));
              v_log_entry := v_log_entry || jsonb_build_object('action', 'used_non_null', 'value', v_field_record.value_1);
            ELSIF v_field_record.value_2 IS NOT NULL AND v_field_record.value_2 <> '' THEN
              v_resolved_data := jsonb_set(v_resolved_data, ARRAY[v_field_record.field_name], to_jsonb(v_field_record.value_2));
              v_log_entry := v_log_entry || jsonb_build_object('action', 'used_non_null', 'value', v_field_record.value_2);
            END IF;

          WHEN 'numeric_data' THEN
            -- Use maximum value for worker counts
            IF v_field_record.field_name = 'estimated_worker_count' THEN
              DECLARE
                v_val_1 integer := COALESCE(v_field_record.value_1::integer, 0);
                v_val_2 integer := COALESCE(v_field_record.value_2::integer, 0);
                v_max_val integer := GREATEST(v_val_1, v_val_2);
              BEGIN
                v_resolved_data := jsonb_set(v_resolved_data, ARRAY[v_field_record.field_name], to_jsonb(v_max_val));
                v_log_entry := v_log_entry || jsonb_build_object('action', 'used_maximum', 'value', v_max_val);
              END;
            END IF;

          ELSE
            -- Default to latest change
            IF v_conflict_record.conflicting_change_id_2 > v_conflict_record.conflicting_change_id_1 THEN
              v_resolved_data := jsonb_set(v_resolved_data, ARRAY[v_field_record.field_name], to_jsonb(v_field_record.value_2));
              v_log_entry := v_log_entry || jsonb_build_object('action', 'default_latest', 'value', v_field_record.value_2);
            ELSE
              v_resolved_data := jsonb_set(v_resolved_data, ARRAY[v_field_record.field_name], to_jsonb(v_field_record.value_1));
              v_log_entry := v_log_entry || jsonb_build_object('action', 'default_first', 'value', v_field_record.value_1);
            END IF;
        END CASE;
    END CASE;

    v_resolution_log := v_resolution_log || v_log_entry;
  END LOOP;

  -- Update conflict record
  UPDATE public.employer_change_conflicts
  SET
    resolution_status = CASE
      WHEN jsonb_array_length(v_unresolved_fields) = 0 THEN 'resolved'
      ELSE 'deferred'
    END,
    resolution_method = 'auto_resolve',
    resolved_by = auth.uid(),
    resolved_at = now(),
    resolved_values = v_resolved_data,
    updated_at = now()
  WHERE id = p_conflict_id;

  success := jsonb_array_length(v_unresolved_fields) = 0;
  resolved_employer_data := v_resolved_data;
  unresolved_fields := v_unresolved_fields;

  -- Log completion
  v_log_entry := jsonb_build_object(
    'step', 'complete',
    'status', CASE WHEN success THEN 'success' ELSE 'partial' END,
    'resolved_fields_count', jsonb_array_length(v_conflict_record.conflicting_fields) - jsonb_array_length(v_unresolved_fields),
    'unresolved_fields_count', jsonb_array_length(v_unresolved_fields),
    'timestamp', now()
  );
  v_resolution_log := v_resolution_log || v_log_entry;
  resolution_log := v_resolution_log;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to manually resolve conflicts with custom data
CREATE OR REPLACE FUNCTION public.manual_resolve_conflict(
  p_conflict_id uuid,
  p_resolved_data jsonb,
  p_resolution_notes text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  v_conflict_record record;
  v_current_version integer;
BEGIN
  -- Validate conflict exists and is pending
  SELECT * INTO v_conflict_record
  FROM public.employer_change_conflicts
  WHERE id = p_conflict_id AND resolution_status = 'pending';

  IF v_conflict_record IS NULL THEN
    RAISE EXCEPTION 'Conflict not found or already resolved: %', p_conflict_id;
  END IF;

  -- Get current employer version
  SELECT version INTO v_current_version
  FROM public.employers
  WHERE id = v_conflict_record.employer_id;

  IF v_current_version IS NULL THEN
    RAISE EXCEPTION 'Employer not found: %', v_conflict_record.employer_id;
  END IF;

  -- Apply resolved data to employer
  PERFORM public.update_employer_with_version(
    v_conflict_record.employer_id,
    v_current_version,
    p_resolved_data,
    jsonb_build_object('manual_conflict_resolution', true, 'conflict_id', p_conflict_id)
  );

  -- Update conflict record
  UPDATE public.employer_change_conflicts
  SET
    resolution_status = 'resolved',
    resolution_method = 'custom_merge',
    resolved_by = auth.uid(),
    resolved_at = now(),
    resolved_values = p_resolved_data,
    resolution_notes = p_resolution_notes,
    updated_at = now()
  WHERE id = p_conflict_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ===================================
-- 3. CONFLICT PREVENTION FUNCTIONS
-- ===================================

-- Function to check for potential conflicts before editing
CREATE OR REPLACE FUNCTION public.check_employer_editing_conflicts(
  p_employer_id uuid,
  p_expected_version integer DEFAULT NULL
)
RETURNS TABLE(
  can_edit boolean,
  conflict_risk text,
  active_editors jsonb,
  recent_changes jsonb,
  recommendations jsonb
) AS $$
DECLARE
  v_current_version integer;
  v_active_editors jsonb := '[]'::jsonb;
  v_recent_changes jsonb := '[]'::jsonb;
  v_conflict_risk text := 'low';
  v_can_edit boolean := true;
  v_recommendations jsonb := '[]'::jsonb;
BEGIN
  -- Get current employer state
  SELECT version INTO v_current_version
  FROM public.employers
  WHERE id = p_employer_id;

  IF v_current_version IS NULL THEN
    RAISE EXCEPTION 'Employer not found: %', p_employer_id;
  END IF;

  -- Check version if provided
  IF p_expected_version IS NOT NULL AND v_current_version <> p_expected_version THEN
    v_conflict_risk := 'high';
    v_can_edit := false;
    v_recommendations := v_recommendations || jsonb_build_object(
      'type', 'version_mismatch',
      'message', 'The employer has been updated since you loaded it',
      'action', 'refresh_data'
    );
  END IF;

  -- Check for active editors
  SELECT jsonb_agg(
    jsonb_build_object(
      'user_id', es.user_id,
      'session_started', es.session_started_at,
      'last_heartbeat', es.last_heartbeat,
      'client_session_id', es.client_session_id
    )
  ) INTO v_active_editors
  FROM public.employer_editing_sessions es
  WHERE es.employer_id = p_employer_id
    AND es.session_ended_at IS NULL
    AND es.user_id <> auth.uid()
    AND es.last_heartbeat > now() - interval '5 minutes';

  -- Check for recent changes by other users
  SELECT jsonb_agg(
    jsonb_build_object(
      'changed_by', a.changed_by,
      'changed_at', a.changed_at,
      'change_type', a.change_type,
      'changed_fields', a.changed_fields
    )
  ) INTO v_recent_changes
  FROM public.employer_change_audit a
  WHERE a.employer_id = p_employer_id
    AND a.changed_by <> auth.uid()
    AND a.changed_at > now() - interval '10 minutes'
  ORDER BY a.changed_at DESC
  LIMIT 5;

  -- Assess conflict risk
  IF jsonb_array_length(v_active_editors) > 0 THEN
    v_conflict_risk := 'high';
    v_recommendations := v_recommendations || jsonb_build_object(
      'type', 'active_editors',
      'message', format('%s other users are currently editing this employer', jsonb_array_length(v_active_editors)),
      'action', 'coordinate_with_team'
    );
  ELSIF jsonb_array_length(v_recent_changes) > 0 THEN
    v_conflict_risk := 'medium';
    v_recommendations := v_recommendations || jsonb_build_object(
      'type', 'recent_changes',
      'message', format('%s recent changes by other users detected', jsonb_array_length(v_recent_changes)),
      'action', 'review_recent_changes'
    );
  END IF;

  -- Return results
  can_edit := v_can_edit;
  conflict_risk := v_conflict_risk;
  active_editors := v_active_editors;
  recent_changes := v_recent_changes;
  recommendations := v_recommendations;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ===================================
-- 4. CONFLICT ANALYTICS FUNCTIONS
-- ===================================

-- Function to analyze conflict patterns
CREATE OR REPLACE FUNCTION public.analyze_conflict_patterns(
  p_start_date date DEFAULT CURRENT_DATE - interval '30 days',
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  conflict_type text,
  severity text,
  total_conflicts bigint,
  resolved_conflicts bigint,
  auto_resolved bigint,
  manual_resolved bigint,
  avg_resolution_time interval,
  most_conflicted_fields jsonb,
  most_active_users jsonb
) AS $$
BEGIN
  -- Analyze conflicts by type and severity
  RETURN QUERY
  WITH conflict_analysis AS (
    SELECT
      ec.conflict_severity,
      ec.resolution_status,
      ec.resolution_method,
      ec.conflicting_fields,
      ec.conflict_detected_at,
      ec.resolved_at,
      a1.changed_by as user_1,
      a2.changed_by as user_2
    FROM public.employer_change_conflicts ec
    JOIN public.employer_change_audit a1 ON ec.conflicting_change_id_1 = a1.id
    JOIN public.employer_change_audit a2 ON ec.conflicting_change_id_2 = a2.id
    WHERE ec.conflict_detected_at::date BETWEEN p_start_date AND p_end_date
  ),
  field_conflicts AS (
    SELECT
      element->>'field' as field_name,
      element->>'severity' as field_severity,
      count(*) as conflict_count
    FROM conflict_analysis ca, jsonb_array_elements(ca.conflicting_fields) as element
    GROUP BY element->>'field', element->>'severity'
  ),
  user_conflicts AS (
    SELECT
      COALESCE(user_1, user_2) as user_id,
      count(*) as conflict_count
    FROM conflict_analysis
    GROUP BY COALESCE(user_1, user_2)
  )
  SELECT
    'concurrent_editing' as conflict_type,
    ca.conflict_severity as severity,
    count(*) as total_conflicts,
    count(*) FILTER (WHERE ca.resolution_status = 'resolved') as resolved_conflicts,
    count(*) FILTER (WHERE ca.resolution_method = 'auto_resolve') as auto_resolved,
    count(*) FILTER (WHERE ca.resolution_method IN ('manual_merge', 'custom_merge')) as manual_resolved,
    avg(ca.resolved_at - ca.conflict_detected_at) as avg_resolution_time,
    (SELECT jsonb_agg(jsonb_build_object('field', fc.field_name, 'count', fc.conflict_count))
     FROM field_conflicts fc WHERE fc.field_severity = ca.conflict_severity
     ORDER BY fc.conflict_count DESC LIMIT 5) as most_conflicted_fields,
    (SELECT jsonb_agg(jsonb_build_object('user_id', uc.user_id, 'conflicts', uc.conflict_count))
     FROM user_conflicts uc
     ORDER BY uc.conflict_count DESC LIMIT 5) as most_active_users
  FROM conflict_analysis ca
  GROUP BY ca.conflict_severity;
END;
$$ LANGUAGE plpgsql;

-- ===================================
-- 5. CONFLICT NOTIFICATION TRIGGERS
-- ===================================

-- Function to automatically detect conflicts when changes occur
CREATE OR REPLACE FUNCTION public.auto_detect_conflicts_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Detect conflicts for new audit entries
  IF TG_OP = 'INSERT' THEN
    PERFORM public.detect_employer_conflicts_detailed(NEW.employer_id);
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic conflict detection
DROP TRIGGER IF EXISTS auto_detect_conflicts_trigger ON public.employer_change_audit;
CREATE TRIGGER auto_detect_conflicts_trigger
  AFTER INSERT ON public.employer_change_audit
  FOR EACH ROW EXECUTE FUNCTION public.auto_detect_conflicts_trigger();

-- ===================================
-- 6. MAINTENANCE FUNCTIONS
-- ===================================

-- Function to clean up old resolved conflicts
CREATE OR REPLACE FUNCTION public.cleanup_resolved_conflicts(
  p_days_to_keep integer DEFAULT 90
)
RETURNS integer AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM public.employer_change_conflicts
  WHERE resolution_status = 'resolved'
    AND resolved_at < now() - interval '1 day' * p_days_to_keep;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to detect and resolve simple conflicts automatically
CREATE OR REPLACE FUNCTION public.resolve_simple_conflicts()
RETURNS TABLE(
  conflicts_resolved integer,
  conflicts_deferred integer,
  processing_time interval
) AS $$
DECLARE
  v_start_time timestamptz := now();
  v_resolved integer := 0;
  v_deferred integer := 0;
  v_conflict record;
BEGIN
  -- Process conflicts that can be auto-resolved
  FOR v_conflict IN
    SELECT *
    FROM public.employer_change_conflicts
    WHERE resolution_status = 'pending'
      AND conflict_severity IN ('low', 'medium')
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(conflicting_fields) element
        WHERE element->>'auto_resolvable' = 'true'
      )
    ORDER BY conflict_detected_at ASC
    LIMIT 100  -- Process in batches
  LOOP
    -- Attempt auto-resolution
    IF (SELECT success FROM public.auto_resolve_conflicts(v_conflict.id, 'merge_safe')) THEN
      v_resolved := v_resolved + 1;
    ELSE
      v_deferred := v_deferred + 1;
    END IF;
  END LOOP;

  conflicts_resolved := v_resolved;
  conflicts_deferred := v_deferred;
  processing_time := now() - v_start_time;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ===================================
-- MIGRATION NOTES
-- ===================================
-- This migration creates sophisticated conflict detection and resolution:
-- 1. Field-level conflict detection with severity assessment
-- 2. Auto-resolution capabilities for safe conflicts
-- 3. Manual resolution workflows for complex conflicts
-- 4. Conflict prevention and risk assessment
-- 5. Analytics for pattern analysis and optimization
-- 6. Automated maintenance and cleanup functions
--
-- Key features:
-- - Detects conflicts at field level with auto-resolvability assessment
-- - Provides multiple resolution strategies (prefer latest, prefer first, merge safe)
-- - Analyzes conflict patterns and user behavior
-- - Automatic conflict detection triggers
-- - Comprehensive logging and audit trails
--
-- Next steps:
-- 1. Build API endpoints for conflict management
-- 2. Create real-time collaboration UI components
-- 3. Implement conflict resolution interfaces
-- 4. Add admin analytics dashboard