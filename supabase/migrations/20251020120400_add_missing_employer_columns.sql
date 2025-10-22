-- Add missing employer columns that failed to apply due to lock timeout
-- These columns are required by the pending employer review system

-- Add columns one at a time to minimize lock duration
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employers' AND column_name='merged_from_pending_ids') THEN
    ALTER TABLE employers ADD COLUMN merged_from_pending_ids uuid[] DEFAULT '{}';
    RAISE NOTICE 'Added merged_from_pending_ids column';
  ELSE
    RAISE NOTICE 'Column merged_from_pending_ids already exists';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employers' AND column_name='auto_merged') THEN
    ALTER TABLE employers ADD COLUMN auto_merged boolean DEFAULT false;
    RAISE NOTICE 'Added auto_merged column';
  ELSE
    RAISE NOTICE 'Column auto_merged already exists';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employers' AND column_name='review_notes') THEN
    ALTER TABLE employers ADD COLUMN review_notes text;
    RAISE NOTICE 'Added review_notes column';
  ELSE
    RAISE NOTICE 'Column review_notes already exists';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employers' AND column_name='last_reviewed_at') THEN
    ALTER TABLE employers ADD COLUMN last_reviewed_at timestamptz;
    RAISE NOTICE 'Added last_reviewed_at column';
  ELSE
    RAISE NOTICE 'Column last_reviewed_at already exists';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employers' AND column_name='last_reviewed_by') THEN
    ALTER TABLE employers ADD COLUMN last_reviewed_by uuid REFERENCES auth.users(id);
    RAISE NOTICE 'Added last_reviewed_by column';
  ELSE
    RAISE NOTICE 'Column last_reviewed_by already exists';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employers' AND column_name='currently_reviewed_by') THEN
    ALTER TABLE employers ADD COLUMN currently_reviewed_by uuid REFERENCES auth.users(id);
    RAISE NOTICE 'Added currently_reviewed_by column';
  ELSE
    RAISE NOTICE 'Column currently_reviewed_by already exists';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employers' AND column_name='review_started_at') THEN
    ALTER TABLE employers ADD COLUMN review_started_at timestamptz;
    RAISE NOTICE 'Added review_started_at column';
  ELSE
    RAISE NOTICE 'Column review_started_at already exists';
  END IF;
END$$;

-- Add indexes after columns are created
CREATE INDEX IF NOT EXISTS idx_employers_merged_from_pending 
  ON employers USING GIN(merged_from_pending_ids);

CREATE INDEX IF NOT EXISTS idx_employers_auto_merged 
  ON employers(auto_merged) WHERE auto_merged = true;

CREATE INDEX IF NOT EXISTS idx_employers_under_review 
  ON employers(currently_reviewed_by) WHERE currently_reviewed_by IS NOT NULL;



