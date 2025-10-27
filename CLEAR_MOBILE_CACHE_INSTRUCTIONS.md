# Clear Mobile View Cache - Step-by-Step Instructions

## The Problem
Your code changes are correct, but cached/stale JavaScript is still running with the old buggy code.

## Solution: Complete Cache Clear

### Step 1: Stop Development Server
```bash
# Press Ctrl+C in terminal where dev server is running
# Or kill all node processes:
pkill -f "next dev"
```

### Step 2: Delete Next.js Build Cache
```bash
cd /Volumes/DataDrive/cursor_repos/cfmeu-nextjs

# Delete all Next.js cache and build artifacts
rm -rf .next
rm -rf node_modules/.cache

# Optional but recommended:
rm -rf /tmp/next-*
```

### Step 3: Clear Browser Cache (CRITICAL)

**Chrome/Edge:**
1. Open DevTools (F12 or Cmd+Option+I on Mac)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"
4. OR: Go to DevTools → Application → Storage → Clear site data

**Safari:**
1. Develop → Empty Caches
2. OR: Cmd+Option+E

**Firefox:**
1. Ctrl+Shift+Delete (Cmd+Shift+Delete on Mac)
2. Select "Cached Web Content"
3. Click "Clear Now"

### Step 4: Restart Development Server
```bash
cd /Volumes/DataDrive/cursor_repos/cfmeu-nextjs
npm run dev
```

Wait for: `✓ Compiled /mobile/... in XXXms`

### Step 5: Test Mobile Routes

**Open in INCOGNITO/PRIVATE window** (to avoid any cached data):
```
http://localhost:3000/mobile/test
http://localhost:3000/mobile/ratings
```

### Step 6: Check Console

Expected output in browser console (should be clean):
- ✅ NO "cn is not defined" errors
- ✅ NO "Rating System Error" 
- ✅ May see auth redirect if not logged in (this is correct!)

### For Vercel Deployment

The fix needs to be deployed to Vercel:

```bash
# Commit and push changes
git add .
git commit -m "Fix mobile view cn errors - remove debug code and add mobile layout"
git push origin main
```

Then in Vercel dashboard:
1. Wait for automatic deployment
2. OR trigger manual redeploy
3. Clear Vercel cache: Settings → Data Cache → Purge Everything

## Verification Checklist

- [ ] Dev server stopped and restarted
- [ ] .next directory deleted
- [ ] Browser cache cleared (hard reload)
- [ ] Testing in incognito/private window
- [ ] localhost:3000/mobile/test loads
- [ ] localhost:3000/mobile/ratings loads
- [ ] No "cn is not defined" in console
- [ ] Changes committed and pushed (for Vercel)

## If Still Failing

Check these files have the changes:

1. **src/components/ratings/SafeRatingProvider.tsx**
   - Lines 43-53 should be REMOVED (no __cnProbe code)
   - Should go directly from `}: SafeRatingProviderProps) {` to `return (`

2. **src/components/mobile/rating-system/RatingDashboard.tsx**
   - Lines 41-56 should be REMOVED (no __cnProbe code)
   - Should go directly from imports to `interface RatingDashboardProps {`

3. **src/app/mobile/layout.tsx**
   - File should exist
   - Should export MobileLayout function
   - Should wrap with AuthProvider → HelpContextProvider → SafeRatingProvider → NavigationLoadingWrapper

