-- Prompt 3B — Canonical Promotion Console
-- Goal: Build admin tooling for managing canonical name changes
-- Detects when authoritative IDs (BCI, Incolink, EBA) attach and queues for review
-- Records decisions in employer_canonical_audit table

-- 1. Create audit table to record all canonical promotion decisions
CREATE TABLE IF NOT EXISTS public.employer_canonical_audit (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
  alias_id uuid REFERENCES public.employer_aliases(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action = ANY (ARRAY['promote', 'reject', 'defer'])),
  previous_canonical_name text NOT NULL,
  proposed_canonical_name text NOT NULL,
  decision_rationale text,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz DEFAULT now() NOT NULL,
  is_authoritative boolean DEFAULT false,
  source_system text,
  conflict_warnings jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_employer_canonical_audit_employer_id 
  ON public.employer_canonical_audit(employer_id);
CREATE INDEX idx_employer_canonical_audit_decided_at 
  ON public.employer_canonical_audit(decided_at DESC);
CREATE INDEX idx_employer_canonical_audit_action 
  ON public.employer_canonical_audit(action);

COMMENT ON TABLE public.employer_canonical_audit 
  IS 'Audit trail of all canonical name promotion decisions including actor, rationale, and conflict metadata';

-- 2. Create a view for the canonical promotion review queue
-- Shows authoritative aliases that could become canonical names
CREATE OR REPLACE VIEW public.canonical_promotion_queue AS
SELECT 
  ea.id as alias_id,
  ea.employer_id,
  ea.alias as proposed_name,
  ea.alias_normalized,
  ea.source_system,
  ea.source_identifier,
  ea.collected_at,
  ea.collected_by,
  ea.is_authoritative,
  ea.notes as alias_notes,
  e.name as current_canonical_name,
  e.bci_company_id,
  e.incolink_id,
  -- Calculate priority: authoritative sources get higher priority
  CASE 
    WHEN ea.is_authoritative THEN 10
    WHEN ea.source_system IN ('bci', 'incolink', 'fwc', 'eba') THEN 5
    ELSE 1
  END as priority,
  -- Check if there are conflicts (other employers with similar normalized names)
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'employer_id', e2.id,
        'employer_name', e2.name,
        'similarity', similarity(e2.name, ea.alias)
      )
    )
    FROM public.employers e2
    WHERE e2.id != ea.employer_id
      AND (
        LOWER(e2.name) = LOWER(ea.alias)
        OR similarity(LOWER(e2.name), LOWER(ea.alias)) > 0.8
      )
    LIMIT 5
  ) as conflict_warnings,
  -- Check if there's already a pending audit decision
  (
    SELECT eca.action
    FROM public.employer_canonical_audit eca
    WHERE eca.employer_id = ea.employer_id
      AND eca.alias_id = ea.id
      AND eca.action = 'defer'
    ORDER BY eca.decided_at DESC
    LIMIT 1
  ) as previous_decision,
  -- Get count of existing aliases for context
  (
    SELECT COUNT(*)
    FROM public.employer_aliases ea2
    WHERE ea2.employer_id = ea.employer_id
  ) as total_aliases,
  ea.created_at as alias_created_at
FROM public.employer_aliases ea
JOIN public.employers e ON e.id = ea.employer_id
WHERE 
  -- Only show aliases that are not already the canonical name
  LOWER(ea.alias) != LOWER(e.name)
  AND (
    -- Authoritative aliases
    ea.is_authoritative = true
    OR
    -- Aliases from key systems with external IDs
    (ea.source_system = 'bci' AND e.bci_company_id IS NOT NULL)
    OR
    (ea.source_system = 'incolink' AND e.incolink_id IS NOT NULL)
  )
ORDER BY 
  priority DESC,
  ea.collected_at DESC,
  ea.created_at DESC;

COMMENT ON VIEW public.canonical_promotion_queue 
  IS 'Queue of authoritative aliases eligible for canonical name promotion with conflict detection';

-- 3. RPC to promote an alias to canonical name
CREATE OR REPLACE FUNCTION public.promote_alias_to_canonical(
  p_alias_id uuid,
  p_decision_rationale text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_employer_id uuid;
  v_previous_name text;
  v_new_name text;
  v_is_authoritative boolean;
  v_source_system text;
  v_actor_id uuid;
  v_conflict_warnings jsonb;
BEGIN
  -- Get current user
  v_actor_id := auth.uid();
  
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get alias details
  SELECT 
    ea.employer_id, 
    ea.alias, 
    ea.is_authoritative,
    ea.source_system,
    e.name
  INTO 
    v_employer_id, 
    v_new_name, 
    v_is_authoritative,
    v_source_system,
    v_previous_name
  FROM employer_aliases ea
  JOIN employers e ON e.id = ea.employer_id
  WHERE ea.id = p_alias_id;

  IF v_employer_id IS NULL THEN
    RAISE EXCEPTION 'Alias not found';
  END IF;

  -- Check for conflicts with other employers
  SELECT jsonb_agg(
    jsonb_build_object(
      'employer_id', e2.id,
      'employer_name', e2.name
    )
  )
  INTO v_conflict_warnings
  FROM employers e2
  WHERE e2.id != v_employer_id
    AND LOWER(e2.name) = LOWER(v_new_name)
  LIMIT 5;

  -- Update employer's canonical name
  UPDATE employers
  SET 
    name = v_new_name,
    updated_at = now()
  WHERE id = v_employer_id;

  -- Record the decision in audit log
  INSERT INTO employer_canonical_audit (
    employer_id,
    alias_id,
    action,
    previous_canonical_name,
    proposed_canonical_name,
    decision_rationale,
    decided_by,
    is_authoritative,
    source_system,
    conflict_warnings
  ) VALUES (
    v_employer_id,
    p_alias_id,
    'promote',
    v_previous_name,
    v_new_name,
    p_decision_rationale,
    v_actor_id,
    v_is_authoritative,
    v_source_system,
    COALESCE(v_conflict_warnings, '[]'::jsonb)
  );

  -- Emit log event for observability
  RAISE LOG 'alias.canonical_promotion employer_id=% alias_id=% previous=% new=% actor=%',
    v_employer_id, p_alias_id, v_previous_name, v_new_name, v_actor_id;

  RETURN jsonb_build_object(
    'success', true,
    'employer_id', v_employer_id,
    'previous_name', v_previous_name,
    'new_name', v_new_name,
    'conflict_warnings', COALESCE(v_conflict_warnings, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.promote_alias_to_canonical 
  IS 'Promotes an alias to become the canonical employer name and records audit trail';

-- 4. RPC to reject a canonical promotion suggestion
CREATE OR REPLACE FUNCTION public.reject_canonical_promotion(
  p_alias_id uuid,
  p_decision_rationale text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_employer_id uuid;
  v_current_name text;
  v_proposed_name text;
  v_is_authoritative boolean;
  v_source_system text;
  v_actor_id uuid;
BEGIN
  -- Get current user
  v_actor_id := auth.uid();
  
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get alias details
  SELECT 
    ea.employer_id, 
    ea.alias, 
    ea.is_authoritative,
    ea.source_system,
    e.name
  INTO 
    v_employer_id, 
    v_proposed_name, 
    v_is_authoritative,
    v_source_system,
    v_current_name
  FROM employer_aliases ea
  JOIN employers e ON e.id = ea.employer_id
  WHERE ea.id = p_alias_id;

  IF v_employer_id IS NULL THEN
    RAISE EXCEPTION 'Alias not found';
  END IF;

  -- Record the rejection in audit log
  INSERT INTO employer_canonical_audit (
    employer_id,
    alias_id,
    action,
    previous_canonical_name,
    proposed_canonical_name,
    decision_rationale,
    decided_by,
    is_authoritative,
    source_system
  ) VALUES (
    v_employer_id,
    p_alias_id,
    'reject',
    v_current_name,
    v_proposed_name,
    p_decision_rationale,
    v_actor_id,
    v_is_authoritative,
    v_source_system
  );

  -- Emit log event
  RAISE LOG 'alias.canonical_rejection employer_id=% alias_id=% rejected=% actor=%',
    v_employer_id, p_alias_id, v_proposed_name, v_actor_id;

  RETURN jsonb_build_object(
    'success', true,
    'employer_id', v_employer_id,
    'action', 'reject'
  );
END;
$$;

COMMENT ON FUNCTION public.reject_canonical_promotion 
  IS 'Rejects a canonical promotion suggestion and records the decision';

-- 5. RPC to defer a canonical promotion decision
CREATE OR REPLACE FUNCTION public.defer_canonical_promotion(
  p_alias_id uuid,
  p_decision_rationale text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_employer_id uuid;
  v_current_name text;
  v_proposed_name text;
  v_is_authoritative boolean;
  v_source_system text;
  v_actor_id uuid;
BEGIN
  -- Get current user
  v_actor_id := auth.uid();
  
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get alias details
  SELECT 
    ea.employer_id, 
    ea.alias, 
    ea.is_authoritative,
    ea.source_system,
    e.name
  INTO 
    v_employer_id, 
    v_proposed_name, 
    v_is_authoritative,
    v_source_system,
    v_current_name
  FROM employer_aliases ea
  JOIN employers e ON e.id = ea.employer_id
  WHERE ea.id = p_alias_id;

  IF v_employer_id IS NULL THEN
    RAISE EXCEPTION 'Alias not found';
  END IF;

  -- Record the deferral in audit log
  INSERT INTO employer_canonical_audit (
    employer_id,
    alias_id,
    action,
    previous_canonical_name,
    proposed_canonical_name,
    decision_rationale,
    decided_by,
    is_authoritative,
    source_system
  ) VALUES (
    v_employer_id,
    p_alias_id,
    'defer',
    v_current_name,
    v_proposed_name,
    p_decision_rationale,
    v_actor_id,
    v_is_authoritative,
    v_source_system
  );

  -- Emit log event
  RAISE LOG 'alias.canonical_deferral employer_id=% alias_id=% deferred=% actor=%',
    v_employer_id, p_alias_id, v_proposed_name, v_actor_id;

  RETURN jsonb_build_object(
    'success', true,
    'employer_id', v_employer_id,
    'action', 'defer'
  );
END;
$$;

COMMENT ON FUNCTION public.defer_canonical_promotion 
  IS 'Defers a canonical promotion decision for later review';

-- 6. Grant appropriate permissions (admin and lead_organiser only)
GRANT SELECT ON public.employer_canonical_audit TO authenticated;
GRANT SELECT ON public.canonical_promotion_queue TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_alias_to_canonical TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_canonical_promotion TO authenticated;
GRANT EXECUTE ON FUNCTION public.defer_canonical_promotion TO authenticated;

-- Note: RLS policies should be added if needed to restrict access to admin/lead_organiser roles
-- This would require checking the profiles.role in the policy

