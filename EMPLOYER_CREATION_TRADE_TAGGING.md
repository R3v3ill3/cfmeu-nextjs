# Employer Creation with Trade Tagging - Implementation Complete

## Issue Summary

**Problem**: When creating a new employer from the subcontractor review in scan imports, the employer was being created without:
1. Required `employer_type` field → Database constraint error
2. Trade type association → Employer had no trade capabilities recorded

**Example Scenario**:
- Scanned mapping sheet shows: "ABC Cleaning Services" under "Cleaners" trade
- User clicks "Match Employer" → "Create new employer"
- Only asked for company name
- Employer created but no indication they do "cleaning" work
- Missing required fields caused database errors

## Solution Implemented

### Three-Part Fix

#### 1. Added Employer Type Selection
**Field**: `employer_type` (required NOT NULL in database)

**Options**:
- **Small Contractor** (< 50 employees) - _Default_
- **Large Contractor** (50+ employees)
- **Principal Contractor** (Head contractor)
- **Builder** (Building company)
- **Individual** (Sole trader)

**UI**: 2-column grid of buttons with descriptions

#### 2. Added Trade Capability Recording
**Table**: `contractor_trade_capabilities`

**Logic**:
```typescript
// After creating employer
if (tradeTypeCode) {
  await supabase
    .from('contractor_trade_capabilities')
    .insert({
      employer_id: newEmployerId,
      trade_type: tradeTypeCode,  // e.g., 'cleaning', 'scaffolding'
      is_primary: true,
      notes: 'Added from scanned mapping sheet',
    })
}
```

**Data Flow**:
```
Subcontractor: "ABC Cleaning Services" (Trade: "Cleaners")
  → User creates new employer
  → Employer created in employers table
  → Trade capability created: employer_id + trade_type='cleaning' + is_primary=true
  → System now knows ABC Cleaning Services does cleaning work
```

#### 3. Added Visual Confirmation
When creating new employer, dialog shows:
```
Company Name: ABC Cleaning Services
Employer Type: [Small Contractor selected]

✓ Will be tagged with trade: cleaning
```

User sees exactly what will be recorded in the database.

## User Experience Flow

### Before Fix
```
1. User: Click "Match Employer for ABC Cleaning"
2. Dialog: "Create new employer"
   - Input: Company name
3. Click "Confirm"
4. ❌ Error: employer_type cannot be null
5. User stuck, cannot proceed
```

### After Fix
```
1. User: Click "Match Employer for ABC Cleaning"
2. Dialog: "Create new employer"
   - Input: Company name (pre-filled: "ABC Cleaning Services")
   - Select: Employer Type (default: Small Contractor)
   - Info: "✓ Will be tagged with trade: cleaning"
3. Click "Confirm"
4. ✅ Success: "New employer created (pending approval)"
5. System creates:
   - Employer record (approval_status: pending)
   - Trade capability record (trade: cleaning, is_primary: true)
6. Import proceeds normally
```

## Database Changes

### Employers Table Insert
```sql
INSERT INTO employers (
  name,
  employer_type,              -- NEW: Required field
  enterprise_agreement_status, -- Fixed: null instead of 'unknown'
  approval_status             -- NEW: Pending workflow
) VALUES (
  'ABC Cleaning Services',
  'small_contractor',         -- User selected
  NULL,                       -- Unknown EBA status
  'pending'                   -- Requires admin approval
);
```

### Trade Capabilities Insert
```sql
INSERT INTO contractor_trade_capabilities (
  employer_id,
  trade_type,
  is_primary,
  notes
) VALUES (
  '<new-employer-id>',
  'cleaning',                 -- From subcontractor trade
  true,                       -- Mark as primary capability
  'Added from scanned mapping sheet'
);
```

## Benefits

### 1. Data Quality
- ✅ Employers properly classified by type
- ✅ Trade capabilities recorded at creation
- ✅ Primary trade marked (the trade they were found doing)

### 2. Future Searching
When searching for cleaners:
```sql
SELECT e.* 
FROM employers e
JOIN contractor_trade_capabilities tc ON tc.employer_id = e.id
WHERE tc.trade_type = 'cleaning'
```
**Result**: "ABC Cleaning Services" appears (tagged at creation)

### 3. Reporting
Can now answer:
- "How many cleaning contractors do we have?"
- "Which small contractors do scaffolding?"
- "Show all employers with multiple trade capabilities"

### 4. EBA Tracking
System knows which trade type to check EBA status for

## Error Handling

### Missing Trade Type
**Scenario**: Dialog opened without trade type code (shouldn't happen, but defensive)

**Behavior**:
- Employer still created successfully
- No trade capability inserted
- No error shown to user
- Console log: "No trade type code provided for new employer"

### Invalid Trade Type
**Scenario**: Trade type code doesn't match database enum

**Behavior**:
- Employer created ✅
- Trade capability insert fails (PostgreSQL constraint error)
- Error caught and logged, doesn't break employer creation
- Console warning: "Failed to add trade capability: ..."

### User Changes Mind
**Scenario**: User selects employer type, then cancels

**Behavior**:
- Dialog closes
- No database changes
- State resets

## UI Screenshots (Conceptual)

### Create New Employer Dialog

```
┌─────────────────────────────────────────────┐
│ Match Employer for "ABC Cleaning Services" │
├─────────────────────────────────────────────┤
│                                             │
│ ○ Use suggested match                      │
│ ○ Search for different employer            │
│ ● Create new employer                      │
│                                             │
│   Company Name                              │
│   ┌─────────────────────────────────────┐  │
│   │ ABC Cleaning Services               │  │
│   └─────────────────────────────────────┘  │
│                                             │
│   Employer Type                             │
│   ┌───────────────┬───────────────┐        │
│   │ ✓ Small       │   Large       │        │
│   │   Contractor  │   Contractor  │        │
│   │   < 50 empl.  │   50+ empl.   │        │
│   ├───────────────┼───────────────┤        │
│   │   Principal   │   Builder     │        │
│   │   Contractor  │               │        │
│   │   Head contr. │   Building co.│        │
│   ├───────────────┴───────────────┤        │
│   │   Individual                  │        │
│   │   Sole trader                 │        │
│   └───────────────────────────────┘        │
│                                             │
│   A new employer record will be created    │
│   with pending approval status.            │
│   ✓ Will be tagged with trade: cleaning    │
│                                             │
│         [Cancel]  [Confirm Match]          │
└─────────────────────────────────────────────┘
```

## Testing Checklist

### Test 1: Create Employer with Trade
- [ ] Open subcontractor match dialog
- [ ] Select "Create new employer"
- [ ] See company name pre-filled
- [ ] See employer type options
- [ ] See trade tag confirmation message
- [ ] Click "Confirm Match"
- [ ] Check database for both records:
  ```sql
  SELECT e.name, e.employer_type, tc.trade_type
  FROM employers e
  LEFT JOIN contractor_trade_capabilities tc ON tc.employer_id = e.id
  WHERE e.name = 'ABC Cleaning Services';
  ```
- [ ] Should show employer + trade capability

### Test 2: Different Employer Types
- [ ] Create employer as "Small Contractor"
- [ ] Create employer as "Large Contractor"
- [ ] Create employer as "Builder"
- [ ] Verify employer_type stored correctly

### Test 3: Various Trade Types
- [ ] Create from "Cleaning" subcontractor → trade: cleaning
- [ ] Create from "Scaffolding" subcontractor → trade: scaffolding
- [ ] Create from "Tower Crane" subcontractor → trade: tower_crane
- [ ] Create from "Demo" subcontractor → trade: demolition

### Test 4: Pending Approval Workflow
- [ ] Create new employer
- [ ] Check `approval_status = 'pending'`
- [ ] Employer appears in pending approval list
- [ ] Admin can approve/reject

### Test 5: Trade Capability Query
```sql
-- Should include newly created employer
SELECT e.name, tc.trade_type, tc.is_primary
FROM employers e
JOIN contractor_trade_capabilities tc ON tc.employer_id = e.id
WHERE tc.trade_type = 'cleaning'
ORDER BY e.created_at DESC;
```

## Files Modified

### 1. EmployerMatchDialog.tsx
**Changes**:
- Added `tradeTypeCode` prop (line 24)
- Added `employerType` state (line 43)
- Added employer type selection UI (lines 280-305)
- Added trade capability insert after employer creation (lines 129-145)
- Added trade tag confirmation message (lines 332-336)
- Fixed `enterprise_agreement_status` to use `null` instead of `'unknown'`

### 2. SubcontractorsReview.tsx
**Changes**:
- Pass `trade_type_code` to EmployerMatchDialog (line 666)

## Database Schema

### Employers Table (existing)
```sql
CREATE TABLE employers (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  employer_type employer_type NOT NULL,  -- 'small_contractor', 'large_contractor', etc.
  enterprise_agreement_status boolean,    -- true/false/null
  approval_status text DEFAULT 'active',  -- 'pending', 'active', 'rejected'
  ...
);
```

### Contractor Trade Capabilities Table (existing)
```sql
CREATE TABLE contractor_trade_capabilities (
  id uuid PRIMARY KEY,
  employer_id uuid REFERENCES employers(id),
  trade_type trade_type NOT NULL,         -- 'cleaning', 'scaffolding', etc.
  is_primary boolean DEFAULT false,       -- true if this is their primary trade
  notes text,
  created_at timestamptz DEFAULT now(),
  ...
  UNIQUE(employer_id, trade_type)          -- One record per employer per trade
);
```

## Benefits Summary

✅ **Complete Employer Records**: All required fields populated
✅ **Trade Intelligence**: System knows what trades each employer does
✅ **Better Matching**: Future scans can find employers by trade type
✅ **Approval Workflow**: New employers go through proper vetting
✅ **Data Integrity**: No NULL constraint violations
✅ **User Clarity**: Dialog shows exactly what will be created

## Future Enhancements (Optional)

### 1. Multi-Trade Employers
Some employers do multiple trades:
```typescript
// Allow selecting multiple trade types
<Checkbox value="cleaning" />
<Checkbox value="scaffolding" />
```

### 2. Infer Employer Type from Trade
```typescript
// Auto-suggest employer type based on trade
if (tradeTypeCode === 'builder') {
  setEmployerType('builder')
} else if (tradeTypeCode === 'tower_crane') {
  setEmployerType('large_contractor')
}
```

### 3. Show Similar Employers with Same Trade
```typescript
// Before creating, show existing employers with this trade
"Note: 12 other cleaning contractors already in database"
```

## Conclusion

✅ **All Fixes Applied**:
1. Fixed boolean type error (`'unknown'` → `null`)
2. Added required `employer_type` field with UI
3. Added trade capability tagging from subcontractor context
4. Enhanced UI with clear feedback
5. Integrated with pending approval workflow

The employer creation process now captures complete, high-quality data while maintaining database integrity.

---

**Date**: October 19, 2025
**Issue Type**: Bug Fix + Feature Enhancement
**Severity**: Critical (Blocked functionality) → Resolved
**Status**: ✅ Complete

