# Supabase Password Reset Configuration Fix

## Problem Identified

When testing password reset:
- ✅ Email is sent
- ✅ Link opens reset page
- ❌ **URL has NO token**: `https://app.com/auth/reset-password` (empty hash)
- ❌ Should have: `https://app.com/auth/reset-password#access_token=xyz&type=recovery`

**Root Cause**: Supabase email template configuration is incorrect or redirect URL is not allowed.

## Solution: Fix Supabase Dashboard Settings

### Step 1: Check Redirect URL Whitelist

1. Go to **Supabase Dashboard** → Your Project
2. Click **Authentication** in left sidebar
3. Click **URL Configuration**
4. Under **Redirect URLs**, ensure this is in the list:
   ```
   https://your-production-domain.com/auth/reset-password
   ```
   
5. For local testing, also add:
   ```
   http://localhost:3000/auth/reset-password
   ```

6. Click **Save**

### Step 2: Check Email Template

1. Still in **Authentication** section
2. Click **Email Templates** in left sidebar
3. Select **"Reset Password"** (or "Change Email Request")
4. Check the email HTML contains the correct variable:

**❌ WRONG** (will not include token):
```html
<a href="{{ .SiteURL }}/auth/reset-password">Reset Password</a>
```

**✅ CORRECT** (includes token automatically):
```html
<a href="{{ .ConfirmationURL }}">Reset Password</a>
```

5. The **default template** should use `{{ .ConfirmationURL }}` which includes the token
6. If you customized the template, make sure you're using the right variable

### Step 3: Verify Email Template Variables

Supabase provides these variables for password reset emails:

| Variable | What It Contains | Use For |
|----------|------------------|---------|
| `{{ .ConfirmationURL }}` | Full URL with token in hash | **Password reset links** ✅ |
| `{{ .SiteURL }}` | Base site URL only | General links (no token) |
| `{{ .Token }}` | Raw token string | Manual construction (not needed) |
| `{{ .TokenHash }}` | Token as hash fragment | Alternative (but use ConfirmationURL) |

**Always use `{{ .ConfirmationURL }}`** for password reset links.

### Step 4: Check Site URL Configuration

1. In **Authentication** → **URL Configuration**
2. Verify **Site URL** is set correctly:
   ```
   Production: https://your-production-domain.com
   Local dev: http://localhost:3000
   ```

3. This is the base that `{{ .ConfirmationURL }}` builds from

### Step 5: Test Email Content

1. Trigger a password reset
2. **Check the email HTML source** (not just clicking the link):
   - Gmail: Open email → Three dots menu → "Show original"
   - Outlook: Open email → View → "View message source"
3. Find the reset password link in the HTML
4. It should look like:
   ```html
   <a href="https://your-app.com/auth/reset-password#access_token=eyJhbG...&type=recovery&...">
   ```

If the link in the EMAIL already lacks the token, the problem is the email template.

## Common Mistakes

### Mistake 1: Custom Template Missing Token
**Symptom**: Email link has no hash token

**Fix**: Change this:
```html
<a href="{{ .SiteURL }}/auth/reset-password">
```

To this:
```html
<a href="{{ .ConfirmationURL }}">
```

### Mistake 2: Wrong Redirect URL in Code
**Symptom**: Email goes to wrong page or has no token

**Fix**: The code already uses `redirectTo` correctly:
```typescript
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/auth/reset-password`,
})
```

But Supabase will **append the hash automatically**. Don't add it yourself!

### Mistake 3: Redirect URL Not Whitelisted
**Symptom**: Email link redirects to Supabase error page or strips token

**Fix**: Add your redirect URL to the whitelist (Step 1 above)

### Mistake 4: Using Wrong Email Template Type
**Symptom**: Email uses wrong format

**Fix**: Make sure you're editing the **"Reset Password"** template, not "Confirm Signup" or "Magic Link"

## Testing After Fix

### Test 1: Check Email HTML

1. Trigger password reset
2. Open email
3. Right-click the "Reset Password" button/link
4. Copy link address
5. Paste in notepad - should see:
   ```
   https://your-app.com/auth/reset-password#access_token=eyJhbG...&type=recovery&...
   ```

If the token is there in the email, proceed to Test 2.

### Test 2: Test the Link

1. Open the reset link in clean incognito browser
2. Check browser console for:
   ```
   Password reset page loaded
   Auth state change: PASSWORD_RECOVERY Has session: true
   ✅ Password recovery session established
   ```

3. Page should show:
   ```
   ✓ Recovery session active (green box)
   ```

4. Enter new password and submit
5. Should succeed!

## Alternative: Manual Token Handling (Not Recommended)

If you can't fix the email template, you can manually handle the token:

```typescript
// In reset-password page
useEffect(() => {
  const hashParams = new URLSearchParams(window.location.hash.substring(1))
  const token = hashParams.get('access_token')
  const type = hashParams.get('type')
  
  if (token && type === 'recovery') {
    // Manually set session
    supabase.auth.setSession({
      access_token: token,
      refresh_token: hashParams.get('refresh_token') || ''
    })
  }
}, [])
```

**But this is a workaround!** Fix the root cause in Supabase Dashboard instead.

## Verifying the Fix

After making changes in Supabase Dashboard:

1. **Trigger new password reset** (old emails won't have the fix)
2. **Check email HTML source** for token in URL
3. **Test in incognito browser** 
4. **Check console**: Should see "✓ Recovery session active"
5. **Set new password** - Should work!

## Default Supabase Email Template

For reference, the **default password reset template** should look like:

```html
<h2>Reset Password</h2>
<p>Follow this link to reset the password for your user:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
```

If yours looks different, you may have customized it incorrectly.

## Still Not Working?

If the email STILL doesn't have the token after fixing the template:

### Check 1: SMTP Settings
Bad SMTP config can cause issues. Verify in **Project Settings** → **Authentication** → **SMTP Settings**

### Check 2: Supabase Version
Older Supabase versions had bugs with password reset. Check:
- Dashboard → Project Settings → General
- If version is old, may need to contact Supabase support

### Check 3: Middleware Interference
Check if you have middleware that strips URL hashes:

```typescript
// src/middleware.ts
// Make sure it doesn't strip hashes for /auth/* routes
```

### Check 4: Try Magic Link Instead
As a test, try the magic link flow to see if that works:
```typescript
await supabase.auth.signInWithOtp({ email })
```

If magic links work but password reset doesn't, it's definitely the email template.

## Quick Checklist

- [ ] Redirect URL is in whitelist (Authentication → URL Configuration)
- [ ] Email template uses `{{ .ConfirmationURL }}`
- [ ] Site URL is correct (Authentication → URL Configuration)
- [ ] Tested with NEW reset email (not old one)
- [ ] Email HTML source shows token in URL
- [ ] Incognito browser test shows green "Recovery session active"
- [ ] Can successfully set new password

## Contact Supabase Support

If nothing works, contact Supabase support with:
- Project ref/ID
- Email template screenshot
- URL configuration screenshot
- Raw email HTML with link
- "Password reset emails not including recovery token in URL"

They can check server-side configuration issues.

