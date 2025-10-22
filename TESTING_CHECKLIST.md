# EBA Search Testing Checklist

## ✅ Migration Applied Successfully
- [x] Ran migration `20251021150000_fix_employer_search_address_fields.sql`
- [x] Got success message
- [x] Testing on localhost

---

## Step 1: Verify Database Function (Do this in Supabase Dashboard)

**Go to:** Supabase Dashboard → SQL Editor

**Run this query:**
```sql
SELECT
  id,
  name,
  address_line_1,  -- KEY: This should work now
  suburb,
  state,
  postcode,
  match_type,
  search_score
FROM search_employers_with_aliases(
  p_query := 'construction',
  p_limit := 5,
  p_offset := 0,
  p_include_aliases := true,
  p_alias_match_mode := 'any'
)
LIMIT 5;
```

**Expected:**
- ✅ Returns rows with address fields populated
- ❌ If error "column does not exist" → Migration didn't fully apply

**If it works in SQL Editor, continue to Step 2.**

---

## Step 2: Restart Your Dev Server

The Next.js API routes might have cached the old function signature.

**In your terminal:**
1. Stop the dev server (Ctrl+C)
2. Wait 2 seconds
3. Start it again:
   ```bash
   npm run dev
   ```

---

## Step 3: Clear Browser Cache

**In your browser:**
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

**Or:**
- Mac: `Cmd + Shift + R`
- Windows: `Ctrl + Shift + F5`

---

## Step 4: Test the Manual Search Flow

**Navigate to:**
1. Administration → Data Management → Employers
2. Click "EBA Trade Import" tab
3. If you have pending employers already:
   - Go to "Pending Employers Import" section
   - Click on any employer to open the match dialog
4. If not:
   - Upload a test PDF
   - Store in pending queue
   - Then proceed to matching

**In the match dialog:**
1. **BEFORE searching:** Open DevTools (F12) → Network tab
2. Click in the search box
3. Type a search term (e.g., "construction" or "REDS GLOBAL")
4. Watch the Network tab for the API call

---

## Step 5: Capture Results

### If Search WORKS ✅

Great! You should see:
- List of matching employers
- No errors in console
- Network request to `/api/admin/pending-employers/search` returns results

**Report back:**
- ✅ "Search is working!"
- Whether automatic matching also finds more matches now

### If Search FAILS ❌

**Capture these details:**

1. **Console Error** (F12 → Console tab):
   - Screenshot or copy the error message

2. **Network Request Details** (F12 → Network tab):
   - Find the request to `/api/admin/pending-employers/search`
   - Click on it
   - Go to "Response" tab → Copy the response
   - Go to "Headers" tab → Copy the request URL with parameters

3. **What you searched for:**
   - The exact search term you typed

**Share all of this with me so I can diagnose which layer is failing.**

---

## Troubleshooting Guide

### Error: "structure of query does not match function result type"
→ The database function still doesn't have address fields
→ Go back to Step 1 and verify the SQL query works

### Error: "Search failed (500)"
→ Server-side error, check terminal for error logs
→ Restart dev server (Step 2)

### Error: No results but no error message
→ Different issue - search is working but not finding matches
→ This is a search logic problem, not a structure problem
→ Report back and we'll tune the matching algorithm

### Network request shows 401 Unauthorized
→ Authentication issue
→ Make sure you're logged in as admin

---

## Quick Test Commands

If you want to test the API directly from terminal:

```bash
# Get your auth token from browser (F12 → Application → Cookies → sb-access-token)
# Then test the API:

curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  "http://localhost:3000/api/admin/pending-employers/search?q=construction&limit=10"
```

Should return JSON with employer results.

---

## What Success Looks Like

**Database Test (Step 1):**
```
id  | name                    | address_line_1      | suburb  | state
----|-------------------------|---------------------|---------|-------
123 | ABC Construction Pty Ltd| 123 Smith St        | Sydney  | NSW
456 | XYZ Builders            | 456 Jones Ave       | Melbourne| VIC
```

**Browser Test (Step 4):**
- Search dialog shows list of employers
- Each employer shows name, address details
- Clicking "Select Match" or "Create New" works
- No red error messages

**Network Tab:**
```json
{
  "results": [
    {
      "id": "123...",
      "name": "ABC Construction Pty Ltd",
      "address_line_1": "123 Smith St",
      "suburb": "Sydney",
      "state": "NSW",
      "postcode": "2000",
      "search_score": 85,
      "match_type": "canonical_name"
    }
  ]
}
```
