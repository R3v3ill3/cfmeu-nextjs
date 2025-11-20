# New Dashboard Verification & Deployment Guide

## 1. Verify Data Accuracy with Real Data

### Overview
Before deploying to production, verify that all new dashboard components display accurate data by comparing against known values and manual calculations.

### Step-by-Step Verification Process

#### 1.1 Contractor-Type Heatmap Verification

**What to verify:**
- Trade type counts match expected values
- Identification percentages are correct
- EBA percentages are calculated correctly
- Gap calculations (identified % - EBA %) are accurate

**How to verify:**

1. **Manual Count Check:**
   ```sql
   -- Get actual counts per trade type
   SELECT 
     tt.code as trade_type,
     COUNT(DISTINCT pa.id) as identified_count,
     COUNT(DISTINCT CASE WHEN eba.fwc_certified_date IS NOT NULL THEN pa.id END) as eba_count
   FROM project_assignments pa
   JOIN trade_types tt ON pa.trade_type_id = tt.id
   JOIN employers e ON pa.employer_id = e.id
   LEFT JOIN company_eba_records eba ON e.id = eba.employer_id AND eba.fwc_certified_date IS NOT NULL
   WHERE pa.assignment_type = 'trade_work'
     AND tt.code IN (SELECT trade_type FROM key_contractor_trades WHERE is_active = true)
     AND pa.project_id IN (
       SELECT id FROM projects 
       WHERE organising_universe = 'active' AND stage_class = 'construction'
     )
   GROUP BY tt.code
   ORDER BY tt.code;
   ```

2. **Compare with API Response:**
   - Visit `/api/dashboard/contractor-type-heatmap?universe=active&stage=construction`
   - Compare counts and percentages with SQL results
   - Verify percentages: `identified_count / total_slots_per_project * 100`

3. **Check Edge Cases:**
   - Empty trade types (should show 0%)
   - Trade types with 100% EBA coverage
   - Trade types with 0% identification

#### 1.2 Waffle Tiles Verification

**What to verify:**
- Total project count matches database
- Fully mapped count (builder known + ≥80% contractor ID) is correct
- EBA builder count matches expected
- Fully assured count (audit complete + green/amber) is accurate

**How to verify:**

1. **Manual Project Count:**
   ```sql
   -- Count total active projects
   SELECT COUNT(*) as total_projects
   FROM projects
   WHERE organising_universe = 'active' AND stage_class = 'construction';
   ```

2. **Fully Mapped Projects:**
   ```sql
   -- Projects with builder known + ≥80% contractor identification
   WITH project_metrics AS (
     SELECT 
       p.id,
       p.name,
       -- Check if builder is known
       CASE WHEN EXISTS (
         SELECT 1 FROM project_assignments pa
         WHERE pa.project_id = p.id
           AND pa.assignment_type = 'contractor_role'
           AND pa.is_primary_for_role = true
           AND EXISTS (
             SELECT 1 FROM contractor_role_types crt
             WHERE crt.id = pa.contractor_role_type_id AND crt.code = 'builder'
           )
       ) THEN 1 ELSE 0 END as has_builder,
       -- Count identified slots
       (
         SELECT COUNT(DISTINCT COALESCE(pa2.contractor_role_type_id::text, pa2.trade_type_id::text))
         FROM project_assignments pa2
         WHERE pa2.project_id = p.id
           AND (
             (pa2.assignment_type = 'contractor_role' AND EXISTS (
               SELECT 1 FROM contractor_role_types crt2
               WHERE crt2.id = pa2.contractor_role_type_id 
                 AND crt2.code IN ('head_contractor', 'builder')
             ))
             OR (pa2.assignment_type = 'trade_work' AND EXISTS (
               SELECT 1 FROM trade_types tt2
               WHERE tt2.id = pa2.trade_type_id
                 AND tt2.code IN (SELECT trade_type FROM key_contractor_trades WHERE is_active = true)
             ))
           )
       ) as identified_slots,
       -- Total slots (key trades + key roles)
       (SELECT COUNT(*) FROM key_contractor_trades WHERE is_active = true) + 2 as total_slots
     FROM projects p
     WHERE p.organising_universe = 'active' AND p.stage_class = 'construction'
   )
   SELECT 
     COUNT(*) as fully_mapped_count
   FROM project_metrics
   WHERE has_builder = 1
     AND total_slots > 0
     AND (identified_slots::numeric / total_slots * 100) >= 80;
   ```

3. **EBA Builder Count:**
   ```sql
   -- Projects with EBA builder
   SELECT COUNT(DISTINCT p.id) as eba_builder_count
   FROM projects p
   JOIN project_assignments pa ON pa.project_id = p.id
   JOIN contractor_role_types crt ON crt.id = pa.contractor_role_type_id
   JOIN employers e ON e.id = pa.employer_id
   JOIN company_eba_records eba ON eba.employer_id = e.id
   WHERE p.organising_universe = 'active'
     AND p.stage_class = 'construction'
     AND pa.assignment_type = 'contractor_role'
     AND pa.is_primary_for_role = true
     AND crt.code = 'builder'
     AND eba.fwc_certified_date IS NOT NULL;
   ```

4. **Compare with API:**
   - Visit `/api/dashboard/waffle-tiles?universe=active&stage=construction`
   - Verify counts match SQL results
   - Check that waffle grid squares add up to total projects

#### 1.3 Coverage vs Assurance Scatter Plot Verification

**What to verify:**
- Coverage percentages are correct (identified slots / total slots per project)
- Audit completion percentages are accurate (rated employers / total employers)
- Traffic-light ratings are assigned correctly
- Project scale (size) is appropriate

**How to verify:**

1. **Sample Project Check:**
   ```sql
   -- Get detailed metrics for a specific project
   SELECT 
     p.id,
     p.name,
     -- Coverage calculation
     (
       SELECT COUNT(DISTINCT COALESCE(pa2.contractor_role_type_id::text, pa2.trade_type_id::text))
       FROM project_assignments pa2
       WHERE pa2.project_id = p.id
         AND (
           (pa2.assignment_type = 'contractor_role' AND EXISTS (
             SELECT 1 FROM contractor_role_types crt2
             WHERE crt2.id = pa2.contractor_role_type_id 
               AND crt2.code IN ('head_contractor', 'builder')
           ))
           OR (pa2.assignment_type = 'trade_work' AND EXISTS (
             SELECT 1 FROM trade_types tt2
             WHERE tt2.id = pa2.trade_type_id
               AND tt2.code IN (SELECT trade_type FROM key_contractor_trades WHERE is_active = true)
           ))
         )
     ) as identified_slots,
     (SELECT COUNT(*) FROM key_contractor_trades WHERE is_active = true) + 2 as total_slots,
     -- Audit completion
     (
       SELECT COUNT(DISTINCT pa3.employer_id)
       FROM project_assignments pa3
       WHERE pa3.project_id = p.id
         AND pa3.employer_id IN (
           SELECT employer_id FROM employer_final_ratings WHERE is_active = true
         )
     ) as rated_employers,
     (
       SELECT COUNT(DISTINCT pa4.employer_id)
       FROM project_assignments pa4
       WHERE pa4.project_id = p.id
     ) as total_employers
   FROM projects p
   WHERE p.id = 'YOUR_PROJECT_ID_HERE'
   LIMIT 1;
   ```

2. **Compare with API:**
   - Visit `/api/dashboard/coverage-assurance-scatter?universe=active&stage=construction`
   - Find the same project in the response
   - Verify coverage % and audit completion % match SQL calculations

3. **Rating Verification:**
   ```sql
   -- Check project-level ratings
   SELECT 
     p.id,
     p.name,
     efr.final_rating,
     COUNT(*) as rating_count
   FROM projects p
   JOIN project_assignments pa ON pa.project_id = p.id
   JOIN employer_final_ratings efr ON efr.employer_id = pa.employer_id
   WHERE p.id = 'YOUR_PROJECT_ID_HERE'
     AND efr.is_active = true
   GROUP BY p.id, p.name, efr.final_rating;
   ```

#### 1.4 Progress Over Time Charts Verification

**What to verify:**
- Snapshot data exists in `dashboard_snapshots` table
- Historical values are correct
- Trends are calculated properly

**How to verify:**

1. **Check Snapshot Data:**
   ```sql
   -- View recent snapshots
   SELECT 
     snapshot_date,
     snapshot_type,
     unknown_builders,
     unidentified_slots,
     eba_builders,
     eba_contractors,
     total_projects,
     created_at
   FROM dashboard_snapshots
   WHERE snapshot_type = 'weekly'
   ORDER BY snapshot_date DESC
   LIMIT 10;
   ```

2. **Compare with Current Metrics:**
   ```sql
   -- Get current metrics to compare with latest snapshot
   SELECT 
     total_active_projects,
     known_builder_count,
     eba_projects_count,
     mapped_key_contractors,
     total_key_contractor_slots,
     key_contractors_with_eba
   FROM calculate_organizing_universe_metrics(
     p_patch_ids := NULL,
     p_tier := NULL,
     p_stage := NULL,
     p_universe := 'active',
     p_eba_filter := NULL,
     p_user_id := NULL,
     p_user_role := 'admin'
   );
   ```

3. **Manual Snapshot Creation Test:**
   - Call the snapshot function manually:
   ```sql
   SELECT create_dashboard_snapshot(CURRENT_DATE, 'weekly');
   ```
   - Verify the snapshot was created with correct values

### Verification Checklist

- [ ] Contractor-Type Heatmap: Counts match SQL queries
- [ ] Contractor-Type Heatmap: Percentages are calculated correctly
- [ ] Waffle Tiles: Total projects count matches database
- [ ] Waffle Tiles: Fully mapped count is correct
- [ ] Waffle Tiles: EBA builder count matches
- [ ] Waffle Tiles: Fully assured count is accurate
- [ ] Scatter Plot: Coverage percentages are correct
- [ ] Scatter Plot: Audit completion percentages are accurate
- [ ] Scatter Plot: Traffic-light ratings are assigned correctly
- [ ] Progress Over Time: Snapshot data exists
- [ ] Progress Over Time: Historical trends are correct
- [ ] All components: Mobile responsiveness verified
- [ ] All components: Filter integration works correctly

---

## 2. Deploy the Dashboard Worker with Weekly Snapshot Job

### Overview
Deploy the updated dashboard worker to Railway with the weekly snapshot scheduling functionality.

### Prerequisites

1. **Railway Account & Project Access**
   - Access to Railway dashboard
   - Permissions to deploy to `cfmeu-dashboard-worker` service

2. **Environment Variables**
   - Ensure `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY` are set
   - Optionally set `DASHBOARD_SNAPSHOT_CRON` (defaults to `'0 2 * * 1'` - Monday 2 AM)

3. **Database Migration**
   - Ensure `dashboard_snapshots` table exists (migration `20251105000000_create_dashboard_snapshots.sql`)
   - Ensure `create_dashboard_snapshot()` function exists

### Step-by-Step Deployment Process

#### 2.1 Pre-Deployment Checks

**1. Verify Local Build Works:**
```bash
cd railway_workers/cfmeu-dashboard-worker
npm install
npm run build
```

**2. Test the Snapshot Function Locally:**
```bash
# Set environment variables
export SUPABASE_URL="your_supabase_url"
export SUPABASE_SERVICE_KEY="your_service_key"
export SUPABASE_ANON_KEY="your_anon_key"

# Run the worker locally
npm run dev

# In another terminal, manually trigger a snapshot (if you add a test endpoint):
# Or test directly with SQL:
psql -d your_database -c "SELECT create_dashboard_snapshot(CURRENT_DATE, 'weekly');"
```

**3. Verify Code Changes:**
```bash
# Check that all changes are present:
git diff railway_workers/cfmeu-dashboard-worker/src/refresh.ts
git diff railway_workers/cfmeu-dashboard-worker/src/index.ts
git diff railway_workers/cfmeu-dashboard-worker/src/config.ts
```

#### 2.2 Railway Deployment

**Option A: Deploy via Railway CLI (Recommended)**

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Navigate to Worker Directory:**
   ```bash
   cd railway_workers/cfmeu-dashboard-worker
   ```

3. **Link to Railway Project:**
   ```bash
   railway link
   # Select the cfmeu-dashboard-worker service
   ```

4. **Verify Environment Variables:**
   ```bash
   railway variables
   # Ensure these are set:
   # - SUPABASE_URL
   # - SUPABASE_SERVICE_KEY
   # - SUPABASE_ANON_KEY
   # - DASHBOARD_SNAPSHOT_CRON (optional, defaults to '0 2 * * 1')
   ```

5. **Deploy:**
   ```bash
   railway up
   ```

6. **Monitor Deployment:**
   ```bash
   railway logs --follow
   ```

**Option B: Deploy via Railway Dashboard**

1. **Push Code to Git:**
   ```bash
   git add railway_workers/cfmeu-dashboard-worker/src/refresh.ts
   git add railway_workers/cfmeu-dashboard-worker/src/index.ts
   git add railway_workers/cfmeu-dashboard-worker/src/config.ts
   git commit -m "Add weekly dashboard snapshot job"
   git push origin main
   ```

2. **Railway Auto-Deploy:**
   - Railway will automatically detect the push and deploy
   - Monitor deployment in Railway dashboard

3. **Check Environment Variables:**
   - Go to Railway dashboard → `cfmeu-dashboard-worker` service
   - Navigate to "Variables" tab
   - Verify all required variables are set

#### 2.3 Post-Deployment Verification

**1. Check Worker Logs:**
```bash
railway logs --follow
# Or in Railway dashboard: Service → Logs
```

**Look for:**
```
Scheduled weekly dashboard snapshots { cron: '0 2 * * 1' }
```

**2. Test Manual Snapshot Creation:**

Create a test endpoint or use Railway's SQL console:

```sql
-- Test the snapshot function
SELECT create_dashboard_snapshot(CURRENT_DATE, 'weekly');
```

**3. Verify Snapshot was Created:**
```sql
SELECT 
  id,
  snapshot_date,
  snapshot_type,
  total_projects,
  unknown_builders,
  eba_builders,
  created_at
FROM dashboard_snapshots
WHERE snapshot_type = 'weekly'
ORDER BY created_at DESC
LIMIT 1;
```

**4. Check Worker Health:**
```bash
# Health check endpoint should still work
curl https://your-worker-url.railway.app/health
```

#### 2.4 Schedule Verification

**1. Verify Cron Schedule:**
- Check Railway logs at the scheduled time (Monday 2 AM)
- Or set a test schedule: `DASHBOARD_SNAPSHOT_CRON='*/5 * * * *'` (every 5 minutes for testing)
- Change back to `'0 2 * * 1'` after testing

**2. Monitor First Scheduled Run:**
- Wait for the scheduled time (or trigger manually)
- Check logs for:
  ```
  Creating weekly dashboard snapshot...
  ✅ Created weekly dashboard snapshot { snapshotId: '...', ms: ... }
  ```

**3. Verify Snapshot Data:**
- Check that new snapshot appears in database
- Compare snapshot values with current metrics
- Verify snapshot metadata (key_contractor_trades, patch_assignments) is captured

### Deployment Checklist

- [ ] Local build succeeds (`npm run build`)
- [ ] Code changes committed and pushed
- [ ] Railway service linked/configured
- [ ] Environment variables verified
- [ ] Deployment successful (check Railway dashboard)
- [ ] Worker logs show "Scheduled weekly dashboard snapshots"
- [ ] Manual snapshot creation test passes
- [ ] Snapshot appears in `dashboard_snapshots` table
- [ ] Snapshot data values are correct
- [ ] Health check endpoint works
- [ ] First scheduled run executes successfully (or test schedule works)

### Troubleshooting

**Issue: Worker fails to start**
- Check Railway logs for errors
- Verify all environment variables are set
- Check TypeScript compilation errors

**Issue: Snapshot function not found**
- Verify migration `20251105000000_create_dashboard_snapshots.sql` was applied
- Check database permissions for service role

**Issue: Cron schedule not working**
- Verify cron format: `'0 2 * * 1'` (Monday 2 AM)
- Check Railway timezone settings
- Test with shorter schedule first (`*/5 * * * *`)

**Issue: Snapshot values are incorrect**
- Compare with current metrics using SQL queries
- Check that `calculate_organizing_universe_metrics` function is working
- Verify key contractor trades are active

### Rollback Plan

If deployment causes issues:

1. **Revert Code:**
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Or Deploy Previous Version:**
   - Railway dashboard → Service → Deployments
   - Select previous successful deployment
   - Click "Redeploy"

3. **Disable Snapshot Job Temporarily:**
   - Set `DASHBOARD_SNAPSHOT_CRON=''` (empty string disables cron)
   - Or remove the function call from `index.ts`

---

## Summary

### Verification Summary
- **Data Accuracy**: Compare API responses with SQL queries for all components
- **Manual Calculations**: Verify percentages, counts, and aggregations
- **Edge Cases**: Test with empty data, single projects, boundary conditions

### Deployment Summary
- **Build Locally**: Ensure code compiles
- **Deploy to Railway**: Use CLI or dashboard
- **Verify**: Check logs, test snapshots, monitor first run
- **Monitor**: Watch for scheduled executions

Both processes ensure the new dashboard is production-ready and data-accurate.




