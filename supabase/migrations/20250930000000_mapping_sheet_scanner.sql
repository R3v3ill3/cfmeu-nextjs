-- ============================================================================
-- Mapping Sheet Scanner: Database Schema
-- ============================================================================

-- Create scraper_jobs table if it doesn't exist
-- This table manages async job processing for workers
CREATE TABLE IF NOT EXISTS scraper_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Execution tracking
  attempts INTEGER DEFAULT 0 NOT NULL,
  max_attempts INTEGER DEFAULT 3 NOT NULL,
  run_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- Locking for worker coordination
  locked_at TIMESTAMPTZ,
  lock_token TEXT,
  
  -- Progress tracking
  progress_completed INTEGER DEFAULT 0,
  progress_total INTEGER DEFAULT 0,
  
  -- Error handling
  last_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ,
  
  CONSTRAINT valid_job_status CHECK (status IN ('queued', 'processing', 'succeeded', 'failed'))
);

-- Index for job polling
CREATE INDEX IF NOT EXISTS idx_scraper_jobs_status_run_at 
  ON scraper_jobs(status, run_at) 
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_scraper_jobs_job_type 
  ON scraper_jobs(job_type);

-- RLS for scraper_jobs
ALTER TABLE scraper_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can create jobs"
  ON scraper_jobs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can view their own jobs or all if admin"
  ON scraper_jobs FOR SELECT
  USING (
    auth.role() = 'authenticated'
  );

-- Function to reserve next available job (for workers)
CREATE OR REPLACE FUNCTION reserve_scraper_job(
  p_job_type TEXT,
  p_lock_token TEXT,
  p_now TIMESTAMPTZ
)
RETURNS scraper_jobs AS $$
DECLARE
  v_job scraper_jobs;
BEGIN
  -- Find and lock next available job
  SELECT * INTO v_job
  FROM scraper_jobs
  WHERE status = 'queued'
    AND job_type = p_job_type
    AND run_at <= p_now
    AND (locked_at IS NULL OR locked_at < (p_now - INTERVAL '5 minutes'))
  ORDER BY run_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  IF v_job.id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Update job to processing with lock
  UPDATE scraper_jobs
  SET 
    status = 'processing',
    locked_at = p_now,
    lock_token = p_lock_token,
    attempts = attempts + 1,
    updated_at = p_now
  WHERE id = v_job.id;
  
  -- Return updated job
  SELECT * INTO v_job FROM scraper_jobs WHERE id = v_job.id;
  RETURN v_job;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Main table for tracking scanned mapping sheets
CREATE TABLE mapping_sheet_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  
  -- File storage
  file_url TEXT NOT NULL, -- Supabase Storage path
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  page_count INTEGER,
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending', 
  -- States: 'pending' -> 'processing' -> 'completed' -> 'under_review' -> 'confirmed' | 'rejected' | 'failed'
  
  -- AI extraction results
  extracted_data JSONB,
  confidence_scores JSONB,
  ai_provider TEXT, -- 'claude' or 'openai'
  extraction_attempted_at TIMESTAMPTZ,
  extraction_completed_at TIMESTAMPTZ,
  extraction_cost_usd DECIMAL(10, 6), -- Track cost per scan
  
  -- User review tracking
  review_started_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES auth.users(id),
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- User notes
  notes TEXT,
  
  CONSTRAINT valid_status CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 
    'under_review', 'confirmed', 'rejected'
  )),
  CONSTRAINT valid_ai_provider CHECK (ai_provider IS NULL OR ai_provider IN ('claude', 'openai'))
);

-- Employer matching decisions from scans
CREATE TABLE mapping_sheet_scan_employer_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES mapping_sheet_scans(id) ON DELETE CASCADE,
  
  -- Extracted company info
  extracted_company_name TEXT NOT NULL,
  extracted_role TEXT, -- 'builder', 'contractor_role', 'trade_contractor'
  extracted_trade_type TEXT,
  extracted_eba_status BOOLEAN,
  
  -- Fuzzy matching results
  matched_employer_id UUID REFERENCES employers(id),
  match_confidence DECIMAL(3,2),
  match_method TEXT, -- 'exact', 'fuzzy', 'manual', 'new_employer'
  alternate_matches JSONB, -- Array of other possible matches
  
  -- User decision
  user_confirmed BOOLEAN DEFAULT false,
  confirmed_employer_id UUID REFERENCES employers(id),
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES auth.users(id),
  
  -- For new employers
  create_new_employer BOOLEAN DEFAULT false,
  new_employer_data JSONB,
  created_employer_id UUID REFERENCES employers(id),
  
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  CONSTRAINT valid_match_confidence CHECK (
    match_confidence IS NULL OR 
    (match_confidence >= 0 AND match_confidence <= 1)
  )
);

-- Cost tracking table
CREATE TABLE mapping_sheet_scan_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES mapping_sheet_scans(id) ON DELETE SET NULL,
  
  -- API usage
  ai_provider TEXT NOT NULL, -- 'claude' or 'openai'
  model TEXT NOT NULL, -- e.g., 'claude-3-5-sonnet-20241022'
  
  -- Token/image usage
  input_tokens INTEGER,
  output_tokens INTEGER,
  images_processed INTEGER,
  
  -- Cost calculation
  cost_usd DECIMAL(10, 6) NOT NULL,
  
  -- Timing
  processing_time_ms INTEGER,
  
  -- Context
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  CONSTRAINT valid_ai_provider CHECK (ai_provider IN ('claude', 'openai'))
);

-- Indexes
CREATE INDEX idx_mapping_sheet_scans_project_id ON mapping_sheet_scans(project_id);
CREATE INDEX idx_mapping_sheet_scans_status ON mapping_sheet_scans(status);
CREATE INDEX idx_mapping_sheet_scans_uploaded_by ON mapping_sheet_scans(uploaded_by);
CREATE INDEX idx_scan_employer_matches_scan_id ON mapping_sheet_scan_employer_matches(scan_id);
CREATE INDEX idx_scan_costs_scan_id ON mapping_sheet_scan_costs(scan_id);
CREATE INDEX idx_scan_costs_created_at ON mapping_sheet_scan_costs(created_at);

-- RLS Policies
ALTER TABLE mapping_sheet_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE mapping_sheet_scan_employer_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE mapping_sheet_scan_costs ENABLE ROW LEVEL SECURITY;

-- Scans: Users can view scans for projects they can access
CREATE POLICY "Users can view scans for accessible projects"
  ON mapping_sheet_scans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = mapping_sheet_scans.project_id
    )
  );

CREATE POLICY "Authenticated users can create scans"
  ON mapping_sheet_scans FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can update scans they created or are reviewing"
  ON mapping_sheet_scans FOR UPDATE
  USING (
    auth.uid() = uploaded_by OR 
    auth.uid() = reviewed_by OR
    get_user_role(auth.uid()) = ANY (ARRAY['admin', 'organiser'])
  );

-- Employer matches: Inherit access from scan
CREATE POLICY "Users can view employer matches for accessible scans"
  ON mapping_sheet_scan_employer_matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM mapping_sheet_scans s
      WHERE s.id = mapping_sheet_scan_employer_matches.scan_id
    )
  );

CREATE POLICY "Users can manage employer matches for scans they access"
  ON mapping_sheet_scan_employer_matches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mapping_sheet_scans s
      WHERE s.id = mapping_sheet_scan_employer_matches.scan_id
      AND (auth.uid() = s.uploaded_by OR auth.uid() = s.reviewed_by)
    )
  );

-- Costs: Admin and user can view their own costs
CREATE POLICY "Users can view their own scan costs"
  ON mapping_sheet_scan_costs FOR SELECT
  USING (
    auth.uid() = user_id OR
    get_user_role(auth.uid()) = 'admin'
  );

-- Function to check if project has pending scan
CREATE OR REPLACE FUNCTION project_has_pending_scan(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM mapping_sheet_scans
    WHERE project_id = p_project_id
    AND status IN ('pending', 'processing', 'under_review')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mapping_sheet_scans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mapping_sheet_scans_updated_at
  BEFORE UPDATE ON mapping_sheet_scans
  FOR EACH ROW
  EXECUTE FUNCTION update_mapping_sheet_scans_updated_at();

-- Storage bucket for scanned PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('mapping-sheet-scans', 'mapping-sheet-scans', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload scanned sheets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'mapping-sheet-scans' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can view scanned sheets"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'mapping-sheet-scans' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own scanned sheets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'mapping-sheet-scans' AND
    auth.role() = 'authenticated'
  );

-- Add comment
COMMENT ON TABLE mapping_sheet_scans IS 'Tracks scanned handwritten mapping sheets processed by AI';
COMMENT ON TABLE mapping_sheet_scan_costs IS 'Tracks AI API costs for mapping sheet scanning';
