# Vercel Environment Variables Verification Guide

## Overview

This document lists all required and optional environment variables for the CFMEU Next.js app running on Vercel. Use this guide to verify your Vercel project has all necessary variables configured.

## Required Environment Variables

### Core Supabase Configuration (CRITICAL)

These are **required** for the app to function at all:

| Variable | Scope | Required | Secret | Description |
|----------|-------|----------|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client | ✅ Yes | No | Your Supabase project URL (e.g., `https://xxxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | ✅ Yes | No | Supabase anonymous key (public, safe for client) |
| `SUPABASE_URL` | Server | ✅ Yes | Yes | Same as NEXT_PUBLIC_SUPABASE_URL (server-side fallback) |
| `SUPABASE_ANON_KEY` | Server | ✅ Yes | Yes | Same as NEXT_PUBLIC_SUPABASE_ANON_KEY (server-side fallback) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | ✅ Yes | Yes | Supabase service role key (for admin operations) |

**Verification**: App should be able to authenticate users and connect to database.

### Application URL Configuration

| Variable | Scope | Required | Secret | Description |
|----------|-------|----------|--------|-------------|
| `NEXT_PUBLIC_APP_URL` | Client | ⚠️ Recommended | No | Production app URL (e.g., `https://cfmeu.uconstruct.app`) |

**Why it's important**: Used for generating share links, email links, and other absolute URLs. Without it, share links may use incorrect preview URLs.

**Verification**: Check that share links generated in production use the correct domain.

### Dashboard Worker Configuration (Optional but Recommended)

| Variable | Scope | Required | Secret | Description |
|----------|-------|----------|--------|-------------|
| `NEXT_PUBLIC_DASHBOARD_WORKER_URL` | Client | ⚠️ Optional | No | Railway dashboard worker URL (e.g., `https://cfmeu-dashboard-worker.railway.app`) |
| `NEXT_PUBLIC_USE_WORKER_DASHBOARD` | Client | ⚠️ Optional | No | Set to `"true"` to use worker, `"false"` or unset to use direct Supabase queries |

**When to use**: If you have the dashboard worker deployed on Railway, set these to offload dashboard queries.

**Verification**: 
- Check `/api/health/workers` endpoint - should show worker status
- Dashboard should load data (either from worker or direct Supabase fallback)

### Google Maps Configuration

| Variable | Scope | Required | Secret | Description |
|----------|-------|----------|--------|-------------|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Client | ⚠️ Optional | No | Google Maps JavaScript API key |

**Verification**: Maps should load on project pages and mobile map views.

## Optional Feature Flags

These control specific features and can be enabled/disabled as needed:

| Variable | Scope | Default | Description |
|----------|-------|---------|-------------|
| `NEXT_PUBLIC_USE_WORKER_PROJECTS` | Client | `false` | Use worker for project queries |
| `NEXT_PUBLIC_USE_EMPLOYER_MAT_VIEW` | Client | `true` | Use materialized view for employer search |
| `NEXT_PUBLIC_SHOW_DEBUG_BADGES` | Client | `false` | Show debug information badges |

## How to Verify Environment Variables in Vercel

### Step 1: Access Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your `cfmeu-nextjs` project
3. Navigate to **Settings** → **Environment Variables**

### Step 2: Check Each Variable

For each required variable above:
- ✅ Verify it exists
- ✅ Verify it's set for **Production** environment (and Preview if needed)
- ✅ Verify the value is correct (especially URLs and keys)

### Step 3: Verify After Deployment

After ensuring all variables are set:

1. **Redeploy** your application (or wait for next automatic deployment)
2. **Check deployment logs** for any environment variable warnings
3. **Test the application**:
   - Authentication should work
   - Dashboard should load
   - Maps should display (if Google Maps key is set)
   - Share links should use correct domain

## Common Issues and Solutions

### Issue: App builds but shows blank pages or errors

**Possible causes**:
- Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Incorrect Supabase credentials

**Solution**: Verify Supabase variables are set correctly in Vercel dashboard.

### Issue: Share links use wrong domain

**Possible causes**:
- Missing `NEXT_PUBLIC_APP_URL`
- Variable set to preview URL instead of production URL

**Solution**: Set `NEXT_PUBLIC_APP_URL=https://cfmeu.uconstruct.app` (or your production domain).

### Issue: Dashboard data doesn't load

**Possible causes**:
- Worker URL incorrect or worker not accessible
- CORS issues with worker
- Missing `NEXT_PUBLIC_USE_WORKER_DASHBOARD` flag

**Solution**: 
- Check `/api/health/workers` endpoint
- Verify worker URL is correct
- App should fallback to direct Supabase if worker fails

### Issue: Maps don't load

**Possible causes**:
- Missing `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- API key restrictions (domain/IP)

**Solution**: 
- Verify Google Maps API key is set
- Check Google Cloud Console for API key restrictions

## Verification Checklist

Use this checklist to verify your Vercel deployment:

- [ ] All required Supabase variables are set
- [ ] `NEXT_PUBLIC_APP_URL` is set to production domain
- [ ] Dashboard worker variables are set (if using worker)
- [ ] Google Maps API key is set (if using maps)
- [ ] All variables are set for **Production** environment
- [ ] Application redeployed after setting variables
- [ ] Authentication works in production
- [ ] Dashboard loads data
- [ ] Share links use correct domain
- [ ] Maps display correctly (if applicable)
- [ ] No console errors related to missing variables

## Testing Environment Variables

### Health Check Endpoint

Visit: `https://[your-vercel-url]/api/health/workers`

This endpoint will show:
- Worker connectivity status
- Environment variable configuration status
- Service health

### Browser Console Check

Open browser DevTools console in production and check for:
- ✅ No errors about missing environment variables
- ✅ No CSP violations
- ✅ Successful API calls

## Quick Reference: Minimum Required Variables

For the app to function at minimum:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_APP_URL=https://cfmeu.uconstruct.app
```

## Additional Resources

- [Vercel Environment Variables Documentation](https://vercel.com/docs/concepts/projects/environment-variables)
- [Supabase Environment Variables Guide](https://supabase.com/docs/guides/getting-started/local-development#environment-variables)
- See `docs/ENV_MATRIX.md` for complete environment variable matrix





