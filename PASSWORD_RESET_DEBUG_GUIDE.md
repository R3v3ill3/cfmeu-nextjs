# Password Reset Debugging Guide

## Current Issue

When following a password reset link in a clean incognito browser:
- ✅ Reset link opens
- ✅ Password reset form appears
- ❌ When submitting: "No active session found. The reset link may have expired."
- ✅ Supabase logs show: `/user`, `/recover`, `/verify` requests completed

## Debugging Features Added

### 1. Visual Session Status Indicator

The password reset page now shows:
- **Green box**: "✓ Recovery session active" - Session detected, ready to reset
- **Yellow box**: "⏳ Waiting for recovery session..." - No session detected yet

### 2. Manual Session Check Button

Click "🔍 Check Session Status" to manually verify if a session exists. This will:
- Log detailed session info to console
- Show an alert with the result
- Enable the form if session is found

### 3. Enhanced Console Logging

Open browser console to see detailed logs:
```
Password reset page loaded
Auth state change: INITIAL_SESSION Has session: false
Auth state change: PASSWORD_RECOVERY Has session: true  <- Should see this
✅ Password recovery session established
```

## Testing Steps

### Test 1: Clean Incognito Browser

1. **Send reset email** (as admin):
   ```
   - Log in as admin
   - Go to Administration → Users
   - Click "Reset Password" for test user
   - Copy the email link
   ```

2. **Open in fresh incognito**:
   ```
   - Close all incognito windows
   - Open NEW incognito window
   - Paste reset link
   ```

3. **Check what you see**:
   - [ ] Yellow "Waiting for recovery session" box appears?
   - [ ] Green "Recovery session active" box appears?
   - [ ] Form fields are enabled or disabled?

4. **Click "🔍 Check Session Status"**:
   - [ ] What does the alert say?
   - [ ] Check browser console - any session logged?
   - [ ] Check the URL - does it still have `#access_token=...&type=recovery`?

5. **Check browser console logs**:
   ```
   Look for these specific messages:
   - "Password reset page loaded"
   - "Auth state change: ..." (what event?)
   - "Session exists" or "No session"
   ```

### Test 2: What Supabase Auth Events Fire?

The `onAuthStateChange` listener should detect one of these events:
- `INITIAL_SESSION` - Page loaded with existing session
- `PASSWORD_RECOVERY` - Supabase detected recovery token
- `SIGNED_IN` - Session created from token

**Check console**: Which event do you see?

## Expected Behavior vs Actual

### ✅ Expected:
1. Reset link opens
2. Supabase processes `#access_token=...&type=recovery` from URL
3. `PASSWORD_RECOVERY` or `SIGNED_IN` event fires
4. Session is established
5. Green "Recovery session active" appears
6. Form is enabled
7. User can set password

### ❌ Actual (based on your report):
1. Reset link opens
2. Supabase logs show `/recover` and `/verify` completed
3. ??? Event fires (or doesn't fire?)
4. ??? Session state
5. Yellow "Waiting" box persists
6. Form disabled OR enabled but fails on submit
7. "No active session found" error

## Key Questions to Answer

1. **Does the yellow box ever turn green?**
   - Yes → Session establishes but then disappears
   - No → Session never establishes

2. **What does "Check Session Status" button show?**
   - "Session found" → Session exists but flag isn't being set
   - "No session found" → Session truly doesn't exist

3. **What auth events appear in console?**
   - `PASSWORD_RECOVERY` → Good, session should exist
   - `INITIAL_SESSION` with no session → Token not processed
   - No events → Listener not working

4. **Is the URL hash still there when form loads?**
   - Yes → Supabase hasn't consumed it yet
   - No → Supabase processed it (or it got lost)

## Potential Root Causes

### Cause A: Auth Event Not Firing
**Symptom**: Yellow box never turns green, no PASSWORD_RECOVERY event in console

**Possible fixes**:
- `@supabase/ssr` might not emit PASSWORD_RECOVERY event
- Event fires before listener attaches
- Need to manually check session on mount

### Cause B: Session Established Then Lost
**Symptom**: Green box appears briefly then error on submit

**Possible fixes**:
- Session timeout issue
- Session being cleared accidentally
- Race condition between session creation and form submit

### Cause C: URL Token Not Being Processed
**Symptom**: URL hash present but no session ever created

**Possible fixes**:
- `createBrowserClient` not configured to handle URL tokens
- Token format issue
- PKCE / security settings blocking token exchange

## Next Debugging Steps

Based on what you observe:

### If Yellow Box Never Turns Green:

```typescript
// Add to useEffect, right after subscription setup:
setTimeout(async () => {
  console.log('⏰ 3-second check...')
  const { data: { session } } = await supabase.auth.getSession()
  console.log('Session after 3s:', session ? 'EXISTS' : 'NONE')
  if (session) {
    setIsRecoverySession(true)
  }
}, 3000)
```

### If "Check Session" Shows Session But Form Fails:

The issue is timing - session exists but gets lost. Need to:
1. Remove `isRecoverySession` check entirely
2. Just rely on session existence at submit time

### If No Events Fire:

The `onAuthStateChange` listener might not be the right approach for `@supabase/ssr`. May need to:
1. Poll for session on mount
2. Use a different event API
3. Check Supabase SSR docs for recovery flow

## Files Modified

- `src/app/(auth)/auth/reset-password/page.tsx` - Simplified approach with debug tools

## What to Report Back

Please test and report:

1. **Visual indicator**: Yellow or green box?
2. **Manual check result**: What alert message?
3. **Console logs**: Copy/paste auth state change messages
4. **URL hash**: Still present when page loads?
5. **Network tab**: Any failed requests?
6. **Supabase dashboard**: Anything in auth logs beyond `/recover` and `/verify`?

This will help us determine the exact point of failure!

