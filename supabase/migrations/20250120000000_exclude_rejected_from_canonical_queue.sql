-- Exclude rejected and deferred items from canonical_promotion_queue view
-- Rejected items should not appear in the queue since rejection is final
-- Deferred items are also excluded - they can be reviewed later by checking audit history

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
  -- Exclude aliases that have been rejected (rejection is final)
  AND NOT EXISTS (
    SELECT 1
    FROM public.employer_canonical_audit eca
    WHERE eca.employer_id = ea.employer_id
      AND eca.alias_id = ea.id
      AND eca.action = 'reject'
  )
  -- Exclude aliases that have been deferred (deferred items are removed from queue)
  AND NOT EXISTS (
    SELECT 1
    FROM public.employer_canonical_audit eca
    WHERE eca.employer_id = ea.employer_id
      AND eca.alias_id = ea.id
      AND eca.action = 'defer'
  )
ORDER BY 
  priority DESC,
  ea.collected_at DESC,
  ea.created_at DESC;

COMMENT ON VIEW public.canonical_promotion_queue 
  IS 'Queue of authoritative aliases eligible for canonical name promotion with conflict detection. Excludes rejected and deferred items.';

