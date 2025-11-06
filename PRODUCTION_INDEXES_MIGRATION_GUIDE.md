# Production Optimization Indexes - Migration Guide

## Summary

The file `production_optimization_indexes.sql` is being skipped by `supabase db push` because:
1. It doesn't follow the naming pattern `<timestamp>_name.sql`
2. It uses `CREATE INDEX CONCURRENTLY` which **cannot** run in transactions (migrations run in transactions)

## Recommendation: Run Manually in SQL Editor ✅

**DO NOT rename and run via `supabase db push`** - this will fail because `CONCURRENTLY` requires manual execution outside a transaction.

### Why Manual Execution is Safe

- ✅ **Won't break sync records** - Manual SQL execution is NOT tracked in `schema_migrations` table
- ✅ **Designed for production** - The `CONCURRENTLY` keyword is specifically for production deployments
- ✅ **Non-blocking** - Indexes are created without locking tables

## Issues Found in Original File

The original `production_optimization_indexes.sql` has several errors that need fixing:

1. ❌ **Line 33**: References `job_sites.is_active` - column doesn't exist
2. ❌ **Line 48**: Uses `CURRENT_DATE` in index predicate - causes IMMUTABLE error
3. ❌ **Line 63**: Uses `CURRENT_DATE` in index predicate - causes IMMUTABLE error
4. ❌ **Line 66**: References `employer_sites` table - doesn't exist
5. ❌ **Line 72**: References `employer_ratings` table - doesn't exist
6. ❌ **Line 92**: References `job_sites.is_active` - column doesn't exist
7. ❌ **Line 97**: References `worker_placements.is_active` - column doesn't exist
8. ❌ **Line 33**: Uses `geometry` instead of `geom` column name

## Fixed Version Available

A fixed version has been created: `production_optimization_indexes_FIXED.sql`

### What Was Fixed

- ✅ Removed non-existent table references
- ✅ Removed non-existent column references
- ✅ Fixed IMMUTABLE errors (replaced `CURRENT_DATE` with fixed dates)
- ✅ Fixed geometry column name (`geom` not `geometry`)
- ✅ Commented out indexes that already exist from `20251107000000_performance_critical_indexes.sql`

### New Indexes That Will Be Created

The fixed version will create these **new** indexes (not already in the performance_critical_indexes migration):

1. `idx_job_sites_geom_active` - Spatial index on job_sites (fixed version)
2. `idx_project_employer_roles_project_type_fixed` - Project employer roles (with fixed date)
3. `idx_organiser_patch_assignments_user_effective` - Organiser assignments with effective dates
4. `idx_lead_organiser_patch_assignments_user_effective` - Lead organiser assignments with effective dates
5. `idx_projects_created_at_recent` - Recent projects (with fixed date)
6. `idx_project_assignments_employer_lookup` - Employer lookup optimization
7. `idx_job_sites_project_id_active` - Job sites by project (fixed version)
8. `idx_worker_placements_employer_id_active` - Worker placements by employer (fixed version)

## How to Execute

### Option 1: Supabase SQL Editor - All at Once (Fastest, but locks tables)

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor**
4. Open `supabase/migrations/production_optimization_indexes_SQL_EDITOR.sql`
5. Copy the entire contents
6. Paste into SQL Editor
7. Click **Run**
8. Review the verification query results at the end

**Note**: This version removes `CONCURRENTLY` so it works in SQL Editor, but will briefly lock tables during index creation (typically < 1 minute per index).

### Option 2: Supabase SQL Editor - One at a Time (Non-blocking with CONCURRENTLY)

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor**
4. Open `supabase/migrations/production_optimization_indexes_INDIVIDUAL.sql`
5. Copy **ONE** CREATE INDEX statement at a time
6. Paste into SQL Editor
7. Click **Run**
8. Wait for completion, then repeat for the next index

**Note**: Running individually allows `CONCURRENTLY` to work (each statement runs outside a transaction block).

### Option 2: Command Line (if you have direct DB access)

```bash
psql -h your-db-host -U postgres -d your-database -f production_optimization_indexes_FIXED.sql
```

## Verification

After running, check the verification query results. You should see 8 new indexes created.

You can also verify manually:

```sql
SELECT indexname, tablename 
FROM pg_indexes 
WHERE indexname IN (
    'idx_job_sites_geom_active',
    'idx_project_employer_roles_project_type_fixed',
    'idx_organiser_patch_assignments_user_effective',
    'idx_lead_organiser_patch_assignments_user_effective',
    'idx_projects_created_at_recent',
    'idx_project_assignments_employer_lookup',
    'idx_job_sites_project_id_active',
    'idx_worker_placements_employer_id_active'
)
ORDER BY tablename, indexname;
```

## What About the Original File?

The original `production_optimization_indexes.sql` can be:
- **Kept as-is** for reference (it will continue to be skipped)
- **Deleted** if you prefer (the fixed version replaces it)
- **Renamed** to something like `production_optimization_indexes_OLD.sql` for archival

## Important Notes

- ⚠️ **Index creation can take time** - Large tables may take several minutes
- ⚠️ **Run during low-traffic periods** - Even with CONCURRENTLY, there's some overhead
- ✅ **Safe to re-run** - All indexes use `IF NOT EXISTS` so they won't error if already present
- ✅ **Non-blocking** - `CONCURRENTLY` ensures tables remain accessible during index creation

