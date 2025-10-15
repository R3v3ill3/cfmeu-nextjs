# Materialized View Implementation: Risk Analysis

## Executive Summary

**Overall Risk Level: 🟡 LOW-MEDIUM**

The materialized view approach is **safe to implement directly** with proper precautions. Key findings:

✅ **No breaking changes** - It's an additive change (new view, doesn't modify existing table)
✅ **Read-only impact** - Only affects search/list queries, not writes
✅ **Easy rollback** - Can revert by changing table name in one API route
⚠️ **Refresh strategy** - Need to ensure view stays synchronized with data changes

---

## Dependency Analysis

### 1. Tables Referencing Employers (Foreign Keys)

Found **33+ foreign key relationships** across these tables:
- `worker_placements` → `employers.id`
- `project_assignments` → `employers.id`
- `company_eba_records` → `employers.id`
- `employer_aliases` → `employers.id` (CASCADE DELETE)
- `site_visit` → `employers.id`
- `contractor_trade_capabilities` → `employers.id`
- `pending_employers.imported_employer_id` → `employers.id`
- `patch_employers` → `employers.id`
- `projects.builder_id` → `employers.id`
- `profiles.scoped_employers[]` (array of employer IDs)
- And more...

**Impact:**
- ✅ **NO RISK**: Foreign keys reference `employers` table directly, not our new view
- ✅ Materialized view is read-only; doesn't affect foreign key constraints
- ✅ All writes continue to go to `employers` table

---

### 2. Database Views Using Employers

#### `employers_with_eba` View
```sql
CREATE VIEW employers_with_eba AS
  -- Joins employers with latest company_eba_records
  SELECT e.*, latest_eba.*
  FROM employers e
  LEFT JOIN company_eba_records latest_eba ...
```

**Impact:**
- ✅ **NO RISK**: This view reads from base `employers` table
- ✅ Our materialized view doesn't modify the base table
- ✅ View continues to work as-is

#### `v_patch_employers_current` View
```sql
CREATE VIEW v_patch_employers_current AS
  SELECT patch_id, employer_id
  FROM patch_employers
  WHERE effective_to IS NULL;
```

**Impact:**
- ✅ **NO RISK**: Doesn't reference employers table directly
- ✅ Only reads from `patch_employers` linking table

---

### 3. Database Triggers on Employers

#### `update_employers_updated_at` Trigger
```sql
CREATE TRIGGER update_employers_updated_at
  BEFORE UPDATE ON employers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Impact:**
- ✅ **NO RISK**: Trigger remains on base `employers` table
- ✅ Our materialized view doesn't interfere with triggers
- ✅ All writes still go through base table, triggering updates

---

### 4. Application Code Writing to Employers

Found **6 components** that INSERT/UPDATE employers:

#### Component: `BCIProjectImport`
- Inserts employers during BCI project import
- Uses: `supabase.from('employers').insert(...)`

#### Component: `PendingEmployersImport`
- Links pending employers or creates new ones
- Manages employer aliases
- Uses: `supabase.from('employers').insert(...)`

#### Component: `EbaImport`
- Creates employers when importing EBA data
- Uses: `supabase.from('employers').insert({...})`

#### Component: `ContractorImport`
- Bulk imports contractors as employers
- Uses: `supabase.from('employers').insert(...)`

#### Component: `WorkerImport`
- Creates employers when needed during worker import
- Uses: `supabase.from('employers').insert({...})`

#### Component: `EmployerEditForm`
- User-facing form to edit employer details
- Uses: `supabase.from('employers').update(...)`

**Impact:**
- ✅ **NO RISK TO WRITES**: All components write to `employers` table
- ✅ Our materialized view is read-only, doesn't affect inserts/updates
- ⚠️ **REFRESH NEEDED**: After writes, view needs refresh to show new data

---

### 5. Application Code Reading from Employers

Found **10+ components** that SELECT from employers:

#### Primary Search/List Views:
1. **`/api/employers/route.ts`** ⭐ - The target of our optimization
   - Currently: `supabase.from('employers').select(...)`
   - After: `supabase.from('employers_search_optimized').select(...)`
   - **Impact**: This is the ONLY file that needs to change

2. **`SingleEmployerPicker`** - Autocomplete for selecting employer
   - Reads: `supabase.from('employers').select('id, name')`
   - **Impact**: ✅ NO CHANGE - Uses base table, needs real-time data

3. **`MultiEmployerPicker`** - Multi-select for employers
   - Reads: `supabase.from('employers').select('id, name')`
   - **Impact**: ✅ NO CHANGE - Uses base table

4. **`EmployerDetailModal`** - Detail view for single employer
   - Reads: `supabase.from('employers').select('*').eq('id', ...)`
   - **Impact**: ✅ NO CHANGE - Single employer lookup, uses base table

5. **`useDashboardData` Hook** - Dashboard statistics
   - Reads: `supabase.from('employers').select('id, name')`
   - **Impact**: ✅ NO CHANGE - Dashboard uses base table

**Summary:**
- ✅ Only 1 file needs modification: `/api/employers/route.ts`
- ✅ All other components continue using base `employers` table
- ✅ No risk of breaking other functionality

---

## Risk Categories & Mitigation

### 🟢 LOW RISK: Data Integrity

**Risk:** Materialized view might not reflect latest data

**Why Low Risk:**
- View is refreshed every 5 minutes (configurable)
- For analytics/search use case, 5-minute delay is acceptable
- Base table remains source of truth

**Mitigation:**
1. Set up automatic refresh (pg_cron or external scheduler)
2. Add monitoring to detect stale view
3. Manual refresh available via function
4. Can refresh on-demand if needed

```sql
-- Manual refresh if needed
SELECT refresh_employers_search_view();

-- Check staleness
SELECT 
  last_refresh,
  NOW() - last_refresh as staleness
FROM employers_search_view_status;
```

---

### 🟢 LOW RISK: Query Performance Regression

**Risk:** What if view is slower than current query?

**Why Low Risk:**
- View has proper indexes
- Precomputed filters eliminate post-processing
- Can test in development first
- Easy rollback if needed

**Mitigation:**
1. Test in staging environment first
2. Compare query plans: `EXPLAIN ANALYZE`
3. Load test before production deployment
4. Keep feature flag for instant rollback

```typescript
// Feature flag for instant rollback
const USE_MATERIALIZED_VIEW = process.env.NEXT_PUBLIC_USE_EMPLOYER_MAT_VIEW !== 'false';

const tableName = USE_MATERIALIZED_VIEW 
  ? 'employers_search_optimized' 
  : 'employers';

const { data } = await supabase.from(tableName).select(...);
```

---

### 🟡 MEDIUM RISK: View Refresh Overhead

**Risk:** Refresh operation might impact database performance

**Why Medium Risk:**
- Refresh scans all employers and relationships
- Could take 5-30 seconds for large datasets
- Concurrent refresh allows reads, but uses resources

**Mitigation:**
1. Use `REFRESH MATERIALIZED VIEW CONCURRENTLY`
   - Allows continued reads during refresh
   - Requires unique index (which we have)
   
2. Schedule refreshes during low-traffic periods
   - Example: Every 5 minutes, offset from peak
   
3. Monitor refresh duration
   - Set alerts if refresh takes >30 seconds
   - May need optimization if too slow

4. Incremental refresh strategy (advanced)
   - Track changed employer IDs
   - Refresh only changed rows
   - More complex but lower overhead

```sql
-- Monitor refresh performance
CREATE TABLE mat_view_refresh_log (
  refreshed_at timestamptz DEFAULT NOW(),
  duration_ms integer,
  rows_refreshed bigint
);

-- Log each refresh
CREATE OR REPLACE FUNCTION refresh_employers_search_view_logged()
RETURNS void AS $$
DECLARE
  v_start timestamptz;
  v_duration integer;
  v_count bigint;
BEGIN
  v_start := clock_timestamp();
  
  REFRESH MATERIALIZED VIEW CONCURRENTLY employers_search_optimized;
  
  v_duration := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start));
  SELECT COUNT(*) INTO v_count FROM employers_search_optimized;
  
  INSERT INTO mat_view_refresh_log (duration_ms, rows_refreshed)
  VALUES (v_duration, v_count);
  
  -- Alert if slow
  IF v_duration > 30000 THEN
    RAISE WARNING 'Slow materialized view refresh: %ms', v_duration;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

---

### 🟢 LOW RISK: Storage Overhead

**Risk:** Materialized view consumes disk space

**Why Low Risk:**
- Estimated +20% of employers table size
- Modern databases handle this easily
- Can be monitored and managed

**Current Sizing Estimate:**
```
Employers table:      ~50MB (estimated for ~5000 employers)
Materialized view:    ~60-70MB (includes precomputed JSONB fields)
Indexes on view:      ~20-30MB
Total overhead:       ~80-100MB (acceptable)
```

For **50,000 employers** (10x growth):
```
Employers table:      ~500MB
Materialized view:    ~600-700MB
Total overhead:       ~800MB-1GB (still acceptable)
```

**Mitigation:**
1. Monitor disk usage
2. Set up alerts if database size grows unexpectedly
3. Regular maintenance: `VACUUM ANALYZE`

---

### 🟢 LOW RISK: Complex Rollback

**Risk:** What if we need to roll back quickly?

**Why Low Risk:**
- Simple one-line code change
- View can remain in database (no harm)
- No data loss

**Rollback Procedure:**

**Step 1: Immediate Code Rollback (< 1 minute)**
```typescript
// In /api/employers/route.ts
// Change line 356:
- const tableName = 'employers_search_optimized';
+ const tableName = 'employers';
```

**Step 2: Deploy**
- Deploy change (Vercel: ~2 minutes)
- Site immediately uses old query path
- No downtime

**Step 3: Clean Up (optional, can do later)**
```sql
-- Drop view if needed (doesn't affect anything)
DROP MATERIALIZED VIEW IF EXISTS employers_search_optimized;
```

---

### 🟡 MEDIUM RISK: Data Freshness Expectations

**Risk:** Users expect real-time data, view has 5-minute delay

**Why Medium Risk:**
- Depends on user expectations
- Could cause confusion if user creates employer and doesn't see it

**Scenarios:**

**✅ SAFE Scenarios (5-min delay OK):**
1. Searching for existing employers
2. Browsing employer list
3. Filtering by engagement/EBA status
4. Analytics and reporting

**⚠️ POTENTIAL ISSUE Scenarios:**
1. User creates new employer → immediately searches for it
   - Won't appear in search for up to 5 minutes
   - Shows in detail view (reads from base table)

2. User updates employer info → checks search results
   - Changes take 5 minutes to appear
   - Shows correctly in detail view

**Mitigation Strategies:**

**Option A: Hybrid Approach (Best UX)**
```typescript
// After creating/updating employer, invalidate cache
await supabase.from('employers').insert(newEmployer);

// Immediately refetch from base table for that employer
const { data: justCreated } = await supabase
  .from('employers')
  .select('*')
  .eq('id', newEmployer.id)
  .single();

// Optionally trigger immediate view refresh
await supabase.rpc('refresh_employers_search_view');
```

**Option B: UI Notification**
```typescript
// Show toast after creating employer
toast({
  title: "Employer created",
  description: "New employer will appear in search within 5 minutes. View details now.",
  action: <Button onClick={() => openEmployerDetail(id)}>View</Button>
});
```

**Option C: On-Demand Refresh**
```typescript
// Add "Refresh" button to employers page (admin only)
<Button onClick={async () => {
  setIsRefreshing(true);
  await supabase.rpc('refresh_employers_search_view');
  await queryClient.invalidateQueries(['employers-server-side']);
  setIsRefreshing(false);
}}>
  {isRefreshing ? 'Refreshing...' : 'Refresh Search Data'}
</Button>
```

**Option D: Real-Time Fallback for New Employers**
```typescript
// Show newly created employers at top of list (outside view)
const recentlyCreated = await supabase
  .from('employers')
  .select('*')
  .gte('created_at', new Date(Date.now() - 5 * 60 * 1000)) // Last 5 min
  .order('created_at', { ascending: false });

// Merge with view results, removing duplicates
const allEmployers = deduplicateById([
  ...recentlyCreated,
  ...viewResults
]);
```

---

### 🟢 LOW RISK: Concurrent Access Issues

**Risk:** Refresh conflicts with queries

**Why Low Risk:**
- `REFRESH MATERIALIZED VIEW CONCURRENTLY` allows reads during refresh
- PostgreSQL handles locking automatically
- No queries blocked

**Requirements:**
- View must have unique index (we do: on `id`)
- Slightly slower refresh but no downtime

---

### 🟢 LOW RISK: Migration Failure

**Risk:** View creation fails during migration

**Why Low Risk:**
- Can test in development first
- Migration is idempotent (safe to re-run)
- Doesn't affect existing functionality if fails

**Mitigation:**
```sql
-- Safe migration with error handling
DO $$ 
BEGIN
  -- Create view
  CREATE MATERIALIZED VIEW IF NOT EXISTS employers_search_optimized AS
  SELECT ...;
  
  RAISE NOTICE 'Materialized view created successfully';
  
  -- Create indexes
  CREATE UNIQUE INDEX IF NOT EXISTS idx_emp_search_opt_id 
    ON employers_search_optimized(id);
  
  RAISE NOTICE 'Indexes created successfully';
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create materialized view: %', SQLERRM;
  -- Doesn't halt migration; can fix later
END $$;
```

---

## Upstream/Downstream Impact Analysis

### ✅ NO UPSTREAM IMPACT

**Upstream = Components that write to employers**

All write operations continue to use base `employers` table:
- BCI imports → `employers` table
- Pending employer imports → `employers` table
- EBA imports → `employers` table
- Manual edits → `employers` table
- Worker imports → `employers` table

**Why No Impact:**
- Materialized view is read-only
- Doesn't intercept writes
- Doesn't change table structure
- No foreign key constraints affected

---

### ✅ MINIMAL DOWNSTREAM IMPACT

**Downstream = Components that read from employers**

**Changed (1 component):**
- `/api/employers/route.ts` - Switches to view for search/list

**Unchanged (10+ components):**
- Employer picker components → Use base table
- Detail modal → Uses base table
- Dashboard stats → Uses base table
- All other employer selectors → Use base table

**Why Minimal Impact:**
- Only search/list API affected
- All other reads continue using base table
- No schema changes to propagate
- No breaking changes to API response format

---

## Testing Strategy

### Phase 1: Development Testing (2-3 days)

**1. Create view in dev environment**
```bash
# Apply migration
psql $DEV_DATABASE_URL < migration_create_mat_view.sql

# Verify view created
psql $DEV_DATABASE_URL -c "SELECT COUNT(*) FROM employers_search_optimized;"
```

**2. Test refresh performance**
```sql
-- Time first refresh (builds view)
SELECT refresh_employers_search_view();
-- Expected: 1-5 seconds for 5000 employers

-- Time concurrent refresh
SELECT refresh_employers_search_view();
-- Expected: 1-3 seconds
```

**3. Test query performance**
```sql
-- Compare old vs new query time
EXPLAIN ANALYZE
SELECT * FROM employers WHERE ...;
-- Note time

EXPLAIN ANALYZE
SELECT * FROM employers_search_optimized WHERE ...;
-- Should be significantly faster
```

**4. Test data accuracy**
```sql
-- Verify computed fields match
SELECT 
  e.id,
  e.name,
  (SELECT COUNT(*) FROM worker_placements WHERE employer_id = e.id) as actual_workers,
  eo.actual_worker_count as view_workers
FROM employers e
JOIN employers_search_optimized eo ON eo.id = e.id
WHERE actual_workers != view_workers;
-- Should return 0 rows
```

**5. Test staleness behavior**
```sql
-- Create new employer
INSERT INTO employers (name, employer_type) VALUES ('Test Corp', 'small_contractor')
RETURNING id;

-- Check if in view (should NOT be yet)
SELECT COUNT(*) FROM employers_search_optimized WHERE name = 'Test Corp';
-- Expected: 0

-- Refresh view
SELECT refresh_employers_search_view();

-- Check again (should be there now)
SELECT COUNT(*) FROM employers_search_optimized WHERE name = 'Test Corp';
-- Expected: 1
```

---

### Phase 2: Staging Testing (3-5 days)

**1. Deploy to staging**
```bash
# Push migration to staging
git push staging feature/employer-mat-view

# Verify deployment
curl https://staging.your-app/api/employers?q=test
```

**2. Load testing**
```bash
# Use k6 or Apache Bench
k6 run load-test-employers.js

# Test scenarios:
# - 10 concurrent users, 50 searches/min
# - Various filter combinations
# - Measure p50, p95, p99 latencies
```

**3. Monitor refresh**
```bash
# Set up cron job for refresh
# Monitor logs for refresh time
tail -f /var/log/postgres/refresh.log
```

**4. User acceptance testing**
- Have team members use staging
- Create employers, verify they appear after refresh
- Test all filter combinations
- Verify results match expectations

---

### Phase 3: Production Rollout (1 week)

**Approach: Gradual Rollout with Feature Flag**

**Week 1: Monitor**
```typescript
// Enable for 10% of users
const USE_MAT_VIEW = Math.random() < 0.1 || 
  user?.email?.endsWith('@cfmeu.org.au');

// Track performance
if (USE_MAT_VIEW) {
  logMetric('employer_search_mat_view', { duration: queryTime });
}
```

**Week 2: Increase to 50%**
```typescript
const USE_MAT_VIEW = Math.random() < 0.5;
```

**Week 3: Full Rollout**
```typescript
const USE_MAT_VIEW = true;
```

**Monitoring:**
```typescript
// Alert on errors
if (error && USE_MAT_VIEW) {
  console.error('Mat view query failed, falling back', error);
  
  // Automatic fallback
  const { data } = await supabase.from('employers').select(...);
}
```

---

## Implementation Checklist

### Pre-Implementation
- [ ] Review this risk analysis with team
- [ ] Decide on refresh frequency (5 min recommended)
- [ ] Set up monitoring/alerting infrastructure
- [ ] Create rollback plan document
- [ ] Test in development environment

### Implementation
- [ ] Create migration SQL file
- [ ] Add refresh function
- [ ] Create monitoring views
- [ ] Update API route to use view
- [ ] Add feature flag for rollback
- [ ] Add logging/metrics

### Post-Implementation
- [ ] Monitor refresh performance (first week)
- [ ] Monitor query performance (first week)
- [ ] Check for user reports of stale data
- [ ] Verify disk usage is acceptable
- [ ] Document refresh procedure for team

### Ongoing Maintenance
- [ ] Weekly review of refresh logs
- [ ] Monthly disk usage check
- [ ] Quarterly performance review
- [ ] Update refresh frequency if needed

---

## Conclusion

### Risk Summary

| Risk Category | Level | Mitigation | Priority |
|---------------|-------|------------|----------|
| Data Integrity | 🟢 Low | Auto-refresh + monitoring | High |
| Query Performance | 🟢 Low | Testing + feature flag | High |
| Refresh Overhead | 🟡 Medium | Concurrent refresh + scheduling | Medium |
| Storage | 🟢 Low | Monitoring | Low |
| Rollback Complexity | 🟢 Low | Simple code change | High |
| Data Freshness | 🟡 Medium | Hybrid approach + UX | High |
| Concurrent Access | 🟢 Low | CONCURRENT refresh | Low |
| Migration Failure | 🟢 Low | Idempotent migration | Medium |

### Overall Assessment

**✅ SAFE TO IMPLEMENT with these conditions:**

1. **Test in dev/staging first** (2-3 days)
2. **Set up refresh automation** (pg_cron or external)
3. **Add monitoring** (refresh duration, staleness)
4. **Keep feature flag** (instant rollback)
5. **Document data freshness** (5-min delay)
6. **Have rollback plan** (one-line code change)

### Recommended Timeline

**Week 1: Development + Testing**
- Days 1-2: Create view, test in dev
- Days 3-4: Load testing, performance validation
- Day 5: Code review, documentation

**Week 2: Staging**
- Deploy to staging
- Team testing
- Monitor refresh performance

**Week 3: Production**
- Gradual rollout with feature flag
- 10% → 50% → 100%
- Monitor metrics

**Total: 3 weeks** (conservative timeline with thorough testing)

### Go/No-Go Decision

**✅ GO if:**
- 5-minute data delay is acceptable
- Have monitoring infrastructure
- Can test in staging first
- Team comfortable with PostgreSQL

**❌ NO-GO if:**
- Need real-time search results (< 1 minute)
- Cannot test in non-prod environment
- No database monitoring capability
- Very limited database resources

**Recommendation: ✅ GO - Risks are manageable and benefits are substantial**


