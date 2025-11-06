# Migration Safety Checker Skill

Validate database migrations for safety, consistency, reversibility, and potential issues before deployment.

## Purpose

Prevent production issues by thoroughly analyzing database migrations before they run. This skill identifies breaking changes, data loss risks, performance impacts, and dependency issues. It ensures migrations are safe, reversible, and properly ordered.

## When to Use This Skill

- Before running any database migration
- After writing new migrations
- During code review of schema changes
- Before production deployments
- When planning major schema refactoring
- After discovering migration-related issues
- When troubleshooting failed migrations

## Analysis Scope

### 1. Breaking Changes Detection

#### Schema Changes
- Column drops (data loss risk)
- NOT NULL constraints on existing columns
- Type changes (potential data truncation)
- Column renames (breaks existing code)
- Table drops or renames
- Foreign key constraint changes
- Unique constraint additions

#### Data Migration Issues
- Missing default values for new NOT NULL columns
- Data backfill without batching
- Transformations on large tables
- No validation of migrated data

### 2. Data Loss Risks

#### Destructive Operations
- DROP COLUMN
- DROP TABLE
- TRUNCATE
- DELETE without WHERE clause
- ALTER TYPE narrowing (e.g., TEXT to VARCHAR(50))
- Data type conversions losing precision

#### Cascade Effects
- CASCADE on foreign key constraints
- Trigger deletions
- View dependencies
- Function dependencies

### 3. Performance Impact

#### Blocking Operations
- Adding NOT NULL constraint (full table scan)
- Adding indexes without CONCURRENTLY
- ALTER TYPE requiring table rewrite
- Adding foreign keys on large tables
- VACUUM FULL or REINDEX

#### Long-Running Operations
- Creating indexes on large tables
- Data backfills without batching
- ALTER TABLE on large tables without optimization

### 4. Dependency Analysis

#### Migration Order
- Foreign key references before creation
- Functions using tables before table creation
- Views depending on columns before column creation
- Triggers on tables before table creation

#### Application Code Dependencies
- Application code expecting old schema
- RLS policies broken by schema changes
- Generated types out of sync
- API contracts broken

## Search Commands

Use these patterns to find migration files and issues:

```bash
# List all migrations
find supabase/migrations -name "*.sql" -type f | sort

# Find destructive operations
grep -n "DROP\|DELETE\|TRUNCATE" supabase/migrations/*.sql

# Find NOT NULL additions
grep -n "ALTER.*ADD COLUMN.*NOT NULL\|SET NOT NULL" supabase/migrations/*.sql

# Find type changes
grep -n "ALTER.*TYPE" supabase/migrations/*.sql

# Find foreign key additions
grep -n "ADD CONSTRAINT.*FOREIGN KEY\|ADD FOREIGN KEY" supabase/migrations/*.sql

# Find index creation
grep -n "CREATE.*INDEX" supabase/migrations/*.sql

# Find table drops
grep -n "DROP TABLE" supabase/migrations/*.sql

# Check for transaction wrapping
grep -n "BEGIN\|COMMIT" supabase/migrations/*.sql
```

## Analysis Process

1. **Migration Inventory**
   - List all pending migrations
   - Check migration order and dependencies
   - Identify migration purpose

2. **Safety Analysis**
   - Scan for destructive operations
   - Check for data loss risks
   - Identify blocking operations

3. **Dependency Check**
   - Verify table creation order
   - Check foreign key references
   - Validate function/view dependencies

4. **Performance Assessment**
   - Estimate operation duration
   - Identify blocking operations
   - Suggest optimizations

5. **Rollback Planning**
   - Check if migration is reversible
   - Identify rollback steps
   - Plan data recovery if needed

## Output Format

### Migration Safety Analysis Report

```markdown
# Migration Safety Analysis

## Migrations Analyzed

**Total Pending Migrations**: [count]
**Critical Issues**: [count] 🔴
**Warnings**: [count] 🟡
**Safe**: [count] ✅

---

## Critical Issues

### Issue #1: Data Loss Risk - Column Drop Without Backup

**Migration**: `20251021000005_drop_legacy_builder_column.sql`

**Problematic Code**:
```sql
-- ❌ DANGEROUS: Drops column without data migration
ALTER TABLE projects
DROP COLUMN builder_id;
```

**Why This Is Dangerous**:
- Column contains data for 5,423 projects
- No data migration to new system
- No backup created
- Irreversible - data lost permanently

**Affected Records**: 5,423 projects

**Impact**: 🔴 **CRITICAL - Data Loss**

**Recommended Fix**:
```sql
-- ✅ SAFE: Migrate data first, then drop column

-- Step 1: Verify all data migrated to new system
DO $$
DECLARE
  unmigrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unmigrated_count
  FROM projects p
  WHERE p.builder_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM project_assignments pa
      WHERE pa.project_id = p.id
        AND pa.contractor_role_type_id = (
          SELECT id FROM contractor_role_types WHERE code = 'builder'
        )
    );

  IF unmigrated_count > 0 THEN
    RAISE EXCEPTION 'Cannot drop builder_id: % projects not migrated', unmigrated_count;
  END IF;
END $$;

-- Step 2: Rename column instead of dropping (allows rollback)
ALTER TABLE projects
RENAME COLUMN builder_id TO builder_id_deprecated;

-- Add comment explaining deprecation
COMMENT ON COLUMN projects.builder_id_deprecated IS
  'DEPRECATED: Migrated to project_assignments table. Will be dropped in future release.';

-- Step 3: Drop in future migration after confirming no issues
-- (Schedule for 2-4 weeks later)
```

---

### Issue #2: Blocking Operation - Index Creation Without CONCURRENTLY

**Migration**: `20251021000007_add_employer_search_indexes.sql`

**Problematic Code**:
```sql
-- ❌ BLOCKING: Locks table during index creation
CREATE INDEX idx_employers_name ON employers (name);
CREATE INDEX idx_employers_eba_status ON employers (enterprise_agreement_status);
```

**Why This Is Dangerous**:
- Acquires SHARE lock on employers table
- Blocks all INSERT, UPDATE, DELETE operations
- On 10,000 employer table, takes ~30 seconds
- 30 seconds of downtime for writes

**Impact**: 🔴 **CRITICAL - Application Downtime**

**Recommended Fix**:
```sql
-- ✅ SAFE: Create indexes concurrently (no locks)
CREATE INDEX CONCURRENTLY idx_employers_name
ON employers (name);

CREATE INDEX CONCURRENTLY idx_employers_eba_status
ON employers (enterprise_agreement_status);

-- Note: Cannot use CONCURRENTLY inside transaction block
-- Each CREATE INDEX CONCURRENTLY must be its own statement
```

**Performance**:
- Without CONCURRENTLY: 30s with table lock
- With CONCURRENTLY: 45s with no lock ✅

---

### Issue #3: Missing NOT NULL Default Value

**Migration**: `20251021000003_add_employer_status_column.sql`

**Problematic Code**:
```sql
-- ❌ FAILS: Cannot add NOT NULL to existing table without default
ALTER TABLE employers
ADD COLUMN status TEXT NOT NULL;
```

**Why This Fails**:
- 10,000 existing rows
- No default value provided
- PostgreSQL cannot populate NOT NULL column

**Error**: `ERROR: column "status" contains null values`

**Impact**: 🔴 **CRITICAL - Migration Fails**

**Recommended Fix**:
```sql
-- ✅ SAFE: Add column with default, then make NOT NULL

-- Step 1: Add column as nullable with default
ALTER TABLE employers
ADD COLUMN status TEXT DEFAULT 'active';

-- Step 2: Backfill existing rows
UPDATE employers
SET status = 'active'
WHERE status IS NULL;

-- Step 3: Add NOT NULL constraint
ALTER TABLE employers
ALTER COLUMN status SET NOT NULL;

-- Step 4: Remove default (optional, if you don't want default for new rows)
ALTER TABLE employers
ALTER COLUMN status DROP DEFAULT;
```

---

## Warnings

### Warning #1: Foreign Key Addition on Large Table

**Migration**: `20251021000006_add_project_employer_fk.sql`

**Code**:
```sql
ALTER TABLE project_assignments
ADD CONSTRAINT fk_project_assignments_employer
FOREIGN KEY (employer_id) REFERENCES employers(id);
```

**Why This Is Concerning**:
- 50,000 rows in project_assignments
- Full table scan to validate constraint
- Takes ~10 seconds
- Blocks table during validation

**Impact**: 🟡 **WARNING - Slow Operation**

**Recommended Optimization**:
```sql
-- ✅ BETTER: Add constraint with NOT VALID, then validate
ALTER TABLE project_assignments
ADD CONSTRAINT fk_project_assignments_employer
FOREIGN KEY (employer_id) REFERENCES employers(id)
NOT VALID;

-- Validate in separate transaction (can be canceled)
ALTER TABLE project_assignments
VALIDATE CONSTRAINT fk_project_assignments_employer;

-- This allows writes to continue during validation
```

---

### Warning #2: Type Change Requires Table Rewrite

**Migration**: `20251021000008_change_employer_abn.sql`

**Code**:
```sql
ALTER TABLE employers
ALTER COLUMN abn TYPE VARCHAR(11);
```

**Why This Is Concerning**:
- Currently type is TEXT
- Changing to VARCHAR requires table rewrite
- 10,000 rows × average 2KB = 20MB to rewrite
- Takes ~5 seconds, table locked

**Impact**: 🟡 **WARNING - Table Rewrite**

**Recommended Optimization**:
```sql
-- ✅ BETTER: Add check constraint instead (faster)
ALTER TABLE employers
ADD CONSTRAINT check_abn_length
CHECK (char_length(abn) <= 11);

-- Or if you must change type, use USING clause for safety
ALTER TABLE employers
ALTER COLUMN abn TYPE VARCHAR(11)
USING (substring(abn, 1, 11));
```

---

## Safe Migrations ✅

### Migration: `20251021000004_add_employer_eba_date.sql`

```sql
-- ✅ Safe: Adds nullable column with no constraints
ALTER TABLE employers
ADD COLUMN eba_expiry_date DATE;

-- ✅ Safe: Add index concurrently
CREATE INDEX CONCURRENTLY idx_employers_eba_expiry
ON employers (eba_expiry_date)
WHERE eba_expiry_date IS NOT NULL;

-- ✅ Safe: Add helpful comment
COMMENT ON COLUMN employers.eba_expiry_date IS
  'Enterprise Bargaining Agreement expiry date';
```

**Why This Is Safe**:
- Adds nullable column (no data required)
- No NOT NULL constraint
- Index created CONCURRENTLY (no lock)
- Partial index (WHERE clause) for efficiency

---

## Dependency Analysis

### Dependency Chain

```
Migration Execution Order:

1. 20251021000001_create_trade_types_table.sql
   └─ Creates: trade_types table

2. 20251021000002_create_employer_capabilities.sql
   └─ Depends on: trade_types.id (foreign key)
   └─ Creates: employer_capabilities table

3. 20251021000003_migrate_trade_capabilities.sql
   └─ Depends on: employer_capabilities table
   └─ Depends on: trade_types table
   └─ Migrates: contractor_trade_capabilities → employer_capabilities

4. 20251021000004_seed_trade_types.sql ⚠️ WARNING
   └─ Should run BEFORE #2 and #3!
   └─ Populates: trade_types table

❌ PROBLEM: Seed migration runs after migrations that need the data!
```

**Issue**: Migration #4 seeds `trade_types` table, but migrations #2 and #3 need this data.

**Fix**: Rename migration #4 to run earlier:
```bash
# Rename to run before create_employer_capabilities
mv 20251021000004_seed_trade_types.sql \
   20251021000001_5_seed_trade_types.sql
```

---

## Application Code Impact

### Impact #1: Generated Types Out of Sync

**Issue**: Migrations add/remove columns but TypeScript types not regenerated

**Files Affected**:
- `src/types/database.ts` (auto-generated)

**How to Fix**:
```bash
# Regenerate TypeScript types after migration
npx supabase gen types typescript --project-id [project-id] > src/types/database.ts
```

**Add to Deployment Checklist**:
- [ ] Run migrations
- [ ] Regenerate TypeScript types
- [ ] Commit updated types
- [ ] Deploy application code

---

### Impact #2: API Endpoints Broken by Column Removal

**Migration**: Drops `projects.builder_id` column

**Affected Code**:
```typescript
// ❌ This will break after migration
const { data } = await supabase
  .from('projects')
  .select('id, project_name, builder_id') // ← builder_id doesn't exist!
  .eq('builder_id', employerId)            // ← Error!
```

**Files to Update Before Deployment**:
1. `src/app/api/projects/route.ts:45`
2. `src/components/projects/ProjectList.tsx:67`
3. `src/hooks/useProjects.ts:23`

**Recommended Fix**:
```typescript
// ✅ Updated to use new system
const { data } = await supabase
  .from('projects')
  .select(`
    id,
    project_name,
    project_assignments!inner (
      employer:employers (id, name)
    )
  `)
  .eq('project_assignments.contractor_role_type_id', builderRoleId)
  .eq('project_assignments.employer_id', employerId)
```

---

## Migration Best Practices Checklist

### Before Writing Migration

- [ ] Plan the schema change completely
- [ ] Consider impact on existing data
- [ ] Plan rollback strategy
- [ ] Check for dependent objects (views, functions, triggers)
- [ ] Estimate operation duration
- [ ] Plan for zero-downtime deployment

### Writing Migration

- [ ] Use transactions when possible
- [ ] Add comments explaining the change
- [ ] Use IF EXISTS / IF NOT EXISTS for idempotency
- [ ] Add defaults for NOT NULL columns
- [ ] Use CONCURRENTLY for indexes
- [ ] Use NOT VALID for constraints
- [ ] Batch large data migrations
- [ ] Add data validation checks

### After Writing Migration

- [ ] Test on development database
- [ ] Test on production-like dataset (size/load)
- [ ] Verify rollback works
- [ ] Check EXPLAIN plans for performance
- [ ] Document breaking changes
- [ ] Update application code
- [ ] Regenerate TypeScript types
- [ ] Update API documentation

### Deployment

- [ ] Run migrations in correct order
- [ ] Monitor for errors
- [ ] Check application logs for failures
- [ ] Verify data integrity
- [ ] Run consistency checks
- [ ] Keep rollback plan ready

---

## Migration Templates

### Template 1: Add Column Safely

```sql
-- Add new column with default value
ALTER TABLE table_name
ADD COLUMN column_name TYPE DEFAULT 'default_value';

-- Backfill existing rows if needed
UPDATE table_name
SET column_name = 'computed_value'
WHERE column_name IS NULL;

-- Add constraints after backfill
ALTER TABLE table_name
ALTER COLUMN column_name SET NOT NULL;

-- Add index if needed
CREATE INDEX CONCURRENTLY idx_table_column
ON table_name (column_name);
```

### Template 2: Drop Column Safely

```sql
-- Step 1: Deprecate (don't drop yet)
ALTER TABLE table_name
RENAME COLUMN old_column TO old_column_deprecated;

COMMENT ON COLUMN table_name.old_column_deprecated IS
  'DEPRECATED: Migrated to new_column. Will be dropped after 2025-12-01.';

-- Step 2: Deploy code using new column

-- Step 3: Wait 2-4 weeks for verification

-- Step 4: Drop in separate migration
ALTER TABLE table_name
DROP COLUMN old_column_deprecated;
```

### Template 3: Rename Column

```sql
-- Create new column
ALTER TABLE table_name
ADD COLUMN new_column_name TYPE;

-- Copy data
UPDATE table_name
SET new_column_name = old_column_name;

-- Add constraints
ALTER TABLE table_name
ALTER COLUMN new_column_name SET NOT NULL;

-- Deploy code using new column

-- Drop old column in separate migration
ALTER TABLE table_name
DROP COLUMN old_column_name;
```

### Template 4: Data Migration

```sql
-- Migrate data in batches to avoid long locks
DO $$
DECLARE
  batch_size INT := 1000;
  offset_val INT := 0;
  rows_affected INT;
BEGIN
  LOOP
    UPDATE table_name
    SET new_column = transform(old_column)
    WHERE id IN (
      SELECT id
      FROM table_name
      WHERE new_column IS NULL
      ORDER BY id
      LIMIT batch_size
    );

    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    offset_val := offset_val + batch_size;

    RAISE NOTICE 'Migrated % rows (total: %)', rows_affected, offset_val;

    EXIT WHEN rows_affected = 0;

    -- Optional: Add delay between batches
    PERFORM pg_sleep(0.1);
  END LOOP;
END $$;
```

### Template 5: Add Index CONCURRENTLY

```sql
-- Check if index exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'table_name'
      AND indexname = 'idx_table_column'
  ) THEN
    -- Create index concurrently (cannot be in transaction)
    EXECUTE 'CREATE INDEX CONCURRENTLY idx_table_column ON table_name (column_name)';
  END IF;
END $$;
```

---

## Rollback Strategy

### Creating Rollback Migrations

For each migration, create a corresponding rollback:

**Forward Migration**: `20251021000005_add_employer_status.sql`
```sql
ALTER TABLE employers
ADD COLUMN status TEXT DEFAULT 'active' NOT NULL;
```

**Rollback Migration**: `20251021000005_add_employer_status_rollback.sql`
```sql
ALTER TABLE employers
DROP COLUMN status;
```

### Rollback Checklist

If migration fails:
- [ ] Stop deployment immediately
- [ ] Run rollback migration
- [ ] Verify application still works
- [ ] Check for data inconsistencies
- [ ] Analyze failure cause
- [ ] Fix migration
- [ ] Test thoroughly before re-deploying

---

## Performance Estimation

### Operation Duration Estimates

| Operation | Small Table (<1K) | Medium (1K-100K) | Large (>100K) |
|-----------|-------------------|------------------|---------------|
| ADD COLUMN (nullable) | <1s | <1s | <1s |
| ADD COLUMN (NOT NULL) | <1s | 1-5s | 5-30s |
| DROP COLUMN | <1s | 1-2s | 2-5s |
| CREATE INDEX | <1s | 5-30s | 30s-5min |
| CREATE INDEX CONCURRENTLY | 1-2s | 10-60s | 1-10min |
| ALTER TYPE | <1s | 5-30s | 30s-5min |
| ADD FOREIGN KEY | <1s | 2-10s | 10-60s |
| VALIDATE CONSTRAINT | <1s | 5-30s | 30s-5min |

### Factors Affecting Performance

- Table size (row count)
- Row width (data per row)
- Existing indexes (slow down writes)
- Database load (concurrent operations)
- Hardware (CPU, memory, disk speed)

---

## Next Steps

After receiving this report:

1. **Fix Critical Issues**: Address data loss risks and blocking operations
2. **Optimize Warnings**: Improve performance of slow operations
3. **Fix Dependencies**: Correct migration order
4. **Update Code**: Change application code affected by schema changes
5. **Test Thoroughly**: Run migrations on test database first
6. **Plan Rollback**: Prepare rollback migrations
7. **Deploy Carefully**: Monitor during deployment

## Example Invocation

**User**: "Run migration-safety-checker on pending migrations"

**You should**:
1. List all migration files in `supabase/migrations/`
2. Read and analyze each migration
3. Check for destructive operations, breaking changes, performance issues
4. Verify migration order and dependencies
5. Identify application code that needs updating
6. Provide detailed report with recommendations
7. Offer to create safe versions of problematic migrations
8. Suggest rollback strategy
