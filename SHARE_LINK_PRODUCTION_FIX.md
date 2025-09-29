# Share Link Production Fix

## Issue
The "Share Mapping Sheet Webform" feature was failing on Vercel production deployment (cfmeu.uconstruct.app) with 404 errors. The generated links were using incorrect base URLs.

## Root Cause
The base URL generation logic in `src/lib/share-links.ts` and `src/app/api/projects/[projectId]/generate-share-link/route.ts` was relying on `VERCEL_URL` which might not point to the correct production domain.

## Solution Applied

### 1. Updated Base URL Logic
Modified `getBaseUrl()` function to use a more reliable fallback chain:

1. `NEXT_PUBLIC_APP_URL` (highest priority - explicitly set)
2. `VERCEL_PROJECT_PRODUCTION_URL` (Vercel's production domain)
3. `VERCEL_URL` (fallback for preview deployments)
4. `http://localhost:3000` (development)

### 2. Updated Share Link Generation
- Modified the route to use the centralized `getBaseUrl()` function
- Added proper import for the shared utility

## Required Environment Variable Setup

### For Production (cfmeu.uconstruct.app)

In your Vercel project settings, add:
```bash
NEXT_PUBLIC_APP_URL=https://cfmeu.uconstruct.app
```

### Alternative: Using Vercel System Variables
If you prefer to use Vercel's automatic environment variables, ensure your deployment has access to `VERCEL_PROJECT_PRODUCTION_URL`.

## Testing the Fix

1. **Deploy the updated code** to Vercel
2. **Set the environment variable** in Vercel dashboard
3. **Test share link generation**:
   - Go to any project's mapping sheet
   - Click the "Share" button
   - Generate a share link
   - Verify the link uses `https://cfmeu.uconstruct.app/share/[token]`
   - Test the generated link in a new browser/incognito window

## Files Modified

- `src/lib/share-links.ts` - Enhanced `getBaseUrl()` function
- `src/app/api/projects/[projectId]/generate-share-link/route.ts` - Use centralized URL logic

## Deployment Checklist

- [ ] Code changes deployed to Vercel
- [ ] Environment variable `NEXT_PUBLIC_APP_URL` set in Vercel dashboard
- [ ] Share link generation tested in production
- [ ] Share link access tested (should load the public form)
- [ ] Form submission tested from shared link

## Environment Variable Setup Instructions

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to your cfmeu-nextjs project
3. Go to Settings → Environment Variables
4. Add new variable:
   - **Name**: `NEXT_PUBLIC_APP_URL`
   - **Value**: `https://cfmeu.uconstruct.app`
   - **Environment**: Production (and Preview if desired)
5. Redeploy your application

## Verification

After deployment, share links should generate as:
```
https://cfmeu.uconstruct.app/share/[48-character-token]
```

And should successfully load the public mapping sheet form without 404 errors.
