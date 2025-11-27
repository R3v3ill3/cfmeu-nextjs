# Node.js Deprecation Warning Suppression

## Overview

This project suppresses Node.js deprecation warnings in production and development environments to prevent noise from third-party dependencies that have not yet updated to the latest Node.js APIs.

## Background

As of **November 26, 2025**, the application is experiencing `DEP0169` deprecation warnings from the `posthog-node@5.14.0` dependency:

```
(node:4) [DEP0169] DeprecationWarning: `url.parse()` behavior is not standardized 
and prone to errors that have security implications. Use the WHATWG URL API instead.
```

### Why This Warning Appears

- **Dependency**: `posthog-node@5.14.0` uses the deprecated `url.parse()` API internally
- **Environment**: Production on Vercel with Node.js v24.11.0
- **Frequency**: 44 occurrences/hour from `/api/dashboard/waffle-tiles` endpoint
- **Sentry Issue**: `JAVASCRIPT-NEXTJS-6`

### Why We're Suppressing Instead of Fixing

1. **Third-party code**: The issue is in `posthog-node`, not our application code
2. **Server-side tracking is critical**: PostHog server-side tracking is important during the testing phase
3. **No immediate security risk**: The deprecation warning is about future API changes, not a current vulnerability
4. **Upstream fix required**: We're waiting for PostHog to update their library to use the WHATWG URL API

## Implementation

### Local Development

The warning suppression is configured in `package.json`:

```json
{
  "scripts": {
    "dev:app": "NODE_OPTIONS='--no-warnings' NEXT_PUBLIC_USE_WORKER_DASHBOARD=true...",
    "build": "NODE_OPTIONS='--no-warnings' next build",
    "start": "NODE_OPTIONS='--no-warnings' next start"
  }
}
```

### Vercel Production Deployment

**IMPORTANT**: You must add the following environment variable in your Vercel project settings:

1. Go to your Vercel project dashboard
2. Navigate to **Settings → Environment Variables**
3. Add a new variable:
   - **Name**: `NODE_OPTIONS`
   - **Value**: `--no-warnings`
   - **Environment**: Production, Preview, Development (all)

4. Redeploy your application for the change to take effect

### Alternative: Suppress Only Specific Warning

If you want to be more specific and only suppress DEP0169 (not all warnings), you can use:

```bash
NODE_OPTIONS='--no-deprecation'
```

However, `--no-warnings` is currently used as it's simpler and catches any similar issues from dependencies.

## Monitoring & Future Actions

### Tracking the Upstream Fix

- **Issue**: Track the posthog-node repository for updates: https://github.com/PostHog/posthog-js-lite/tree/main/posthog-node
- **Version**: Currently on `posthog-node@5.14.0`
- **Action**: Check for new versions periodically and test without warning suppression

### Testing After Updates

When testing a new version of `posthog-node`:

1. Remove `NODE_OPTIONS='--no-warnings'` from scripts temporarily
2. Run the application locally:
   ```bash
   npm run dev:app
   ```
3. Check console for DEP0169 warnings
4. If warnings persist, re-enable suppression
5. If warnings are gone, remove suppression permanently

### Sentry Monitoring

- Monitor Sentry issue `JAVASCRIPT-NEXTJS-6`
- If warning count increases significantly, investigate for new sources
- Current baseline: ~44 warnings/hour from posthog-node

## Related Issues

- **Sentry**: [JAVASCRIPT-NEXTJS-6](https://reveille-strategy.sentry.io/issues/JAVASCRIPT-NEXTJS-6)
- **Node.js Deprecation**: [DEP0169](https://nodejs.org/docs/latest/api/deprecations.html#DEP0169)
- **Root Cause**: `url.parse()` in posthog-node dependency

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-11-26 | Suppress DEP0169 warnings via `NODE_OPTIONS='--no-warnings'` | Third-party issue, server-side tracking critical, waiting for upstream fix |
| TBD | Re-evaluate when posthog-node updates | Test new version and remove suppression if fixed |

## Alternative Solutions Considered

1. ✅ **Suppress warnings** (IMPLEMENTED)
   - Pros: Quick, no functionality loss
   - Cons: Hides the warning, doesn't fix root cause

2. ❌ **Disable server-side PostHog**
   - Pros: Eliminates warning source
   - Cons: Loses critical tracking during testing phase

3. ❌ **Downgrade Node.js to v22 LTS**
   - Pros: Older Node version less strict about deprecations
   - Cons: Loses Node.js 24 features, not a real fix

4. ⏳ **Wait for upstream fix**
   - Pros: Proper long-term solution
   - Cons: Timeline unknown, meanwhile Sentry is noisy

## Verification

To verify the suppression is working:

### Locally
```bash
npm run dev:app
# Should NOT see DEP0169 warnings in console
```

### On Vercel
1. Check Sentry issue `JAVASCRIPT-NEXTJS-6` after deployment
2. Event count should drop to zero
3. If warnings persist, verify `NODE_OPTIONS` environment variable is set correctly

## Support

If you have questions about this suppression:
- Review Sentry issue analysis in this document
- Check posthog-node repository for updates
- Contact the development team for guidance on re-enabling warnings for testing




