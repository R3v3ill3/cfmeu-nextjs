# Address Search Diagnostic Steps

## Database: ✅ VERIFIED WORKING
The `find_nearby_projects` RPC function is working correctly and returns data.
- Tested with Sydney CBD coordinates
- Successfully returns 10 projects within 100km
- Database function and permissions are correct

## Frontend Flow Diagnostics

**I've added:**
1. Comprehensive console logging at every step
2. A purple debug panel that appears when in address search mode (development only)

Please perform these steps and report back what you see:

### Step 1: Check Console Logs
1. Open the Projects page (`http://localhost:3000/projects`)
2. Open browser console (F12 → Console tab)
3. Clear console
4. Switch to "Search by Address" tab
5. Type an address (e.g., "1 Martin Place, Sydney")
6. Select an address from the Google autocomplete dropdown

**EXPECTED LOGS TO SEE:**
```
[Address Search] handleAddressSelect called { address: {...}, error: null, hasCoordinates: true }
[Address Search] Setting URL params { lat: -33.xxx, lng: 151.xxx, formatted: "..." }
[useAddressSearch] Hook called with: { lat: -33.xxx, lng: 151.xxx, ... }
[useAddressSearch] Query function executing...
[useAddressSearch] Calling find_nearby_projects RPC ...
[useAddressSearch] RPC success, results: X projects
```

**QUESTIONS:**
- Do you see ANY of these logs?
- If you see "[Address Search] handleAddressSelect called" - what does `hasCoordinates` show?
- If no logs appear at all, that means the onChange callback isn't firing

### Step 2: Check URL Parameters
After selecting an address, check the browser URL bar:

**EXPECTED:**
```
/projects?searchMode=address&addressLat=-33.8688&addressLng=151.2093&addressQuery=1%20Martin%20Place...
```

**QUESTIONS:**
- Do you see `searchMode=address` in the URL?
- Do you see `addressLat` and `addressLng` parameters?
- Are the lat/lng values valid numbers?

### Step 3: Check Network Tab
1. Open browser DevTools → Network tab
2. Filter for "find_nearby_projects" or look for XHR/Fetch requests to Supabase
3. Select an address

**QUESTIONS:**
- Do you see a network request to Supabase?
- If yes, what's the response status code?
- If no request appears, the hook isn't executing

### Step 4: React DevTools (if available)
If you have React DevTools installed:
1. Find the `ProjectsDesktopView` or `ProjectsMobileView` component
2. Look at the state/props:
   - `addressLat` - should be a number
   - `addressLng` - should be a number
   - `searchMode` - should be "address"

### Step 5: Check Debug Panel
After selecting an address, you should see a purple-bordered debug panel showing:
- Search Mode
- Address Query
- Latitude/Longitude
- Hook status
- Results count

**Take a screenshot or copy the values shown**

## Please Report Back

Tell me:
1. **Debug Panel Values** - What does the purple debug panel show?
2. **Console Logs** - Which logs appear? (copy/paste, especially the `[GoogleAddressInput]` ones)
3. **URL After Selection** - What's in the URL bar?
4. **Network Requests** - Any requests to Supabase in Network tab?
5. **Any Errors** - Even seemingly unrelated ones

## Most Likely Issues

Based on the code analysis, the issue is probably one of:

### A) Google Autocomplete not firing
- You'll see NO `[GoogleAddressInput] place_changed event fired` log
- Means Google Maps autocomplete isn't initialized or listener isn't attached
- Could be Google Maps API key issue or script loading problem

### B) Coordinates not being extracted
- You'll see `[GoogleAddressInput] place_changed event fired`
- But `[GoogleAddressInput] Extracted coordinates` shows null/undefined
- Means Google isn't returning geometry data

### C) onChange callback not firing
- You'll see coordinates extracted
- But NO `[Address Search] handleAddressSelect called` log
- Means the callback chain is broken

### D) URL params not updating
- You'll see `handleAddressSelect` called with coordinates
- But URL doesn't change
- Means router.replace isn't working

### E) Hook not executing
- URL params are set correctly
- But NO `[useAddressSearch] Hook called` log
- Means the hook's enabled condition is false

The console logs and debug panel will tell us exactly which one it is.

