-- Automation rate limiting and per-user credential storage

CREATE TABLE IF NOT EXISTS automation_rate_limits (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  last_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, task)
);

ALTER TABLE automation_rate_limits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'automation_rate_limits' 
    AND policyname = 'automation_rate_limits_select_own'
  ) THEN
    CREATE POLICY automation_rate_limits_select_own
      ON automation_rate_limits
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'automation_rate_limits' 
    AND policyname = 'automation_rate_limits_insert_own'
  ) THEN
    CREATE POLICY automation_rate_limits_insert_own
      ON automation_rate_limits
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'automation_rate_limits' 
    AND policyname = 'automation_rate_limits_update_own'
  ) THEN
    CREATE POLICY automation_rate_limits_update_own
      ON automation_rate_limits
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'automation_rate_limits' 
    AND policyname = 'automation_rate_limits_delete_own'
  ) THEN
    CREATE POLICY automation_rate_limits_delete_own
      ON automation_rate_limits
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_external_credentials (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  secret_encrypted TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, provider)
);

ALTER TABLE user_external_credentials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_external_credentials' 
    AND policyname = 'user_external_credentials_select_own'
  ) THEN
    CREATE POLICY user_external_credentials_select_own
      ON user_external_credentials
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_external_credentials' 
    AND policyname = 'user_external_credentials_insert_own'
  ) THEN
    CREATE POLICY user_external_credentials_insert_own
      ON user_external_credentials
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_external_credentials' 
    AND policyname = 'user_external_credentials_update_own'
  ) THEN
    CREATE POLICY user_external_credentials_update_own
      ON user_external_credentials
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_external_credentials' 
    AND policyname = 'user_external_credentials_delete_own'
  ) THEN
    CREATE POLICY user_external_credentials_delete_own
      ON user_external_credentials
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.user_external_credentials_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_user_external_credentials_updated_at ON user_external_credentials;
CREATE TRIGGER trg_user_external_credentials_updated_at
BEFORE UPDATE ON user_external_credentials
FOR EACH ROW EXECUTE FUNCTION public.user_external_credentials_set_updated_at();

COMMENT ON TABLE automation_rate_limits IS 'Tracks recent execution timestamps for automation tasks per user to enforce throttling.';
COMMENT ON TABLE user_external_credentials IS 'Stores encrypted per-user credentials for third-party services (e.g. Incolink).';
