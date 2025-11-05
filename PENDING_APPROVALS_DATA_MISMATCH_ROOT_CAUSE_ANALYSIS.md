# Pending Approvals Data Mismatch - Root Cause Analysis

**Date:** November 5, 2025  
**Status:** CRITICAL - Blocking pending project reviews  
**Error:** `column mapping_sheet_scans_1.uploaded_at does not exist`

## Executive Summary

The Pending Approvals review system is broken due to a **schema-code mismatch**: the frontend code attempts to select a non-existent column (`uploaded_at`) from the `mapping_sheet_scans` table. This is causing cascading failures across the project review workflow.

### Root Cause

**The `mapping_sheet_scans` table does NOT have an `uploaded_at` column** - it only has:
- `created_at` (when the scan record was created)
- `updated_at` (when the scan record was last modified)

However, the code in `src/hooks/usePendingProjectData.ts` attempts to select `uploaded_at`, causing the PostgreSQL query to fail with a 400 error.

### Impact Scope

This affects:
1. ✅ **Pending Projects Review** (Admin → Data Integrity → Pending Approvals)
2. ✅ **Project Review Dialog** (EnhancedProjectReviewDialog component)
3. ⚠️ **All workflows that query mapping sheet scans with upload timing**

---

## Complete Data Flow Trace

### 1. Entry Point: Admin Page

**File:** `src/app/(app)/admin/page.tsx`

```typescript
// Line 334-365: Pending Approvals section
<Collapsible defaultOpen>
  <CollapsibleTrigger>
    <Button>Pending Approvals</Button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    {/* Pending Projects Table */}
    <PendingProjectsTable
      projects={pendingProjects}
      onApprove={handleApproveProject}
      onReject={handleRejectProject}
      onRefresh={fetchPendingItems}
    />
  </CollapsibleContent>
</Collapsible>
```

**Data fetched by:** `useQuery` hook calling `/api/admin/pending-items`

---

### 2. API Route: Pending Items

**File:** `src/app/api/admin/pending-items/route.ts`

```typescript
// Lines 27-45: Fetches pending projects
const { data: pendingProjects } = await supabase
  .from('projects')
  .select(`
    id,
    name,
    value,
    proposed_start_date,
    created_at,
    main_job_site:job_sites!main_job_site_id (
      full_address
    ),
    scan:mapping_sheet_scans!created_project_id (
      id,
      file_name,
      uploaded_by  // ✅ NO uploaded_at here - this works!
    )
  `)
  .eq('approval_status', 'pending')
```

**Status:** ✅ This query is CORRECT (doesn't select `uploaded_at`)

---

### 3. Review Dialog Opens

**File:** `src/components/admin/PendingProjectsTable.tsx`

```typescript
// Lines 67-75: User clicks "Review" button
const handleReview = (projectId: string) => {
  setSelectedProjectId(projectId)
  setIsReviewOpen(true)  // Opens EnhancedProjectReviewDialog
}
```

**File:** `src/components/admin/EnhancedProjectReviewDialog.tsx`

```typescript
// Lines 55-58: Dialog uses usePendingProjectData hook
const { data: project, isLoading, error } = usePendingProjectData({
  projectId,
  enabled: open && !!projectId,
});
```

---

### 4. THE BUG: usePendingProjectData Hook

**File:** `src/hooks/usePendingProjectData.ts`

```typescript
// Lines 79-88: ❌ BROKEN QUERY
scan:mapping_sheet_scans!mapping_sheet_scans_project_id_fkey (
  id,
  file_name,
  uploaded_at,        // ❌ THIS COLUMN DOES NOT EXIST
  uploaded_by,
  file_size_bytes,
  status,
  upload_mode,
  created_at
)
```

**PostgreSQL Error Response:**
```
400 Bad Request
column mapping_sheet_scans_1.uploaded_at does not exist
```

---

### 5. Database Schema Reality

**File:** `supabase/migrations/20250930000000_mapping_sheet_scanner.sql`

```sql
CREATE TABLE mapping_sheet_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  
  -- File storage
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  page_count INTEGER,
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- AI extraction results
  extracted_data JSONB,
  confidence_scores JSONB,
  ai_provider TEXT,
  extraction_attempted_at TIMESTAMPTZ,
  extraction_completed_at TIMESTAMPTZ,
  
  -- User review tracking
  review_started_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES auth.users(id),
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Audit timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,    -- ✅ EXISTS
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,    -- ✅ EXISTS
  -- uploaded_at DOES NOT EXIST                      -- ❌ MISSING
  
  -- User notes
  notes TEXT,
  
  -- Additional fields from later migrations:
  upload_mode TEXT,
  created_project_id UUID REFERENCES projects(id),
  selected_pages integer[],
  retry_attempt integer DEFAULT 0,
  review_data JSONB DEFAULT NULL
);
```

**Columns for timing:**
- ✅ `created_at` - When the scan record was created in database
- ✅ `updated_at` - When the scan record was last modified
- ❌ `uploaded_at` - **DOES NOT EXIST**

**Semantic meaning:**
- `created_at` effectively represents when the file was uploaded (scan record created during upload)
- `updated_at` tracks subsequent modifications
- There is NO separate `uploaded_at` column

---

## Why This Happened

### Historical Context

Looking at the migration history:

1. **Initial Migration** (20250930000000): Created `mapping_sheet_scans` with `created_at` and `updated_at`
2. **Enhancement Migrations**: Added `upload_mode`, `created_project_id`, `selected_pages`, `review_data`
3. **Code Drift**: Someone likely assumed an `uploaded_at` column existed, or copied query patterns from another table

### Common Pattern in Codebase

Most upload-related tables use `created_at` to represent upload time:

```typescript
// Correct pattern (most scan review pages):
const { data: scanData } = await supabase
  .from('mapping_sheet_scans')
  .select('*')  // or specifically: created_at, updated_at
  .eq('id', scanId)
  .single()
```

But `usePendingProjectData.ts` incorrectly introduced `uploaded_at`.

---

## Data Connections Map

### How Data Flows Between Systems

```
┌─────────────────────────────────────────────────────────────┐
│                     DATA FLOW DIAGRAM                        │
└─────────────────────────────────────────────────────────────┘

1. BULK UPLOAD PATH:
   Excel/CSV Upload
     → Batch Upload Worker (Railway)
     → Creates pending_employers
     → Creates pending_projects (approval_status='pending')
     → Creates project_assignments (source='bci_import' or 'manual')

2. MAPPING SHEET UPLOAD PATH:
   PDF Upload
     → mapping_sheet_scans table (status='pending')
     → Scanner Worker (Railway) processes PDF
     → Updates scan (status='processing' → 'completed')
     → Extracted data stored in extracted_data JSONB
     → User reviews scan → status='under_review'
     → User confirms → status='confirmed'
     → Creates/links:
        • Project (if new project upload)
        • Project assignments
        • Site contacts
        • Employer records

3. PENDING APPROVALS REVIEW:
   Admin → Data Integrity → Pending Approvals
     → Fetches projects WHERE approval_status='pending'
     → Includes related:
        • main_job_site (job_sites table)
        • project_assignments (employers via FK)
        • scan info (mapping_sheet_scans) ← ❌ BREAKS HERE
     → Review dialog opens
     → usePendingProjectData queries ← ❌ FAILS HERE
     → Can't complete review
```

### Table Relationships

```sql
-- Projects created from mapping sheets
mapping_sheet_scans
  ├── project_id         → projects.id (existing project context)
  ├── created_project_id → projects.id (project created from "new project" scan)
  └── uploaded_by        → auth.users.id (who uploaded the file)

-- Projects in pending review
projects (approval_status='pending')
  ├── main_job_site_id   → job_sites.id
  └── Reverse relations:
      ├── project_assignments → employer_id → employers
      ├── site_contacts (via job_sites)
      └── mapping_sheet_scans (via project_id OR created_project_id)

-- Two ways scans relate to projects:
1. Scan for existing project: scan.project_id → projects.id
2. Scan that created project: scan.created_project_id → projects.id

-- In pending approvals, we use BOTH relationships:
scan:mapping_sheet_scans!created_project_id (...)
   └── This finds scans WHERE created_project_id = project.id
   └── i.e., scans that created this pending project
```

---

## Impact of Recent Changes

### Migration Timeline

1. **20251007000000**: Added `upload_mode`, `created_project_id` for new project workflow
2. **20251015144000**: Added `selected_pages`, `retry_attempt`
3. **20251025000000**: Added `review_data` for save & continue functionality

**None of these added `uploaded_at`** - yet code started referencing it.

### Why Fixes Have Cascaded

Each attempted fix likely addressed **symptoms** rather than **root cause**:

1. "Project review not loading" → Try different query
2. "Scan data missing" → Add more fields to select
3. "Foreign key confusion" → Switch between project_id and created_project_id
4. **But nobody checked:** *Does the column I'm selecting actually exist?*

---

## Systemic Issues Identified

### 1. Schema-Code Synchronization

**Problem:** No automated verification that queries match actual database schema.

**Evidence:**
- TypeScript types in `src/types/database.ts` are auto-generated from Supabase
- But developers can still write queries that fail at runtime
- No compile-time checking of column names in `.select()` strings

### 2. Inconsistent Field Usage

**Problem:** Different parts of codebase use different fields for "upload time":

- ✅ `/api/admin/pending-items` uses `created_at`
- ❌ `usePendingProjectData` tries to use `uploaded_at`
- ✅ Scan review pages use `select('*')` (all fields)

### 3. Multiple Foreign Key Paths

**Problem:** `mapping_sheet_scans` has TWO foreign keys to projects:

```sql
project_id         -- Scan for existing project
created_project_id -- Project created by this scan
```

**Different queries use different paths:**
- Pending items API: `scan:mapping_sheet_scans!created_project_id`
- Pending project data hook: `scan:mapping_sheet_scans!mapping_sheet_scans_project_id_fkey`

**This creates confusion** about which relationship to query.

### 4. Type Safety Gaps

**Problem:** PostgREST query strings are untyped:

```typescript
// No compile-time error even though uploaded_at doesn't exist:
.select(`
  scan:mapping_sheet_scans (
    uploaded_at  // ← Should fail at compile time, but doesn't
  )
`)
```

---

## Recommended Systemic Fix

### Immediate Fix (Stop the Bleeding)

**File:** `src/hooks/usePendingProjectData.ts` (Line 82)

Change:
```typescript
scan:mapping_sheet_scans!mapping_sheet_scans_project_id_fkey (
  id,
  file_name,
  uploaded_at,        // ❌ Remove this
  uploaded_by,
  file_size_bytes,
  status,
  upload_mode,
  created_at          // ✅ Use this for upload time
)
```

To:
```typescript
scan:mapping_sheet_scans!mapping_sheet_scans_project_id_fkey (
  id,
  file_name,
  created_at,         // ✅ This is the upload timestamp
  uploaded_by,
  file_size_bytes,
  status,
  upload_mode,
  updated_at
)
```

### Option A: Standardize on created_at

**Approach:** Use `created_at` consistently across codebase as "upload time"

**Pros:**
- No database migration needed
- Semantically correct (record created = file uploaded)
- Most of codebase already does this

**Cons:**
- Less explicit naming
- Could be confusing if record is created separately from upload

**Implementation:**
1. Fix `usePendingProjectData.ts` to use `created_at`
2. Update TypeScript types if needed
3. Document that `created_at` represents upload time

### Option B: Add uploaded_at Column (Recommended)

**Approach:** Add an explicit `uploaded_at` column to match code expectations

**Pros:**
- Explicit and self-documenting
- Matches developer intuition
- Allows for future scenarios where record creation != upload time
- Makes migration from `created_at` seamless (backfill with `created_at` values)

**Cons:**
- Requires database migration
- Need to backfill existing records
- Additional column to maintain

**Implementation:**

1. **Migration SQL:**
```sql
-- Add uploaded_at column
ALTER TABLE mapping_sheet_scans
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ;

-- Backfill existing records (uploaded_at = created_at for existing scans)
UPDATE mapping_sheet_scans
  SET uploaded_at = created_at
  WHERE uploaded_at IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE mapping_sheet_scans
  ALTER COLUMN uploaded_at SET DEFAULT now();
  
ALTER TABLE mapping_sheet_scans
  ALTER COLUMN uploaded_at SET NOT NULL;

-- Add comment
COMMENT ON COLUMN mapping_sheet_scans.uploaded_at IS
  'Timestamp when the file was uploaded by the user. Defaults to created_at for historical records.';
```

2. **Update Upload Code:**
```typescript
// When creating new scans, explicitly set uploaded_at
await supabase
  .from('mapping_sheet_scans')
  .insert({
    project_id,
    file_url,
    file_name,
    uploaded_by: user.id,
    uploaded_at: new Date().toISOString(),  // Explicit upload time
    status: 'pending'
  })
```

3. **Keep queries as-is** - they'll now work!

### Option C: Comprehensive Type-Safe Query Layer (Long-term)

**Approach:** Create type-safe query helpers that prevent schema mismatches

**Example:**
```typescript
// Type-safe helper
import { Database } from '@/types/database'

type MappingSheetScanColumns = keyof Database['public']['Tables']['mapping_sheet_scans']['Row']

function selectMappingSheetScans<T extends MappingSheetScanColumns[]>(
  columns: T
) {
  return columns.join(',')
}

// Usage (compile-time error if column doesn't exist):
.select(`
  scan:mapping_sheet_scans (
    ${selectMappingSheetScans([
      'id',
      'file_name',
      'uploaded_at',  // ← TypeScript error: column doesn't exist
      'created_at'
    ])}
  )
`)
```

**Pros:**
- Prevents future schema-code mismatches
- Catches errors at compile time
- Self-documenting

**Cons:**
- Significant refactoring effort
- Requires changing all query patterns
- May conflict with PostgREST syntax flexibility

---

## Recommended Action Plan

### Phase 1: Emergency Fix (NOW)

1. ✅ Update `src/hooks/usePendingProjectData.ts` to remove `uploaded_at`
2. ✅ Use `created_at` instead (or add `uploaded_at` column if preferred)
3. ✅ Test pending project review flow end-to-end
4. ✅ Deploy to production

**Estimated Time:** 15 minutes

### Phase 2: Audit & Fix (Today)

1. ✅ Search codebase for all references to `uploaded_at` on `mapping_sheet_scans`
2. ✅ Update TypeScript type definitions if needed
3. ✅ Review all scan-related queries for similar mismatches
4. ✅ Document standard field naming conventions

**Estimated Time:** 1-2 hours

### Phase 3: Prevent Recurrence (This Week)

1. ⚠️ Decide: Add `uploaded_at` column OR standardize on `created_at`?
2. ⚠️ Create migration if adding column
3. ⚠️ Update documentation with field usage guidelines
4. ⚠️ Add tests for critical query paths
5. ⚠️ Consider implementing type-safe query helpers

**Estimated Time:** 4-6 hours

---

## Testing Checklist

After fix is applied:

### Manual Testing

- [ ] Navigate to Admin → Data Integrity → Pending Approvals
- [ ] Verify pending projects table loads without errors
- [ ] Click "Review" on a pending project
- [ ] Verify EnhancedProjectReviewDialog opens
- [ ] Verify all tabs load (Overview, Contacts, Employers, Duplicates, Source)
- [ ] Verify scan upload information displays correctly
- [ ] Test approve workflow
- [ ] Test reject workflow

### Automated Testing

- [ ] Write unit test for `usePendingProjectData` hook
- [ ] Write integration test for pending project review flow
- [ ] Add E2E test covering mapping sheet upload → review → approval

---

## Related Files

### Files Requiring Changes

1. **Primary Fix:**
   - `src/hooks/usePendingProjectData.ts` (Lines 79-88)

2. **Potential Updates:**
   - `src/types/pendingProjectReview.ts` (MappingSheetScanDetails interface)
   - `src/components/admin/project-review/SourceFileSection.tsx` (display logic)

### Files Already Correct

1. ✅ `src/app/api/admin/pending-items/route.ts` - Uses correct columns
2. ✅ `src/app/(app)/projects/[projectId]/scan-review/[scanId]/page.tsx` - Uses `select('*')`
3. ✅ `src/app/(app)/projects/new-scan-review/[scanId]/page.tsx` - Uses `select('*')`

---

## Prevention Strategies

### 1. Schema Change Protocol

**Guideline:** When modifying database schema:

1. Update migration SQL
2. Regenerate TypeScript types: `npx supabase gen types typescript`
3. Search codebase for all references to changed table
4. Update all queries
5. Update tests
6. Document changes

### 2. Query Review Checklist

Before merging code with database queries:

- [ ] Column names match schema exactly (check migration files)
- [ ] Foreign key relationships are correct
- [ ] Type definitions are up-to-date
- [ ] Similar queries use consistent patterns
- [ ] Tests cover query paths

### 3. Automated Validation

**Consider:**
- Pre-commit hook: Validate queries against current schema
- CI check: Run test suite that includes database queries
- Lint rule: Warn on hardcoded column names in select strings

---

## Conclusion

### Root Cause

Code references non-existent column `uploaded_at` in `mapping_sheet_scans` table.

### Immediate Fix

Replace `uploaded_at` with `created_at` in `usePendingProjectData.ts`.

### Systemic Issue

Lack of schema-code synchronization validation allows runtime errors that could be caught at compile time.

### Long-term Solution

1. Choose: Add `uploaded_at` column OR standardize on `created_at`
2. Implement type-safe query patterns
3. Add automated schema validation
4. Document field naming conventions
5. Improve test coverage for database queries

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-05  
**Author:** AI Analysis

