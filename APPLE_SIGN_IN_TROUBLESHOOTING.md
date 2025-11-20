# Apple Sign In Troubleshooting Guide

## Error: "Signups not allowed for this instance" (422)

This error occurs when Supabase blocks OAuth signups. Even though we validate users after signup, Supabase requires signups to be enabled for OAuth flows to complete.

## Step-by-Step Fix

### 1. Enable Signups in Supabase Dashboard

**Critical:** You MUST enable signups for OAuth to work, even if you restrict access afterward.

1. Go to **Supabase Dashboard** → Your Project
2. Navigate to **Authentication** → **Settings** → **Auth**
3. Find **"Disable new user signups"** toggle
4. **Make sure it is OFF/UNCHECKED** (signups must be ENABLED)
5. Click **Save**

### 2. Verify Redirect URL Configuration

1. Still in **Authentication** → **Settings**
2. Click **URL Configuration** tab
3. Under **Redirect URLs**, ensure these are whitelisted:
   ```
   https://your-production-domain.com/auth/confirm
   http://localhost:3000/auth/confirm
   ```
4. **Site URL** should be set to:
   ```
   Production: https://your-production-domain.com
   Local: http://localhost:3000
   ```
5. Click **Save**

### 3. Verify Apple Provider Configuration

1. Go to **Authentication** → **Providers**
2. Click on **Apple**
3. Verify:
   - ✅ **Enabled** toggle is ON
   - **Client ID**: `app.uconstruct.cfmeu` (your Service ID)
   - **Secret Key**: Your JWT token (should be a long string starting with `eyJ...`)
4. Click **Save**

### 4. Check Apple Service ID Configuration

In Apple Developer Portal:

1. Go to **Certificates, Identifiers & Profiles** → **Identifiers**
2. Select your Service ID: `app.uconstruct.cfmeu`
3. Under **Sign in with Apple**, click **Configure**
4. Verify **Return URLs** includes:
   ```
   https://[your-project-ref].supabase.co/auth/v1/callback
   ```
   (This is Supabase's callback URL - Apple redirects here first, then Supabase redirects to your app)

### 5. Test the Flow

1. Clear browser cookies/cache
2. Go to `/auth` page
3. Click "Continue with Apple"
4. Complete Apple sign-in
5. You should be redirected back to your app

## Why Signups Must Be Enabled

Supabase's OAuth flow works like this:

1. User clicks "Continue with Apple"
2. Redirects to Apple → User authenticates
3. Apple redirects to **Supabase's callback URL** (`https://[project].supabase.co/auth/v1/callback`)
4. **Supabase processes OAuth and creates user account** (requires signups enabled)
5. Supabase redirects to your app's callback (`/auth/confirm`) with a `code` parameter
6. Your app exchanges code for session and validates user

If signups are disabled, Supabase blocks at step 4, so you never receive the callback.

## Security: How We Still Restrict Access

Even with signups enabled, unauthorized users cannot access your app:

1. **OAuth user is created** in `auth.users` table (Supabase requirement)
2. **Your callback handler validates** the email against `profiles` or `pending_users`
3. **If email doesn't exist**, user is immediately signed out
4. **RLS policies prevent access** - users without a profile cannot query any data
5. **User sees error message** directing them to contact administrator

## Alternative: Database Trigger to Auto-Delete Unauthorized Users

If you want to automatically clean up unauthorized OAuth signups, you can add a database trigger:

```sql
-- Auto-delete auth.users if no matching profile/pending_user exists
CREATE OR REPLACE FUNCTION auto_delete_unauthorized_oauth_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email text;
  v_exists boolean := false;
BEGIN
  -- Get user email
  v_email := lower(NEW.email);
  
  -- Check if email exists in profiles or pending_users
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE lower(email) = v_email AND is_active = true
    UNION
    SELECT 1 FROM pending_users WHERE lower(email) = v_email AND status IN ('draft', 'invited')
  ) INTO v_exists;
  
  -- If user doesn't exist, delete them immediately
  IF NOT v_exists THEN
    DELETE FROM auth.users WHERE id = NEW.id;
    RETURN NULL; -- Prevent the insert
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger (runs after user is created)
CREATE TRIGGER check_oauth_user_authorization
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION auto_delete_unauthorized_oauth_users();
```

**Note:** This is optional - our callback handler already handles validation and sign-out.

## Common Issues

### Issue: "Missing authentication parameters"

**Cause:** The callback URL isn't receiving the `code` parameter.

**Solutions:**
1. Verify redirect URL is whitelisted in Supabase
2. Check Apple Service ID return URLs include Supabase callback
3. Clear browser cache and try again

### Issue: Still getting 422 error after enabling signups

**Solutions:**
1. **Double-check the setting** - sometimes it takes a moment to propagate
2. **Check for multiple settings** - some Supabase versions have separate toggles for email vs OAuth signups
3. **Try disabling and re-enabling** the Apple provider
4. **Check Supabase logs** for more detailed error messages

### Issue: User can sign in but sees "not registered" error

**This is expected behavior** - it means:
- ✅ OAuth flow completed successfully
- ✅ User validation is working
- ❌ User's email isn't in your system

**Solution:** Add the user's email (or Apple email) to `profiles` or `pending_users` table, or have them add their Apple email in Settings.

### Issue: "An account already exists for this email"

**Cause:** User tried to sign in with Apple ID, but they already have an account created with email/password. Supabase creates a new OAuth account instead of linking to the existing one.

**What happens:**
- OAuth creates a new `auth.users` record
- Trigger creates a new `profiles` record
- System detects email matches existing profile
- New account is deleted and user is signed out
- User sees error message

**Solutions:**
1. **User should sign in with their existing email/password account** instead of Apple Sign In
2. **Admin can link Apple ID** to existing account (requires manual database update or admin tool)
3. **User can add their Apple email** to their profile's `apple_email` field in Settings, then use Apple Sign In (if email matches)

**Note:** Supabase doesn't automatically link OAuth accounts to existing email accounts. If a user wants to use Apple Sign In, they should either:
- Use the same email for both accounts (and select "Share My Email" when signing in with Apple)
- Add their Apple email to the `apple_email` field in Settings first

### Issue: User sees "Welcome back, [random-id]" instead of their name

**Cause:** User chose "Hide My Email" during Apple Sign In, so Apple provided a private relay email instead of their real email.

**What happens:**
- Apple provides relay email (e.g., `m7xyg6jg52@privaterelay.appleid.com`)
- System detects relay email and rejects sign-in
- User is signed out immediately

**Solution:** User must sign in again and select **"Share My Email"** instead of "Hide My Email" when Apple prompts them.

### Issue: Not seeing "Share My Email" / "Hide My Email" option

**Cause:** The OAuth request isn't requesting the email scope, so Apple doesn't show the option.

**Solution:** The code automatically includes `scopes: 'email'` in the OAuth request. If you're not seeing the option:

1. **Clear browser cache** - Apple may have cached previous authorization
2. **Sign out of Apple ID** in your browser/device settings temporarily, then try again
3. **Check Supabase configuration** - Ensure the Apple provider is enabled and configured correctly
4. **First-time users** - If this is the first time signing in with Apple for this app, the option should appear. If you've already authorized the app, Apple may skip the prompt (you can revoke access in Apple ID settings to see it again)

**Note:** The email scope is automatically requested in the code (`scopes: 'email'`), so no Apple Developer configuration changes are needed.

## Verification Checklist

- [ ] Signups enabled in Supabase (Authentication → Settings → Auth)
- [ ] Redirect URL whitelisted (`/auth/confirm`)
- [ ] Apple provider enabled and configured correctly
- [ ] Apple Service ID return URLs include Supabase callback
- [ ] JWT secret key is valid (not expired)
- [ ] User's email exists in `profiles` or `pending_users` table

