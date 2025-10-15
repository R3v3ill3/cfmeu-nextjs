# Password Reset Flow - Session Conflict Fix

## Problem Identified

When an admin triggers a password reset for another user and then opens the reset link (even in incognito mode), multiple critical issues occurred:

### Symptom Chain
1. **Admin logged in** → Has active session in browser
2. **Admin clicks "Reset Password"** for another user → Password reset email sent
3. **Admin opens the reset link** (meant for target user) → Creates PASSWORD_RECOVERY session
4. **Two sessions conflict** → Admin session vs. Recovery session
5. **Auth system breaks** → 500 errors, dashboard fails, Supabase connection errors
6. **Admin gets logged back in** → Instead of seeing password reset form

### Root Causes

1. **Session Persistence**: Browser Supabase client persists sessions across pages
2. **No Session Clearing**: Reset page didn't clear existing sessions before handling recovery
3. **Flawed Redirect Logic**: Page would redirect authenticated users away from password reset
4. **Session Conflict**: Two simultaneous sessions (admin + recovery) caused auth failures

## Files Fixed

### 1. `/src/app/(auth)/auth/reset-password/page.tsx`

**Changes:**
- ✅ **Auto-detect and clear conflicting sessions**: When reset link is opened, any existing session is cleared
- ✅ **Track recovery session state**: New `isRecoverySession` flag prevents misuse
- ✅ **Removed broken redirect logic**: No longer redirects away during password recovery
- ✅ **Clean session after password update**: Signs out recovery session after successful password change
- ✅ **Better error handling**: More specific error messages for different failure modes
- ✅ **Added debug logging**: Console logs to help troubleshoot auth flow

**How it works now:**
```typescript
// 1. When page loads, check for reset token in URL hash
if (hasResetToken) {
  // Clear any existing session (admin, regular user, etc.)
  await supabase.auth.signOut({ scope: 'local' })
  
  // The reset token will automatically create a clean recovery session
}

// 2. Track that we're in password recovery mode
if (event === 'PASSWORD_RECOVERY') {
  setIsRecoverySession(true)
}

// 3. After password update, clean up
await supabase.auth.updateUser({ password })
await supabase.auth.signOut({ scope: 'local' })
// User can now log in fresh with new password
```

### 2. `railway_workers/cfmeu-dashboard-worker/src/supabase.ts`

**Changes:**
- ✅ **Proper JWT validation**: Added `verifyJWT()` function using service role
- ✅ **Fixed token validation**: `getUserClientFromToken()` now properly validates tokens
- ✅ **Better architecture**: Separates JWT verification from database queries

**Why this matters:**
Even though the immediate issue was session conflicts, the dashboard worker had fragile JWT validation that would fail when sessions were in inconsistent states. This fix makes it robust.

### 3. `railway_workers/cfmeu-dashboard-worker/src/index.ts`

**Changes:**
- ✅ **Better error logging**: Added detailed logs for auth failures
- ✅ **Explicit JWT verification**: Uses new `verifyJWT()` before processing requests
- ✅ **Debug logging**: Logs successful authorizations for troubleshooting

## Testing the Fix

### Test Scenario 1: Admin Password Reset (The Original Issue)

1. **Log in as admin**
   ```
   Go to your app
   Log in with admin credentials
   ```

2. **Trigger password reset for test user**
   ```
   Navigate to Administration → Users
   Find test user
   Click "Reset Password"
   Verify email is sent
   ```

3. **Open reset link in SAME browser (not incognito)**
   ```
   Open the reset email
   Click the password reset link
   ```

4. **Expected behavior:**
   ✅ Admin session is automatically cleared
   ✅ Password reset form appears
   ✅ No 500 errors in console
   ✅ No "Dashboard endpoint error" in logs
   ✅ Can successfully set new password

5. **After password update:**
   ✅ Recovery session is cleared
   ✅ Redirected to login page
   ✅ Can log in with new password

### Test Scenario 2: Regular Password Reset (User Self-Service)

1. **Go to login page as logged-out user**
2. **Click "Forgot Password"**
3. **Enter email and submit**
4. **Open reset link from email**
5. **Set new password**

**Expected:**
✅ Works as before (no regression)

### Test Scenario 3: Expired Reset Link

1. **Generate reset link**
2. **Wait for token to expire** (or use old link)
3. **Try to open expired link**

**Expected:**
✅ Shows error: "Invalid or expired reset link. Please request a new one."

### Test Scenario 4: Direct Access to Reset Page

1. **Navigate directly to `/auth/reset-password`** (without reset token)
2. **Try to set password**

**Expected:**
✅ Shows error: "This page can only be used with a valid password reset link."

## Verification Checklist

After deploying:

- [ ] Admin can trigger password resets for other users
- [ ] Opening reset link (as admin) doesn't cause 500 errors
- [ ] Password reset form appears properly
- [ ] Can successfully update password
- [ ] No "Dashboard endpoint error" in Railway logs
- [ ] Admin can log back in as admin after the flow
- [ ] Target user can log in with new password
- [ ] Regular self-service password reset still works
- [ ] Expired links show appropriate error

## Browser Console Debug Output

When testing, you'll see helpful console logs:

```
✅ Good flow:
  "Current session on reset page: { ... }" 
  "Password reset link detected, clearing any existing sessions..."
  "Existing session cleared, ready for password recovery"
  "Auth event on reset page: PASSWORD_RECOVERY Has session: true"
  "Password recovery event detected"
  "Attempting to update password..."
  "Password update result: null"
  "Password updated, signing out recovery session..."

❌ Bad flow (fixed):
  "Session error: ..." → Check Supabase configuration
  "No active session found" → Reset link expired or invalid
```

## Deployment Instructions

**DO NOT PUSH TO GIT YET** (per user request)

When ready to deploy:

```bash
# Review changes
git diff src/app/\(auth\)/auth/reset-password/page.tsx
git diff railway_workers/cfmeu-dashboard-worker/

# Stage changes
git add src/app/\(auth\)/auth/reset-password/page.tsx
git add railway_workers/cfmeu-dashboard-worker/

# Commit with descriptive message
git commit -m "fix: resolve session conflicts in password reset flow

- Clear existing sessions before password recovery
- Add proper JWT validation in dashboard worker
- Prevent auth conflicts between admin and recovery sessions
- Sign out recovery session after password update
- Add debug logging for troubleshooting"

# Push (after approval)
git push origin main
```

## Related Issues

This fix also resolves:
- ✅ Intermittent 500 errors during auth flows
- ✅ "Dashboard endpoint error" in Railway logs
- ✅ Admin menu disappearing unexpectedly
- ✅ Stale session conflicts
- ✅ Fragile JWT validation in workers

## Prevention

To prevent similar issues in the future:

1. **Test auth flows in same browser**: Don't always use incognito - test with existing sessions
2. **Check Railway logs**: Look for auth errors after auth-related changes
3. **Use browser console**: Auth events are logged - watch for conflicts
4. **Test admin actions**: Admin triggering actions for other users can expose session issues

## Rollback Plan

If issues arise after deployment:

```bash
# Revert the password reset fix
git revert <commit-hash>

# Or restore just the reset page:
git checkout HEAD~1 -- src/app/\(auth\)/auth/reset-password/page.tsx

# Push
git push origin main
```

## Technical Notes

### Why `signOut({ scope: 'local' })` Instead of `signOut()`?

```typescript
await supabase.auth.signOut({ scope: 'local' })
```

- `scope: 'local'` clears only the browser's session
- Does NOT revoke the token on the server
- Faster and sufficient for session conflicts
- User can still have valid tokens elsewhere (mobile app, etc.)

### Why Wait 500ms After Sign Out?

```typescript
await supabase.auth.signOut({ scope: 'local' })
await new Promise(resolve => setTimeout(resolve, 500))
```

- Browser storage operations are async
- Gives time for localStorage/cookies to clear
- Prevents race condition with recovery token parsing
- 500ms is conservative but safe

### URL Hash vs Query Parameters

Password reset tokens come in the URL **hash** (`#access_token=...`), not query params:

```
Good: https://app.com/auth/reset-password#access_token=xyz&type=recovery
Bad:  https://app.com/auth/reset-password?access_token=xyz
```

This is a Supabase security feature - hash fragments aren't sent to servers.

