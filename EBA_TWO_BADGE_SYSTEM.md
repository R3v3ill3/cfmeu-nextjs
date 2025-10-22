# EBA Two-Badge System Implementation

## Overview

The EBA status display has been refactored to use **two separate badges** that show different information:

### Badge 1: Canonical EBA Status (Blue Eureka Flag)
- **Source**: `employers.enterprise_agreement_status` (boolean)
- **Display**: Blue badge with Eureka flag GIF + "EBA" text
- **Shows when**: `enterprise_agreement_status === true`
- **Purpose**: Official CFMEU EBA status - "This employer HAS an active EBA with CFMEU"
- **Provenance tracked in**: `eba_status_source` ('manual', 'import', 'fwc_scraper')

### Badge 2: FWC Workflow Status (Secondary badge)
- **Source**: `company_eba_records` table (FWC scrape data)
- **Values**:
  - `certified`: FWC certification found (within 4 years)
  - `lodged`: Lodged with FWC (within 1 year)
  - `pending`: EBA negotiation in progress (signed/voted within 6 months)
  - `no_fwc_match`: No FWC records found
- **Purpose**: Shows what we know from FWC scraping - evidence/provenance

## Key Behaviors

### Possible Combinations

| Blue Badge | FWC Badge | Meaning |
|------------|-----------|---------|
| ✅ Yes | FWC Certified | Perfect alignment - EBA confirmed by both sources |
| ✅ Yes | No FWC Match | Has EBA (manual/import) but no FWC scrape match yet |
| ✅ Yes | FWC Lodged | Has EBA and FWC shows recent lodgement |
| ❌ No | FWC Certified | FWC cert found but canonical boolean not updated |
| ❌ No | No FWC Match | No EBA and no FWC match |

### Filtering

The Employers page filter dropdown has these options:
- **All EBA**: No filter applied
- **Active**: Filters by `enterprise_agreement_status = true` (canonical boolean)
- **Lodged**: Filters by FWC workflow `eba_category = 'lodged'`
- **Pending**: Filters by FWC workflow `eba_category = 'pending'`
- **No EBA**: Filters by `enterprise_agreement_status != true`

## Implementation Details

### Files Modified

1. **`src/components/employers/ebaHelpers.ts`**
   - `getEbaCategory()`: Now returns FWC workflow status
   - Returns: 'certified', 'lodged', 'pending', or 'no_fwc_match'
   - Labels: "FWC Certified", "FWC Lodged", "EBA Pending", "No FWC Match"

2. **`src/components/employers/EmployerCard.tsx`**
   - Shows both badges side by side
   - Blue badge uses `enterprise_agreement_status`
   - FWC badge uses `getEbaCategory(company_eba_records[0])`
   - Source badge shows when blue badge is active

3. **`src/components/employers/EmployerTable.tsx`**
   - Same two-badge approach as card view
   - Consistent display in list/table mode

4. **`supabase/migrations/20251021071052_update_eba_category_logic.sql`**
   - Materialized view `eba_category` now computes FWC workflow status
   - Values: 'certified', 'lodged', 'pending', 'no_fwc_match'

5. **`src/app/api/employers/route.ts`**
   - Filter logic updated:
     - `eba === 'active'` → `enterprise_agreement_status = true`
     - `eba === 'no'` → `enterprise_agreement_status != true`
     - `eba === 'lodged'` / `'pending'` → `eba_category = eba`

### Database Schema

**Canonical EBA Status Fields** (employers table):
```sql
enterprise_agreement_status  BOOLEAN     -- The canonical source of truth
eba_status_source           TEXT        -- 'unknown', 'fwc_scraper', 'import', 'manual'
eba_status_updated_at       TIMESTAMPTZ -- When status was last updated
eba_status_notes            TEXT        -- Optional notes/explanation
```

**FWC Workflow Evidence** (company_eba_records table):
```sql
fwc_certified_date         DATE  -- FWC certification date
eba_lodged_fwc             DATE  -- Lodged with FWC date
date_eba_signed            DATE  -- Signed by parties
date_vote_occurred         DATE  -- Employee vote
eba_data_form_received     BOOLEAN
date_draft_signing_sent    DATE
date_barg_docs_sent        DATE
```

### Helper Functions

**`set_employer_eba_status(employer_id, status, source, notes)`**
- Canonical setter for `enterprise_agreement_status`
- Updates tracking fields
- Use this for manual updates

**`refresh_employer_eba_status(employer_id)`**
- Auto-syncs boolean with FWC data
- Respects manual overrides
- Called after FWC scraping

**`getEbaCategory(ebaRecord)`** (TypeScript client-side)
- Computes FWC workflow status
- Returns badge data: category, label, variant

## Workflow

1. **FWC Scraper** finds a certification
   - Creates/updates record in `company_eba_records`
   - Calls `refresh_employer_eba_status(employer_id)`
   - Sets `enterprise_agreement_status = true` with `eba_status_source = 'fwc_scraper'`

2. **Manual Verification**
   - Staff confirms EBA exists
   - Calls `set_employer_eba_status(employer_id, true, 'manual', 'Verified by staff')`
   - Sets canonical status regardless of FWC records

3. **Import Process**
   - Bulk import sets `enterprise_agreement_status = true`
   - With `eba_status_source = 'import'`
   - FWC scraper can later add evidence

## Visual Design

### Card View
```
┌─────────────────────────────────────┐
│ Employer Name                       │
│ ABN: 12345678901                    │
│                                     │
│ [🏴 EBA] [FWC Certified] [FWC]     │ ← Two badges + source
│ [Incolink: ABC123] [👥 12]          │
│                                     │
└─────────────────────────────────────┘
```

### List View (Same logic)
```
| Employer | ... | EBA                                |
|----------|-----|-----------------------------------|
| Acme Ltd | ... | [🏴 EBA] [No FWC Match] [Manual] |
| Beta Co  | ... | [FWC Certified]                   |
```

## Migration Path

The migration `20251021071052_update_eba_category_logic.sql`:
1. Drops and recreates materialized view with corrected `eba_category` logic
2. `eba_category` now represents FWC workflow, not canonical status
3. Refreshes view to populate with new values

## Testing Checklist

- [ ] Blue badge shows only when `enterprise_agreement_status = true`
- [ ] FWC badge always shows (never hidden)
- [ ] Filter "Active" shows employers with boolean = true
- [ ] Filter "No EBA" shows employers with boolean != true
- [ ] Filter "Lodged/Pending" shows employers by FWC workflow status
- [ ] Card view and list view show identical badges
- [ ] Source badge shows when blue badge is active
- [ ] Clicking badges opens correct modals (EBA tracker vs FWC search)
