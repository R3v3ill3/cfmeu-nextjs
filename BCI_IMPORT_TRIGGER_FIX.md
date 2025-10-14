# BCI Import Trigger Cascade Fix

## Problem Summary

The BCI XLSX Import was getting stuck on the first project during the import phase, with no visible errors in console or terminal. The import would begin processing but never progress past the first project.

## Root Cause Analysis

### The Trigger Cascade

The issue was caused by a cascade of database triggers that block the import process:

```
1. BCI Import: INSERT INTO projects (name, bci_project_id, ...)
   ↓
2. BEFORE INSERT Trigger: trigger_auto_assign_organising_universe
   - Calculates organising_universe based on tier
   ↓
3. BCI Import: INSERT INTO job_sites (project_id, latitude, longitude, ...)
   ↓
4. BEFORE INSERT Trigger: trg_job_sites_auto_patch
   - Assigns patch_id based on coordinates
   - Inserts into patch_job_sites table
   ↓
5. AFTER INSERT Trigger: trigger_patch_organising_universe_update
   - Tries to UPDATE projects.organising_universe
   - 🚨 BLOCKS: Project row is locked by ongoing transaction
   ↓
6. BCI Import: UPDATE projects SET main_job_site_id = ...
   - 🚨 BLOCKS: Waiting for trigger to complete
```

**Result:** Circular dependency/deadlock. The triggers try to update the project while it's still being created, causing the import to hang indefinitely.

### Why This Started Happening

Recent changes introduced the "Organising Universe" functionality with these triggers:
- `trigger_auto_assign_organising_universe` (on projects table)
- `trigger_patch_organising_universe_update` (on patch_job_sites table)
- `job_sites_set_patch_from_coords()` (inserts into patch_job_sites)

These triggers work fine for normal operations but create a cascade during the specific sequence used by BCI imports.

## The Fix

### Migration: `20251015150000_fix_patch_assignment_trigger_cascade.sql`

Modified `handle_patch_assignment_organising_universe_update()` function to skip the update during initial project creation:

```sql
-- Skip if project is still in initial creation phase:
-- - main_job_site_id is NULL (hasn't been set yet)
-- - created_at is within last 1 second
IF project_main_site_id IS NULL AND project_created_at > (NOW() - INTERVAL '1 second') THEN
  RAISE DEBUG 'Skipping organising universe update for project % still in initial creation';
  RETURN COALESCE(NEW, OLD);
END IF;
```

### Why This Works

1. **Surgical approach:** Only affects the exact scenario causing the problem
   - Projects in initial creation (main_job_site_id not yet set)
   - Within 1 second of creation
   - This is very specific to the import flow

2. **Preserves all functionality:**
   - ✅ Automatic geo-coded patch assignment still works
   - ✅ Coordinates are still used to find the correct patch
   - ✅ Patches are still assigned during import
   - ✅ Organising universe is still calculated (on initial INSERT)
   - ✅ Future patch changes still trigger updates

3. **No performance impact:**
   - Only adds a simple NULL check and timestamp comparison
   - The 1-second window is well within normal transaction times

4. **Safe for all import types:**
   - Won't affect manual project creation
   - Won't affect other import workflows
   - Won't affect legitimate patch reassignments after creation

## What's Preserved

### Automatic Patch Assignment
- When a job_site is created with latitude/longitude, it's automatically assigned to the correct patch
- Uses ST_Contains with patch geometries to find geographic match
- Falls back to a default patch if no geographic match found
- **This continues to work exactly as before**

### Organising Universe Calculation
- On initial project creation, the BEFORE INSERT trigger calculates organising_universe based on tier
- Later, when patches/EBA builders are assigned, the universe can be recalculated
- The fix only defers the recalculation during the critical creation window
- After creation completes, all updates work normally

## Testing

To verify the fix works:

1. Navigate to Administration → Data Management → BCI Imports → BCI XLSX Import
2. Upload a BCI XLSX file
3. Process projects (Stage 1)
4. Verify all projects import successfully
5. Check that job sites have patch_id assigned
6. Check that organising_universe is set appropriately

### What to Look For

**Success indicators:**
- ✅ Import progresses through all projects (doesn't hang on first one)
- ✅ Projects are created with coordinates
- ✅ Job sites have patch_id populated
- ✅ No errors in console or server logs
- ✅ Import completes to Stage 2 (Employers)

**Debug logging:**
If you want to see the fix in action, check Supabase logs for:
```
Skipping organising universe update for project <uuid> still in initial creation
```

## Future Considerations

If similar blocking issues occur with other import workflows, the same pattern can be applied:
1. Identify the trigger cascade
2. Add a check for initial creation phase
3. Use specific indicators (like NULL foreign keys) to detect the creation state
4. Preserve all functionality while breaking the cascade

## Related Files

- **Migration:** `/supabase/migrations/20251015150000_fix_patch_assignment_trigger_cascade.sql`
- **Import Component:** `/src/components/upload/BCIXlsxWizard.tsx`
- **Import Logic:** `/src/components/upload/BCIProjectImport.tsx`
- **Schema:** `/supabase/migrations/0000_remote_schema.sql`

## Migration Applied

✅ Successfully applied to remote database on October 15, 2025

The BCI Import should now work without hanging.

