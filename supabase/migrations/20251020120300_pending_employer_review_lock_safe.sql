-- Pending Employer Review Enhancements (Lock-Safe Version)
-- This migration uses conditional DDL to avoid lock timeouts

-- Set a reasonable lock timeout
SET lock_timeout = '5s';

-- ==========================================
-- 1. Add columns one at a time with existence checks
-- ==========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='employers' AND column_name='merged_from_pending_ids'
  ) THEN
    ALTER TABLE employers ADD COLUMN merged_from_pending_ids uuid[] DEFAULT '{}';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='employers' AND column_name='auto_merged'
  ) THEN
    ALTER TABLE employers ADD COLUMN auto_merged boolean DEFAULT false;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='employers' AND column_name='review_notes'
  ) THEN
    ALTER TABLE employers ADD COLUMN review_notes text;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='employers' AND column_name='last_reviewed_at'
  ) THEN
    ALTER TABLE employers ADD COLUMN last_reviewed_at timestamptz;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='employers' AND column_name='last_reviewed_by'
  ) THEN
    ALTER TABLE employers ADD COLUMN last_reviewed_by uuid REFERENCES auth.users(id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='employers' AND column_name='currently_reviewed_by'
  ) THEN
    ALTER TABLE employers ADD COLUMN currently_reviewed_by uuid REFERENCES auth.users(id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='employers' AND column_name='review_started_at'
  ) THEN
    ALTER TABLE employers ADD COLUMN review_started_at timestamptz;
  END IF;
END$$;

-- ==========================================
-- 2. Create indexes
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_employers_merged_from_pending 
  ON employers USING GIN(merged_from_pending_ids);

CREATE INDEX IF NOT EXISTS idx_employers_auto_merged 
  ON employers(auto_merged) WHERE auto_merged = true;

CREATE INDEX IF NOT EXISTS idx_employers_under_review 
  ON employers(currently_reviewed_by) WHERE currently_reviewed_by IS NOT NULL;

-- ==========================================
-- 3. Create merge log table
-- ==========================================

CREATE TABLE IF NOT EXISTS pending_employer_merge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_employer_id uuid REFERENCES employers(id) ON DELETE SET NULL,
  merged_employer_ids uuid[] NOT NULL,
  similarity_scores jsonb DEFAULT '{}',
  conflict_resolutions jsonb DEFAULT '{}',
  merged_by uuid REFERENCES auth.users(id),
  merged_at timestamptz DEFAULT now(),
  undone_at timestamptz,
  undone_by uuid REFERENCES auth.users(id),
  undo_reason text,
  created_at timestamptz DEFAULT now()
);

-- RLS for merge log
ALTER TABLE pending_employer_merge_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins can view merge log"
    ON pending_employer_merge_log FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'lead_organiser')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can insert merge log"
    ON pending_employer_merge_log FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'lead_organiser')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can update merge log"
    ON pending_employer_merge_log FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'lead_organiser')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT, UPDATE ON pending_employer_merge_log TO authenticated;

CREATE INDEX IF NOT EXISTS idx_merge_log_canonical ON pending_employer_merge_log(canonical_employer_id);
CREATE INDEX IF NOT EXISTS idx_merge_log_merged_at ON pending_employer_merge_log(merged_at DESC);
CREATE INDEX IF NOT EXISTS idx_merge_log_undone ON pending_employer_merge_log(undone_at) WHERE undone_at IS NOT NULL;

COMMENT ON TABLE pending_employer_merge_log IS 'Audit trail for pending employer merge operations with undo capability';

-- ==========================================
-- 4. Helper Functions
-- ==========================================

CREATE OR REPLACE FUNCTION levenshtein_distance(s1 text, s2 text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s1_len integer := length(s1);
  s2_len integer := length(s2);
  cost integer;
  d integer[][];
  i integer;
  j integer;
BEGIN
  IF s1_len = 0 THEN RETURN s2_len; END IF;
  IF s2_len = 0 THEN RETURN s1_len; END IF;
  
  FOR i IN 0..s1_len LOOP
    d[i][0] := i;
  END LOOP;
  
  FOR j IN 0..s2_len LOOP
    d[0][j] := j;
  END LOOP;
  
  FOR i IN 1..s1_len LOOP
    FOR j IN 1..s2_len LOOP
      IF substring(s1, i, 1) = substring(s2, j, 1) THEN
        cost := 0;
      ELSE
        cost := 1;
      END IF;
      
      d[i][j] := LEAST(
        d[i-1][j] + 1,
        d[i][j-1] + 1,
        d[i-1][j-1] + cost
      );
    END LOOP;
  END LOOP;
  
  RETURN d[s1_len][s2_len];
END;
$$;

CREATE OR REPLACE FUNCTION normalize_employer_name(input_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN lower(regexp_replace(
    regexp_replace(
      regexp_replace(input_name, '\s+(pty|ltd|limited|inc|corporation|corp)\s*$', '', 'gi'),
      '[^a-z0-9\s]', '', 'g'
    ),
    '\s+', ' ', 'g'
  ));
END;
$$;

-- Note: The rest of the RPC functions (find_duplicate_pending_employers, merge_pending_employers, 
-- undo_pending_employer_merge, array_remove_elements, release_stale_review_locks) 
-- will be added in a follow-up migration to keep this one focused on schema changes.

-- Reset lock timeout
RESET lock_timeout;

