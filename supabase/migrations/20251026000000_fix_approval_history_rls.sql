-- Fix approval_history RLS - add missing INSERT policy
-- The table has RLS enabled but only SELECT policies, blocking direct inserts

-- Allow admins and lead_organisers to insert approval history
CREATE POLICY "Admins can insert approval history"
  ON approval_history FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'lead_organiser')
  );

-- Also add UPDATE policy for completeness (in case we need to fix records)
CREATE POLICY "Admins can update approval history"
  ON approval_history FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'lead_organiser')
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'lead_organiser')
  );

COMMENT ON POLICY "Admins can insert approval history" ON approval_history IS
  'Allows admins and lead_organisers to insert approval history records from application code';

COMMENT ON POLICY "Admins can update approval history" ON approval_history IS
  'Allows admins and lead_organisers to update approval history records if needed';
