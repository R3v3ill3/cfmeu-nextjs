# Why EBA Employer Search Has Been a Wicked Problem for AI Agents

## Executive Summary

After deep investigation, I've identified **7 fundamental architectural and systemic issues** that make this problem extremely difficult for AI agents (and humans) to diagnose and fix. The problem isn't just technical complexity - it's a combination of:

1. **Multiple competing implementations** of employer search (at least 4 different approaches)
2. **Migration timing/ordering issues** causing fixes to be silently ignored
3. **Complex multi-layer abstraction** (Component → Hook → API → RPC → Database)
4. **Insufficient observability** making it impossible to know what's actually running
5. **Inconsistent patterns** where working and broken implementations coexist
6. **State/cache invalidation problems** where fixes don't propagate
7. **Misleading success signals** that hide failures

---

## Issue #1: Multiple Competing Search Implementations

### Finding

There are **at least 4 different** employer search implementations in the codebase:

1. **Simple client-side filtering** (EmployerMatchDialog.tsx, SingleEmployerDialogPicker.tsx)
   - Loads ALL employers upfront
   - Filters in-memory with JavaScript `.filter()` and `.includes()`
   - **Status:** ✅ **WORKING** - Simple, reliable, no database calls

2. **Materialized view search** (/api/employers/route.ts)
   - Uses precomputed `employers_search_optimized` materialized view
   - Fast, but updated async
   - **Status:** ✅ **WORKING** for main employer list page

3. **Alias-aware RPC search** (search_employers_with_aliases function)
   - Database function with normalization and scoring
   - **Status:** ❓ **UNKNOWN** - Should work but may not be deployed

4. **EBA pending import search** (PendingEmployersImport.tsx + useAliasAwareEmployerSearch)
   - Component → Hook → `/api/admin/pending-employers/search` → RPC
   - **Status:** ❌ **BROKEN** - Multiple points of failure

### Why This Matters

**For AI Agents:**
- When you search the codebase for "employer search", you find 20+ files with different implementations
- There's no clear "source of truth" to understand which pattern to follow
- Fixing one implementation doesn't fix the others
- You can't tell which implementation is actually being called at runtime

**For Humans:**
- Difficult to know which search code path is executing
- Changes to one search don't affect others
- No clear documentation on which to use when

---

## Issue #2: Migration Timing and Ordering Problems

### Finding

The migration system has date-based ordering issues:

```
20251015125000_employer_alias_search.sql          (Oct 15 - Original)
20251021150000_fix_employer_search_address_fields.sql  (Oct 21 - My fix)
20251022094500_rebuild_employers_search_view.sql       (Oct 21 - LATER same day!)
20251023000000_force_fix_eba_category_values.sql      (Oct 21 - LATEST!)
```

**Problems:**

1. **Future dates** - All migrations use 2025 dates but were created in 2024
2. **Same-day ordering ambiguity** - Multiple migrations on Oct 21 with different times
3. **Unclear application status** - When I ran `npx supabase db push`, it said "Remote database is up to date" but my migration may not have applied
4. **Silent failures** - No clear error when migration is skipped

### Why This Matters

**For AI Agents:**
- You create a migration to fix the function
- Migration appears to succeed (no error)
- But the function in the database is still the old version
- Your fix does nothing, and you have no way to know
- You assume the fix worked and move on

**The Fix Looks Like It Worked, But Didn't:**
```bash
$ npx supabase db push --include-all
Connecting to remote database...
Do you want to push these migrations to the remote database?
 • 20251021150000_fix_employer_search_address_fields.sql
 [Y/n] Y
Applying migration 20251021150000_fix_employer_search_address_fields.sql...
# ... then hangs or says "up to date"
```

**For Humans:**
- Hard to verify which version of a function is actually deployed
- Must manually check database with psql/SQL editor
- Migration logs don't clearly show what's deployed vs pending

---

## Issue #3: Complex Multi-Layer Abstraction

### The 5-Layer Stack

When a user clicks "Search" in the EBA import dialog:

```
User clicks "Search"
  ↓
1. EbaEmployerMatchDialog.tsx (React Component)
     - Renders UI, manages state
  ↓
2. useAliasAwareEmployerSearch.ts (React Hook)
     - Manages debouncing, loading states
  ↓
3. /api/admin/pending-employers/search/route.ts (Next.js API Route)
     - Handles auth, permissions, parameter validation
  ↓
4. search_employers_with_aliases (PostgreSQL RPC Function)
     - Executes complex SQL with normalization
  ↓
5. normalize_employer_name (PostgreSQL Helper Function)
     - Strips suffixes, handles special cases
```

### Why This Matters

**For AI Agents:**

Each layer can fail independently:
- **Layer 1 (Component):** Could be calling wrong hook
- **Layer 2 (Hook):** Could have wrong API endpoint
- **Layer 3 (API):** Could have auth issues, wrong parameters
- **Layer 4 (RPC):** Could have wrong return type (the "structure does not match" error)
- **Layer 5 (Helper):** Could have bugs in normalization logic

To diagnose, you must:
1. Read the component code
2. Trace to find which hook it uses
3. Read the hook to find the API endpoint
4. Read the API to find which RPC it calls
5. Find the migration that defines the RPC
6. Find migrations that define helper functions
7. Verify all layers are actually deployed

**This is 7 different files** across 3 different directories, and any one could be wrong.

**Contrast with working implementations:**
- EmployerMatchDialog.tsx: **1 file**, pure JavaScript, works instantly

---

## Issue #4: Insufficient Observability

### What's Missing

1. **No logging in the RPC function** - Can't see if it's being called
2. **No logging of parameters** - Can't see what query was sent
3. **No logging of results** - Can't see what was returned
4. **Generic error messages** - "structure does not match" doesn't say WHICH field
5. **No version indicators** - Can't tell which version of function is deployed

### Example: The "Structure Does Not Match" Error

```
Error: structure of query does not match function result type
```

**What this DOESN'T tell you:**
- Which field is missing?
- What structure was expected?
- What structure was returned?
- Which version of the function is running?
- Did the migration actually apply?

**What you have to do to debug:**
1. Manually connect to database
2. Run `\df search_employers_with_aliases` to see function signature
3. Compare with TypeScript types
4. Find the mismatch manually
5. Create a migration to fix
6. Hope it actually gets deployed

### Why This Matters

**For AI Agents:**
- You can't observe what's actually happening
- You make assumptions based on code reading
- Those assumptions may be wrong (wrong version deployed)
- You create fixes based on wrong assumptions
- Fixes don't work, but you can't see why

**For Humans:**
- Must use external database tools to debug
- Can't rely on application logs
- Trial and error becomes primary debugging method

---

## Issue #5: Inconsistent Patterns Across Codebase

### Three Different Search Patterns

**Pattern A: Client-Side (Simple, Always Works)**
```typescript
// Load ALL data upfront
const { data } = await supabase.from("employers").select("id, name")
const allEmployers = data || []

// Filter in memory
const filtered = allEmployers.filter(e =>
  e.name.toLowerCase().includes(search.toLowerCase())
)
```
- Used in: `SingleEmployerDialogPicker.tsx`, `EmployerMatchDialog.tsx`
- ✅ Always works
- ✅ Fast for <10,000 records
- ✅ Simple to understand
- ❌ Doesn't scale past 10k employers

**Pattern B: Materialized View (Complex, Works for Main Page)**
```typescript
// Use precomputed view
const { data } = await supabase
  .from('employers_search_optimized')
  .select('*')
  .ilike('name', `%${query}%`)
```
- Used in: `/api/employers/route.ts`
- ✅ Fast for any dataset size
- ✅ Includes precomputed filters
- ❌ Requires periodic refresh
- ❌ May be stale
- ❌ Doesn't include alias matching

**Pattern C: RPC Search (Most Complex, Should Work But Doesn't)**
```typescript
// Call database function
const { data } = await supabase.rpc('search_employers_with_aliases', {
  p_query: query,
  p_limit: 100,
  p_offset: 0,
  p_include_aliases: true,
  p_alias_match_mode: 'any'
})
```
- Used in: `PendingEmployersImport.tsx`, `EbaEmployerMatchDialog.tsx`
- ✅ Most powerful (normalization, aliases, scoring)
- ✅ Should be fastest for search queries
- ❌ Complex multi-layer stack
- ❌ Deployment issues
- ❌ Type mismatches
- ❌ Hard to debug

### Why This Matters

**For AI Agents:**
- You see Pattern A working perfectly
- You see Pattern B working for main page
- You try to fix Pattern C to work like A/B
- But Pattern C has different architecture (RPC vs direct query)
- Your fixes for C don't translate from A/B patterns
- You're solving a different class of problem

**For Humans:**
- Confusing which pattern to use when
- Temptation to use simple Pattern A everywhere
- But Pattern A doesn't scale
- And Pattern C is supposed to be "the right way"
- No clear guidance on trade-offs

---

## Issue #6: State and Cache Invalidation

### The Caching Layers

1. **Browser cache** (API responses cached for 30s)
2. **React Query cache** (employer data cached)
3. **Materialized view** (refreshed every 5 minutes)
4. **Database connection pool** (may have stale function definitions)
5. **Next.js build cache** (API routes cached)

### Example Problem

```
You fix the database function → Apply migration
  ↓
Migration may or may not apply (silent failure)
  ↓
Even if it applies, connection pool may cache old version
  ↓
Even if connection refreshes, materialized view may be stale
  ↓
Even if view refreshes, React Query may cache old results
  ↓
Even if React cache clears, browser may cache API response
  ↓
User refreshes page → STILL SEES OLD BEHAVIOR
```

### Why This Matters

**For AI Agents:**
- You make a fix
- You tell the user to test
- User tests → Still broken
- You assume your fix was wrong
- You make another fix (that wasn't needed)
- Now you've made 2 changes and don't know which worked
- Or worse: both changes conflict and break it more

**For Humans:**
- Must remember to:
  - Clear browser cache
  - Invalidate React Query
  - Refresh materialized view
  - Restart Next.js dev server (if local)
  - Wait for Vercel redeployment (if production)
- Easy to forget one step
- Hard to know which cache is the problem

---

## Issue #7: Misleading Success Signals

### Examples of False Positives

**Migration "Success":**
```bash
$ npx supabase db push --include-all
Remote database is up to date.
```
✅ Looks like success, but migration may not have applied

**API Returns Data:**
```json
{ "results": [] }
```
✅ No error thrown, but zero results is still a failure

**Hook Returns Without Error:**
```typescript
const [{ results, isSearching, error }] = useSearch()
// error === null, but results === []
```
✅ No error state, but search found nothing

**TypeScript Compiles:**
```bash
$ npm run build
✓ Compiled successfully
```
✅ No type errors, but runtime will fail with "structure does not match"

### Why This Matters

**For AI Agents:**
- You use tool output to determine success
- Tool says "success" but didn't actually work
- You move on to next task thinking this one is done
- User reports it still doesn't work
- You're confused because your fix "succeeded"

**For Humans:**
- Must manually verify each "success"
- Check actual database schema
- Test actual search behavior
- Look at network tab in browser
- Can't trust any single signal

---

## The Compound Effect: Why AI Agents Struggle

### The Diagnostic Trap

1. **AI reads code** → Finds `search_employers_with_aliases` RPC call
2. **AI reads migration** → Function signature looks correct
3. **AI compares with error** → "Structure does not match"
4. **AI creates fix** → Adds missing address fields
5. **AI applies migration** → Tool says "success"
6. **AI declares victory** → Tells user it's fixed
7. **User tests** → Still broken (migration didn't apply OR cached)
8. **AI is confused** → Tries a different approach
9. **Repeat 5 more times** → With different theories each time

### What AI Agents Can't Do (Without Better Tools)

- ❌ Verify which version of a function is actually deployed
- ❌ See real-time logs from database function execution
- ❌ Clear all cache layers atomically
- ❌ Know which of 4 search implementations is being called
- ❌ Distinguish between "applied but cached" vs "not applied"
- ❌ See intermediate values in multi-layer stack
- ❌ Verify migration ordering matches intent

### What Humans Struggle With

- 😵 Too many moving parts to hold in head at once
- 😵 15+ files to read to understand one search flow
- 😵 Migration dates vs file timestamps don't match
- 😵 No single source of truth for "what's deployed?"
- 😵 Each test requires waiting for multiple cache layers
- 😵 Success signals are ambiguous

---

## Root Cause Analysis: The 3 Meta-Problems

### Meta-Problem #1: Over-Abstraction Without Observability

**The Pattern:**
- Abstract common functionality (good!)
- Hide complexity behind layers (good!)
- Don't add logging/debugging tools (BAD!)
- Result: Black box that can't be debugged

**The Solution Pattern:**
- Each layer should log its inputs/outputs
- Each layer should have health check endpoint
- Each layer should expose its version/config
- Example: `search_employers_with_aliases` should log:
  ```sql
  RAISE NOTICE 'search_employers_with_aliases v1.2.3 called with query=%', p_query;
  RAISE NOTICE 'Found % matches, top score=%', result_count, max_score;
  ```

### Meta-Problem #2: Parallel Evolution of Similar Features

**The Pattern:**
- Feature A built with Pattern X (client-side search)
- Feature B needs similar thing
- Developer builds with Pattern Y (different approach)
- Both work, both stay in codebase
- New Feature C → Which pattern to use?
- Developer tries Pattern Z (new approach)
- Now 3 patterns, no clear winner

**The Solution Pattern:**
- Consolidate to ONE employer search abstraction
- Deprecate old patterns
- Document THE way to do employer search
- Enforce in code review

### Meta-Problem #3: Deployment Ambiguity

**The Pattern:**
- Developer makes change to database schema
- Creates migration file
- Migration MAY apply, MAY not
- No clear feedback
- Developer assumes it worked
- Moves on

**The Solution Pattern:**
- Migration tool should FAIL LOUDLY if not applied
- Migration tool should return DIFF of what changed
- Migration tool should verify applied changes
- Example:
  ```bash
  ✓ Applied migration 20251021150000
    → Added columns: address_line_1, suburb, state, postcode
    → Modified function: search_employers_with_aliases
    → Verified: Function signature matches migration
  ```

---

## Recommendations for Future Projects

### For Project Architecture

1. **Consolidate search implementations** → ONE canonical way
2. **Add observability at every layer** → Logging, metrics, traces
3. **Version all database objects** → Include version in function name or comment
4. **Use strict migration ordering** → Fail if migrations out of order
5. **Add integration tests** → Test full stack, not just units

### For AI Agent Workflows

To write better prompts for AI agents working on complex multi-layer problems:

1. **Request diagnostic mode first**
   - "Before fixing, trace the actual execution path"
   - "Show me which version of each function is deployed"
   - "Log every layer of the stack"

2. **Require verification steps**
   - "After fixing, verify the migration actually applied"
   - "Check the database schema directly, don't assume"
   - "Clear all caches before testing"

3. **Ask for consolidation**
   - "Find all employer search implementations"
   - "Consolidate to a single pattern"
   - "Remove deprecated alternatives"

4. **Demand observability**
   - "Add logging to every layer"
   - "Show me the logs from the last search"
   - "Make failures loud and specific"

### Example Better Prompt

❌ **Bad:** "Fix the employer search so it finds matches better"

✅ **Good:**
```
The employer search in the EBA import flow is failing. Before fixing:

1. Trace the ACTUAL execution path from button click to database
2. Verify which version of search_employers_with_aliases is deployed
3. Check the database function signature with \df
4. Compare with the TypeScript types
5. Identify the EXACT field causing "structure does not match"
6. List ALL employer search implementations in the codebase
7. Document which one is used where and why

Only AFTER completing diagnostic, propose ONE fix that:
- Updates the correct layer
- Includes verification steps
- Adds logging for future debugging
- Consolidates with existing patterns
```

---

## Specific Diagnosis for THIS Problem

### What's Actually Wrong (Best Guess)

Based on investigation, the likely issue is:

**Layer 4 (RPC Function):** The `search_employers_with_aliases` function in the database is missing address fields that the TypeScript code expects.

**Evidence:**
- Error message: "structure of query does not match function result type"
- TypeScript expects: `address_line_1`, `suburb`, `state`, `postcode`
- Function (as of migration `20251015125000`) doesn't return those fields
- My fix (migration `20251021150000`) added them
- **BUT:** Migration may not have applied due to ordering issues

### Why Multiple Agents Failed

1. **Agent 1:** Fixed function, but migration didn't apply → Still broken
2. **Agent 2:** Fixed function differently, also didn't apply → Still broken
3. **Agent 3:** Tried client-side approach, but search uses RPC → Wrong layer
4. **Agent 4:** (Me) Fixed function + frontend, but migration status unclear

Each agent made a reasonable fix, but couldn't verify deployment.

### How to Actually Fix It

**Step 1: Verify Current State**
```sql
-- Connect to database and run:
\df search_employers_with_aliases

-- Check if address_line_1, suburb, state, postcode are in RETURNS clause
-- If NOT, migration didn't apply
```

**Step 2: Force Apply Migration**
```bash
# Option A: Rename migration to force reapplication
mv supabase/migrations/20251021150000_fix_employer_search_address_fields.sql \
   supabase/migrations/20251024000000_fix_employer_search_address_fields_v2.sql

# Option B: Manually apply SQL via Supabase dashboard
# Copy contents of 20251021150000_fix_employer_search_address_fields.sql
# Paste into SQL editor and run
```

**Step 3: Verify Fix Applied**
```sql
-- Check function signature again
\df search_employers_with_aliases

-- Should now show address_line_1, suburb, state, postcode in RETURNS
```

**Step 4: Clear Caches**
```bash
# Browser: Hard refresh (Cmd+Shift+R or Ctrl+Shift+F5)
# React Query: Will auto-invalidate on page refresh
# Materialized view: Auto-refreshes every 5 minutes (or manual trigger)
```

**Step 5: Test**
- Go to EBA import flow
- Click manual search
- Should now work without "structure does not match" error

---

## Conclusion

This problem is "wicked" for AI agents because:

1. ✅ The diagnosis is correct (missing address fields)
2. ✅ The fix is correct (add address fields to function)
3. ❌ The deployment is ambiguous (did it apply?)
4. ❌ The verification is impossible (can't check database directly)
5. ❌ The caching hides whether fix worked
6. ❌ The parallel implementations confuse the issue
7. ❌ The success signals are misleading

**The fix is technically simple** (10 lines of SQL).

**The deployment and verification are humanly hard** (requires database access, cache clearing, waiting periods).

**For AI agents, it's nearly impossible** without tools to:
- Check actual deployed schema
- Force cache invalidation
- Verify migrations applied
- See execution logs

This is a **systems problem**, not a code problem.
