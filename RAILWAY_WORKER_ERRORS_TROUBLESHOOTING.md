# Railway Dashboard Worker Errors - Troubleshooting Guide

## Error Summary

Based on your Railway logs, there are two main errors occurring:

1. **JWT verification failed** - Authentication tokens are being rejected
2. **Coverage ladders endpoint error** - Database query failures in the coverage ladders endpoint

## Error 1: JWT Verification Failed

### What It Means

The worker is receiving requests with JWT tokens, but when it tries to verify them using Supabase, the verification fails. This happens in `verifyJWT()` function which calls `serviceClient.auth.getUser(jwt)`.

### Root Causes

1. **Supabase Configuration Mismatch**
   - Railway worker's `SUPABASE_URL` doesn't match Vercel's `NEXT_PUBLIC_SUPABASE_URL`
   - Railway worker's `SUPABASE_SERVICE_KEY` (service role key) doesn't match the Supabase project
   - Railway worker's `SUPABASE_ANON_KEY` is missing or incorrect

2. **Expired or Invalid Tokens**
   - User session tokens have expired
   - Token format is incorrect

3. **Token Not Being Sent Correctly**
   - Authorization header not being set properly
   - Token extraction failing

### Diagnostic Steps

#### Step 1: Verify Railway Environment Variables

Check your Railway dashboard worker has these set correctly:

```bash
SUPABASE_URL=https://xxxxx.supabase.co  # Must match Vercel's NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Service role key from Supabase (NOTE: variable name is SUPABASE_SERVICE_KEY, not SUPABASE_SERVICE_ROLE_KEY)
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Anon key (required by worker)
```

**IMPORTANT**: The dashboard worker uses `SUPABASE_SERVICE_KEY` (not `SUPABASE_SERVICE_ROLE_KEY`). This is the same value as the service role key from Supabase, just a different variable name.

**Action**: 
1. Go to Railway → Your Dashboard Worker → Variables
2. Verify `SUPABASE_URL` matches exactly with your Vercel `NEXT_PUBLIC_SUPABASE_URL`
3. Verify `SUPABASE_SERVICE_KEY` is set (this is the service role key from Supabase dashboard)
4. Verify `SUPABASE_ANON_KEY` is set (required by the worker)

#### Step 2: Verify Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Verify:
   - **Project URL** matches `SUPABASE_URL` in Railway
   - **service_role key** matches `SUPABASE_SERVICE_KEY` in Railway (note: variable name is `SUPABASE_SERVICE_KEY`, not `SUPABASE_SERVICE_ROLE_KEY`)

#### Step 3: Test JWT Verification

The worker logs should show more details. Check Railway logs for:

```
JWT verification failed
```

If you see this, it means:
- Token was received but verification failed
- Check the error details in logs (may show "Invalid or expired token")

#### Step 4: Check Token Sending

Verify the Next.js app is sending tokens correctly:

1. Open browser DevTools → Network tab
2. Look for requests to your worker URL (e.g., `https://cfmeu-dashboard-worker.railway.app/v1/dashboard`)
3. Check the **Request Headers**:
   - Should have: `Authorization: Bearer <token>`
   - Token should be a JWT string

### Solutions

#### Solution 1: Fix Environment Variables

If Railway variables are wrong:

1. Go to Railway → Dashboard Worker → Variables
2. Update `SUPABASE_URL` to match Vercel exactly
3. Update `SUPABASE_SERVICE_KEY` with the service role key from Supabase dashboard (Settings → API → service_role key)
4. Ensure `SUPABASE_ANON_KEY` is set (from Supabase dashboard, Settings → API → anon/public key)
5. **Redeploy** the worker

#### Solution 2: Verify Token Source

The Next.js app sends `session.access_token` from Supabase. Verify:

1. User is logged in (has active session)
2. Session token is valid (not expired)
3. Token is being extracted correctly in `useNewDashboardData.tsx` (line 286)

#### Solution 3: Add Better Error Logging

The worker should log more details. Check if you can see:
- What error Supabase returns
- Token format issues
- Network connectivity issues

## Error 2: Coverage Ladders Endpoint Error

### What It Means

The `/v1/coverage-ladders` endpoint is catching errors during database queries. This could be:
- Database connection issues
- Query syntax errors
- Missing data/views
- Permission issues

### Root Causes

1. **Database View Missing**
   - `patch_project_mapping_view` doesn't exist
   - View is not accessible

2. **Query Errors**
   - Invalid query syntax
   - Missing columns
   - Data type mismatches

3. **Permission Issues**
   - Service role doesn't have access to required tables
   - RLS policies blocking access

### Diagnostic Steps

#### Step 1: Check Database Views

Verify these views exist in your Supabase database:

```sql
-- Check if view exists
SELECT * FROM information_schema.views 
WHERE table_name = 'patch_project_mapping_view';

-- Check if view is accessible
SELECT COUNT(*) FROM patch_project_mapping_view;
```

#### Step 2: Check Worker Logs for Specific Error

The error is logged at line 1032 in the worker. Check Railway logs for the actual error message:

```
Coverage ladders endpoint error
```

Look for the error details above this line - it should show what query failed.

#### Step 3: Test Endpoint Directly

Try calling the endpoint directly (requires authentication):

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://your-worker.railway.app/v1/coverage-ladders?tier=all&stage=construction&universe=active"
```

### Solutions

#### Solution 1: Verify Database Views

Run this SQL in Supabase SQL Editor to check views:

```sql
-- List all views
SELECT schemaname, viewname 
FROM pg_views 
WHERE schemaname = 'public'
ORDER BY viewname;
```

Ensure these views exist:
- `patch_project_mapping_view`
- `project_list_comprehensive_view` (used in health check)

#### Solution 2: Check Query Syntax

The coverage ladders endpoint queries:
- `projects` table
- `project_assignments` table
- `employers` table
- `company_eba_records` table

Verify these tables exist and have the expected columns.

#### Solution 3: Add More Detailed Logging

The worker should log the actual error. Check if you can see:
- Which query failed
- What error Supabase returned
- Which line in the code failed

## Common Issues and Quick Fixes

### Issue: "JWT verification failed" but tokens work in Vercel

**Cause**: Railway worker's Supabase configuration doesn't match Vercel's

**Fix**: 
1. Copy `NEXT_PUBLIC_SUPABASE_URL` from Vercel
2. Set as `SUPABASE_URL` in Railway
3. Get service role key from Supabase dashboard (Settings → API → service_role key)
4. Set as `SUPABASE_SERVICE_KEY` in Railway (note: variable name is `SUPABASE_SERVICE_KEY`, not `SUPABASE_SERVICE_ROLE_KEY`)
5. Get anon key from Supabase dashboard (Settings → API → anon/public key)
6. Set as `SUPABASE_ANON_KEY` in Railway
7. Redeploy worker

### Issue: "Coverage ladders endpoint error" but other endpoints work

**Cause**: Missing database view or query syntax issue

**Fix**:
1. Check if `patch_project_mapping_view` exists
2. Verify view has correct columns
3. Check worker logs for specific SQL error
4. Run the failing query manually in Supabase SQL Editor

### Issue: Errors only in production, not localhost

**Cause**: Environment variable differences or database schema differences

**Fix**:
1. Compare Railway variables with local `.env`
2. Verify production database has same schema as local
3. Check if views exist in production database

## Verification Checklist

After applying fixes, verify:

- [ ] Railway `SUPABASE_URL` matches Vercel `NEXT_PUBLIC_SUPABASE_URL` exactly
- [ ] Railway `SUPABASE_SERVICE_KEY` is set to the service role key from Supabase
- [ ] Railway `SUPABASE_ANON_KEY` is set to the anon key from Supabase
- [ ] Worker health endpoint works: `https://your-worker.railway.app/health`
- [ ] No "JWT verification failed" errors in Railway logs
- [ ] No "Coverage ladders endpoint error" in Railway logs
- [ ] Dashboard data loads in Vercel app
- [ ] Coverage ladders component displays data

## Getting More Information

### Enable Debug Logging

Set in Railway worker environment variables:

```bash
LOG_LEVEL=debug
```

This will show more detailed error messages in logs.

### Check Specific Endpoints

Test these endpoints directly:

1. **Health Check** (no auth required):
   ```
   GET https://your-worker.railway.app/health
   ```

2. **Dashboard** (requires auth):
   ```
   GET https://your-worker.railway.app/v1/dashboard
   Authorization: Bearer YOUR_JWT_TOKEN
   ```

3. **Coverage Ladders** (requires auth):
   ```
   GET https://your-worker.railway.app/v1/coverage-ladders?tier=all&stage=construction&universe=active
   Authorization: Bearer YOUR_JWT_TOKEN
   ```

## Next Steps

1. **Verify Railway Environment Variables** - Most common issue
2. **Check Railway Logs** - Look for specific error messages
3. **Test Endpoints** - Verify which endpoints are failing
4. **Check Database** - Ensure views and tables exist
5. **Compare Configurations** - Railway vs Vercel vs Local

## Related Documentation

- `VERCEL_ENVIRONMENT_VARIABLES_VERIFICATION.md` - Vercel env setup
- `VERCEL_DIAGNOSTIC_GUIDE.md` - General Vercel troubleshooting
- `docs/ENV_MATRIX.md` - Complete environment variable matrix

