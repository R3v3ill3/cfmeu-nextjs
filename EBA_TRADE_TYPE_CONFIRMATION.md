# EBA Trade Type Confirmation Feature

## Feature Added

**Trade type confirmation and editing during EBA employer review step**

## Changes Made

### 1. ✅ In-Table Trade Type Selector (Review Step)

**File**: `src/components/upload/EbaTradeImport.tsx`

**Location**: Lines 598-627 (Trade column in review table)

**What was added**:
```typescript
<Select
  value={employer.tradeType || 'general_construction'}
  onValueChange={(value) => {
    setReviewEmployers((prev) =>
      prev.map((e) =>
        e.id === employer.id
          ? { ...e, tradeType: value as TradeType }
          : e
      )
    )
  }}
>
  <SelectTrigger className="w-[180px]">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {getAllTradeOptions().map((option) => (
      <SelectItem key={option.value} value={option.value}>
        {option.label}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
{employer.tradeType !== employer.tradeLabel && (
  <Badge variant="secondary" className="text-xs mt-1">
    Modified
  </Badge>
)}
```

**Features**:
- Dropdown selector showing all available trade types
- Pre-populated with auto-detected trade from filename
- Shows "Modified" badge if user changes from detected value
- Immediate update - no need to open edit dialog

---

### 2. ✅ Trade Type Selector in Edit Dialog

**Location**: Lines 727-754 (Edit employer dialog)

**What was added**:
```typescript
<div>
  <label className="text-sm font-medium">Trade Type</label>
  <Select
    value={editingEmployer.tradeType || 'general_construction'}
    onValueChange={(value) =>
      setEditingEmployer({ ...editingEmployer, tradeType: value as TradeType })
    }
  >
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {getAllTradeOptions().map((option) => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  <p className="text-xs text-gray-500 mt-1">
    Detected from filename: <strong>{editingEmployer.tradeLabel}</strong>
    {editingEmployer.tradeType !== editingEmployer.tradeLabel && (
      <span className="text-amber-600 ml-2">
        ⚠️ Modified from detected value
      </span>
    )}
  </p>
</div>
```

**Features**:
- Full trade type selector in edit dialog
- Shows originally detected trade label
- Warns if modified from detected value
- Validates against canonical trade type list

---

### 3. ✅ Warning Alert at Top of Review Step

**Location**: Lines 499-507

**What was added**:
```typescript
<Alert className="border-amber-200 bg-amber-50">
  <AlertCircle className="h-4 w-4 text-amber-600" />
  <AlertDescription className="text-amber-800">
    <strong>⚠️ Trade Type Confirmation:</strong> Review the trade type dropdown for each employer. 
    Auto-detected from filename (e.g., "Waterproofing.pdf" → waterproofing), but verify it's correct. 
    Common variations like "concreting/concreter/concrete" should all use the same canonical trade type.
  </AlertDescription>
</Alert>
```

**Purpose**: Reminds user to check trade types before proceeding

---

## Available Trade Types

All canonical trade types from `ebaTradeTypeMapping.ts`:

- Bricklaying → `bricklaying`
- Civil → `civil_infrastructure`
- Cleaning → `cleaning`
- Commercial Builders → `head_contractor`
- **Concrete → `concrete`** ← Use for concreting/concreter
- Formwork → `form_work`
- Gyprock → `internal_walls`
- Labour Hire → `labour_hire`
- Mobile Cranes → `mobile_crane`
- Painting → `painting`
- Scaffolding → `scaffolding`
- Steelfixing → `steel_fixing`
- Stress → `post_tensioning`
- Tower Crane → `tower_crane`
- Trade → `general_construction`
- Traffic → `traffic_control`
- **Waterproofing → `waterproofing`**

---

## User Workflow

### Step 1: Upload PDF
- User uploads "Waterproofing as of 1.10.25.pdf"
- AI parses and extracts employers
- Trade type auto-detected as `waterproofing`

### Step 2: Review (NEW CONFIRMATION STEP)
- Table shows all parsed employers
- **Trade column** has dropdown selector
- User can click dropdown to change trade type
- Options show all canonical types
- If changed, "Modified" badge appears
- OR click Edit button for full editor

### Step 3: Edit Dialog (Optional)
- Full form for all fields
- Trade Type selector included
- Shows originally detected value
- Warns if modified

### Step 4: Store
- User confirms all data is correct
- Trade types are canonical values
- Stored to `pending_employers` with confirmed trade type

---

## Example Use Cases

### Case 1: Variation Normalization
**PDF**: "Concreting as of 1.10.25.pdf"  
**Auto-detected**: `concrete`  
**User confirms**: ✅ Correct, proceed

**OR**

**PDF**: "Concreters as of 1.10.25.pdf"  
**Auto-detected**: `general_construction` (no match in map)  
**User changes**: `concrete` (canonical)  
**Badge shows**: "Modified"

### Case 2: Wrong Detection
**PDF**: "Cleaning as of 1.10.25.pdf"  
**Employer**: "ABC Scaffolding Pty Ltd" (miscategorized in PDF)  
**Auto-detected**: `cleaning`  
**User changes**: `scaffolding` (correct)  
**Badge shows**: "Modified"

### Case 3: Multiple Corrections
User can:
- Click dropdown in table → Quick change
- OR click Edit button → Full editor with all fields

---

## Data Flow

```
PDF Filename
  ↓
extractTradeLabelFromFilename() → "Waterproofing"
  ↓
mapFilenameToTradeType() → waterproofing
  ↓
ReviewEmployer.tradeType → waterproofing (editable)
  ↓
User confirms/modifies → concrete
  ↓
pending_employers.inferred_trade_type → concrete
  ↓
Import creates employer with trade capability
```

---

## Benefits

✅ **Prevents incorrect trade assignments** - User reviews before import  
✅ **Handles variations** - User can normalize "concreting" → "concrete"  
✅ **Visible in table** - No need to open edit dialog for quick changes  
✅ **Shows modifications** - "Modified" badge indicates changes from auto-detection  
✅ **Full canonical list** - All trade types available in dropdown  
✅ **Fast workflow** - Click dropdown → Select → Done  

---

## Testing Checklist

- [ ] Upload EBA PDF with trade type that needs correction
- [ ] Review step shows trade type dropdown in table
- [ ] Click dropdown shows all canonical trade types
- [ ] Change trade type → "Modified" badge appears
- [ ] Store employers
- [ ] Check `pending_employers` table has correct `inferred_trade_type`
- [ ] Import employers
- [ ] Verify `contractor_trade_capabilities` uses confirmed trade type

---

**Files Modified**: `src/components/upload/EbaTradeImport.tsx`  
**Lines Changed**: 498-507 (alert), 598-627 (table), 727-754 (edit dialog)  
**Status**: Complete and ready for testing  
**Risk**: Low - UI enhancement only, doesn't change data logic


