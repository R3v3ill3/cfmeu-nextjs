# Railway Dashboard Worker - JWT Fix Deployment

## What Was Fixed

The dashboard worker had an incorrect JWT validation implementation that could fail intermittently. The fix ensures proper token validation using Supabase's service role client.

### Changes Made

**File: `railway_workers/cfmeu-dashboard-worker/src/supabase.ts`**
- Added `verifyJWT()` function that properly validates JWT tokens using service role client
- Updated `getUserClientFromToken()` to use service role for queries with proper JWT validation
- Added detailed comments explaining the approach

**File: `railway_workers/cfmeu-dashboard-worker/src/index.ts`**
- Updated `ensureAuthorizedUser()` to use the new `verifyJWT()` function
- Added better error logging for auth failures
- Added debug logging for successful authorizations

## Why This Matters

Even though the immediate issue was browser cache, this fix prevents:
- ❌ Intermittent auth failures when tokens expire
- ❌ Silent failures in JWT validation
- ❌ Reliance on browser session state
- ❌ Inconsistent behavior between environments

## Deployment Steps

### 1. Commit and Push Changes

```bash
cd /Volumes/DataDrive/cursor_repos/cfmeu-nextjs

git add railway_workers/cfmeu-dashboard-worker/src/supabase.ts
git add railway_workers/cfmeu-dashboard-worker/src/index.ts
git commit -m "fix: improve JWT validation in dashboard worker"
git push origin main
```

### 2. Deploy to Railway

Railway should auto-deploy when you push to main. Monitor the deployment:

1. Go to Railway dashboard → `cfmeu-dashboard-worker` service
2. Watch the deployment logs
3. Look for: `cfmeu-dashboard-worker listening`
4. Verify no "Dashboard endpoint error" messages appear

### 3. Verify Environment Variables

Ensure these are set in Railway for `cfmeu-dashboard-worker`:

**Required:**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Service role key (starts with `eyJ...`)
- `SUPABASE_ANON_KEY` - Anonymous key

**Optional:**
- `PORT` - Defaults to 3000
- `CORS_ORIGIN` - Defaults to `*`
- `REFRESH_CRON` - Defaults to `*/10 * * * *` (every 10 minutes)
- `LOG_LEVEL` - Defaults to `info`, use `debug` for more verbose logging

### 4. Test the Fix

After deployment:

```bash
# Get your JWT token from browser console:
# (await supabase.auth.getSession()).data.session.access_token

# Test the dashboard endpoint:
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://your-dashboard-worker.railway.app/v1/dashboard
```

Expected response: JSON with dashboard data
Error response: Check Railway logs for detailed error messages

### 5. Monitor Logs

Watch Railway logs for:
- ✅ `User authorized` (debug level) - JWT validation succeeded
- ⚠️ `JWT verification failed` - Invalid/expired tokens
- ⚠️ `No profile found for user` - User exists but no profile
- ⚠️ `User role not allowed` - User doesn't have required role

## Browser Cache Issue Prevention

For future troubleshooting, remember:
- 🔄 Test in incognito/private browsing mode first
- 🗑️ Clear browser cache and cookies if auth seems broken
- 🔑 Check that localStorage/sessionStorage doesn't have stale tokens
- 🕐 JWT tokens expire - refresh might be needed

## Rollback Plan

If the deployment causes issues:

1. In Railway dashboard, go to deployments
2. Click on the previous working deployment
3. Click "Redeploy"

Or revert the Git commit:

```bash
git revert HEAD
git push origin main
```

## Success Criteria

- ✅ Dashboard loads without errors in browser
- ✅ Admin menu appears for admin users
- ✅ No "Dashboard endpoint error" in Railway logs
- ✅ `/v1/dashboard` endpoint returns 200 with valid JWT
- ✅ Materialized views continue to refresh (check logs every 10 minutes)

