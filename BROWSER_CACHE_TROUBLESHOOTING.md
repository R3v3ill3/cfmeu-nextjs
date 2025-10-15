# Browser Cache Troubleshooting Guide

## Quick Test: Incognito Mode

**Always test in incognito/private mode first** when debugging authentication issues:

- **Chrome/Edge**: `Cmd+Shift+N` (Mac) or `Ctrl+Shift+N` (Windows)
- **Firefox**: `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows)
- **Safari**: `Cmd+Shift+N`

If it works in incognito but not in regular browser → **it's a cache issue**.

## Common Cache Issues

### 1. Stale JWT Tokens
- **Symptoms**: 401/403 errors, "Unauthorized" messages, missing admin menu
- **Cause**: Old auth tokens stored in browser
- **Fix**: Clear application data (see below)

### 2. Outdated JavaScript/CSS
- **Symptoms**: Old UI, missing features, console errors about undefined functions
- **Cause**: Cached bundle files from previous deployment
- **Fix**: Hard reload (see below)

### 3. Corrupted Service Worker
- **Symptoms**: Stale data, offline behavior when online, API calls not updating
- **Cause**: Service worker caching strategy
- **Fix**: Unregister service workers (see below)

## Clearing Browser Cache

### Method 1: Hard Reload (Quick)
**Mac**: `Cmd+Shift+R`  
**Windows**: `Ctrl+Shift+R` or `Ctrl+F5`

This reloads the page bypassing cache for that page only.

### Method 2: Clear Application Data (Thorough)

#### Chrome/Edge
1. Open DevTools (`F12` or `Cmd+Option+I`)
2. Go to **Application** tab
3. In left sidebar, click **Storage**
4. Click "Clear site data"
5. Refresh page

Or:
1. Click lock icon in address bar
2. Site settings → Clear data

#### Firefox
1. Open DevTools (`F12`)
2. Go to **Storage** tab
3. Right-click on domain → Delete All
4. Refresh page

#### Safari
1. Safari → Preferences → Privacy
2. Manage Website Data
3. Find your domain → Remove
4. Refresh page

### Method 3: Full Browser Cache Clear (Nuclear Option)

#### Chrome/Edge
1. `Cmd+Shift+Delete` (Mac) or `Ctrl+Shift+Delete` (Windows)
2. Time range: "All time"
3. Check: Cookies, Cached images and files
4. Click "Clear data"

#### Firefox
1. `Cmd+Shift+Delete` (Mac) or `Ctrl+Shift+Delete` (Windows)
2. Time range: "Everything"
3. Check: Cookies, Cache
4. Click "Clear Now"

## Developer Troubleshooting

### Check Current Auth State

Open browser console and run:

```javascript
// Check current session
const session = await supabase.auth.getSession()
console.log('Session:', session)

// Check token expiry
if (session?.data?.session?.access_token) {
  const token = session.data.session.access_token
  const payload = JSON.parse(atob(token.split('.')[1]))
  const expiry = new Date(payload.exp * 1000)
  console.log('Token expires:', expiry)
  console.log('Is expired?', expiry < new Date())
}

// Check stored tokens
console.log('LocalStorage auth:', localStorage.getItem('supabase.auth.token'))
```

### Force Re-authentication

```javascript
// Sign out completely
await supabase.auth.signOut()

// Clear all Supabase data
Object.keys(localStorage)
  .filter(key => key.startsWith('supabase'))
  .forEach(key => localStorage.removeItem(key))

// Reload
window.location.reload()
```

### Check Service Workers

```javascript
// List active service workers
navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log('Service Workers:', registrations)
  
  // Unregister all (if needed)
  // registrations.forEach(reg => reg.unregister())
})
```

## Prevention Strategies

### For Development
1. **Disable cache in DevTools**:
   - Open DevTools → Network tab
   - Check "Disable cache" (while DevTools is open)

2. **Use versioned assets**:
   - Next.js automatically adds hashes to build files
   - Verify in Network tab that files have `?v=` or hash in filename

3. **Short cache TTLs during development**:
   - Use short `staleTime` in React Query
   - Set appropriate `Cache-Control` headers

### For Production
1. **Proper cache headers**:
   ```
   Cache-Control: public, max-age=3600, must-revalidate
   ```

2. **Versioned API endpoints**:
   - `/v1/dashboard`, `/v2/dashboard` for breaking changes
   - Allows gradual migration

3. **User logout on version change**:
   - Store app version in localStorage
   - Force logout if version mismatch

## When to Suspect Cache Issues

- ✅ Works in incognito, fails in regular browser
- ✅ Works for other users, fails for you
- ✅ Works after clearing cache
- ✅ Auth errors despite correct credentials
- ✅ Old UI despite new deployment
- ✅ Console errors about missing modules/functions

## When It's NOT a Cache Issue

- ❌ Fails in incognito too
- ❌ Fails for all users
- ❌ Network errors (500, 502, 503)
- ❌ Database errors in server logs
- ❌ CORS errors
- ❌ Missing environment variables

## Quick Checklist

Before diving into code debugging:

- [ ] Test in incognito mode
- [ ] Hard reload (`Cmd+Shift+R`)
- [ ] Clear application data in DevTools
- [ ] Check browser console for errors
- [ ] Check Network tab for failed requests
- [ ] Verify JWT token hasn't expired
- [ ] Check server logs (Railway, Vercel, Supabase)

## Related Files

- See `RAILWAY_DASHBOARD_WORKER_DEPLOYMENT.md` for Railway deployment
- See `SUPABASE_AUTH_TROUBLESHOOTING_CHECKLIST.md` for Supabase auth issues

