# Employer Alias Initiative - Deployment Runbook
## Migration & Testing Procedures

**Version:** 1.0  
**Last Updated:** October 15, 2025  
**Owner:** Technical Lead / DevOps Team

## Overview

This runbook covers the deployment of the Employer Alias Initiative (Prompts 3B, 3C, 3D) including:
- Database schema migrations
- API enhancements
- UI components
- Analytics dashboard

**Total Migrations:** 3  
**Estimated Downtime:** None (migrations are additive only)  
**Deployment Time:** ~30 minutes (staging), ~45 minutes (production)

---

## Pre-Deployment Checklist

### Code Readiness
- [ ] All code merged to main branch
- [ ] No linting errors (`pnpm lint`)
- [ ] All tests passing (`pnpm test`)
- [ ] Build succeeds locally (`pnpm build`)
- [ ] TypeScript compilation clean (`pnpm type-check`)

### Database Readiness
- [ ] Migrations exist in `supabase/migrations/`
- [ ] Migration files are sequential and timestamped
- [ ] SQL syntax validated locally
- [ ] No conflicts with existing schema

### Environment Readiness
- [ ] Staging environment accessible
- [ ] Production backup recent (<24h)
- [ ] Database connection strings verified
- [ ] Monitoring/alerting active

### Team Readiness
- [ ] Deployment window scheduled
- [ ] Key stakeholders notified
- [ ] Rollback procedure reviewed
- [ ] Support team on standby

---

## Migration Order

Execute migrations in this **exact order**:

### 1. Alias Provenance Schema (Prompt 1B - Already Deployed)
**File:** `20251014093000_employer_alias_provenance.sql`  
**Status:** ✅ Previously deployed  
**Skip if:** Already in production

### 2. Normalization Function (Prompt 1A - Check if Deployed)
**File:** `20251014090000_normalize_employer_name.sql`  
**Status:** Check production database  
**Required for:** Prompts 3B, 3C, 3D

### 3. Canonical Promotion System (Prompt 3B)
**File:** `20251015120000_canonical_promotion_system.sql`  
**Dependencies:** Alias provenance schema  
**Contents:**
- `employer_canonical_audit` table
- `canonical_promotion_queue` view
- 3 RPC functions (promote, reject, defer)

### 4. Alias Search System (Prompt 3C)
**File:** `20251015125000_employer_alias_search.sql`  
**Dependencies:** Alias provenance, normalization function  
**Contents:**
- `search_employers_with_aliases` RPC
- `get_employer_aliases` RPC
- `employer_alias_stats` view
- Performance indexes

### 5. Analytics System (Prompt 3D)
**File:** `20251015130000_alias_analytics.sql`  
**Dependencies:** All previous migrations  
**Contents:**
- 6 analytics views
- `get_alias_metrics_range` RPC

---

## Staging Deployment

### Step 1: Pre-Deployment Verification

```bash
# Navigate to project directory
cd /path/to/cfmeu-nextjs

# Ensure on main branch with latest code
git checkout main
git pull origin main

# Verify no uncommitted changes
git status

# Check migration files exist
ls -la supabase/migrations/202510151*

# You should see:
# 20251015120000_canonical_promotion_system.sql
# 20251015125000_employer_alias_search.sql
# 20251015130000_alias_analytics.sql
```

### Step 2: Database Backup (Staging)

```bash
# Login to Supabase CLI
supabase login

# Link to staging project
supabase link --project-ref <staging-project-ref>

# Verify connection
supabase db remote get

# Create backup (optional for staging, required for production)
# Note: Supabase handles automated backups, but document current state
echo "Backup created at: $(date)" >> deployment-log.txt
```

### Step 3: Run Migrations (Staging)

```bash
# Check current migration status
supabase db remote get-migrations

# Run all pending migrations
supabase db push

# Expected output:
# ✓ Applying migration 20251015120000_canonical_promotion_system.sql
# ✓ Applying migration 20251015125000_employer_alias_search.sql
# ✓ Applying migration 20251015130000_alias_analytics.sql
# ✓ Migrations complete

# Verify migrations applied
supabase db remote get-migrations
```

**If errors occur:**
1. Note the exact error message
2. Check SQL syntax in failed migration
3. Verify dependencies (tables/functions) exist
4. Review logs: `supabase logs db`
5. Do NOT proceed until resolved

### Step 4: Verify Database Objects

```sql
-- Connect to staging database
-- psql or Supabase SQL Editor

-- Verify tables created
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('employer_canonical_audit');
-- Expected: 1 row

-- Verify views created
SELECT viewname FROM pg_views 
WHERE schemaname = 'public' 
AND viewname LIKE 'alias%' OR viewname LIKE 'canonical%' OR viewname LIKE 'employer_alias%';
-- Expected: 9 rows

-- Verify RPC functions created
SELECT proname FROM pg_proc 
WHERE proname LIKE '%alias%' OR proname LIKE '%canonical%';
-- Expected: 6 functions

-- Test a simple query
SELECT * FROM alias_metrics_summary;
-- Should return 1 row with current metrics
```

### Step 5: Deploy Application Code (Staging)

```bash
# Trigger Vercel deployment (or your deployment method)
git push origin main

# Or manual Vercel deploy
vercel --prod

# Wait for deployment to complete
# Monitor: https://vercel.com/your-team/cfmeu-nextjs/deployments

# Verify deployment succeeded
curl -I https://staging.your-domain.com/api/admin/alias-metrics
# Expected: 401 (Unauthorized - because not logged in, but endpoint exists)
```

### Step 6: Staging Verification Tests

Execute these manual tests in staging:

#### Test 1: Canonical Promotion Console Access
1. Login as admin user
2. Navigate to Admin → Canonical Names
3. **Expected:** Console loads without errors
4. **Expected:** Shows pending queue (may be empty)
5. Try a promotion action if items exist
6. **Expected:** Audit record created

**SQL Verification:**
```sql
SELECT COUNT(*) FROM employer_canonical_audit;
-- Should increase after test action
```

#### Test 2: Alias Search API
```bash
# Test basic search
curl -H "Authorization: Bearer <token>" \
  "https://staging.your-domain.com/api/employers?q=construction"
# Expected: 200 OK with employers list

# Test alias search
curl -H "Authorization: Bearer <token>" \
  "https://staging.your-domain.com/api/employers?q=construction&includeAliases=true"
# Expected: 200 OK with aliases in response

# Test RPC directly (via Supabase client)
SELECT * FROM search_employers_with_aliases('construction', 10, 0, true, 'any');
# Expected: Rows returned with alias data
```

#### Test 3: Analytics Dashboard
1. Navigate to Admin → Alias Analytics
2. **Expected:** Dashboard loads without errors
3. **Expected:** Overview cards show metrics
4. **Expected:** Source systems table populated
5. Click "Export CSV" buttons
6. **Expected:** CSV files download successfully

#### Test 4: BCI Import Flow
1. Navigate to Data Upload → BCI Import
2. Upload a test CSV with employer names
3. **Expected:** Import completes successfully
4. **Expected:** Aliases created with `source_system = 'bci'`

**SQL Verification:**
```sql
SELECT * FROM employer_aliases 
WHERE source_system = 'bci' 
ORDER BY created_at DESC 
LIMIT 5;
-- Should show newly imported aliases
```

#### Test 5: Pending Employers Resolution
1. Navigate to Admin → Pending Approvals
2. Select a pending employer
3. Link to existing or create new employer
4. **Expected:** Alias created with `source_system = 'pending_import'`

**SQL Verification:**
```sql
SELECT * FROM employer_aliases 
WHERE source_system = 'pending_import' 
ORDER BY created_at DESC 
LIMIT 5;
```

### Step 7: Performance Verification (Staging)

```sql
-- Check query performance
EXPLAIN ANALYZE SELECT * FROM alias_metrics_summary;
-- Expected: < 100ms

EXPLAIN ANALYZE SELECT * FROM canonical_promotion_queue LIMIT 10;
-- Expected: < 200ms

EXPLAIN ANALYZE 
SELECT * FROM search_employers_with_aliases('test', 50, 0, true, 'any');
-- Expected: < 500ms

-- Verify indexes are being used
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE indexname LIKE '%alias%';
-- Expected: Multiple indexes listed
```

### Step 8: Staging Sign-Off

**Checklist:**
- [ ] All migrations applied successfully
- [ ] All database objects created
- [ ] API endpoints responding correctly
- [ ] UI components rendering without errors
- [ ] Test imports working (BCI, Pending Employers)
- [ ] Analytics dashboard functional
- [ ] CSV exports downloading
- [ ] Performance acceptable (< 500ms for most queries)
- [ ] No console errors in browser
- [ ] No application errors in logs

**Document Findings:**
```
Staging Deployment Results
Date: _______________
Deployed By: _______________
Duration: _______________

✅ Migrations: Success
✅ Application: Success
✅ Tests: X/5 passed

Notes:
- 
- 
```

---

## Production Deployment

### Prerequisites
- [ ] Staging deployment completed successfully
- [ ] All staging tests passed
- [ ] Stakeholders notified of deployment window
- [ ] Database backup confirmed recent
- [ ] Rollback procedure reviewed
- [ ] Support team on standby

### Step 1: Pre-Deployment Database Backup

```bash
# Connect to production
supabase link --project-ref <production-project-ref>

# Verify you're connected to production (CRITICAL!)
supabase status
# Double-check the project name/ref

# Document backup
echo "Production backup verified at: $(date)" >> production-deployment-log.txt

# Note: Supabase automatically backs up, but verify:
# Go to Supabase Dashboard → Database → Backups
# Confirm recent backup exists
```

### Step 2: Announce Maintenance Window (Optional)

```bash
# If you have a status page, update it
# No downtime expected, but inform users of new features

# Example notification:
"Deploying new alias search and analytics features. 
No downtime expected. New features will be available shortly."
```

### Step 3: Run Production Migrations

```bash
# CRITICAL: Verify you're on production project
supabase status

# Check current migration status
supabase db remote get-migrations

# Run migrations (same as staging)
supabase db push

# Monitor output carefully
# Expected: 3 migrations applied successfully

# Verify
supabase db remote get-migrations
```

**If any migration fails:**
1. **STOP IMMEDIATELY**
2. Note the error
3. Do NOT attempt to fix in production
4. Proceed to Rollback section
5. Debug in staging first

### Step 4: Verify Database Objects (Production)

```sql
-- Run same verification queries as staging

-- Quick check: Count new objects
SELECT COUNT(*) FROM pg_tables 
WHERE tablename = 'employer_canonical_audit';
-- Expected: 1

SELECT COUNT(*) FROM pg_views 
WHERE viewname LIKE 'alias%' OR viewname LIKE 'canonical%';
-- Expected: 9

SELECT COUNT(*) FROM pg_proc 
WHERE proname IN (
  'search_employers_with_aliases',
  'get_employer_aliases',
  'promote_alias_to_canonical',
  'reject_canonical_promotion',
  'defer_canonical_promotion',
  'get_alias_metrics_range'
);
-- Expected: 6

-- Test metrics view (should return data)
SELECT total_aliases, employers_with_aliases 
FROM alias_metrics_summary;
```

### Step 5: Deploy Application Code (Production)

```bash
# Push to main triggers automatic Vercel deployment
git push origin main

# Or manual production deploy
vercel --prod

# Monitor deployment
# Wait for "Ready" status

# Verify deployment URL
curl -I https://your-production-domain.com
# Expected: 200 OK
```

### Step 6: Smoke Tests (Production)

**Execute quickly after deployment:**

#### Test 1: Health Check
```bash
curl https://your-domain.com/api/employers
# Expected: 401 or data (depends on auth)
# Key: No 500 errors

curl https://your-domain.com/api/admin/alias-metrics
# Expected: 401 (unauthorized - expected)
```

#### Test 2: UI Access
1. Login as admin
2. Navigate to Admin page
3. **Expected:** "Alias Analytics" and "Canonical Names" tabs visible
4. Click each tab
5. **Expected:** Both load without errors

#### Test 3: Critical Path - Create Alias
1. Go to any employer creation flow
2. Create test employer
3. **Expected:** Process completes normally
4. Verify alias created:
```sql
SELECT * FROM employer_aliases 
ORDER BY created_at DESC 
LIMIT 1;
```

### Step 7: Monitor for Issues

**Monitor for 30 minutes post-deployment:**

```bash
# Check Vercel logs
vercel logs --prod

# Check Supabase logs
supabase logs db --follow

# Watch for:
# - 500 errors
# - Slow queries (>1s)
# - Failed alias insertions
# - RPC errors
```

**Monitoring Checklist:**
- [ ] No application errors in logs (first 5 minutes)
- [ ] No database errors in logs (first 5 minutes)
- [ ] API response times normal (<500ms)
- [ ] No user-reported issues (first 15 minutes)
- [ ] New features accessible to admins
- [ ] Background jobs running normally (if applicable)

### Step 8: Post-Deployment Verification

**Run these tests 1 hour after deployment:**

```sql
-- Check for any failed alias insertions
SELECT * FROM pg_stat_activity 
WHERE state = 'idle in transaction' 
AND query LIKE '%employer_aliases%';
-- Expected: No long-running transactions

-- Verify analytics are computing
SELECT * FROM alias_metrics_summary;
-- Expected: Data looks reasonable

-- Check for constraint violations
SELECT COUNT(*) FROM employer_canonical_audit;
-- Expected: Should have records if any promotions happened
```

### Step 9: Production Sign-Off

**Final Checklist:**
- [ ] All migrations applied successfully
- [ ] Application deployed successfully
- [ ] Smoke tests passed
- [ ] 30-minute monitoring period passed
- [ ] No errors in logs
- [ ] Performance acceptable
- [ ] New features accessible
- [ ] Support team reports no issues

**Document:**
```
Production Deployment Results
Date: _______________
Deployed By: _______________
Start Time: _______________
End Time: _______________
Duration: _______________

✅ Migrations: 3/3 successful
✅ Application: Deployed
✅ Smoke Tests: Passed
✅ Monitoring: No issues

Metrics Snapshot:
- Total aliases: _____
- Employers with aliases: _____
- Pending reviews: _____
- Coverage: _____%

Sign-off: _______________
```

---

## Rollback Procedures

### When to Rollback

**Immediately rollback if:**
- Migration fails with data integrity errors
- Critical functionality broken (employers can't be created)
- Database performance severely degraded (>5s queries)
- Data corruption detected

**Consider rollback if:**
- New features have bugs (but core functionality works)
- Performance slightly degraded but acceptable
- Non-critical UI issues

**Do NOT rollback for:**
- Minor UI bugs that don't block workflows
- Expected behavior changes (document instead)
- Feature requests/enhancements

### Application Rollback (Quick)

```bash
# Rollback to previous Vercel deployment
vercel rollback

# Or redeploy previous version
git revert HEAD
git push origin main

# Verify rollback
curl https://your-domain.com
# Check version or test endpoints
```

**Application rollback is safe because:**
- New database objects are backward compatible
- Old code doesn't use new features
- No breaking changes to existing functionality

### Database Rollback (Complex)

⚠️ **WARNING:** Database rollbacks are complex. Migrations are additive only (no DROP statements), so "rollback" means disabling new features.

#### Option 1: Disable New Features (Safest)

```sql
-- Revoke permissions on new functions/views
REVOKE ALL ON FUNCTION search_employers_with_aliases FROM authenticated;
REVOKE ALL ON FUNCTION get_alias_metrics_range FROM authenticated;
REVOKE SELECT ON alias_metrics_summary FROM authenticated;
-- Repeat for all new objects

-- This prevents new features from being used
-- But doesn't break existing data
```

#### Option 2: Drop New Objects (More Risky)

```sql
-- ONLY if absolutely necessary
-- ONLY if no data has been written to new tables

BEGIN;

-- Drop analytics views (Prompt 3D)
DROP VIEW IF EXISTS alias_metrics_summary CASCADE;
DROP VIEW IF EXISTS alias_metrics_daily CASCADE;
DROP VIEW IF EXISTS canonical_review_metrics CASCADE;
DROP VIEW IF EXISTS alias_conflict_backlog CASCADE;
DROP VIEW IF EXISTS alias_source_system_stats CASCADE;
DROP VIEW IF EXISTS employer_alias_coverage CASCADE;
DROP FUNCTION IF EXISTS get_alias_metrics_range CASCADE;

-- Drop search functions (Prompt 3C)
DROP FUNCTION IF EXISTS search_employers_with_aliases CASCADE;
DROP FUNCTION IF EXISTS get_employer_aliases CASCADE;
DROP VIEW IF EXISTS employer_alias_stats CASCADE;

-- Drop canonical promotion system (Prompt 3B)
DROP FUNCTION IF EXISTS promote_alias_to_canonical CASCADE;
DROP FUNCTION IF EXISTS reject_canonical_promotion CASCADE;
DROP FUNCTION IF EXISTS defer_canonical_promotion CASCADE;
DROP VIEW IF EXISTS canonical_promotion_queue CASCADE;
DROP TABLE IF EXISTS employer_canonical_audit CASCADE;

-- Only commit if you're CERTAIN
-- ROLLBACK; -- Uncomment to abort
COMMIT;
```

#### Option 3: Emergency Disable (Fastest)

```sql
-- If severe performance issues
-- Disable the problematic function/view temporarily

ALTER FUNCTION search_employers_with_aliases RENAME TO search_employers_with_aliases_DISABLED;

-- Re-enable later after fix
ALTER FUNCTION search_employers_with_aliases_DISABLED RENAME TO search_employers_with_aliases;
```

### Post-Rollback Actions

1. **Notify stakeholders** of rollback and reason
2. **Document what went wrong** in incident report
3. **Fix issue in staging** before redeploying
4. **Schedule re-deployment** after fix validated

---

## Backfill Strategy

### Overview

The migrations are designed to work with existing data. However, you may want to backfill certain fields:

### 1. Existing Aliases (Already Backfilled)

Migration `20251014093000_employer_alias_provenance.sql` includes backfill:
```sql
UPDATE employer_aliases SET
  source_system = COALESCE(source_system, 'legacy_migration'),
  collected_at = COALESCE(collected_at, created_at),
  ...
WHERE source_system IS NULL;
```

**No action needed** - handled by migration.

### 2. Missing Aliases for Employers with External IDs

Employers with `bci_company_id` or `incolink_id` but no aliases should have aliases created:

```sql
-- Find gaps
SELECT COUNT(*) FROM employers e
LEFT JOIN employer_aliases ea ON ea.employer_id = e.id
WHERE (e.bci_company_id IS NOT NULL OR e.incolink_id IS NOT NULL)
AND ea.id IS NULL;

-- Create aliases for BCI companies
INSERT INTO employer_aliases (
  employer_id, alias, alias_normalized,
  source_system, source_identifier, is_authoritative,
  collected_at, notes
)
SELECT 
  e.id,
  e.name,
  public.normalize_employer_name(e.name),
  'bci_backfill',
  e.bci_company_id,
  false, -- Mark as not authoritative since we're unsure
  e.created_at,
  'Backfilled from existing BCI company ID'
FROM employers e
LEFT JOIN employer_aliases ea ON ea.employer_id = e.id AND ea.source_system LIKE 'bci%'
WHERE e.bci_company_id IS NOT NULL
AND ea.id IS NULL;

-- Repeat for Incolink
-- (Similar query with incolink_id)
```

**When to run:** After migrations, during low-traffic period  
**Estimated time:** < 5 minutes for typical dataset  
**Rollback:** Delete aliases WHERE source_system = 'bci_backfill'

### 3. Normalizing Existing Alias Names

If `alias_normalized` values were created before the new `normalize_employer_name` function:

```sql
-- Update normalizations to use new function
UPDATE employer_aliases
SET alias_normalized = public.normalize_employer_name(alias)
WHERE alias_normalized != public.normalize_employer_name(alias);

-- Check impact first
SELECT COUNT(*) FROM employer_aliases
WHERE alias_normalized != public.normalize_employer_name(alias);
```

**When to run:** Optional, only if normalization rules changed significantly  
**Risk:** May create duplicate normalized values temporarily

---

## Monitoring & Validation

### Key Metrics to Monitor

**Database Performance:**
```sql
-- Query performance
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%employer_alias%'
OR query LIKE '%canonical%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE indexname LIKE '%alias%'
ORDER BY idx_scan DESC;

-- Table sizes
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE tablename IN ('employer_aliases', 'employer_canonical_audit')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Application Metrics:**
- API endpoint response times (`/api/employers`, `/api/admin/alias-metrics`)
- Error rates (should remain at baseline)
- User session duration (should not decrease)

**Business Metrics:**
```sql
-- Daily alias creation
SELECT COUNT(*), DATE(created_at) as date
FROM employer_aliases
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Canonical decisions
SELECT COUNT(*), action, DATE(decided_at) as date
FROM employer_canonical_audit
WHERE decided_at >= NOW() - INTERVAL '7 days'
GROUP BY action, DATE(decided_at)
ORDER BY date DESC, action;

-- Coverage trend
SELECT 
  ROUND((COUNT(DISTINCT ea.employer_id)::numeric / COUNT(DISTINCT e.id)) * 100, 2) as coverage_pct,
  DATE(ea.created_at) as date
FROM employers e
LEFT JOIN employer_aliases ea ON ea.employer_id = e.id
WHERE e.created_at <= CURRENT_DATE
GROUP BY DATE(ea.created_at)
ORDER BY date DESC
LIMIT 30;
```

### Alerting Thresholds

**Set up alerts for:**
- Query time > 1s for alias searches
- Error rate > 1% on `/api/employers`
- Canonical review backlog > 50
- Alias insert failures > 5/hour
- Coverage percentage drops > 5%

### Daily Health Checks (First Week)

```sql
-- Run daily for first week post-deployment
SELECT 
  'Aliases Created' as metric, 
  COUNT(*)::text as value 
FROM employer_aliases 
WHERE created_at >= CURRENT_DATE
UNION ALL
SELECT 
  'Decisions Made', 
  COUNT(*)::text 
FROM employer_canonical_audit 
WHERE decided_at >= CURRENT_DATE
UNION ALL
SELECT 
  'Pending Reviews', 
  COUNT(*)::text 
FROM canonical_promotion_queue
UNION ALL
SELECT 
  'Search Performance', 
  ROUND(AVG(mean_exec_time))::text || 'ms'
FROM pg_stat_statements 
WHERE query LIKE '%search_employers_with_aliases%';
```

---

## Troubleshooting

### Common Issues

#### Issue: Migration fails with "relation already exists"
**Cause:** Migration previously partially applied  
**Solution:**
```sql
-- Check what exists
SELECT tablename FROM pg_tables WHERE tablename = 'employer_canonical_audit';
SELECT viewname FROM pg_views WHERE viewname LIKE 'alias%';

-- If objects exist, mark migration as applied manually
-- (Supabase CLI): supabase db remote commit
```

#### Issue: "function does not exist" error
**Cause:** Normalization function not deployed  
**Solution:**
```sql
-- Check if function exists
SELECT proname FROM pg_proc WHERE proname = 'normalize_employer_name';

-- If missing, deploy normalization migration first
-- See Migration Order section
```

#### Issue: Slow alias search queries
**Cause:** Missing indexes or large dataset  
**Solution:**
```sql
-- Check index usage
EXPLAIN ANALYZE 
SELECT * FROM search_employers_with_aliases('test', 50, 0, true, 'any');

-- If sequential scans, rebuild indexes
REINDEX TABLE employer_aliases;
ANALYZE employer_aliases;
```

#### Issue: Dashboard shows no data
**Cause:** Views need initial data or permissions  
**Solution:**
```sql
-- Check if views return data
SELECT * FROM alias_metrics_summary;

-- If empty but aliases exist, views may need refresh
REFRESH MATERIALIZED VIEW alias_metrics_daily; -- If materialized

-- Check permissions
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'alias_metrics_summary';
```

#### Issue: CSV export fails
**Cause:** Permission issue or data format  
**Solution:**
- Check browser console for errors
- Verify user has admin/lead_organiser role
- Test API endpoint directly:
```bash
curl -X POST https://your-domain.com/api/admin/alias-metrics \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"exportType":"sourceSystems"}'
```

---

## Success Criteria

Deployment is considered successful when:

- [ ] All 3 migrations applied without errors
- [ ] All database objects created and accessible
- [ ] Application deployed and responding
- [ ] Admin users can access new features
- [ ] Canonical promotion console functional
- [ ] Alias search returns results
- [ ] Analytics dashboard displays metrics
- [ ] CSV exports download successfully
- [ ] No performance degradation (queries < 500ms)
- [ ] No increase in error rates
- [ ] Monitoring shows expected usage patterns
- [ ] No critical issues reported in first 24 hours

---

## Rollback Decision Tree

```
Issue Detected
    │
    ├─ Critical (data loss, broken core functionality)
    │   └─> ROLLBACK IMMEDIATELY
    │
    ├─ High (new features broken, performance issues)
    │   └─> Evaluate impact
    │       ├─ Affects all users? → ROLLBACK
    │       └─ Affects admin only? → Consider hotfix
    │
    └─ Medium/Low (UI bugs, minor issues)
        └─> Document, plan hotfix, NO rollback needed
```

---

## Post-Deployment Checklist

**Immediately After (0-1 hour):**
- [ ] Verify deployment success
- [ ] Run smoke tests
- [ ] Check logs for errors
- [ ] Monitor performance metrics
- [ ] Test critical user paths

**First Day:**
- [ ] Run health check queries
- [ ] Review analytics dashboard
- [ ] Check for user-reported issues
- [ ] Verify background jobs running
- [ ] Document any issues found

**First Week:**
- [ ] Daily health checks
- [ ] Monitor metric trends
- [ ] Gather user feedback
- [ ] Address minor issues
- [ ] Optimize if needed

**End of Week:**
- [ ] Final deployment report
- [ ] Lessons learned document
- [ ] Update runbook with findings
- [ ] Plan any improvements

---

## Contact Information

**During Deployment:**
- Technical Lead: _______________
- Database Admin: _______________
- DevOps On-Call: _______________
- Support Lead: _______________

**Escalation Path:**
1. Technical Lead
2. Engineering Manager
3. CTO

**Emergency Rollback Authority:**
- Technical Lead (primary)
- Engineering Manager (backup)

---

## Appendix

### A. Migration File Reference

| File | Description | Size | Objects Created |
|------|-------------|------|-----------------|
| `20251015120000_canonical_promotion_system.sql` | Canonical promotion management | ~8KB | 1 table, 1 view, 3 functions |
| `20251015125000_employer_alias_search.sql` | Alias-aware search | ~10KB | 2 functions, 1 view, 6 indexes |
| `20251015130000_alias_analytics.sql` | Analytics dashboard | ~12KB | 6 views, 1 function |

### B. Database Object Reference

**Tables:**
- `employer_canonical_audit` - Audit trail for all canonical decisions

**Views:**
- `canonical_promotion_queue` - Items for review
- `alias_metrics_summary` - Overall statistics
- `alias_metrics_daily` - Time series data
- `canonical_review_metrics` - Queue and decision metrics
- `alias_conflict_backlog` - Conflicts needing attention
- `alias_source_system_stats` - Per-source breakdown
- `employer_alias_coverage` - Coverage metrics
- `employer_alias_stats` - Per-employer alias stats (existing)

**Functions:**
- `promote_alias_to_canonical(p_alias_id, p_decision_rationale)`
- `reject_canonical_promotion(p_alias_id, p_decision_rationale)`
- `defer_canonical_promotion(p_alias_id, p_decision_rationale)`
- `search_employers_with_aliases(p_query, p_limit, p_offset, p_include_aliases, p_alias_match_mode)`
- `get_employer_aliases(p_employer_id)`
- `get_alias_metrics_range(p_start_date, p_end_date)`

### C. API Endpoint Reference

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/employers` | GET | Required | Employer list (enhanced with aliases) |
| `/api/admin/alias-metrics` | GET | Admin | Analytics metrics |
| `/api/admin/alias-metrics` | POST | Admin | CSV export |

### D. Useful SQL Queries

```sql
-- Check migration status
SELECT * FROM supabase_migrations.schema_migrations 
ORDER BY version DESC LIMIT 10;

-- Count aliases by source
SELECT source_system, COUNT(*) 
FROM employer_aliases 
GROUP BY source_system 
ORDER BY COUNT(*) DESC;

-- Find employers needing aliases
SELECT e.id, e.name, e.bci_company_id, e.incolink_id
FROM employers e
LEFT JOIN employer_aliases ea ON ea.employer_id = e.id
WHERE (e.bci_company_id IS NOT NULL OR e.incolink_id IS NOT NULL)
AND ea.id IS NULL
LIMIT 10;

-- Review recent canonical decisions
SELECT * FROM employer_canonical_audit 
ORDER BY decided_at DESC 
LIMIT 20;

-- Check for conflicts
SELECT * FROM alias_conflict_backlog 
WHERE age_bucket IN ('<24h', '1-3d')
ORDER BY priority DESC;
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-15 | AI Assistant | Initial runbook creation |

---

**END OF RUNBOOK**

