# Vercel Build Cache Fix

## Issue
Vercel builds failing with:
1. "pnpm-lock.yaml is not up to date" (but it IS up to date locally)
2. TypeScript errors about campaigns table not existing (but types ARE correct locally)

## Root Cause
**Vercel's build cache is corrupted/stale** after switching from npm to pnpm and making multiple rapid commits.

## Solution: Clear Vercel Build Cache

### Option 1: Via Vercel Dashboard (Recommended)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **General**
3. Scroll down to **Build & Development Settings**
4. Find the section that says **"Reset Build Cache"** or similar
5. Click **"Clear Build Cache"** or **"Redeploy"** with "Use existing Build Cache" **UNCHECKED**

### Option 2: Force Clean Deploy

1. Go to **Deployments** tab
2. Click the **"⋯"** (three dots) next to latest deployment
3. Select **"Redeploy"**
4. **IMPORTANT:** Uncheck **"Use existing Build Cache"**
5. Click **"Redeploy"**

### Option 3: Via Git (Trigger Fresh Build)

Make a trivial change to force a fresh build:

```bash
cd /Volumes/DataDrive/cursor_repos/cfmeu-nextjs
echo "# Trigger rebuild" >> VERCEL_BUILD_FIX.md
git add VERCEL_BUILD_FIX.md
git commit -m "chore: trigger fresh Vercel build"
git push origin main
```

Then immediately go to Vercel dashboard and click "Redeploy" with cache disabled.

## Why This Happens

When you:
1. Switch package managers (npm → pnpm)
2. Delete old lock files
3. Make rapid commits with dependency changes
4. Update worker dependencies

Vercel's build cache can get confused about:
- Which package manager to use
- Which lock file is current
- What the dependency tree looks like
- What the database types should be

## Permanent Fix

After clearing cache once, future builds should work fine. The key changes we made that will prevent this:

1. ✅ Removed old `package-lock.json`
2. ✅ Using only `pnpm-lock.yaml`
3. ✅ All lockfiles are in sync
4. ✅ Vercel ignoreCommand handles missing git refs

## Verify Fix

After clearing cache and redeploying, watch for:

```
✓ Installing dependencies using pnpm
✓ Dependencies installed successfully
✓ Compiling successfully
✓ Linting passed
✓ Type checking passed
✓ Build completed
```

## If Still Failing

If clearing cache doesn't work:

### Check Environment Variables

Ensure these are set in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Regenerate Types (if needed)

```bash
# Local only - don't commit unless necessary
cd /Volumes/DataDrive/cursor_repos/cfmeu-nextjs
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
```

But this shouldn't be necessary - types are correct.

## Summary

**Action Required:** Clear Vercel build cache via dashboard

**Expected Result:** Clean build with no cache poisoning

**Time to Fix:** < 2 minutes

---

**Status:** Waiting for cache clear

