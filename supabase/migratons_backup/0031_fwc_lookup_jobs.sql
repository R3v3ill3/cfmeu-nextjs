-- Create tables for FWC lookup job management and persistence

-- FWC lookup jobs table
CREATE TABLE IF NOT EXISTS public.fwc_lookup_jobs (
    id TEXT PRIMARY KEY,
    employer_ids UUID[] NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    progress_completed INTEGER NOT NULL DEFAULT 0,
    progress_total INTEGER NOT NULL,
    current_employer TEXT,
    batch_size INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    estimated_duration INTEGER, -- in seconds
    options JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FWC lookup results table
CREATE TABLE IF NOT EXISTS public.fwc_lookup_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id TEXT NOT NULL REFERENCES public.fwc_lookup_jobs(id) ON DELETE CASCADE,
    employer_id UUID NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    employer_name TEXT NOT NULL,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    fwc_results JSONB DEFAULT '[]', -- Array of FWCSearchResult objects
    selected_result JSONB, -- The selected FWCSearchResult object
    processing_time INTEGER NOT NULL, -- in milliseconds
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fwc_lookup_jobs_status ON public.fwc_lookup_jobs(status);
CREATE INDEX IF NOT EXISTS idx_fwc_lookup_jobs_created_at ON public.fwc_lookup_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_fwc_lookup_jobs_priority ON public.fwc_lookup_jobs(priority);
CREATE INDEX IF NOT EXISTS idx_fwc_lookup_results_job_id ON public.fwc_lookup_results(job_id);
CREATE INDEX IF NOT EXISTS idx_fwc_lookup_results_employer_id ON public.fwc_lookup_results(employer_id);
CREATE INDEX IF NOT EXISTS idx_fwc_lookup_results_success ON public.fwc_lookup_results(success);

-- Update trigger for jobs table
CREATE OR REPLACE FUNCTION update_fwc_lookup_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_fwc_lookup_jobs_updated_at
    BEFORE UPDATE ON public.fwc_lookup_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_fwc_lookup_jobs_updated_at();

-- RLS Policies
ALTER TABLE public.fwc_lookup_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fwc_lookup_results ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage FWC lookup jobs
CREATE POLICY "Users can manage FWC lookup jobs" ON public.fwc_lookup_jobs
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view FWC lookup results" ON public.fwc_lookup_results
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert FWC lookup results" ON public.fwc_lookup_results
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update FWC lookup results" ON public.fwc_lookup_results
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Grant permissions
GRANT ALL ON public.fwc_lookup_jobs TO authenticated, service_role;
GRANT ALL ON public.fwc_lookup_results TO authenticated, service_role;

-- Comments for documentation
COMMENT ON TABLE public.fwc_lookup_jobs IS 'Background jobs for FWC document lookup processing';
COMMENT ON TABLE public.fwc_lookup_results IS 'Results from FWC lookup jobs for individual employers';
COMMENT ON COLUMN public.fwc_lookup_jobs.employer_ids IS 'Array of employer UUIDs to process';
COMMENT ON COLUMN public.fwc_lookup_jobs.options IS 'Job configuration options (skipExisting, autoSelectBest, etc.)';
COMMENT ON COLUMN public.fwc_lookup_results.fwc_results IS 'Array of FWC search results for this employer';
COMMENT ON COLUMN public.fwc_lookup_results.selected_result IS 'The FWC result that was selected/applied to the employer';
COMMENT ON COLUMN public.fwc_lookup_results.processing_time IS 'Time taken to process this employer in milliseconds';
