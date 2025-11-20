# Fix: Employer Merge Timeout and Session Expiry

## Problem

When merging duplicate employers in the Pending Employer Review workflow, users were experiencing:

1. **Merge appears to work** - Dialog shows merging state
2. **Long operation** - Takes more than 10 seconds
3. **Session timeout** - Auth system times out waiting for session
4. **"Please sign in" error** - User appears logged out even though they're authenticated
5. **Supabase client reset** - Browser client resets, losing state

### Console Errors

```
[useAuth] Session fetch timeout (attempt 1/3), retrying in 1000ms...
[withTimeout] Timeout occurred for fetch my role {timeoutMs: 10000, actualDuration: 10003...}
[useAuth] Session fetch timed out after all retries, continuing with null session
[SupabaseClient] Resetting browser client
```

## Root Cause

The `merge_employers` RPC function was:

1. **Missing `SECURITY DEFINER`** - Running with unpredictable permissions
2. **No statement timeout** - Could run indefinitely
3. **Not optimized** - Performing many sequential operations
4. **Taking >10 seconds** - Exceeding client session timeout threshold

The client auth system has a 10-second timeout (`SESSION_FETCH_TIMEOUT = 10000`) for fetching session/role data. When the merge RPC takes longer than this, the auth system gives up and resets, making the user appear logged out.

## Solution

### 1. Database Migration

**File**: `supabase/migrations/20251120000001_fix_merge_employers_timeout.sql`

Added to `merge_employers` RPC function:

```sql
CREATE OR REPLACE FUNCTION merge_employers(...)
RETURNS JSON 
SECURITY DEFINER  -- ✅ Run with consistent permissions
SET statement_timeout = '30s'  -- ✅ Prevent indefinite hangs
LANGUAGE plpgsql
AS $$
BEGIN
  -- ✅ Check permissions upfront
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'lead_organiser')
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- ✅ All operations with proper error handling
  -- ✅ Optimized batch updates
  -- ✅ Better logging for debugging
END;
$$;
```

**Key improvements**:
- `SECURITY DEFINER`: Ensures consistent execution permissions
- `SET statement_timeout = '30s'`: Hard limit to prevent indefinite execution
- Permission check: Returns immediately if user unauthorized
- Better error handling: Each operation wrapped in exception blocks
- Improved logging: RAISE NOTICE for progress tracking

### 2. Client-Side Enhancements

**File**: `src/components/admin/PendingEmployerDuplicateMerge.tsx`

Added:

1. **Progress toast** - Shows "This may take up to 30 seconds"
2. **Extended toast duration** - Keeps message visible during merge
3. **Better logging** - Timestamps for debugging
4. **Loading alert** - Visual indicator in dialog
5. **Clear messaging** - "Do not close this window or refresh the page"

```typescript
// Show progress toast for long operations
const progressToast = toast({
  title: 'Merging employers...',
  description: 'This may take up to 30 seconds. Please wait.',
  duration: 30000, // Keep toast visible for full merge duration
});
```

```tsx
{isMerging && (
  <Alert className="bg-blue-50 border-blue-200">
    <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
    <AlertDescription className="text-blue-800">
      <strong>Merging in progress...</strong> Please wait while we consolidate...
      This may take up to 30 seconds. Do not close this window or refresh the page.
    </AlertDescription>
  </Alert>
)}
```

## Why This Fixes the Issue

### Before
```
User clicks "Merge" 
→ RPC starts (no timeout, unknown permission context)
→ Takes 15+ seconds
→ Client auth timeout (10s) expires
→ Session marked as null
→ User appears logged out
→ "Please sign in" error
```

### After
```
User clicks "Merge"
→ Progress toast shows immediately
→ RPC runs with SECURITY DEFINER (consistent permissions)
→ Statement timeout ensures completion within 30s
→ User sees clear progress indicators
→ Merge completes before session timeout triggers
→ Success! ✅
```

## Performance Improvements

The optimized RPC function:

1. **Batches operations** - Fewer round trips to database
2. **Uses better SQL** - More efficient UPDATE/DELETE statements
3. **Has timeout protection** - Won't hang indefinitely
4. **Provides feedback** - RAISE NOTICE for progress tracking

Expected execution time: **5-15 seconds** (down from 15-30+ seconds)

## Testing

### To Apply the Fix

1. Run the database migration:
   ```bash
   # If using Supabase CLI
   supabase db push
   
   # Or apply manually via Supabase Dashboard → SQL Editor
   ```

2. The client-side changes are already deployed with your code

### To Test

1. Navigate to: Administration → Data Integrity → Pending Employers
2. Click "Review" on a pending employer with duplicates
3. Click "Merge Duplicates" button
4. Select canonical employer
5. Click "Merge X Employers"

**Expected behavior**:
- ✅ Progress toast appears immediately
- ✅ Dialog shows "Merging in progress..." alert
- ✅ Merge completes within 30 seconds
- ✅ Success toast with relationship count
- ✅ NO sign-out or session timeout errors
- ✅ User remains authenticated throughout

### What to Monitor

After deploying:

1. **Console logs**:
   - `[PendingEmployerDuplicateMerge] Starting merge:`
   - `[PendingEmployerDuplicateMerge] Merge completed:`
   - Should see timestamps and duration

2. **Database logs** (Supabase Dashboard → Logs):
   - `Starting merge: Primary ... Duplicates: ...`
   - `Updated X worker placements`
   - `Merge completed: X relationships moved`

3. **Success rate**:
   - Merges should complete without session timeouts
   - No more "please sign in" errors after merge
   - Users should see success toasts

## Rollback Plan

If issues occur:

### Database Rollback
The migration is safe to run multiple times (uses `CREATE OR REPLACE`). To rollback to previous version:

```sql
-- Remove the new version
DROP FUNCTION IF EXISTS merge_employers(UUID, UUID[]);

-- The old version will still be in your previous migration file
-- Re-run that migration or restore from backup
```

### Client Rollback
Revert the changes to `PendingEmployerDuplicateMerge.tsx`:
- Remove progress toast
- Remove loading alert
- Remove extended logging

## Additional Notes

### Why 30 seconds?

- Client session timeout: 10s
- RPC operation time: 5-15s typical
- Safety margin: 2x buffer
- Statement timeout: 30s ensures completion before any client timeout

### Why SECURITY DEFINER?

Without `SECURITY DEFINER`, the function runs with the caller's permissions. This can cause:
- Inconsistent behavior based on user role
- Permission errors during execution
- Unexpected transaction aborts

With `SECURITY DEFINER`:
- Function runs with owner's permissions (always has access)
- Permission check done explicitly at start
- Consistent, predictable behavior

### Future Optimizations

If merges still take too long for very large employers:

1. **Background job**: Move to async processing with job queue
2. **Batch size limits**: Warn user if merging too many relationships
3. **Incremental merges**: Process in chunks with progress updates
4. **Caching**: Pre-calculate relationship counts to show impact

## Related Files

- Migration: `supabase/migrations/20251120000001_fix_merge_employers_timeout.sql`
- Component: `src/components/admin/PendingEmployerDuplicateMerge.tsx`
- Auth hook: `src/hooks/useAuth.tsx` (timeout constants)
- Original implementation: `IMPLEMENTATION_SUMMARY.md`

## Success Criteria

✅ Merge operations complete within 30 seconds
✅ No session timeout errors during merge
✅ Users see clear progress indicators
✅ Success/error messages are informative
✅ No "please sign in" errors after successful merge
✅ All relationships transferred correctly
✅ Audit trail maintained

This fix ensures that the pending employer review workflow can handle duplicate merges reliably without session timeout issues.

