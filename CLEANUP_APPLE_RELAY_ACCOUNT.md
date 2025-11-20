# Cleanup Guide: Remove Old Apple Relay Email Account

If you signed in with Apple using "Hide My Email" and then tried again with "Share My Email", you may have two accounts:
1. Old account with relay email (e.g., `m7xyg6jg52@privaterelay.appleid.com`)
2. New account with real email

This guide helps you clean up the old relay email account.

## Step 1: Sign Out Completely

1. In your app, sign out completely
2. Go to **Apple ID Settings** → **Sign-In & Security** → **Apps Using Apple ID**
3. Find your app and **revoke access** (this ensures a fresh start)

## Step 2: Find the Old Account in Supabase

### Option A: Via Supabase Dashboard (Easiest)

1. Go to **Supabase Dashboard** → Your Project
2. Navigate to **Authentication** → **Users**
3. Search for the relay email (e.g., `m7xyg6jg52@privaterelay.appleid.com`)
4. Note the **User ID** (UUID) of this account

### Option B: Via SQL Query

Run this in **Supabase Dashboard** → **SQL Editor**:

```sql
-- Find accounts with relay emails
SELECT 
  id,
  email,
  created_at,
  raw_user_meta_data->>'provider' as provider
FROM auth.users
WHERE email LIKE '%@privaterelay.appleid.com'
ORDER BY created_at DESC;
```

## Step 3: Delete the Old Account

### Option A: Via Supabase Dashboard

1. In **Authentication** → **Users**, find the relay email account
2. Click the **three dots** (⋮) next to the user
3. Select **Delete user**
4. Confirm deletion

### Option B: Via SQL (More Control)

Run this SQL in **Supabase Dashboard** → **SQL Editor**:

**⚠️ WARNING: Replace `USER_ID_HERE` with the actual UUID from Step 2**

```sql
-- Delete the old relay email account
-- Replace USER_ID_HERE with the actual user ID UUID

DO $$
DECLARE
  v_user_id uuid := 'USER_ID_HERE'; -- ⚠️ REPLACE THIS
BEGIN
  -- Delete from profiles first (due to foreign key)
  DELETE FROM public.profiles WHERE id = v_user_id;
  
  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = v_user_id;
  
  RAISE NOTICE 'Deleted user account: %', v_user_id;
END $$;
```

**To find the user ID first, run:**
```sql
SELECT id, email FROM auth.users WHERE email LIKE '%@privaterelay.appleid.com';
```

Then copy the `id` UUID and use it in the deletion script above.

## Step 4: Verify Cleanup

Run this query to verify the account is gone:

```sql
SELECT id, email FROM auth.users WHERE email LIKE '%@privaterelay.appleid.com';
```

Should return no rows (or only accounts you want to keep).

## Step 5: Sign In Again

1. **Clear browser cache** or use an incognito window
2. Go to your app's sign-in page
3. Click **Continue with Apple**
4. **Important:** When Apple prompts you, make sure to select **"Share My Email"**
5. You should now sign in with your real email address

## Troubleshooting

### Still seeing relay email after cleanup?

1. **Check if Apple is still providing relay email:**
   - Apple may cache the authorization
   - Try revoking access in Apple ID settings again
   - Wait a few minutes, then try signing in again

2. **Check Supabase logs:**
   - Go to **Authentication** → **Logs**
   - Look for the OAuth callback to see what email Apple provided

3. **Verify email scope is requested:**
   - The code should include `scopes: 'email'` in the OAuth request
   - Check `src/app/(auth)/auth/page.tsx` to confirm

### Multiple accounts with same email?

If you have multiple accounts (one with relay email, one with real email), you may need to:

1. Delete the relay email account (as above)
2. Keep the real email account
3. If the real email account doesn't have a profile, you may need to create one or link it to your existing profile

## Prevention

To prevent this in the future:

1. **Always select "Share My Email"** when signing in with Apple
2. The code now automatically detects relay emails and rejects them
3. Users will see a clear error message if they choose "Hide My Email"

