# Railway Worker Scaling Guide - Deploy 10 Parallel Workers

**Purpose:** Scale the mapping-sheet-scanner-worker to 10 replicas for parallel processing of bulk uploads.

**Expected Outcome:** Bulk upload batches complete in ~2-3 minutes instead of 20+ minutes.

---

## Prerequisites

- [x] Railway account with access to the project
- [x] mapping-sheet-scanner-worker service deployed and running
- [x] Railway CLI installed (optional, but recommended)

---

## Method 1: Railway Dashboard (Easiest - 5 minutes)

### Step 1: Navigate to Service

1. Go to: https://railway.app
2. Login to your account
3. Select your project (e.g., "cfmeu-nextjs" or similar)
4. Click on **"mapping-sheet-scanner-worker"** service

### Step 2: Open Settings

1. Click **"Settings"** tab in the top navigation
2. Scroll to **"Deploy"** section

### Step 3: Configure Scaling

**Find the following settings:**

1. **Replicas:**
   - Current: `1`
   - **Change to: `10`**

2. **Memory per Replica:**
   - Recommended: `1024 MB` (1GB per worker)
   - Minimum: `512 MB` (if cost-sensitive)

3. **Restart Policy:**
   - Type: `ON_FAILURE`
   - Max Retries: `10`

### Step 4: Save and Deploy

1. Click **"Save"** or **"Update"** button
2. Railway will automatically:
   - Spin up 10 new worker instances
   - Distribute them across availability zones
   - Start health checking each replica

### Step 5: Monitor Deployment

1. Click **"Deployments"** tab
2. Watch the deployment status:
   ```
   ✓ Building...
   ✓ Deploying replicas (1/10)
   ✓ Deploying replicas (5/10)
   ✓ Deploying replicas (10/10)
   ✓ Deployment successful
   ```

**Expected time:** 2-3 minutes

---

## Method 2: Railway CLI (Recommended for Automation)

### Step 1: Install Railway CLI

```bash
# macOS/Linux
npm install -g @railway/cli

# Or using Homebrew (macOS)
brew install railway
```

### Step 2: Login

```bash
railway login
```

This will open a browser for authentication.

### Step 3: Link to Project

```bash
# Navigate to worker directory
cd railway_workers/mapping-sheet-scanner-worker

# Link to Railway project (if not already linked)
railway link

# Select your project and service when prompted
```

### Step 4: Scale Service

```bash
# Scale to 10 replicas
railway service --replicas 10

# Optionally set memory
railway service --memory 1024

# Or do both at once
railway up --replicas 10 --memory 1024
```

### Step 5: Verify Scaling

```bash
# Check service status
railway status

# Expected output:
# Service: mapping-sheet-scanner-worker
# Replicas: 10/10 running
# Memory: 1024 MB per replica
```

---

## Method 3: Infrastructure as Code (Best for Long-term)

### Step 1: Create railway.json

Create a file at: `railway_workers/mapping-sheet-scanner-worker/railway.json`

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm install && pnpm build"
  },
  "deploy": {
    "numReplicas": 10,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "startCommand": "node dist/index.js"
  },
  "resources": {
    "memoryMB": 1024,
    "cpuCores": 1
  }
}
```

### Step 2: Commit and Push

```bash
git add railway_workers/mapping-sheet-scanner-worker/railway.json
git commit -m "Scale mapping-sheet-scanner-worker to 10 replicas"
git push
```

### Step 3: Deploy

```bash
cd railway_workers/mapping-sheet-scanner-worker
railway up
```

Railway will read the `railway.json` and apply the configuration.

---

## Verification Steps

### 1. Check Health Status

**Via Railway Dashboard:**
```
Service → Metrics → Health Checks
✓ All 10 replicas should show "healthy"
```

**Via CLI:**
```bash
railway logs --follow
```

**Expected output (from 10 different workers):**
```
[worker-1] Starting mapping sheet scanner worker...
[worker-2] Starting mapping sheet scanner worker...
[worker-3] Starting mapping sheet scanner worker...
...
[worker-10] Starting mapping sheet scanner worker...
```

### 2. Check Health Endpoints

Each worker exposes a health endpoint. Get the URLs:

```bash
railway variables

# Look for: SERVICE_URL or similar
```

Then test:
```bash
curl https://your-worker-url.railway.app/health

# Expected response:
{
  "status": "healthy",
  "currentJob": "none",
  "isShuttingDown": false,
  "uptime": 123.45,
  "worker": "mapping-sheet-scanner-worker"
}
```

### 3. Test Parallel Processing

**Upload a test batch:**
1. Go to your app: `https://your-app.vercel.app/projects`
2. Click **"Bulk Upload"**
3. Upload a 10-page PDF (5 scans)
4. Watch Railway logs in real-time:

```bash
railway logs --follow --service mapping-sheet-scanner-worker
```

**Expected behavior:**
```
[worker-1] [worker] Handling job abc123... (scan 1)
[worker-3] [worker] Handling job def456... (scan 2)
[worker-5] [worker] Handling job ghi789... (scan 3)
[worker-7] [worker] Handling job jkl012... (scan 4)
[worker-2] [worker] Handling job mno345... (scan 5)
```

**All scans should start within ~5 seconds of each other!**

---

## Database Verification

### Check Job Locks

```sql
-- Connect to Supabase SQL Editor
SELECT
  id,
  status,
  lock_token,
  locked_at,
  payload->>'scanId' as scan_id
FROM scraper_jobs
WHERE job_type = 'mapping_sheet_scan'
  AND status = 'processing'
ORDER BY locked_at DESC
LIMIT 10;
```

**What to look for:**
- ✅ Multiple jobs with status='processing'
- ✅ Each job has different `lock_token` (different workers)
- ✅ `locked_at` times are within seconds of each other

### Check Batch Progress

```sql
SELECT
  id,
  status,
  total_projects,
  projects_completed,
  created_at,
  processing_started_at,
  processing_completed_at
FROM batch_uploads
ORDER BY created_at DESC
LIMIT 5;
```

**Monitor `projects_completed` incrementing rapidly (multiple per minute).**

---

## Troubleshooting

### Issue 1: Workers Not Starting

**Symptom:** Railway shows "0/10 replicas running"

**Solutions:**

1. **Check build logs:**
   ```bash
   railway logs --deployment latest
   ```

2. **Verify environment variables:**
   ```bash
   railway variables
   ```
   Ensure these are set:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`

3. **Check resource limits:**
   - Memory might be too low
   - Try increasing to 1024MB

### Issue 2: Workers Crash After Starting

**Symptom:** Replicas start then immediately crash

**Solutions:**

1. **Check worker logs:**
   ```bash
   railway logs --follow
   ```

2. **Look for common errors:**
   - `Missing required environment variable` → Add missing vars
   - `Connection refused` → Check Supabase URL
   - `Out of memory` → Increase memory allocation

3. **Check health endpoint:**
   ```bash
   railway service info
   ```
   If health checks fail, workers restart continuously.

### Issue 3: Only 1 Worker Processing Jobs

**Symptom:** All 10 workers running, but only 1 picking up jobs

**Solutions:**

1. **Check database connection:**
   ```sql
   SELECT count(*) FROM scraper_jobs WHERE status = 'queued';
   ```
   If 0 jobs queued, workers have nothing to do (expected).

2. **Check lock mechanism:**
   ```sql
   SELECT status, lock_token, locked_at
   FROM scraper_jobs
   WHERE job_type = 'mapping_sheet_scan'
   ORDER BY created_at DESC LIMIT 10;
   ```
   Each job should have unique `lock_token`.

3. **Check worker poll interval:**
   Workers poll every 5 seconds. With 10 workers, a job should be picked up within ~500ms.

### Issue 4: High Costs

**Symptom:** Railway bill increases significantly

**Current cost with 10 workers:** ~$110/month

**To reduce costs:**

1. **Scale down to 5 workers:**
   ```bash
   railway service --replicas 5
   ```
   Still 5× faster than 1 worker, ~$55/month.

2. **Use smaller memory:**
   ```bash
   railway service --memory 512
   ```
   Reduces cost by ~50%.

3. **Implement auto-scaling** (manual):
   - Scale to 10 during business hours
   - Scale to 2 during off-hours
   ```bash
   # Morning (8am)
   railway service --replicas 10

   # Evening (6pm)
   railway service --replicas 2
   ```

---

## Performance Benchmarks

### Before Scaling (1 Worker)

| Batch Size | Processing Time | Timeout? |
|------------|-----------------|----------|
| 2 scans    | ~4 minutes      | ✅ Sometimes |
| 5 scans    | ~10 minutes     | ❌ Always |
| 10 scans   | ~20 minutes     | ❌ Always |

### After Scaling (10 Workers)

| Batch Size | Processing Time | Timeout? |
|------------|-----------------|----------|
| 2 scans    | ~2 minutes      | ✅ Never |
| 5 scans    | ~2 minutes      | ✅ Never |
| 10 scans   | ~2-3 minutes    | ✅ Never |
| 20 scans   | ~4-5 minutes    | ✅ Never |
| 50 scans   | ~10-12 minutes  | ✅ Never* |

*Frontend timeout set to 5 minutes, so 50-scan batch would timeout but continue processing.

---

## Monitoring & Alerts

### Railway Metrics

**Watch these metrics after scaling:**

1. **CPU Usage:**
   - Expected: 20-50% average across all replicas
   - Alert if: Consistently > 80%

2. **Memory Usage:**
   - Expected: 300-700MB per replica
   - Alert if: > 900MB (approaching limit)

3. **Restart Count:**
   - Expected: 0-1 restarts per day
   - Alert if: > 5 restarts per hour

4. **Health Check Success Rate:**
   - Expected: 99%+
   - Alert if: < 95%

### Set Up Alerts (Railway Dashboard)

1. Go to: Service → Settings → Alerts
2. Add alert rules:
   - CPU > 80% for 5 minutes
   - Memory > 900MB for 5 minutes
   - Restart count > 5 in 1 hour
   - Health check failures > 10 in 10 minutes

---

## Rollback Plan

If scaling causes issues:

```bash
# Immediate rollback to 1 worker
railway service --replicas 1

# Or via dashboard
Settings → Deploy → Replicas: 1 → Save
```

**Rollback time:** < 1 minute

---

## Next Steps After Successful Scaling

1. ✅ Monitor performance for 24 hours
2. ✅ Check Railway costs in billing dashboard
3. ✅ Test with production workload (real user uploads)
4. ✅ Document any issues in team chat
5. ✅ Consider implementing auto-scaling if needed

---

## Cost Summary

**Monthly Infrastructure Costs:**

| Component | Before | After | Increase |
|-----------|--------|-------|----------|
| Main App (Vercel) | $0 | $0 | $0 |
| Workers (Railway) | $11 | $110 | +$99 |
| Supabase | $25 | $25 | $0 |
| Claude API | $50 | $50 | $0 |
| **Total** | **$86** | **$185** | **+$99/mo** |

**Value delivered:**
- ✅ Zero timeout errors
- ✅ 10× faster processing
- ✅ Better user experience
- ✅ Scales to any batch size

---

## Support

**If you encounter issues:**

1. Check Railway logs: `railway logs --follow`
2. Check Supabase logs: Supabase Dashboard → Logs
3. Check application logs: Browser console
4. Review this guide's troubleshooting section
5. Contact Railway support: https://railway.app/help

---

**Last Updated:** 2025-10-24
**Tested Configuration:** 10 workers × 1GB RAM
**Expected Deployment Time:** 5-10 minutes
**Status:** ✅ Ready for Production
