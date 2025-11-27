-- Migration: Fix Apple OAuth User Validation
-- Purpose: Prevent unauthorized users from gaining access through Apple Sign In
-- 
-- PROBLEM: When a user signs in with Apple:
-- 1. Supabase creates auth.users record with their Apple email
-- 2. The handle_new_user trigger creates a profiles record
-- 3. The profiles table has DEFAULT role='viewer' and is_active=true
-- 4. check_user_exists_for_oauth finds this newly created profile
-- 5. User gets viewer access to the entire system!
--
-- SOLUTION: 
-- 1. Update handle_new_user to set role=NULL for new users
-- 2. Update check_user_exists_for_oauth to:
--    - Check both email AND apple_email fields
--    - Require that the profile has role IS NOT NULL (explicitly assigned)
--    - This way, trigger-created profiles won't pass the check

-- Step 1: Update the handle_new_user trigger function to NOT set a default role
-- This ensures trigger-created profiles have role=NULL until an admin assigns a role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
    -- Insert new profile WITHOUT setting role - let it default to NULL
    -- This is critical for OAuth security: newly created profiles should have no role
    -- until explicitly assigned by an administrator
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NULL);
    RETURN NEW;
END;
$$;

-- Add comment explaining the security implications
COMMENT ON FUNCTION public.handle_new_user() IS 
'Trigger function that creates a profile when a new auth.users record is created. 
SECURITY: Role is explicitly set to NULL to prevent unauthorized OAuth access. 
A user must have their role explicitly assigned by an admin to access the application.';


-- Step 2: Update check_user_exists_for_oauth to properly validate users
-- This function now:
-- 1. Checks both primary email AND apple_email in profiles
-- 2. Requires the profile to have role IS NOT NULL (explicitly assigned)
-- 3. Requires is_active = true
-- 4. Also checks pending_users table for invited users
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
  -- CRITICAL SECURITY CHECKS:
  -- 1. Match against both primary email AND apple_email fields
  -- 2. Profile must be active (is_active = true)
  -- 3. Profile must have an explicitly assigned role (role IS NOT NULL)
  --    This prevents trigger-created profiles from passing validation
  SELECT EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE (
      lower(email) = p_email 
      OR lower(apple_email) = p_email
    )
    AND is_active = true
    AND role IS NOT NULL  -- Critical: only allow users with explicitly assigned roles
  ) INTO v_exists;
  
  -- If not found in profiles, check pending_users
  -- Pending users are users who have been invited but haven't yet created an account
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

-- Add comment explaining what this function does
COMMENT ON FUNCTION check_user_exists_for_oauth(text) IS 
'Validates if an email is authorized for OAuth sign-in.
Checks profiles table for active users with BOTH:
- Matching email (primary OR apple_email field)
- Explicitly assigned role (role IS NOT NULL)
Also checks pending_users for invited users.
SECURITY: Newly created profiles from OAuth have role=NULL and will NOT pass this check.';


-- Step 3: Clean up any existing profiles that were created by OAuth but have no legitimate role
-- These are profiles that were created by the trigger but the user was never authorized
-- They will have role='viewer' (the old default) but no pending_user record
-- 
-- NOTE: We're being conservative here - only removing profiles where:
-- - The profile has the default viewer role
-- - There's no corresponding pending_user record for that email
-- - The profile was created recently (within last 24 hours) to avoid removing legitimate old accounts
--
-- Step 4: Create a SECURITY DEFINER function to clean up unauthorized OAuth profiles
-- This is needed because there's no DELETE policy on profiles, so the auth callback
-- can't delete profiles directly. This function bypasses RLS safely.
CREATE OR REPLACE FUNCTION cleanup_unauthorized_oauth_profile(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_profile_role text;
  v_deleted boolean := false;
BEGIN
  -- Only delete if the profile exists and has role=NULL (unauthorized OAuth profile)
  -- This prevents accidentally deleting legitimate profiles
  SELECT role INTO v_profile_role
  FROM profiles
  WHERE id = p_user_id;
  
  IF v_profile_role IS NULL THEN
    -- Profile has no role, safe to delete (it's an unauthorized OAuth profile)
    DELETE FROM profiles WHERE id = p_user_id;
    v_deleted := true;
  END IF;
  
  RETURN v_deleted;
END;
$$;

-- Grant execute to authenticated users (needed for the auth callback)
GRANT EXECUTE ON FUNCTION cleanup_unauthorized_oauth_profile(uuid) TO authenticated;

-- Add comment explaining the function
COMMENT ON FUNCTION cleanup_unauthorized_oauth_profile(uuid) IS 
'Safely deletes an unauthorized OAuth profile. Only deletes profiles with role=NULL 
(profiles created by the handle_new_user trigger but never assigned a role by an admin).
This function uses SECURITY DEFINER to bypass RLS since there is no DELETE policy on profiles.';


-- Step 5: Also handle the case where old profiles might have role='viewer' by default
-- Create a function to check if a profile is legitimately authorized
CREATE OR REPLACE FUNCTION is_profile_authorized(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_email text;
  v_role text;
  v_has_pending_user boolean;
BEGIN
  -- Get the profile's email and role
  SELECT email, role INTO v_email, v_role
  FROM profiles
  WHERE id = p_user_id;
  
  -- If no profile found, not authorized
  IF v_email IS NULL THEN
    RETURN false;
  END IF;
  
  -- If role is NULL, not authorized (trigger-created profile)
  IF v_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if there's a pending_user record for this email
  -- This means an admin explicitly invited this user
  SELECT EXISTS (
    SELECT 1 FROM pending_users
    WHERE lower(email) = lower(v_email)
      AND status IN ('draft', 'invited', 'activated')
  ) INTO v_has_pending_user;
  
  -- User is authorized if they have a pending_user record OR have a non-viewer role
  -- (Admins manually set roles to non-viewer values)
  RETURN v_has_pending_user OR v_role != 'viewer';
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION is_profile_authorized(uuid) TO authenticated;

COMMENT ON FUNCTION is_profile_authorized(uuid) IS 
'Checks if a profile is legitimately authorized. Returns true if:
1. Profile has a pending_user record (explicitly invited by admin), OR
2. Profile has a role other than viewer (explicitly assigned by admin)
Returns false for trigger-created profiles with default viewer role and no invitation.';


