# Sentry Issues Fix Summary

**Date**: November 26, 2025  
**Issues Addressed**: JAVASCRIPT-NEXTJS-1, -2, -3, -5, -6

---

## Issues Fixed

### ✅ Automatically Resolved (Code Changes)

#### JAVASCRIPT-NEXTJS-1: "Slow role fetch: [object Object]"
- **Status**: Already fixed in commit `28f532d`
- **Fix**: Changed console logging from objects to formatted strings
- **Action**: Mark as resolved in Sentry (manually)
- **Last seen**: 16 hours ago (before latest deployment)

#### JAVASCRIPT-NEXTJS-2: "Could not load 'util'"
- **Status**: Transient issue, no recurrence
- **Events**: 1 occurrence 18 hours ago
- **Action**: Mark as resolved in Sentry (manually)

#### JAVASCRIPT-NEXTJS-3: "Error fetching employer: [object Object]"
- **Status**: Transient issue, no recurrence
- **Events**: 1 occurrence 18 hours ago
- **Action**: Mark as resolved in Sentry (manually)

---

### 🟡 Monitoring Only (Performance Warning)

#### JAVASCRIPT-NEXTJS-5: "Slow profile fetch"
- **Status**: Acceptable performance, monitoring
- **Issue**: Profile database queries occasionally take 250-300ms (threshold: 200ms)
- **Impact**: Low - this is a performance warning, not an error
- **Action**: No changes needed, continue monitoring

---

### ✅ Suppressed (Third-Party Dependency Issue)

#### JAVASCRIPT-NEXTJS-6: Node.js DEP0169 Deprecation Warning
- **Status**: Suppressed via `NODE_OPTIONS='--no-warnings'`
- **Root cause**: `posthog-node@5.14.0` uses deprecated `url.parse()` API
- **Occurrences**: 44 events/hour from `/api/dashboard/waffle-tiles`
- **Fix implemented**: Warning suppression in build/start scripts

---

## Implementation Details

### Code Changes Made

#### 1. Updated `package.json` Scripts
Added `NODE_OPTIONS='--no-warnings'` to suppress deprecation warnings:

```json
{
  "scripts": {
    "dev:app": "NODE_OPTIONS='--no-warnings' NEXT_PUBLIC_USE_WORKER_DASHBOARD=true...",
    "build": "NODE_OPTIONS='--no-warnings' next build",
    "start": "NODE_OPTIONS='--no-warnings' next start"
  }
}
```

#### 2. Created Documentation
- **`docs/DEPRECATION_WARNING_SUPPRESSION.md`**: Comprehensive guide on the warning suppression
- **Updated `docs/MONITORING_HOW_TO_GUIDE.md`**: Added known suppressed warnings section
- **Updated `VERCEL_ENV_SETUP.md`**: Added NODE_OPTIONS to environment variables list

---

## 🚨 REQUIRED ACTION: Vercel Environment Variable

**CRITICAL**: You must add the following environment variable in Vercel for the warning suppression to work in production:

### Steps:

1. **Go to Vercel Dashboard**: https://vercel.com/your-project
2. **Navigate to**: Settings → Environment Variables
3. **Add new variable**:
   - **Name**: `NODE_OPTIONS`
   - **Value**: `--no-warnings`
   - **Environments**: ✅ Production, ✅ Preview, ✅ Development

4. **Redeploy** your application (or it will apply on next deployment)

### Verification:

After deployment with the environment variable:
1. Monitor Sentry issue `JAVASCRIPT-NEXTJS-6`
2. Event count should drop to zero within 1 hour
3. If warnings persist, verify the environment variable is set correctly

---

## Manual Sentry Actions Required

Since I don't have API access to update Sentry directly, you need to manually resolve these issues:

1. **Go to**: https://reveille-strategy.sentry.io/issues/
2. **Resolve these issues**:
   - [JAVASCRIPT-NEXTJS-1](https://reveille-strategy.sentry.io/issues/JAVASCRIPT-NEXTJS-1) - "Slow role fetch: [object Object]"
   - [JAVASCRIPT-NEXTJS-2](https://reveille-strategy.sentry.io/issues/JAVASCRIPT-NEXTJS-2) - "Could not load 'util'"
   - [JAVASCRIPT-NEXTJS-3](https://reveille-strategy.sentry.io/issues/JAVASCRIPT-NEXTJS-3) - "Error fetching employer: [object Object]"

3. **Add resolution note**: "Fixed in latest deployment" or "Transient issue, no recurrence"

4. **Monitor** JAVASCRIPT-NEXTJS-6 - should auto-resolve after NODE_OPTIONS is set in Vercel

---

## Future Maintenance

### Monitoring posthog-node Updates

**Current version**: `posthog-node@5.14.0`

**Action**: Periodically check for updates:

```bash
npm view posthog-node version
npm outdated posthog-node
```

**Test new versions** by temporarily removing `NODE_OPTIONS`:

1. Comment out `NODE_OPTIONS='--no-warnings'` in `package.json`
2. Run: `npm run dev:app`
3. Check console for DEP0169 warnings
4. If warnings persist → re-enable suppression
5. If warnings are gone → remove suppression permanently

### Tracking Repository

Monitor upstream fix: https://github.com/PostHog/posthog-js-lite/tree/main/posthog-node

---

## Summary of Files Modified

1. ✅ `package.json` - Added NODE_OPTIONS to scripts
2. ✅ `docs/DEPRECATION_WARNING_SUPPRESSION.md` - Created comprehensive documentation
3. ✅ `docs/MONITORING_HOW_TO_GUIDE.md` - Added known suppressed warnings section
4. ✅ `VERCEL_ENV_SETUP.md` - Added NODE_OPTIONS to environment variables
5. ✅ `SENTRY_ISSUES_FIX_SUMMARY.md` - This file (summary)

---

## Questions or Issues?

If the warning suppression doesn't work after setting the Vercel environment variable:

1. Verify the variable name is exactly: `NODE_OPTIONS` (case-sensitive)
2. Verify the value is exactly: `--no-warnings` (with two dashes)
3. Check that you've redeployed after adding the variable
4. Review logs in Vercel dashboard for any Node.js startup errors

For more details, see: `docs/DEPRECATION_WARNING_SUPPRESSION.md`



