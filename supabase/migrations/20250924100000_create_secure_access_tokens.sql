-- Create secure_access_tokens table for temporary public access to webforms
CREATE TABLE secure_access_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token text UNIQUE NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Add indexes for performance
CREATE INDEX idx_secure_access_tokens_token ON secure_access_tokens(token);
CREATE INDEX idx_secure_access_tokens_resource ON secure_access_tokens(resource_type, resource_id);
CREATE INDEX idx_secure_access_tokens_expires_at ON secure_access_tokens(expires_at);

-- Enable RLS
ALTER TABLE secure_access_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see tokens they created
CREATE POLICY "Users can view their own tokens" ON secure_access_tokens
  FOR SELECT USING (auth.uid() = created_by);

-- Policy: Users can create tokens for resources they have access to
CREATE POLICY "Users can create tokens" ON secure_access_tokens
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Policy: Users can update their own tokens (for marking as used)
CREATE POLICY "Users can update their own tokens" ON secure_access_tokens
  FOR UPDATE USING (auth.uid() = created_by);

-- Policy: Allow public access for validation (needed for public API endpoints)
-- This will be used by our API endpoints to validate tokens without authentication
CREATE POLICY "Public token validation" ON secure_access_tokens
  FOR SELECT USING (true);

-- Add a function to generate cryptographically secure tokens
CREATE OR REPLACE FUNCTION generate_secure_token(length integer DEFAULT 32)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i integer := 0;
  char_length integer := length(chars);
BEGIN
  -- Use gen_random_bytes for cryptographic security
  FOR i IN 1..length LOOP
    result := result || substr(chars, 1 + (abs(get_byte(gen_random_bytes(1), 0)) % char_length), 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Function to clean up expired tokens (can be called by a cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM secure_access_tokens 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Grant execute permission on the functions to authenticated users
GRANT EXECUTE ON FUNCTION generate_secure_token(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_tokens() TO authenticated;

COMMENT ON TABLE secure_access_tokens IS 'Stores secure access tokens for temporary public access to webforms';
COMMENT ON COLUMN secure_access_tokens.token IS 'Cryptographically secure random token';
COMMENT ON COLUMN secure_access_tokens.resource_type IS 'Type of resource (e.g., PROJECT_MAPPING_SHEET, PROJECT_SITE_VISIT)';
COMMENT ON COLUMN secure_access_tokens.resource_id IS 'ID of the specific resource (e.g., project ID)';
COMMENT ON COLUMN secure_access_tokens.created_by IS 'User who created the token (organiser)';
COMMENT ON COLUMN secure_access_tokens.expires_at IS 'When the token expires and becomes invalid';
COMMENT ON COLUMN secure_access_tokens.used_at IS 'When the form was successfully submitted (for single-use tokens)';
