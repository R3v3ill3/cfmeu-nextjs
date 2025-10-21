# Migration Fixes: NULL UUID Casting & Partial Unique Constraints

## Issue 1: NULL UUID Type Mismatch
When running `npx supabase db push --include-all`, the migrations failed with:
```
ERROR: column "trade_type_id" is of type uuid but expression is of type text (SQLSTATE 42804)
```

### Root Cause
In PostgreSQL, when inserting NULL values into UUID columns, the NULL must be explicitly cast to the correct type: `NULL::uuid`

Without the cast, PostgreSQL cannot infer the type and defaults to text, causing a type mismatch error.

### Fix Applied
All three migration files have been updated:

1. **20251021000000_consolidate_employer_classifications.sql**
   - Line 32: `NULL` → `NULL::uuid` (contractor_role_type_id for role migrations)
   - Line 86: `NULL` → `NULL::uuid` (contractor_role_type_id for trade migrations)

2. **20251021000001_update_sync_triggers_dual_write.sql**
   - Line 31: `NULL` → `NULL::uuid` (trade_type_id in sync_employer_role_tag_from_per)
   - Line 76: `NULL` → `NULL::uuid` (contractor_role_type_id in sync_trade_capability_from_pct)

3. **20251021000002_update_admin_update_employer_rpc.sql**
   - Line 71: `NULL` → `NULL::uuid` (trade_type_id for role capabilities)
   - Line 99: `NULL` → `NULL::uuid` (contractor_role_type_id for trade capabilities)

---

## Issue 2: Partial Unique Constraint Syntax Error
After fixing Issue 1, migrations failed with:
```
ERROR: syntax error at or near "WHERE" (SQLSTATE 42601)
```

### Root Cause
PostgreSQL does not support WHERE clauses in unique constraints added via `ALTER TABLE ADD CONSTRAINT` within a DO block. This syntax is invalid:

```sql
-- ❌ INVALID SYNTAX
ALTER TABLE employer_capabilities
ADD CONSTRAINT employer_capabilities_role_unique
UNIQUE (employer_id, capability_type, contractor_role_type_id)
WHERE contractor_role_type_id IS NOT NULL;
```

### Fix Applied
Changed to use `CREATE UNIQUE INDEX` which does support WHERE clauses (partial indexes):

```sql
-- ✅ VALID SYNTAX
CREATE UNIQUE INDEX IF NOT EXISTS idx_employer_capabilities_role_unique
  ON employer_capabilities(employer_id, capability_type, contractor_role_type_id)
  WHERE contractor_role_type_id IS NOT NULL;
```

**File:** `20251021000000_consolidate_employer_classifications.sql`
- Replaced DO block with CONSTRAINT syntax
- Now uses CREATE UNIQUE INDEX for both role and trade uniqueness
- Partial indexes enforce uniqueness only on non-NULL values

---

## Resolution Status
✅ **Both issues fixed!**

All NULL values being inserted into UUID columns now have proper type casting, and unique constraints are properly implemented using partial indexes.

## Next Steps
You can now re-run the migrations:
```bash
npx supabase db push --include-all
```

The migrations should complete successfully now! 🎉

