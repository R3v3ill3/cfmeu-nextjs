-- Migration: Apple OAuth User Validation Function
-- Purpose: Check if a user email exists in profiles or pending_users tables
-- This is used to restrict Apple Sign In to existing registered users only

CREATE OR REPLACE FUNCTION check_user_exists_for_oauth(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_exists boolean := false;
BEGIN
  -- Normalize email to lowercase
  p_email := lower(trim(p_email));
  
  -- Check if email exists in profiles table
  SELECT EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE lower(email) = p_email
      AND is_active = true
  ) INTO v_exists;
  
  -- If not found in profiles, check pending_users
  IF NOT v_exists THEN
    SELECT EXISTS (
      SELECT 1 
      FROM pending_users 
      WHERE lower(email) = p_email
        AND status IN ('draft', 'invited')
    ) INTO v_exists;
  END IF;
  
  RETURN v_exists;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION check_user_exists_for_oauth(text) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION check_user_exists_for_oauth(text) IS 
'Checks if an email exists in profiles (active) or pending_users (draft/invited) tables. Used to restrict OAuth sign-in to existing registered users.';

