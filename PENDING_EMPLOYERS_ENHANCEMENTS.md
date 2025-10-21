# Pending Employers Import - Enhancement Plan

## Changes Needed

### 1. Add Manual Match Dialog (✅ Created)

**File**: `src/components/upload/EbaEmployerMatchDialog.tsx`

Features:
- Search employers by name or ABN
- Show similarity scores
- Display employer details (address, phone, EBA status)
- Three actions:
  - Select Match
  - Create New
  - Skip for Now

### 2. Integrate Manual Match into Pending Employers

**File**: `src/components/upload/PendingEmployersImport.tsx`

**Changes Needed**:

1. **Import the dialog component**:
```typescript
import { EbaEmployerMatchDialog } from './EbaEmployerMatchDialog'
```

2. **Add state for manual matching**:
```typescript
const [manualMatchDialog, setManualMatchDialog] = useState<{
  open: boolean
  pendingEmployerId: string | null
  pendingEmployerName: string
}>({
  open: false,
  pendingEmployerId: null,
  pendingEmployerName: '',
})
```

3. **Add manual match handlers**:
```typescript
const openManualMatch = (employerId: string, employerName: string) => {
  setManualMatchDialog({
    open: true,
    pendingEmployerId: employerId,
    pendingEmployerName: employerName,
  })
}

const handleManualMatchSelect = async (matchedEmployerId: string) => {
  if (!manualMatchDialog.pendingEmployerId) return
  
  // Update the pending employer with the match
  const { error } = await supabase
    .from('pending_employers')
    .update({
      matched_employer_id: matchedEmployerId,
      import_status: 'matched',
    })
    .eq('id', manualMatchDialog.pendingEmployerId)
  
  if (!error) {
    toast({ title: 'Match saved', description: 'Employer matched successfully' })
    // Refresh the list
    loadPendingEmployers()
  }
}

const handleManualMatchCreateNew = async () => {
  if (!manualMatchDialog.pendingEmployerId) return
  
  // Mark as ready to create new
  const { error } = await supabase
    .from('pending_employers')
    .update({
      import_status: 'create_new',
    })
    .eq('id', manualMatchDialog.pendingEmployerId)
  
  if (!error) {
    toast({ title: 'Marked as new', description: 'Will create new employer' })
    loadPendingEmployers()
  }
}

const handleManualMatchSkip = async () => {
  if (!manualMatchDialog.pendingEmployerId) return
  
  // Mark as skipped
  const { error } = await supabase
    .from('pending_employers')
    .update({
      import_status: 'skipped',
    })
    .eq('id', manualMatchDialog.pendingEmployerId)
  
  if (!error) {
    toast({ title: 'Skipped', description: 'Employer skipped for now' })
    loadPendingEmployers()
  }
}
```

4. **Add Delete Functionality**:
```typescript
const deletePendingEmployer = async (employerId: string, employerName: string) => {
  if (!confirm(`Are you sure you want to delete "${employerName}" from pending imports?`)) {
    return
  }
  
  const { error } = await supabase
    .from('pending_employers')
    .delete()
    .eq('id', employerId)
  
  if (!error) {
    toast({ title: 'Deleted', description: `Removed "${employerName}"` })
    loadPendingEmployers()
  } else {
    toast({ 
      title: 'Delete failed', 
      description: error.message,
      variant: 'destructive' 
    })
  }
}
```

5. **Add Skip Functionality**:
```typescript
const skipPendingEmployer = async (employerId: string) => {
  const { error } = await supabase
    .from('pending_employers')
    .update({ import_status: 'skipped' })
    .eq('id', employerId)
  
  if (!error) {
    toast({ title: 'Skipped', description: 'Employer skipped' })
    loadPendingEmployers()
  }
}
```

6. **Update UI to add buttons**:
```typescript
// In the employer list rendering, add these buttons:
<Button
  size="sm"
  variant="outline"
  onClick={() => openManualMatch(employer.id, employer.company_name)}
>
  <Search className="h-4 w-4 mr-2" />
  Manual Match
</Button>

<Button
  size="sm"
  variant="outline"
  onClick={() => skipPendingEmployer(employer.id)}
>
  Skip
</Button>

<Button
  size="sm"
  variant="destructive"
  onClick={() => deletePendingEmployer(employer.id, employer.company_name)}
>
  <Trash2 className="h-4 w-4" />
  Delete
</Button>
```

7. **Add the dialog to the component**:
```typescript
<EbaEmployerMatchDialog
  open={manualMatchDialog.open}
  onOpenChange={(open) => setManualMatchDialog({ ...manualMatchDialog, open })}
  pendingEmployerName={manualMatchDialog.pendingEmployerName}
  pendingEmployerId={manualMatchDialog.pendingEmployerId || ''}
  onSelectMatch={handleManualMatchSelect}
  onCreateNew={handleManualMatchCreateNew}
  onSkip={handleManualMatchSkip}
/>
```

## Database Schema Check

Need to verify if `pending_employers` table has:
- `matched_employer_id` column (for storing manual matches)
- `import_status` supports: 'pending', 'matched', 'create_new', 'skipped', 'imported'

If not, we may need a migration.

## Testing Steps

1. **Manual Match**:
   - [ ] Click "Manual Match" on a pending employer
   - [ ] Dialog opens with employer name
   - [ ] Search for existing employers
   - [ ] Select a match - employer marked as matched
   - [ ] Create new - employer marked as create_new
   - [ ] Skip - employer marked as skipped

2. **Skip**:
   - [ ] Click "Skip" on a pending employer
   - [ ] Employer status changes to 'skipped'
   - [ ] Can still un-skip later if needed

3. **Delete**:
   - [ ] Click "Delete" on a pending employer
   - [ ] Confirmation dialog appears
   - [ ] Confirm - employer removed from list
   - [ ] Cancel - no change

## Benefits

- **Manual Control**: Users decide exact matches vs. creating new
- **Skip Option**: Defer decisions without importing
- **Delete**: Remove incorrect/duplicate pending records
- **Search**: Find employers by name or ABN
- **Similarity Scores**: See match confidence
- **EBA Visibility**: See which employers already have EBAs

## Implementation Status

- [x] EbaEmployerMatchDialog component created
- [ ] Import dialog into PendingEmployersImport
- [ ] Add manual match functionality
- [ ] Add skip functionality  
- [ ] Add delete functionality
- [ ] Test all workflows
- [ ] Document for users

## Next Steps

1. Update PendingEmployersImport.tsx with the handlers
2. Add buttons to the UI
3. Test the workflow
4. Add database migration if needed
5. Update user documentation

---

**Note**: This bypasses the automatic merge functionality that was causing the `get_employer_merge_impact` error, giving users full manual control over the matching process.


