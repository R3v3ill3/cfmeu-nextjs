-- Add bci_company_id to employers table
ALTER TABLE public.employers
ADD COLUMN bci_company_id TEXT;

-- Add bci_company_id to pending_employers table
ALTER TABLE public.pending_employers
ADD COLUMN bci_company_id TEXT;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_employers_bci_company_id ON public.employers(bci_company_id);
CREATE INDEX IF NOT EXISTS idx_pending_employers_bci_company_id ON public.pending_employers(bci_company_id);

-- Note: projects.bci_project_id already exists, so no need to add it