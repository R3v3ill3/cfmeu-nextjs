# Apple OAuth Security Fix - January 2025

## Security Issue Identified

**Problem:** Unauthorized users were able to gain access to the application through Apple Sign-In even when their Apple email was not linked to any registered user.

### Root Cause Analysis

When a user signs in with Apple, the following happens:

1. Supabase creates an `auth.users` record with their Apple email
2. The `handle_new_user` trigger automatically creates a `profiles` record
3. **BUG:** The profiles table had `DEFAULT role='viewer'` and `DEFAULT is_active=true`
4. The `check_user_exists_for_oauth` function found this newly created profile
5. User was granted viewer access to the entire system!

Additionally, the validation function was only checking the primary `email` field, not the `apple_email` field.

## Security Fixes Applied

### Migration: `20250127000000_fix_apple_oauth_user_validation.sql`

This migration makes the following changes:

#### 1. Updated `handle_new_user` Trigger
- Now explicitly sets `role = NULL` for newly created profiles
- This ensures trigger-created profiles have no access until an admin assigns a role

#### 2. Updated `check_user_exists_for_oauth` Function
- Now checks **both** `email` AND `apple_email` fields in the profiles table
- Requires `role IS NOT NULL` - profiles must have an explicitly assigned role
- Requires `is_active = true`
- Still checks `pending_users` table for invited users

#### 3. Added `cleanup_unauthorized_oauth_profile` Function
- SECURITY DEFINER function that can delete profiles with `role = NULL`
- Used by the auth callback to clean up profiles created by the trigger for unauthorized users
- Bypasses RLS safely (no DELETE policy exists on profiles)

#### 4. Added `is_profile_authorized` Helper Function
- Checks if a profile is legitimately authorized
- Returns true only if the profile has a pending_user record OR has a non-viewer role

### Auth Callback Updates (`/auth/confirm/route.ts`)

- Updated to use the new `cleanup_unauthorized_oauth_profile` function
- Added `role IS NOT NULL` filter to existing profile checks
- Improved logging for security events

## How It Works Now

### Authorized User Flow

1. Admin creates pending_user record OR assigns role to existing profile
2. User optionally sets their `apple_email` in settings (if different from profile email)
3. User signs in with Apple
4. OAuth creates auth.users and triggers profile creation (role=NULL)
5. `check_user_exists_for_oauth` finds matching profile with role assigned → returns true
6. Unauthorized profile (role=NULL) is cleaned up
7. User is authenticated and redirected to dashboard

### Unauthorized User Flow

1. User (not in system) tries to sign in with Apple
2. OAuth creates auth.users and triggers profile creation (role=NULL)
3. `check_user_exists_for_oauth` finds NO matching profile with role → returns false
4. Unauthorized profile is deleted via `cleanup_unauthorized_oauth_profile`
5. User is signed out and redirected to auth page with error

### Private Relay Email Flow

1. User selects "Hide My Email" during Apple Sign-In
2. Apple provides a private relay email (e.g., `xyz@privaterelay.appleid.com`)
3. Auth callback detects relay email and immediately rejects
4. User is signed out and shown error asking them to share their real email

## For Administrators

### Setting Up Apple Sign-In for a User

**Option 1: User's Apple email matches their profile email**
- No additional setup needed
- User can sign in with Apple immediately

**Option 2: User's Apple email is different from their profile email**
1. Go to Admin → Users
2. Find the user's profile
3. Set their `apple_email` field to their Apple ID email
4. User can now sign in with Apple using that email

**Option 3: Invite a new user with Apple email**
1. Create a pending_user record with the user's Apple ID email
2. Set appropriate role and patches
3. Invite the user
4. User can sign in with Apple directly

### Troubleshooting

**User gets "not registered" error:**
- Verify the user's email is in `profiles` or `pending_users`
- Check that the profile has `role IS NOT NULL` and `is_active = true`
- If using different Apple email, ensure `apple_email` field is set

**User gets "account exists" error:**
- User has an email/password account with same email
- They should sign in with email/password instead
- OR admin should link their Apple ID to their existing profile

**User gets "private relay email" error:**
- User selected "Hide My Email" during Apple Sign-In
- They need to try again and select "Share My Email"

## Database Changes Summary

```sql
-- Functions modified:
-- 1. handle_new_user() - sets role=NULL explicitly
-- 2. check_user_exists_for_oauth() - checks apple_email and requires role IS NOT NULL

-- Functions added:
-- 1. cleanup_unauthorized_oauth_profile() - safely deletes unauthorized profiles
-- 2. is_profile_authorized() - helper to check profile authorization
```

## Testing the Fix

### Test 1: Unauthorized Access (Should be blocked)

1. Use an Apple ID email not in the system
2. Sign in with Apple
3. **Expected:** Redirected to /auth with "not registered" error

### Test 2: Authorized Access via Primary Email

1. Ensure profile exists with role assigned and email matching Apple ID
2. Sign in with Apple
3. **Expected:** Successfully authenticated

### Test 3: Authorized Access via Apple Email Field

1. Set profile's `apple_email` to match Apple ID email
2. Sign in with Apple
3. **Expected:** Successfully authenticated

### Test 4: Private Relay Email (Should be blocked)

1. Sign in with Apple and select "Hide My Email"
2. **Expected:** Redirected to /auth with "private relay" error

## Rollback Instructions

If you need to rollback this change:

```sql
-- Restore original handle_new_user (uses table default for role)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$;

-- Restore check_user_exists_for_oauth without role check
-- (Copy from previous migration file)
```

**Warning:** Rolling back will re-enable the security vulnerability.


