# Vercel Production Diagnostic Guide

## Overview

This guide helps diagnose issues when the app builds successfully on Vercel but fails to function in production.

## Step 1: Check Deployment Logs

### Access Deployment Logs

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Navigate to **Deployments** tab
4. Click on the latest deployment
5. Review the **Build Logs** and **Runtime Logs**

### What to Look For

**Build Logs**:
- ✅ Build completes successfully
- ✅ No TypeScript errors
- ✅ No missing dependency errors
- ⚠️ Any warnings about environment variables

**Runtime Logs**:
- ✅ Server starts successfully
- ⚠️ Any runtime errors
- ⚠️ Missing environment variable warnings
- ⚠️ Database connection errors

## Step 2: Test Health Endpoints

### Worker Health Check

Visit: `https://[your-vercel-url]/api/health/workers`

**Expected Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-01-06T...",
  "healthChecks": [
    {
      "service": "Dashboard Worker",
      "status": "healthy" | "unhealthy" | "disabled" | "error",
      "responseTime": 123,
      "url": "https://...",
      "error": null
    }
  ]
}
```

**What to Check**:
- ✅ All services show status
- ⚠️ If worker is "error" or "unhealthy", check:
  - Worker URL is correct
  - Worker is accessible from Vercel
  - CORS is configured on worker
  - Network connectivity

### General Health Check

Visit: `https://[your-vercel-url]/api/health`

**Expected Response**: `{ "status": "ok" }`

## Step 3: Check Browser Console

### Open Browser DevTools

1. Open your production app in a browser
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to **Console** tab
4. Look for errors

### Common Console Errors

#### Missing Environment Variables
```
Error: NEXT_PUBLIC_SUPABASE_URL is not defined
```
**Solution**: Verify environment variables are set in Vercel dashboard

#### CSP Violations
```
Content Security Policy: The page's settings blocked the loading of a resource
```
**Solution**: Check `src/middleware.ts` CSP configuration, especially `connect-src` for worker URLs

#### Failed Fetch Requests
```
Failed to fetch: https://...
```
**Solution**: 
- Check network tab for failed requests
- Verify URLs are correct
- Check CORS configuration
- Verify worker is accessible

#### Authentication Errors
```
Auth session missing!
```
**Solution**: 
- Verify Supabase credentials are correct
- Check Supabase project is active
- Verify RLS policies are configured

## Step 4: Verify Environment Variables

See `VERCEL_ENVIRONMENT_VARIABLES_VERIFICATION.md` for complete checklist.

### Quick Check

1. Go to Vercel Dashboard → Settings → Environment Variables
2. Verify these are set for **Production**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL`

### Test Environment Variable Access

Create a test API route to verify variables (remove after testing):

```typescript
// src/app/api/test-env/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasAppUrl: !!process.env.NEXT_PUBLIC_APP_URL,
    // Don't expose actual values in production!
  })
}
```

Visit: `https://[your-vercel-url]/api/test-env`

**Expected**: All should be `true`

## Step 5: Test Key Functionality

### Authentication Flow

1. Navigate to production app
2. Try to log in
3. Check if authentication works
4. Check if user session persists

**If failing**: Check Supabase credentials and RLS policies

### Dashboard Loading

1. Log in to production app
2. Navigate to dashboard
3. Check if dashboard data loads
4. Check browser console for errors

**If failing**: 
- Check worker connectivity (if using worker)
- Check direct Supabase queries (if not using worker)
- Verify user has proper permissions

### Project/Employer Pages

1. Navigate to a project page
2. Navigate to an employer page
3. Check if data loads
4. Check for any errors

**If failing**: Check database connectivity and RLS policies

## Step 6: Check Network Requests

### Open Network Tab

1. Open DevTools → **Network** tab
2. Reload the page
3. Look for failed requests (red status codes)

### Common Failed Requests

#### 404 Errors
- **Cause**: Route doesn't exist or build didn't include route
- **Solution**: Check build logs, verify route exists

#### 500 Errors
- **Cause**: Server-side error
- **Solution**: Check Vercel function logs, check API route code

#### CORS Errors
- **Cause**: Worker or external API blocking requests
- **Solution**: Check CORS configuration on worker/API

#### Timeout Errors
- **Cause**: Request taking too long
- **Solution**: Check worker response times, optimize queries

## Step 7: Verify CSP Configuration

### Check CSP Headers

1. Open DevTools → **Network** tab
2. Select the main document request
3. Check **Response Headers** → `Content-Security-Policy`

### Common CSP Issues

#### Worker URL Not Allowed
```
connect-src 'self' https://*.supabase.co ... (missing worker URL)
```
**Solution**: Verify `NEXT_PUBLIC_DASHBOARD_WORKER_URL` is set and CSP includes it

#### Google Maps Blocked
```
script-src ... (missing maps.googleapis.com)
```
**Solution**: Verify Google Maps is in CSP `script-src` and `connect-src`

## Step 8: Check Supabase Connection

### Verify Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Verify project is active
3. Check project URL matches `NEXT_PUBLIC_SUPABASE_URL`
4. Verify API keys are correct

### Test Database Connection

Use Supabase SQL Editor to verify:
```sql
-- Should return current timestamp
SELECT NOW();
```

## Step 9: Verify Worker Connectivity (If Using)

### Check Worker Status

1. Visit worker health endpoint directly: `https://[worker-url]/health`
2. Should return: `{ "status": "ok" }`

### Test from Vercel

Use the health check endpoint: `https://[vercel-url]/api/health/workers`

**If worker shows as "error"**:
- Verify worker URL is correct
- Check worker is deployed and running
- Verify CORS allows Vercel domain
- Check network connectivity

## Step 10: Common Issues and Solutions

### Issue: Blank White Page

**Possible Causes**:
1. JavaScript error preventing render
2. Missing environment variables
3. Authentication redirect loop

**Diagnosis**:
- Check browser console for errors
- Check network tab for failed requests
- Check Vercel function logs

### Issue: 500 Errors on API Routes

**Possible Causes**:
1. Missing server-side environment variables
2. Database connection issues
3. Code errors in API routes

**Diagnosis**:
- Check Vercel function logs
- Check environment variables
- Test API route locally

### Issue: Data Not Loading

**Possible Causes**:
1. RLS policies blocking access
2. Worker connectivity issues
3. Database query errors

**Diagnosis**:
- Check browser console
- Check network requests
- Verify user permissions
- Check worker health

### Issue: Share Links Don't Work

**Possible Causes**:
1. `NEXT_PUBLIC_APP_URL` not set or incorrect
2. Route not deployed
3. Database token lookup failing

**Diagnosis**:
- Verify `NEXT_PUBLIC_APP_URL` is set correctly
- Check share link route exists
- Verify database connection

## Diagnostic Checklist

Use this checklist to systematically diagnose issues:

- [ ] Deployment logs show successful build
- [ ] Runtime logs show no errors
- [ ] Health endpoints respond correctly
- [ ] Browser console shows no errors
- [ ] Environment variables are set correctly
- [ ] Authentication works
- [ ] Dashboard loads data
- [ ] Network requests succeed
- [ ] CSP headers are correct
- [ ] Supabase connection works
- [ ] Worker connectivity works (if using)
- [ ] Key user workflows function

## Getting Help

If issues persist after following this guide:

1. **Collect Information**:
   - Screenshot of browser console errors
   - Vercel deployment logs
   - Network request failures
   - Health endpoint responses

2. **Check Related Documentation**:
   - `VERCEL_ENVIRONMENT_VARIABLES_VERIFICATION.md`
   - `VERCEL_BUILD_FIX.md`
   - `SHARE_LINK_PRODUCTION_FIX.md`

3. **Review Recent Changes**:
   - Check git history for recent commits
   - Review environment variable changes
   - Check for dependency updates





