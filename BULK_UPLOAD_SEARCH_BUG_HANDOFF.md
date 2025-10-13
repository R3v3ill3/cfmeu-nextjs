# Bulk Upload Search Bug - Agent Handoff Summary

## Context: What We're Building

**Feature:** Bulk upload workflow for CFMEU mapping sheet PDFs containing multiple projects

**Goal:** Allow users to:
1. Upload a single PDF with multiple projects (e.g., 6 pages = 3 projects)
2. Use AI (Claude) to automatically detect project boundaries and extract project names
3. For each detected project, either:
   - **Create New Project** (default)
   - **Match to Existing Project** (search & select)
4. Split PDF and process each project independently

---

## Current Status

### ✅ What Works

1. **AI Analysis** - Claude correctly detects projects and extracts names from PDFs
   - Using correct model: `claude-sonnet-4-5-20250929`
   - Prompt is properly tuned for CFMEU NSW MappingSheets forms
   - `/api/projects/batch-upload/analyze` endpoint functioning
   - Returns correct project boundaries and names

2. **Project Search on Projects Page** - Existing search works perfectly
   - Component: `ProjectQuickFinder.tsx`
   - Uses: Direct Supabase RPC call to `search_projects_basic()`
   - Returns results for any search term
   - Works for admin and all authenticated users

3. **Batch Upload Pipeline** - Everything else works
   - PDF upload ✅
   - AI analysis ✅
   - PDF splitting ✅
   - Batch creation ✅
   - Worker processing ✅

### ❌ What Doesn't Work

**Project search in bulk upload dialog returns ZERO results regardless of search term**

- Component: `ProjectSearchDialog.tsx`
- User types any project name → no results
- Even known existing projects → no results
- User is admin (should bypass any RLS issues)

---

## Failed Troubleshooting Attempts

### Attempt 1: Fix Claude Model + Use Existing RPC
**Theory:** Wrong model name, API route subject to RLS
**Action:**
- Changed model to `claude-sonnet-4-5-20250929`
- Changed API route to use `search_projects_basic()` RPC
- **Result:** No change - still 0 results

### Attempt 2: Enhanced AI Prompt
**Theory:** AI not extracting project names correctly
**Action:** Added detailed CFMEU form structure to prompt
**Result:** AI works fine, search still broken

### Attempt 3: Direct RPC Call (Match Working Implementation)
**Theory:** API route layer causing issues
**Action:**
- Removed API route `/api/projects/search`
- Changed `ProjectSearchDialog` to direct Supabase RPC (identical to working `ProjectQuickFinder`)
- **Result:** No change - still 0 results

---

## Technical Details

### Working Search (ProjectQuickFinder.tsx)

```typescript
// File: src/components/projects/ProjectQuickFinder.tsx:53-56
const { data, error } = await supabase
  .rpc('search_projects_basic', {
    p_query: debouncedSearch.trim(),
  })

// Returns: { id, name, full_address, builder_name }[]
// ✅ Works perfectly - returns results
```

### Broken Search (ProjectSearchDialog.tsx)

```typescript
// File: src/components/projects/ProjectSearchDialog.tsx:73-76
const { data, error } = await supabase
  .rpc('search_projects_basic', {
    p_query: query.trim(),
  })

// Returns: EMPTY ARRAY []
// ❌ Identical code, different component, returns nothing
```

### Database Function

```sql
-- File: supabase/migrations/20251007000000_new_project_scan_support.sql:128-148
CREATE OR REPLACE FUNCTION search_projects_basic(p_query TEXT, p_limit INT DEFAULT 20)
RETURNS TABLE(
  id UUID,
  name TEXT,
  full_address TEXT,
  builder_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT q.id, q.name, q.full_address, q.builder_name
  FROM public.projects_quick_search q
  WHERE (
    p_query IS NULL
    OR p_query = ''
    OR q.search_vector @@ plainto_tsquery('simple', unaccent(p_query))
  )
  ORDER BY similarity(unaccent(q.name), unaccent(p_query)) DESC NULLS LAST,
           q.name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Key points:**
- `SECURITY DEFINER` → bypasses RLS
- `GRANT EXECUTE ... TO authenticated` → all users can call it
- Uses `projects_quick_search` view
- Requires `pg_trgm` extension (confirmed enabled)
- Requires `unaccent` extension (confirmed enabled)

---

## Key Questions for Next Agent

1. **Why does identical RPC call work in one component but not another?**
   - Same function
   - Same Supabase client source
   - Same user auth context
   - Different results

2. **Console errors?**
   - User reports "still fucked - no difference"
   - No specific error messages provided in latest attempt
   - Previous errors were about Claude model (now fixed)

3. **Is the RPC actually being called?**
   - No debugging added yet
   - Don't know if RPC returns empty or fails silently
   - Don't know what error object contains

4. **Component rendering context differences?**
   - `ProjectQuickFinder` used in projects page
   - `ProjectSearchDialog` used in `BulkUploadDialog`
   - Both are client components
   - Both use same Supabase client import

---

## Recommended Next Steps

### 1. Add Comprehensive Logging (First Priority)
```typescript
const searchProjects = async (query: string) => {
  console.log('[SEARCH] Starting search for:', query)
  setIsLoading(true)

  const { data, error } = await supabase
    .rpc('search_projects_basic', {
      p_query: query.trim(),
    })

  console.log('[SEARCH] RPC response:', {
    data,
    error,
    dataLength: data?.length,
    errorDetails: error
  })

  if (error) {
    console.error('[SEARCH] Error details:', JSON.stringify(error, null, 2))
    setResults([])
  } else {
    console.log('[SEARCH] Setting results:', data)
    setResults((data as ProjectFromRPC[]) || [])
  }

  setIsLoading(false)
}
```

### 2. Test RPC Directly in Browser Console
Open browser console on bulk upload page:
```javascript
const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const { data, error } = await supabase.rpc('search_projects_basic', {
  p_query: 'test'
})
console.log({ data, error })
```

### 3. Compare Supabase Client Instances
Check if both components are using same client:
```typescript
// In both components
import { supabase } from '@/integrations/supabase/client'
console.log('[CLIENT]', supabase)
```

### 4. Check Database Directly
Verify RPC works in Supabase SQL editor:
```sql
SELECT * FROM search_projects_basic('test', 20);
```

### 5. Verify projects_quick_search View
```sql
SELECT COUNT(*) FROM projects_quick_search;
SELECT * FROM projects_quick_search LIMIT 5;
```

---

## Files Modified (This Session)

1. ✅ `src/app/api/projects/batch-upload/analyze/route.ts` - Fixed Claude model name
2. ✅ `src/app/api/projects/search/route.ts` - Changed to use RPC (now unused)
3. ✅ `src/components/projects/ProjectSearchDialog.tsx` - Changed to direct RPC
4. ✅ `BULK_UPLOAD_FIXES.md` - Documentation
5. ✅ `BULK_UPLOAD_AI_IMPLEMENTATION_SUMMARY.md` - Original implementation doc

---

## User Environment

- **User Role:** Admin (full permissions)
- **Database:** Supabase PostgreSQL
- **Framework:** Next.js 14 (App Router)
- **Working Directory:** `/Volumes/DataDrive/cursor_repos/cfmeu-nextjs`
- **Git Branch:** main
- **Dev Server:** Needs restart after file changes

---

## Critical Insight

**The EXACT SAME CODE works in one place and fails in another.**

This suggests:
- Not a database issue (RPC works)
- Not a permissions issue (admin user, SECURITY DEFINER)
- Not a code logic issue (identical implementation)
- Likely: Component lifecycle, context, or client initialization difference

**Next agent should focus on runtime differences, not code logic.**

---

## What User Has Tried

1. Restart dev server - No effect
2. Multiple different search terms - All return 0 results
3. Tested as admin user - Still fails
4. Verified working search exists elsewhere - Confirmed working

---

## Success Criteria

User should be able to:
1. Open bulk upload dialog
2. Upload PDF (AI analysis works)
3. Click "Match to Existing Project"
4. Type any project name in search
5. **SEE RESULTS APPEAR** (currently returns empty)
6. Select a project
7. Complete batch upload

**Everything works except step 5.**

---

## Additional Context

- AI correctly extracts project names from PDFs
- User can create new projects (works fine)
- Only matching to existing projects is broken
- No JavaScript errors in console (per user's latest feedback)
- "still fucked - no difference" after all attempted fixes

Good luck! 🫡
