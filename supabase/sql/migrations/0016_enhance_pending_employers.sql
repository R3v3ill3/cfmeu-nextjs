-- Enhance pending_employers table to store trade type information
-- and project associations for proper import handling

-- Add new columns to pending_employers
ALTER TABLE public.pending_employers 
ADD COLUMN IF NOT EXISTS inferred_trade_type text,
ADD COLUMN IF NOT EXISTS our_role text CHECK (our_role IN ('builder', 'head_contractor', 'subcontractor')),
ADD COLUMN IF NOT EXISTS project_associations jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS user_confirmed_trade_type text,
ADD COLUMN IF NOT EXISTS import_status text DEFAULT 'pending' CHECK (import_status IN ('pending', 'imported', 'skipped', 'error')),
ADD COLUMN IF NOT EXISTS imported_employer_id uuid REFERENCES public.employers(id),
ADD COLUMN IF NOT EXISTS import_notes text,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_pending_employers_import_status 
  ON public.pending_employers(import_status);
CREATE INDEX IF NOT EXISTS idx_pending_employers_our_role 
  ON public.pending_employers(our_role);
CREATE INDEX IF NOT EXISTS idx_pending_employers_inferred_trade_type 
  ON public.pending_employers(inferred_trade_type);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_pending_employers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pending_employers_updated_at
    BEFORE UPDATE ON public.pending_employers
    FOR EACH ROW
    EXECUTE FUNCTION update_pending_employers_updated_at();

-- Add helper function to validate trade types against enum
CREATE OR REPLACE FUNCTION validate_trade_type(trade_type_value text)
RETURNS boolean AS $$
BEGIN
    RETURN trade_type_value::public.trade_type IS NOT NULL;
EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the validation function
GRANT EXECUTE ON FUNCTION validate_trade_type(text) TO authenticated, service_role;

-- Add comments for documentation
COMMENT ON COLUMN public.pending_employers.inferred_trade_type IS 'Trade type inferred from CSV role using inferTradeTypeFromCsvRole()';
COMMENT ON COLUMN public.pending_employers.our_role IS 'Role classification: builder, head_contractor, or subcontractor';
COMMENT ON COLUMN public.pending_employers.project_associations IS 'Array of project IDs this employer should be linked to: [{"project_id": "uuid", "project_name": "string", "csv_role": "string"}]';
COMMENT ON COLUMN public.pending_employers.user_confirmed_trade_type IS 'Trade type confirmed/modified by user during import review';
COMMENT ON COLUMN public.pending_employers.import_status IS 'Current import status: pending, imported, skipped, error';
COMMENT ON COLUMN public.pending_employers.imported_employer_id IS 'ID of created employer record after successful import';
COMMENT ON COLUMN public.pending_employers.import_notes IS 'Notes about import process, errors, or user decisions';
