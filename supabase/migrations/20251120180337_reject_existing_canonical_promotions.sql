-- Reject all existing aliases in the canonical promotion queue
-- This preserves all aliases but marks them as rejected for canonical promotion
-- The current canonical names will remain unchanged
-- This should be run BEFORE the migration that adds mark_for_canonical_review

-- Insert reject records for all aliases currently in the promotion queue
-- Using a system rationale to explain this is a bulk operation
INSERT INTO public.employer_canonical_audit (
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
)
SELECT 
  cpq.employer_id,
  cpq.alias_id,
  'reject' as action,
  cpq.current_canonical_name as previous_canonical_name,
  cpq.proposed_name as proposed_canonical_name,
  'Bulk rejection: Alias promotion system updated to require explicit opt-in. Existing aliases remain connected but are not eligible for automatic promotion.' as decision_rationale,
  NULL as decided_by, -- System action, no specific user
  cpq.is_authoritative,
  cpq.source_system,
  COALESCE(cpq.conflict_warnings, '[]'::jsonb) as conflict_warnings
FROM public.canonical_promotion_queue cpq
WHERE NOT EXISTS (
  -- Only insert if not already rejected
  SELECT 1
  FROM public.employer_canonical_audit eca
  WHERE eca.employer_id = cpq.employer_id
    AND eca.alias_id = cpq.alias_id
    AND eca.action = 'reject'
);

-- Log the number of rejections
DO $$
DECLARE
  v_rejected_count integer;
BEGIN
  SELECT COUNT(*) INTO v_rejected_count
  FROM public.employer_canonical_audit
  WHERE decision_rationale LIKE 'Bulk rejection: Alias promotion system updated%';
  
  RAISE LOG 'Bulk canonical promotion rejection: % aliases rejected', v_rejected_count;
END $$;

-- Note: This migration rejects all existing aliases in the canonical promotion queue.
-- This preserves all aliases but marks them as rejected for promotion, ensuring 
-- current canonical names remain unchanged. Run this BEFORE the migration that 
-- adds mark_for_canonical_review (20251120180336_add_canonical_review_flag.sql).

