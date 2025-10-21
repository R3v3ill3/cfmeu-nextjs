# Add Employer Roles/Tags to Add Employer Form - Implementation Plan

## Executive Summary

This plan expands the "Add Employer" dialog to include employer role tags and trade capabilities during initial creation, mirroring the architecture used in the EBA Employers system and EmployerCategoriesEditor component.

---

## Current Architecture Research

### 1. **Employer Categorization System** (Multi-layered)

#### A. **employer_type** (Basic Category - Single Select)
**Location:** `employers` table, `employer_type` column  
**Type:** Enum field  
**Values:**
- `builder`
- `principal_contractor`
- `large_contractor`
- `small_contractor`
- `individual`

**Purpose:** General business classification for contractors  
**Usage:** Already in Add Employer form ✅

---

#### B. **employer_role_tags** (Durable Role Classifications - Multi-select)
**Location:** `employer_role_tags` table  
**Type:** Many-to-many relationship  
**Schema:**
```sql
CREATE TABLE employer_role_tags (
  id UUID PRIMARY KEY,
  employer_id UUID REFERENCES employers(id),
  tag employer_role_tag NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

CREATE TYPE employer_role_tag AS ENUM (
  'builder',
  'head_contractor'
)
```

**Purpose:** Persistent role classification that follows employer across projects  
**Usage:**
- Used in project assignment prioritization
- Used in `SingleEmployerPicker` to prioritize/filter employers
- Used in `MultiEmployerPicker` for smart suggestions
- **Currently NOT in Add Employer form** ❌

**Current Implementation:**
- Managed in `EmployerEditForm.tsx` (lines 129-140)
- Displayed in `EmployerCategoriesEditor.tsx`
- Used for filtering/sorting in employer pickers

---

#### C. **contractor_trade_capabilities** (Trade Skills - Multi-select)
**Location:** `contractor_trade_capabilities` table  
**Type:** Many-to-many relationship  
**Schema:**
```sql
CREATE TABLE contractor_trade_capabilities (
  id UUID PRIMARY KEY,
  employer_id UUID REFERENCES employers(id),
  trade_type trade_type NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**Trade Types:** Uses `trade_type` enum with 40+ values:
- formwork, scaffolding, concreting, steel_fixing
- electrical, plumbing, carpentry, painting
- excavation, demolition, etc.

**Purpose:** Skills/capabilities that employer can perform  
**Usage:**
- Trade assignment on projects
- Matching employers to project needs
- **Currently NOT in Add Employer form** ❌

**Current Implementation:**
- Managed in `EmployerEditForm.tsx` (lines 142-150)
- Displayed in `EmployerCategoriesEditor.tsx`
- Used in project trade assignments

---

#### D. **contractor_role_types** (Project-Level Roles - Reference Table)
**Location:** `contractor_role_types` table + `project_assignments`  
**Type:** Reference data used in many-to-many assignments  
**Schema:**
```sql
CREATE TABLE contractor_role_types (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  hierarchy_level INTEGER DEFAULT 999,
  description TEXT,
  is_active BOOLEAN DEFAULT true
)
```

**Sample Roles:**
- BUILDER, HEAD_CONTRACTOR, PROJECT_MANAGER
- CIVIL_CONTRACTOR, MECHANICAL_CONTRACTOR
- DEMOLITION_CONTRACTOR, EXCAVATION_CONTRACTOR
- etc.

**Purpose:** Project-specific role assignments (not durable classification)  
**Usage:**
- Used in `project_assignments` table
- Tied to specific projects, not employer-wide
- **Should NOT be in Add Employer form** ❌ (project-specific)

---

### 2. **EBA Employers Architecture** (Reference Model)

**Key Components:**
1. **Category-Based Filtering** (`src/app/(app)/eba-employers/page.tsx`)
   - Dropdown selection by type (contractor_role or trade)
   - Category selection within type
   - Shows employers matching selected category
   - Checkbox filters: Current only, Include derived, Include manual, Key only

2. **EmployerCategoriesEditor** (`src/components/employers/EmployerCategoriesEditor.tsx`)
   - Displays current roles and trades as badges
   - Manual tags shown in blue (default variant)
   - Derived tags shown in gray (secondary variant)
   - Add/remove functionality via API endpoints
   - Shows related projects

3. **API Endpoints:**
   - `GET /api/eba/categories` - Get available categories
   - `GET /api/eba/employers/{id}/categories` - Get employer's categories
   - `POST /api/eba/employers/{id}/categories` - Add category
   - `DELETE /api/eba/employers/{id}/categories` - Remove category

---

### 3. **Existing Edit Flow** (EmployerEditForm)

**Current Role/Trade Management:**
- Loads existing `employer_role_tags` (lines 130-140)
- Loads existing `contractor_trade_capabilities` (lines 142-150)
- Displays with checkboxes for selection
- Manages via separate state variables
- Saves via separate API calls after main form save

**Architecture Pattern:**
- Separate queries for tags/capabilities
- UI shows checkboxes for multi-select
- Save happens after employer record is created/updated
- Uses `upsert` operations to add/remove

---

## Proposed Enhancement

### What to Add to "Add Employer" Form

#### Option A: **Basic Role Tags** (Recommended for MVP)

**Add to Form:**
1. **Employer Role Tags** section
   - Checkbox group for role tags:
     - ☐ Builder
     - ☐ Head Contractor
   - Multiple selection allowed
   - Optional (can be added later)

**Benefits:**
- Simple, clean UX
- Matches most common use case
- Minimal complexity
- Easy to understand

**Implementation:**
- Add state for selected role tags
- Create role tags after employer creation
- 2 simple INSERT operations

---

#### Option B: **Role Tags + Trade Capabilities** (Comprehensive)

**Add to Form:**
1. **Employer Role Tags** section (as above)

2. **Trade Capabilities** section
   - Multi-select dropdown or checkbox list
   - Primary trade indicator (radio or checkbox)
   - Shows 40+ trade types
   - Collapsible/expandable for space

3. **Optional Notes** field for trade details

**Benefits:**
- Complete employer profile from start
- Reduces need to go back and edit
- Better for imports/bulk operations

**Challenges:**
- Form becomes longer/more complex
- May overwhelm users for simple adds
- More validation needed

---

### Recommended Approach: **Hybrid "Quick Add" vs "Full Add"**

**Quick Add Mode** (Default)
- Name, Type, Role Tags only
- Fast, minimal friction
- Covers 80% of use cases

**Full Add Mode** (Optional toggle/button)
- Expands to show trade capabilities
- Contact details
- Address fields
- Notes
- For power users or detailed initial setup

---

## Implementation Plan

### Phase 1: Add Role Tags to Form ✅

#### 1.1 Update AddEmployerDialog Component

**File:** `src/components/employers/AddEmployerDialog.tsx`

**Changes:**
```typescript
// Add state for role tags
const [roleTags, setRoleTags] = useState<Array<'builder' | 'head_contractor'>>([])

// Add UI section after Employer Type field:
<div className="md:col-span-2">
  <Label>Employer Roles (Optional)</Label>
  <div className="flex gap-4 pt-2">
    <div className="flex items-center space-x-2">
      <Checkbox
        id="role-builder"
        checked={roleTags.includes('builder')}
        onCheckedChange={(checked) => {
          if (checked) {
            setRoleTags([...roleTags, 'builder'])
          } else {
            setRoleTags(roleTags.filter(t => t !== 'builder'))
          }
        }}
      />
      <label htmlFor="role-builder" className="text-sm">Builder</label>
    </div>
    <div className="flex items-center space-x-2">
      <Checkbox
        id="role-head-contractor"
        checked={roleTags.includes('head_contractor')}
        onCheckedChange={(checked) => {
          if (checked) {
            setRoleTags([...roleTags, 'head_contractor'])
          } else {
            setRoleTags(roleTags.filter(t => t !== 'head_contractor'))
          }
        }}
      />
      <label htmlFor="role-head-contractor" className="text-sm">Head Contractor</label>
    </div>
  </div>
  <p className="text-xs text-muted-foreground mt-1">
    These tags help prioritize this employer in project assignments
  </p>
</div>
```

**Save Logic:**
```typescript
// After employer creation, add role tags
if (roleTags.length > 0) {
  const tagInserts = roleTags.map(tag => ({
    employer_id: data.id,
    tag: tag
  }))
  
  const { error: tagError } = await supabase
    .from('employer_role_tags')
    .insert(tagInserts)
  
  if (tagError) {
    console.error('Failed to add role tags:', tagError)
    // Don't fail the whole operation, just log it
  }
}
```

---

### Phase 2: Add Trade Capabilities (Optional)

#### 2.1 Create Trade Selector Component

**File:** `src/components/employers/TradeCapabilitiesSelector.tsx`

```typescript
interface TradeCapabilitiesSelectorProps {
  selectedTrades: string[]
  primaryTrade: string | null
  onChange: (trades: string[], primary: string | null) => void
}

export function TradeCapabilitiesSelector({ ... }) {
  // Multi-select dropdown using shadcn/ui Command/Combobox
  // Show selected as badges
  // Allow marking one as primary
}
```

#### 2.2 Integrate into AddEmployerDialog

**Add to form:**
- Collapsible "Advanced" section
- Trade capabilities selector
- Save after employer creation similar to role tags

---

### Phase 3: UX Improvements

#### 3.1 Quick Add vs Full Add Toggle

**Add toggle at top of form:**
```typescript
<div className="flex items-center justify-between mb-4">
  <DialogTitle>Add New Employer</DialogTitle>
  <Button
    variant="ghost"
    size="sm"
    onClick={() => setShowAdvanced(!showAdvanced)}
  >
    {showAdvanced ? 'Quick Add' : 'Full Details'}
  </Button>
</div>
```

#### 3.2 Smart Defaults

**Based on employer_type, suggest role tags:**
- `builder` type → suggest `builder` role tag
- `principal_contractor` type → suggest `head_contractor` role tag
- Show suggestions but allow override

---

## Database Considerations

### No Schema Changes Required ✅

All tables already exist:
- ✅ `employer_role_tags`
- ✅ `contractor_trade_capabilities`
- ✅ `contractor_role_types`
- ✅ `employers`

### RLS Policies

Need to verify INSERT permissions:
- Check `employer_role_tags` RLS allows authenticated INSERT
- Check `contractor_trade_capabilities` RLS allows authenticated INSERT

---

## Testing Plan

### Unit Tests
1. **Role Tag Selection**
   - Select one tag
   - Select both tags
   - Deselect tags
   - Save with tags

2. **Trade Capabilities**
   - Select single trade
   - Select multiple trades
   - Mark primary trade
   - Save with capabilities

3. **Edge Cases**
   - Create employer without tags (should work)
   - Create employer with only tags (should work)
   - Network failure during tag creation (employer still created)

### Integration Tests
1. **Full Flow**
   - Create employer with role tags
   - Verify tags saved to database
   - Open employer detail modal
   - Verify tags display correctly

2. **Project Assignment**
   - Create employer with `builder` tag
   - Open project builder picker
   - Verify employer appears in prioritized list

---

## UI/UX Mockup

```
┌─────────────────────────────────────────────┐
│ Add New Employer                [Quick Add] │
├─────────────────────────────────────────────┤
│                                             │
│ Employer Name *                             │
│ [___________________________________]       │
│                                             │
│ Employer Type *                             │
│ [Select employer type ▼]                    │
│                                             │
│ Employer Roles (Optional)                   │
│ ☐ Builder    ☐ Head Contractor              │
│ These tags help prioritize this employer    │
│ in project assignments                      │
│                                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                             │
│ ABN              Phone                      │
│ [__________]     [__________]               │
│                                             │
│ Email            Website                    │
│ [__________]     [__________]               │
│                                             │
│ ... more fields ...                         │
│                                             │
│                        [Cancel] [Create]    │
└─────────────────────────────────────────────┘
```

**With "Full Details" mode:**
```
┌─────────────────────────────────────────────┐
│ Add New Employer             [Full Details] │
├─────────────────────────────────────────────┤
│                                             │
│ ... basic fields ...                        │
│                                             │
│ Employer Roles (Optional)                   │
│ ☐ Builder    ☐ Head Contractor              │
│                                             │
│ Trade Capabilities (Optional)               │
│ [Select trades ▼]                           │
│ Selected: [Formwork ×] [Scaffolding ×]      │
│           [Concreting (Primary) ×]          │
│                                             │
│ ... contact fields ...                      │
│ ... address fields ...                      │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Alignment with EBA Employers Architecture

### Similarities Applied
1. **Badge Display:** Role tags and trades shown as badges (matching EmployerCategoriesEditor)
2. **Manual vs Derived:** New tags are always "manual" (user-created)
3. **Category Types:** Same types (contractor_role, trade)
4. **API Pattern:** Similar save/delete pattern

### Differences (Intentional)
1. **Inline Creation:** Tags created during employer creation (not post-creation edit)
2. **Simplified UI:** Checkboxes vs dropdown+add button (better for small set)
3. **No "Key Contractor":** Flag not relevant at creation time
4. **No Project Context:** Tags are employer-wide, not project-specific

---

## Migration Path

### Step 1: Basic Implementation
- Add role tags only (2 checkboxes)
- Test thoroughly
- Deploy to production
- Gather user feedback

### Step 2: Enhanced (if needed)
- Add trade capabilities
- Add quick/full mode toggle
- Add smart suggestions
- Deploy as iteration

### Step 3: Bulk Operations (future)
- Allow role tags in CSV imports
- Bulk tag assignment for multiple employers
- Tag-based filtering in employers list

---

## Risk Assessment

### Low Risk ✅
- No schema changes
- Non-breaking addition to form
- Tags are optional
- Existing functionality unchanged

### Medium Risk ⚠️
- Form complexity increases
- User confusion if not well-explained
- Performance impact (2 extra INSERT queries)

### Mitigation
- Keep tags optional
- Add helper text/tooltips
- Make UI collapsible
- Monitor query performance

---

## Success Metrics

1. **Adoption:** % of employers created with role tags
2. **Accuracy:** % of tags that remain unchanged after creation
3. **Time Savings:** Reduced need to edit employer after creation
4. **Project Assignment:** Improved prioritization in employer pickers

---

## Recommendation

**Start with Phase 1: Role Tags Only**

### Why
- Highest value, lowest complexity
- Matches 80% of use cases
- Easy to understand and use
- Quick to implement and test
- Low risk, high return

### Next Steps
1. Review and approve this plan
2. Implement Phase 1 (role tags)
3. Create PR for review
4. Test on staging
5. Deploy to production
6. Monitor usage
7. Evaluate Phase 2 need based on user feedback

---

## Questions for Stakeholder Review

1. **Role Tags:** Is the "builder" and "head_contractor" distinction clear enough? Do we need more categories?

2. **Trade Capabilities:** Should this be in initial creation form or remain in edit-only flow?

3. **Quick vs Full:** Do users prefer minimal form or complete form by default?

4. **Smart Suggestions:** Should we auto-suggest role tags based on employer_type selection?

5. **Required vs Optional:** Should certain role tags be required for certain employer types?

6. **Import/Export:** Do we need to support role tags in CSV imports immediately?

---

## Implementation Estimate

### Phase 1: Role Tags
- **Development:** 3-4 hours
- **Testing:** 2 hours  
- **Documentation:** 1 hour
- **Total:** ~6-7 hours

### Phase 2: Trade Capabilities
- **Development:** 6-8 hours
- **Testing:** 3 hours
- **Documentation:** 1 hour
- **Total:** ~10-12 hours

### Full Implementation (Both Phases)
- **Total:** ~16-19 hours
- **Risk Buffer:** +20% = 19-23 hours

---

## Appendix: Code References

### Existing Implementations to Reference
1. **EmployerEditForm.tsx** (lines 129-150) - Role tag and trade capability management
2. **EmployerCategoriesEditor.tsx** - Badge display and add/remove UI
3. **EBA Employers page** - Category filtering and display
4. **SingleEmployerPicker.tsx** - Role tag prioritization logic
5. **MultiEmployerPicker.tsx** - Role tag filtering

### Database Tables
- `employer_role_tags`
- `contractor_trade_capabilities`
- `contractor_role_types`
- `project_assignments`

### Related Files to Update
- `src/components/employers/AddEmployerDialog.tsx` ✏️
- `src/components/employers/AddEmployerDialog.test.tsx` (if exists)
- `ADD_EMPLOYER_TEST_CHECKLIST.md` ✏️
- `ADD_EMPLOYER_IMPLEMENTATION.md` ✏️


