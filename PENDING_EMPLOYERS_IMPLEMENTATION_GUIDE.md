# Pending Employers Manual Match/Skip/Delete - Implementation Guide

## Overview

This guide shows exactly how to add manual match, skip, and delete functionality to `PendingEmployersImport.tsx`.

## Key Design Decisions

✅ **Manual matches bypass duplicate detection workflow** - Direct database persistence  
✅ **Database migration required** - New status values: `'matched'`, `'create_new'`  
✅ **Skip hides employers** - Query filter excludes `import_status = 'skipped'`  
✅ **Matched employers get updated** - Trade assignments, roles, and other data merged  
✅ **Manual Match button** - Only shown when NO automatic match detected  
✅ **Automatic matches** - Can be confirmed OR switched to manual search if incorrect  

## Prerequisites

### Step 0: Run Database Migration

**Before implementing UI changes**, apply the migration:

```bash
# This adds 'matched' and 'create_new' status values
# Also adds matched_employer_id column if missing
```

Migration file: `supabase/migrations/0100_add_pending_employer_status_values.sql`

Status values after migration:
- `'pending'` - Default, awaiting review
- `'imported'` - Successfully imported
- `'skipped'` - User skipped (hidden from list)
- `'error'` - Import failed
- `'matched'` - User manually matched to existing employer (NEW)
- `'create_new'` - User confirmed create as new (NEW)

## Step 1: Add Import

**Location**: Line 8 (with other lucide-react imports)

**Add**:
```typescript
import { EbaEmployerMatchDialog } from './EbaEmployerMatchDialog';
```

**After this change, the imports should look like**:
```typescript
import { CheckCircle, AlertCircle, Info, Building2, Trash2, Eye, EyeOff, Wrench, AlertTriangle, Search, FileText, ExternalLink, ChevronDown, ChevronRight, XCircle } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { getTradeTypeLabel, TradeType, getTradeTypeCategories } from '@/utils/bciTradeTypeInference';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { normalizeEmployerName } from '@/lib/employers/normalize';
import { useAliasTelemetry } from '@/hooks/useAliasTelemetry';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { EbaEmployerMatchDialog } from './EbaEmployerMatchDialog'; // ADD THIS LINE
```

## Step 2: Add State Variables

**Location**: Around line 145-155 (in the component function, after existing state declarations, look for `const [showEbaSearch, setShowEbaSearch]`)

**Add these state variables**:
```typescript
// Manual match dialog state
const [manualMatchDialog, setManualMatchDialog] = useState<{
  open: boolean;
  pendingEmployerId: string | null;
  pendingEmployerName: string;
}>({
  open: false,
  pendingEmployerId: null,
  pendingEmployerName: '',
});

// Delete confirmation dialog
const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
  open: boolean;
  employerId: string | null;
  employerName: string;
}>({
  open: false,
  employerId: null,
  employerName: '',
});

// Filter for skipped employers
const [showSkipped, setShowSkipped] = useState(false);
```

## Step 3: Add Handler Functions

**Location**: After the existing handler functions (around line 700-900, after `loadPendingEmployers` and before `createEmployer`)

**Add all these functions**:
```typescript
// ============================================================================
// MANUAL MATCH, SKIP, DELETE HANDLERS
// ============================================================================

// Manual Match Handlers
const openManualMatch = (employerId: string, employerName: string) => {
  setManualMatchDialog({
    open: true,
    pendingEmployerId: employerId,
    pendingEmployerName: employerName,
  });
};

const handleManualMatchSelect = async (matchedEmployerId: string) => {
  if (!manualMatchDialog.pendingEmployerId) return;
  
  const supabase = getSupabaseBrowserClient();
  
  // Bypass duplicate detection - persist directly to database
  const { error } = await supabase
    .from('pending_employers')
    .update({
      import_status: 'matched',
      matched_employer_id: matchedEmployerId,
    })
    .eq('id', manualMatchDialog.pendingEmployerId);
  
  if (!error) {
    toast({
      title: 'Match Saved',
      description: 'Employer matched successfully. Will update existing employer on import.',
    });
    
    // Refresh list to show updated status
    loadPendingEmployers();
  } else {
    toast({
      title: 'Match Failed',
      description: error.message,
      variant: 'destructive',
    });
  }
  
  setManualMatchDialog({ open: false, pendingEmployerId: null, pendingEmployerName: '' });
};

const handleManualMatchCreateNew = async () => {
  if (!manualMatchDialog.pendingEmployerId) return;
  
  const supabase = getSupabaseBrowserClient();
  
  // Mark as create new in database
  const { error } = await supabase
    .from('pending_employers')
    .update({
      import_status: 'create_new',
      matched_employer_id: null, // Clear any previous match
    })
    .eq('id', manualMatchDialog.pendingEmployerId);
  
  if (!error) {
    toast({
      title: 'Marked as New',
      description: 'Will create new employer on import',
    });
    
    loadPendingEmployers();
  } else {
    toast({
      title: 'Update Failed',
      description: error.message,
      variant: 'destructive',
    });
  }
  
  setManualMatchDialog({ open: false, pendingEmployerId: null, pendingEmployerName: '' });
};

const handleManualMatchSkip = async () => {
  if (!manualMatchDialog.pendingEmployerId) return;
  
  const supabase = getSupabaseBrowserClient();
  
  // Update status to skipped (will be hidden from list)
  const { error } = await supabase
    .from('pending_employers')
    .update({ import_status: 'skipped' })
    .eq('id', manualMatchDialog.pendingEmployerId);
  
  if (!error) {
    toast({
      title: 'Skipped',
      description: 'Employer hidden from import list',
    });
    
    // Refresh list (employer will disappear if showSkipped is false)
    loadPendingEmployers();
  } else {
    toast({
      title: 'Skip Failed',
      description: error.message,
      variant: 'destructive',
    });
  }
  
  setManualMatchDialog({ open: false, pendingEmployerId: null, pendingEmployerName: '' });
};

// Quick Skip (without opening dialog)
const skipPendingEmployer = async (employerId: string, employerName: string) => {
  const supabase = getSupabaseBrowserClient();
  
  const { error } = await supabase
    .from('pending_employers')
    .update({ import_status: 'skipped' })
    .eq('id', employerId);
  
  if (!error) {
    toast({
      title: 'Skipped',
      description: `"${employerName}" hidden from import list`,
    });
    loadPendingEmployers();
  } else {
    toast({
      title: 'Skip Failed',
      description: error.message,
      variant: 'destructive',
    });
  }
};

// Delete Handler (opens confirmation dialog)
const openDeleteConfirm = (employerId: string, employerName: string) => {
  setDeleteConfirmDialog({
    open: true,
    employerId: employerId,
    employerName: employerName,
  });
};

const confirmDeletePendingEmployer = async () => {
  if (!deleteConfirmDialog.employerId) return;
  
  const supabase = getSupabaseBrowserClient();
  const employerName = deleteConfirmDialog.employerName;
  
  const { error } = await supabase
    .from('pending_employers')
    .delete()
    .eq('id', deleteConfirmDialog.employerId);
  
  if (!error) {
    toast({
      title: 'Deleted',
      description: `Removed "${employerName}" from pending list`,
    });
    
    // Remove from selected employers if it was selected
    setSelectedEmployers(prev => {
      const updated = new Set(prev);
      updated.delete(deleteConfirmDialog.employerId!);
      return updated;
    });
    
    // Refresh list
    loadPendingEmployers();
  } else {
    toast({
      title: 'Delete Failed',
      description: error.message,
      variant: 'destructive',
    });
  }
  
  setDeleteConfirmDialog({ open: false, employerId: null, employerName: '' });
};

// Switch from automatic match to manual search
const switchToManualMatch = (employerId: string, employerName: string) => {
  // Remove from duplicate detections to allow manual override
  setDuplicateDetections(prev => {
    const updated = { ...prev };
    delete updated[employerId];
    return updated;
  });
  
  // Open manual match dialog
  openManualMatch(employerId, employerName);
  
  toast({
    title: 'Switched to Manual',
    description: 'Search for the correct employer match',
  });
};
```

## Step 4: Add Buttons to UI

**Location**: Lines ~2400-2600 where pending employers are mapped/rendered. Look for the `.map((employer) =>` that renders each pending employer card.

**Search for**: The section that displays `employer.company_name` and has badge/status indicators

**Add action buttons** for each employer. The logic differs based on duplicate detection status:

```typescript
{/* Action Buttons - Different per scenario */}
<div className="flex gap-2 flex-wrap">
  {/* SCENARIO 1: Has automatic duplicate detection */}
  {duplicateDetections[employer.id] ? (
    <>
      {/* Confirm automatic match */}
      {duplicateDetections[employer.id].hasExactMatch && (
        <Button
          size="sm"
          variant={duplicateDetections[employer.id].userDecision === 'use_existing' ? 'default' : 'outline'}
          onClick={() => {
            const match = duplicateDetections[employer.id].exactMatches?.[0];
            if (match) {
              updateDuplicateDecision(employer.id, 'use_existing', match.id);
            }
          }}
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          {duplicateDetections[employer.id].userDecision === 'use_existing' ? 'Match Confirmed' : 'Confirm Match'}
        </Button>
      )}
      
      {/* Switch to manual search */}
      <Button
        size="sm"
        variant="outline"
        onClick={() => switchToManualMatch(employer.id, employer.company_name)}
      >
        <Search className="h-4 w-4 mr-1" />
        Different Match
      </Button>
      
      {/* Create New option */}
      <Button
        size="sm"
        variant={duplicateDetections[employer.id].userDecision === 'create_new' ? 'default' : 'outline'}
        onClick={() => updateDuplicateDecision(employer.id, 'create_new')}
      >
        Create New
      </Button>
    </>
  ) : (
    /* SCENARIO 2: No automatic match - show manual match button */
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => openManualMatch(employer.id, employer.company_name)}
      >
        <Search className="h-4 w-4 mr-1" />
        Manual Match
      </Button>
      
      <Button
        size="sm"
        variant="outline"
        onClick={() => skipPendingEmployer(employer.id, employer.company_name)}
        disabled={employer.import_status === 'skipped'}
      >
        {employer.import_status === 'skipped' ? 'Skipped' : 'Skip'}
      </Button>
    </>
  )}
  
  {/* Delete always available */}
  <Button
    size="sm"
    variant="ghost"
    onClick={() => openDeleteConfirm(employer.id, employer.company_name)}
    className="text-red-600 hover:text-red-700 hover:bg-red-50"
  >
    <Trash2 className="h-4 w-4" />
  </Button>
</div>
```

**Visual placement**: These buttons should be in a flex container within each employer card, typically near the employer name or in an actions column.

## Step 5: Add Dialog Components

**Location**: At the end of the component's return statement, around line 2680, before the final closing `</div>` and `</>`

**Add both dialogs**:
```typescript
{/* Manual Match Dialog */}
<EbaEmployerMatchDialog
  open={manualMatchDialog.open}
  onOpenChange={(open) => setManualMatchDialog({ ...manualMatchDialog, open })}
  pendingEmployerName={manualMatchDialog.pendingEmployerName}
  pendingEmployerId={manualMatchDialog.pendingEmployerId || ''}
  onSelectMatch={handleManualMatchSelect}
  onCreateNew={handleManualMatchCreateNew}
  onSkip={handleManualMatchSkip}
/>

{/* Delete Confirmation Dialog */}
<Dialog open={deleteConfirmDialog.open} onOpenChange={(open) => setDeleteConfirmDialog({ ...deleteConfirmDialog, open })}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Delete Pending Employer</DialogTitle>
      <DialogDescription>
        Are you sure you want to permanently delete <strong>"{deleteConfirmDialog.employerName}"</strong> from the pending import list?
      </DialogDescription>
    </DialogHeader>
    <div className="flex justify-end gap-3 mt-4">
      <Button
        variant="outline"
        onClick={() => setDeleteConfirmDialog({ open: false, employerId: null, employerName: '' })}
      >
        Cancel
      </Button>
      <Button
        variant="destructive"
        onClick={confirmDeletePendingEmployer}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Delete Permanently
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

## Step 6: Update loadPendingEmployers to Filter Skipped

**Location**: In the `loadPendingEmployers` function around line 341-380

**Find this existing code** (around line 348):
```typescript
if (!showProcessedEmployers) {
  // Only load employers that haven't been processed (pending or null status)
  query = query.or('import_status.is.null,import_status.eq.pending');
}
```

**Replace with**:
```typescript
if (!showProcessedEmployers) {
  // Build filter: pending, null, and optionally skipped/matched
  const statuses = ['import_status.is.null', 'import_status.eq.pending'];
  
  if (showSkipped) {
    statuses.push('import_status.eq.skipped');
  }
  
  // Include matched and create_new so user can see manual decisions
  statuses.push('import_status.eq.matched');
  statuses.push('import_status.eq.create_new');
  
  query = query.or(statuses.join(','));
}
```

**Then add a toggle in the UI** (around line 1900-2000, where filter controls are):
```typescript
{/* Filter Controls */}
<div className="flex items-center gap-4">
  <div className="flex items-center gap-2">
    <Checkbox
      id="showSkipped"
      checked={showSkipped}
      onCheckedChange={(checked) => setShowSkipped(checked as boolean)}
    />
    <Label htmlFor="showSkipped" className="cursor-pointer">
      Show skipped employers
    </Label>
  </div>
  
  <div className="flex items-center gap-2">
    <Checkbox
      id="showProcessed"
      checked={showProcessedEmployers}
      onCheckedChange={(checked) => setShowProcessedEmployers(checked as boolean)}
    />
    <Label htmlFor="showProcessed" className="cursor-pointer">
      Show imported employers
    </Label>
  </div>
</div>
```

## Testing Checklist

### Manual Match
- [ ] Click "Manual Match" button
- [ ] Dialog opens with employer name
- [ ] Search finds existing employers
- [ ] Can select a match
- [ ] Can create new
- [ ] Can skip

### Skip
- [ ] Click "Skip" button
- [ ] Employer marked as skipped
- [ ] Button changes to "Skipped" (disabled)
- [ ] Can still delete if needed

### Delete
- [ ] Click delete button (trash icon)
- [ ] Confirmation dialog appears
- [ ] Clicking OK removes employer from list
- [ ] Clicking Cancel does nothing
- [ ] Employer is removed from selected list if selected

## Error Handling

If you encounter errors:

1. **"EbaEmployerMatchDialog not found"**
   - Ensure `EbaEmployerMatchDialog.tsx` is in the same directory
   - Check the import path is correct

2. **"loadPendingEmployers is not defined"**
   - Find the existing function name for loading employers
   - Replace `loadPendingEmployers()` with the correct function name

3. **"updateDuplicateDecision is not defined"**
   - This function should already exist in PendingEmployersImport
   - If not, you may need to adjust the manual match logic

## Step 7: Handle Manual Matches in Import Logic

**Location**: In the `createEmployer` or import processing function (around line 387-600)

**Find where employer creation/matching is decided**. Add logic to check for manual matches:

```typescript
const processEmployer = async (pendingEmployer: PendingEmployer, results: ImportResults) => {
  const supabase = getSupabaseBrowserClient();
  
  // Check if user manually matched this employer
  if (pendingEmployer.import_status === 'matched' && pendingEmployer.matched_employer_id) {
    console.log(`✓ Using manually matched employer for ${pendingEmployer.company_name}`);
    
    // Update the existing employer with any new information
    const updateData: any = {};
    
    // Add trade assignments if present
    if (pendingEmployer.user_confirmed_trade_type || pendingEmployer.inferred_trade_type) {
      const tradeType = pendingEmployer.user_confirmed_trade_type || pendingEmployer.inferred_trade_type;
      // Logic to add trade to employer (use existing trade assignment functions)
      updateData.trade_type = tradeType;
    }
    
    // Add role information if present
    if (pendingEmployer.our_role) {
      updateData.our_role = pendingEmployer.our_role;
    }
    
    // Update employer with new data
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('employers')
        .update(updateData)
        .eq('id', pendingEmployer.matched_employer_id);
      
      if (updateError) {
        console.error('Error updating matched employer:', updateError);
      }
    }
    
    // Mark as imported
    await supabase
      .from('pending_employers')
      .update({ 
        import_status: 'imported',
        imported_employer_id: pendingEmployer.matched_employer_id 
      })
      .eq('id', pendingEmployer.id);
    
    results.processedEmployers.push({
      id: pendingEmployer.matched_employer_id,
      name: pendingEmployer.company_name
    });
    
    return pendingEmployer.matched_employer_id;
  }
  
  // Check if user confirmed create new
  if (pendingEmployer.import_status === 'create_new') {
    console.log(`✓ Creating new employer as confirmed by user: ${pendingEmployer.company_name}`);
    // Continue with normal employer creation logic
  }
  
  // Rest of existing duplicate detection logic...
};
```

This ensures manually matched employers get their data merged into the existing record.

## Benefits

✅ **Manual control** - Override automatic matching with manual search  
✅ **Confirm automatic matches** - Explicitly approve detected duplicates  
✅ **Switch to manual** - If automatic match is wrong, switch to manual search  
✅ **Skip without deleting** - Hide employers from list temporarily  
✅ **Permanent delete** - Remove incorrect entries with confirmation dialog  
✅ **Search with similarity** - Find employers by name or ABN with scoring  
✅ **See EBA status** - View which employers have agreements  
✅ **Bypass duplicate workflow** - Direct database persistence for manual matches  
✅ **Merge data** - Manually matched employers get updated with new trade/role info  
✅ **Filter control** - Toggle visibility of skipped/processed employers  

---

## Implementation Checklist

- [ ] **Step 0**: Apply database migration `0100_add_pending_employer_status_values.sql`
- [ ] **Step 1**: Add `EbaEmployerMatchDialog` import
- [ ] **Step 2**: Add state variables (manual match, delete confirm, showSkipped)
- [ ] **Step 3**: Add all handler functions
- [ ] **Step 4**: Add action buttons to employer rendering (conditional based on detection)
- [ ] **Step 5**: Add dialog components at end of return statement
- [ ] **Step 6**: Update `loadPendingEmployers` filter logic
- [ ] **Step 7**: Handle manual matches in import processing logic
- [ ] **Test**: All workflows (manual match, confirm automatic, skip, delete)
- [ ] **Test**: Filter toggles (show skipped, show processed)
- [ ] **Test**: Data merge for manually matched employers

---

**Implementation Time**: ~60-90 minutes  
**Testing Time**: ~30 minutes  
**Total**: ~2 hours

**Status**: Ready to implement  
**Priority**: High - Resolves duplicate employer merge issues

