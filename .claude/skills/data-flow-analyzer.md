# Data Flow Analyzer Skill

Identify and resolve data consistency issues across multiple data sources, detecting parallel systems, schema mismatches, and synchronization gaps.

## Purpose

Ensure data consistency by mapping data flow from database to UI, identifying multiple sources of truth, detecting schema mismatches, and finding synchronization issues. This skill prevents bugs caused by data inconsistency and helps consolidate parallel data systems.

## When to Use This Skill

- When data appears inconsistent between different views
- After database schema changes or migrations
- When debugging data synchronization issues
- Before planning data architecture refactoring
- When adding new data sources
- When experiencing cache invalidation issues
- After discovering duplicate functionality

## Analysis Scope

### 1. Multiple Sources of Truth

#### Parallel Data Systems
- Same data defined in multiple places
- Database ENUMs vs database tables vs TypeScript constants
- Hardcoded values duplicating database data
- Client-side data duplicating server data
- Multiple caching layers with different data

#### Configuration Sources
- Environment variables
- Database configuration tables
- TypeScript constants
- JSON configuration files
- Feature flags

### 2. Data Synchronization Issues

#### Cache Invalidation
- Mutations not invalidating related caches
- Stale cache data after updates
- Missing cache dependencies
- Cache key inconsistencies
- No cache warming after mutations

#### Real-time Updates
- Missing real-time subscriptions
- Subscriptions not updating local state
- Conflicting updates (local vs server)
- No optimistic updates
- Lost updates due to race conditions

### 3. Schema Mismatches

#### Type Mismatches
- Database types vs TypeScript types
- Generated types vs manual types
- API response types vs database types
- Form data types vs database types

#### Data Transformation
- Inconsistent data transformations
- Missing transformations
- Different transformation logic in different places
- Data shape changes not propagated

### 4. Data Flow Mapping

#### Source to UI Flow
- Database → API → Hook → Component
- External API → Cache → Component
- Form → Validation → API → Database
- File Upload → Processing → Database

#### Bidirectional Flow
- Read path consistency
- Write path consistency
- Update propagation
- Delete cascading

## Search Commands

Use these patterns to identify data flow issues:

```bash
# Find duplicate data definitions
grep -n "export const.*TRADE" --include="*.ts" -r src/

# Find database ENUMs
grep -n "CREATE TYPE\|ALTER TYPE" -r supabase/

# Find TypeScript enums and constants
grep -n "export enum\|export const.*=\s*\[" --include="*.ts" -r src/constants/

# Find cache invalidation
grep -n "invalidateQueries\|refetchQueries" --include="*.ts" --include="*.tsx" -r src/

# Find real-time subscriptions
grep -n "\.subscribe\|\.on\('postgres_changes'" --include="*.ts" --include="*.tsx" -r src/

# Find data transformations
grep -n "\.map\(.*=>.*\)\|transform\|normalize" --include="*.ts" --include="*.tsx" -r src/

# Find manual type definitions
grep -n "interface.*{" --include="*.ts" -r src/types/

# Find generated types usage
grep -n "from '@/types/database'" --include="*.ts" --include="*.tsx" -r src/
```

## Analysis Process

1. **Data Source Inventory**
   - Identify all data sources (DB, APIs, constants, etc.)
   - Map data entities and their sources
   - Find duplicate definitions

2. **Flow Mapping**
   - Trace data from source to UI for key entities
   - Identify transformation points
   - Map cache layers

3. **Consistency Analysis**
   - Compare parallel data sources
   - Check schema alignment
   - Identify synchronization gaps

4. **Impact Assessment**
   - Identify critical inconsistencies
   - Find user-facing issues
   - Assess refactoring scope

## Output Format

### Data Flow Analysis Report

```markdown
# Data Flow & Consistency Analysis Report

## Executive Summary

**Data Entities Analyzed**: [count]
**Multiple Sources of Truth Found**: [count]
**Schema Mismatches**: [count]
**Synchronization Issues**: [count]
**Critical Issues**: [count]

**Risk Level**: [High/Medium/Low]

---

## Critical Issue: Trade Types in Three Places

### The Problem

Trade types exist in **three separate places** with potential for inconsistency:

1. **Database ENUM** (`trade_type`)
   - Location: Database type definition
   - Count: 53 values
   - Purpose: Type constraint
   - Maintainer: Database migrations

2. **Database Table** (`trade_types`)
   - Location: `trade_types` table
   - Count: 53 rows (should match ENUM)
   - Purpose: Reference data with metadata
   - Maintainer: Migration seeds
   - **Issue**: May not be fully seeded! ⚠️

3. **TypeScript Constant** (`TRADE_OPTIONS`)
   - Location: `src/constants/trades.ts`
   - Count: 53 options
   - Purpose: UI display
   - Maintainer: Manual updates

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Trade Type Sources                    │
└─────────────────────────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    ┌─────────────┐  ┌─────────────┐  ┌──────────────┐
    │ Database    │  │ Database    │  │ TypeScript   │
    │ ENUM        │  │ TABLE       │  │ CONSTANT     │
    │ trade_type  │  │ trade_types │  │ TRADE_OPTIONS│
    └─────────────┘  └─────────────┘  └──────────────┘
           │                │                  │
           │                │                  │
           ▼                ▼                  ▼
    ┌─────────────┐  ┌─────────────┐  ┌──────────────┐
    │ Type        │  │ JOINs &     │  │ Edit Form    │
    │ Constraints │  │ Filters     │  │ Checkboxes   │
    └─────────────┘  └─────────────┘  └──────────────┘
                             │
                             ▼
                   ┌──────────────────┐
                   │ User sees        │
                   │ inconsistent     │
                   │ trade options!   │
                   └──────────────────┘
```

### Current Behavior

**When Adding Trade Capability**:
1. User selects "Cleaning" in Edit form (from `TRADE_OPTIONS`)
2. Form sends trade type code to API
3. API inserts into `employer_capabilities` with trade_type_id
4. trade_type_id references `trade_types` table

**The Bug**:
- If "Cleaning" exists in ENUM and CONSTANT but NOT in table...
- API cannot find trade_types.id for code 'cleaning'
- OR: Capability saves but doesn't appear in Categories tab (JOIN fails)
- OR: EBA Employers filter doesn't show "Cleaning" option

**Evidence from Codebase**:
- `CRITICAL_TRADE_TYPES_TABLE_ISSUE.md` documents this exact problem
- "Cleaning" appears in Edit form but not Categories tab
- Root cause: `trade_types` table not fully seeded

### Recommended Solution

**Phase 1: Immediate Fix** (Seed the table)
```sql
-- Migration: Ensure all 53 trades in table
INSERT INTO trade_types (id, code, name, category, sort_order)
SELECT
  gen_random_uuid(),
  enumval::text,
  initcap(replace(enumval::text, '_', ' ')),
  CASE
    WHEN enumval::text IN ('demolition', 'excavation', 'piling') THEN 'early_works'
    WHEN enumval::text IN ('formwork', 'concrete', 'steel_fixing') THEN 'structure'
    WHEN enumval::text IN ('painting', 'tiling', 'flooring') THEN 'finishing'
    ELSE 'other'
  END,
  ROW_NUMBER() OVER (ORDER BY enumval::text)
FROM pg_enum
WHERE enumtypid = 'trade_type'::regtype
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order;
```

**Phase 2: Long-term Fix** (Single source of truth)

Option A: Table as source of truth
```typescript
// Generate TypeScript constant from database table
// scripts/generate-trade-types.ts
import { supabase } from '@/lib/supabase/server'

const { data: tradeTypes } = await supabase
  .from('trade_types')
  .select('code, name, category')
  .order('sort_order')

const tsCode = `
// AUTO-GENERATED - Do not edit manually
// Run: npm run generate:trade-types

export const TRADE_OPTIONS = [
${tradeTypes.map(t => `  { value: '${t.code}', label: '${t.name}', category: '${t.category}' }`).join(',\n')}
] as const
`

await writeFile('src/constants/trades.generated.ts', tsCode)
```

Option B: Runtime query (no constant)
```typescript
// src/hooks/useTradeTypes.ts
export function useTradeTypes() {
  return useQuery(['trade-types'], async () => {
    const { data } = await supabase
      .from('trade_types')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    return data
  }, {
    staleTime: Infinity, // Never refetch (rarely changes)
    cacheTime: Infinity  // Keep in cache forever
  })
}

// Usage in forms
function TradeSelector() {
  const { data: trades, isLoading } = useTradeTypes()

  if (isLoading) return <Skeleton />

  return (
    <CheckboxGroup>
      {trades?.map(trade => (
        <Checkbox key={trade.code} value={trade.code}>
          {trade.name}
        </Checkbox>
      ))}
    </CheckboxGroup>
  )
}
```

---

## Additional Data Consistency Issues

### Issue #2: Employer Categories - Parallel Systems

**Two Systems for Categorizing Employers**:

1. **Old System**: Direct columns
   - `employers.our_role` (builder/subcontractor)
   - `contractor_trade_capabilities` table
   - `key_contractor_trades` (hardcoded list)

2. **New System**: Unified capabilities
   - `employer_capabilities` table
   - `capability_type` (trade/role/key_contractor)
   - Relations to reference tables

**Inconsistency Risk**:
- Data in both old and new tables
- Updates to one don't update the other
- Queries using wrong table
- Filters checking wrong columns

**Data Flow**:
```
┌──────────────┐         ┌──────────────────────┐
│ Edit Form    │────────▶│ API: Which table     │
│ (User Input) │         │ do we update?        │
└──────────────┘         └──────────────────────┘
                                   │
                   ┌───────────────┴───────────────┐
                   ▼                               ▼
         ┌──────────────────┐           ┌──────────────────┐
         │ Old:             │           │ New:             │
         │ contractor_trade │           │ employer_        │
         │ _capabilities    │           │ capabilities     │
         └──────────────────┘           └──────────────────┘
                   │                               │
                   └───────────────┬───────────────┘
                                   ▼
                         ┌──────────────────┐
                         │ Categories Tab:  │
                         │ Which table to   │
                         │ read from?       │
                         └──────────────────┘
```

**Solution**:
1. Complete migration to new system
2. Add database trigger to keep tables in sync during transition
3. Update all queries to use new table
4. Deprecate old columns

```sql
-- Sync trigger during migration
CREATE OR REPLACE FUNCTION sync_trade_capabilities()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    -- Sync new capability to old table
    INSERT INTO contractor_trade_capabilities (employer_id, trade_type)
    SELECT NEW.employer_id, tt.code::trade_type
    FROM trade_types tt
    WHERE tt.id = NEW.trade_type_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

### Issue #3: EBA Status - Multiple Indicators

**Three Ways to Check EBA Status**:

1. `employers.enterprise_agreement_status` (boolean)
2. `eba_employers` table (separate table for EBA details)
3. `pending_employers.source` (contains 'eba' for imports)

**Inconsistency**:
- Boolean flag can be true without row in eba_employers table
- eba_employers table can have expired records
- pending_employers source is import metadata, not current status

**Correct Logic**:
```typescript
// Definitive EBA status check
function hasActiveEBA(employer: Employer) {
  return (
    employer.enterprise_agreement_status === true &&
    employer.eba_expiry_date &&
    new Date(employer.eba_expiry_date) > new Date()
  )
}

// Or use database view
CREATE VIEW v_employers_with_active_eba AS
SELECT e.*
FROM employers e
WHERE e.enterprise_agreement_status = true
  AND (e.eba_expiry_date IS NULL OR e.eba_expiry_date > CURRENT_DATE);
```

---

### Issue #4: Project Builder Assignment - Legacy vs New

**Two Systems**:

1. **Legacy**: `projects.builder_id` (single UUID)
2. **New**: `project_assignments` table (supports multiple roles)

**Inconsistency**:
- Some code checks `builder_id`
- Some code queries `project_assignments`
- Updates to one don't update the other
- No clear deprecation path

**Data Flow**:
```
┌─────────────────────────────────────────────────┐
│ Project Edit Dialog                             │
│ - User selects builder                          │
└─────────────────────────────────────────────────┘
                        │
                        ▼
                ┌───────────────┐
                │ Save API:     │
                │ Update both?  │
                └───────────────┘
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
┌──────────────────┐        ┌──────────────────┐
│ Legacy:          │        │ New:             │
│ builder_id       │        │ project_         │
│ column           │        │ assignments      │
└──────────────────┘        └──────────────────┘
          │                           │
          └─────────────┬─────────────┘
                        ▼
              ┌──────────────────┐
              │ Display:         │
              │ Which to show?   │
              └──────────────────┘
```

**Solution**:
```sql
-- Sync trigger during migration
CREATE OR REPLACE FUNCTION sync_builder_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- When project_assignments changes, update legacy builder_id
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    UPDATE projects
    SET builder_id = NEW.employer_id
    WHERE id = NEW.project_id
      AND NEW.contractor_role_type_id = (
        SELECT id FROM contractor_role_types WHERE code = 'builder'
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_builder_on_assignment
AFTER INSERT OR UPDATE ON project_assignments
FOR EACH ROW
EXECUTE FUNCTION sync_builder_assignment();
```

---

## Data Consistency Recommendations

### 1. Establish Single Sources of Truth

| Entity | Current State | Recommendation |
|--------|---------------|----------------|
| Trade Types | ENUM + Table + Constant | **Table only**, generate constant |
| Employer Categories | Old + New tables | **New table only**, migrate fully |
| EBA Status | Boolean + Table | **Computed view** from authoritative table |
| Project Builder | Legacy + New columns | **New system only**, sync trigger during migration |
| User Roles | Enum + Column | **Keep as is** (simple, rarely changes) |

### 2. Data Validation Rules

```typescript
// src/lib/data-validation.ts

// Ensure trade types consistency
export async function validateTradeTypes() {
  const enumValues = await getEnumValues('trade_type')
  const tableValues = await getTableValues('trade_types', 'code')
  const constantValues = TRADE_OPTIONS.map(t => t.value)

  const missing = {
    inTable: enumValues.filter(v => !tableValues.includes(v)),
    inConstant: enumValues.filter(v => !constantValues.includes(v))
  }

  if (missing.inTable.length > 0) {
    throw new Error(`Missing trade types in table: ${missing.inTable.join(', ')}`)
  }

  return { valid: true, missing }
}

// Run in CI or as admin check
```

### 3. Migration Strategy

**Step 1: Audit Current State**
```bash
# Run these queries to identify inconsistencies

# Check trade types consistency
SELECT
  'ENUM' as source,
  COUNT(*) as count
FROM pg_enum
WHERE enumtypid = 'trade_type'::regtype
UNION ALL
SELECT
  'TABLE' as source,
  COUNT(*) as count
FROM trade_types;

# Check employer categories consistency
SELECT
  COUNT(*) as old_system,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM employer_capabilities ec
    WHERE ec.employer_id = ctc.employer_id
  )) as also_in_new_system
FROM contractor_trade_capabilities ctc;
```

**Step 2: Seed Missing Data**
- Run migrations to populate reference tables
- Verify all ENUM values have table rows
- Check for orphaned records

**Step 3: Implement Sync**
- Add database triggers to keep systems in sync
- Add application-level validation
- Log inconsistencies for investigation

**Step 4: Migrate Gradually**
- Update queries one feature at a time
- Keep both systems in sync
- Add feature flag for new system

**Step 5: Deprecate Old System**
- Remove old code paths
- Drop triggers
- Archive old columns (don't drop immediately)

### 4. Ongoing Monitoring

```typescript
// src/lib/data-consistency-check.ts
export async function runConsistencyChecks() {
  const checks = [
    checkTradeTypesConsistency(),
    checkEmployerCategoriesConsistency(),
    checkProjectAssignmentsConsistency(),
    checkEBAStatusConsistency()
  ]

  const results = await Promise.all(checks)

  return {
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    warnings: results.filter(r => r.status === 'warning').length,
    details: results
  }
}

// Run daily via cron job
// Alert if checks fail
```

---

## Cache Invalidation Issues

### Issue: React Query Cache Not Invalidated

**Pattern Found**:
```typescript
// Mutation updates employer
const updateMutation = useMutation({
  mutationFn: updateEmployer,
  onSuccess: () => {
    toast.success('Employer updated')
    // ❌ Missing: invalidate related queries
  }
})
```

**What Should Happen**:
```typescript
const queryClient = useQueryClient()

const updateMutation = useMutation({
  mutationFn: updateEmployer,
  onSuccess: (data, variables) => {
    // ✅ Invalidate all related queries
    queryClient.invalidateQueries(['employer', variables.id])
    queryClient.invalidateQueries(['employers']) // List view
    queryClient.invalidateQueries(['dashboard']) // If affects dashboard

    // ✅ Optimistic update
    queryClient.setQueryData(['employer', variables.id], data)

    toast.success('Employer updated')
  }
})
```

**Affected Mutations**:
1. Employer create/update/delete
2. Project create/update/delete
3. EBA assignment
4. Trade capability changes
5. Compliance assessment submissions

---

## Implementation Checklist

### Phase 1: Audit & Document
- [ ] Map all data entities and their sources
- [ ] Identify duplicate systems
- [ ] Document data flow for critical paths
- [ ] Create consistency validation queries

### Phase 2: Seed & Validate
- [ ] Seed all reference tables
- [ ] Validate ENUM vs table consistency
- [ ] Add database constraints
- [ ] Create consistency check scripts

### Phase 3: Consolidate
- [ ] Choose single source of truth for each entity
- [ ] Add sync triggers for transition period
- [ ] Update queries to use correct source
- [ ] Add feature flags for gradual rollout

### Phase 4: Monitor
- [ ] Set up consistency monitoring
- [ ] Add alerts for inconsistencies
- [ ] Log data flow issues
- [ ] Regular consistency audits

---

## Next Steps

After receiving this report:

1. **Validate Findings**: Run consistency check queries
2. **Prioritize**: Focus on user-facing inconsistencies first
3. **Seed Data**: Run migrations to populate missing reference data
4. **Consolidate**: Choose single source of truth for each entity
5. **Monitor**: Set up ongoing consistency checks

## Example Invocation

**User**: "Run data-flow-analyzer on employer categories"

**You should**:
1. Map all places where employer categories are defined
2. Trace data flow from database to UI
3. Identify inconsistencies between sources
4. Check for synchronization issues
5. Provide consolidation recommendations
6. Suggest migration strategy with code examples
