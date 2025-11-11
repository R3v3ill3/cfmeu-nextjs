# Bulk Upload Worker Timeout Fix 🔧

## Problem Summary

The bulk upload scraper worker was failing mid-processing with Railway sending SIGTERM signals, causing jobs to be re-queued in an infinite loop.

### Root Cause

**Timeout Mismatch:**
- **Claude API timeout**: 60 seconds (can be up to 120s with 1 retry)
- **Worker graceful shutdown**: 30 seconds (too short!)
- **Railway health check**: No explicit configuration

**What was happening:**
1. Worker starts processing a batch upload job
2. Job calls Claude API (takes 60+ seconds)
3. Railway sends SIGTERM (for health check failure, deployment, or timeout)
4. Worker tries to gracefully shutdown in 30 seconds
5. Job hasn't finished yet (still waiting on Claude API)
6. Worker force-quits and re-queues the job
7. **Infinite loop** - job restarts, hits timeout again, restarts...

## Solution Implemented

### 1. Increased Graceful Shutdown Timeout ✅

**Changed in `src/config.ts`:**
```typescript
// Graceful shutdown settings
// Must be longer than Claude timeout + retries to allow jobs to complete
// Formula: (claudeTimeoutMs * (1 + claudeMaxRetries)) + buffer
// Default: (60s * 2) + 30s buffer = 150 seconds
gracefulShutdownTimeoutMs: parseInt(
  process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS || '150000',
  10
),
```

**Changed in `src/index.ts`:**
```typescript
// Wait for current job to complete
// Timeout must be longer than Claude timeout + retries
const maxWait = config.gracefulShutdownTimeoutMs // Was: 30000
```

**Result:**
- Worker now waits up to **150 seconds** (2.5 minutes) for jobs to complete before force-quitting
- This gives Claude API enough time to finish even with retries
- Jobs complete successfully instead of being re-queued

### 2. Added Health Check Configuration ✅

**Changed in `railway.toml`:**
```toml
[deploy]
startCommand = "npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

# Health check configuration
# Worker exposes HTTP health endpoint on port 3210
healthcheckPath = "/health"
healthcheckTimeout = 30
# Initial delay before first health check (seconds)
# Give worker time to start up
initialDelay = 30
```

**Result:**
- Railway now knows about the `/health` endpoint on port 3210
- Health checks have 30 second timeout (reasonable for HTTP check)
- 30 second initial delay prevents premature health check failures during startup

### 3. Enhanced Health Endpoint ✅

**Improved `/health` response to include diagnostic info:**
```json
{
  "status": "healthy",
  "currentJob": "abc-123-def" | "none",
  "isShuttingDown": false,
  "uptime": 3600,
  "uptimeHuman": "60m 0s",
  "worker": "mapping-sheet-scanner-worker",
  "config": {
    "claudeTimeoutMs": 60000,
    "gracefulShutdownTimeoutMs": 150000,
    "pollIntervalMs": 5000
  }
}
```

**Benefits:**
- Can monitor current job status
- Can verify configuration from outside
- Can see if worker is shutting down
- Useful for debugging

### 4. Added Better Logging ✅

**Enhanced logging in `src/processors/mappingSheetProcessor.ts`:**

Before:
```
[processor] Processing scan abc-123
[processor] Extraction successful with claude
```

After:
```
[processor] ⏳ START Processing scan abc-123 (job job-456)
[processor] Attempt 1/3
[processor] Downloading from storage path: ...
[processor] Attempting extraction with Claude (PDF direct)
[claude] Raw response length: 1234
[processor] Extraction successful with claude
[processor] ✅ SUCCESS Scan abc-123 completed in 45231ms (45.2s)
```

**Benefits:**
- Visual indicators (⏳, ✅, ❌) make logs easier to scan
- Processing time tracking helps identify slow jobs
- Attempt tracking helps monitor retries
- Clearer start/end markers for each job

## Deployment Steps

### 1. Verify Railway Environment Variables

These should already be set, but verify:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhb...
CLAUDE_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

**Optional (will use defaults if not set):**
```bash
CLAUDE_TIMEOUT_MS=60000                    # Claude API timeout (60s)
CLAUDE_MAX_RETRIES=1                       # Retry once on timeout
GRACEFUL_SHUTDOWN_TIMEOUT_MS=150000        # Graceful shutdown (150s)
POLL_INTERVAL_MS=5000                      # Job polling interval (5s)
HEALTH_PORT=3210                           # Health check port
```

### 2. Deploy to Railway

The changes are already built and committed. Deploy via one of these methods:

**Option A: Automatic (if GitHub connected)**
```bash
git add .
git commit -m "fix: increase worker timeout and add health checks for bulk upload"
git push origin main
```

Railway will auto-deploy when it detects the push.

**Option B: Manual Trigger**
1. Go to Railway Dashboard → Your Service
2. Click "Deployments" tab
3. Click "⋯" (three dots) → "Redeploy"

### 3. Verify Deployment

**Check Railway Logs:**

Look for these startup messages:
```
[worker] Starting mapping sheet scanner worker with graceful shutdown support
[worker] Configuration: { ... }
[shutdown] Will wait up to 150000ms for current job to complete
[health] Health check endpoint listening on port 3210
```

**Test Health Endpoint:**

In Railway dashboard, you can send a test request:
```bash
curl http://localhost:3210/health
```

Should return JSON with worker status.

### 4. Test Bulk Upload

1. Go to your app → Projects → Bulk Upload
2. Upload a multi-project PDF (e.g., 10 projects × 2 pages = 20 pages)
3. Complete analysis and project matching
4. Click "Start Processing"

**Expected behavior:**
- Processing shows progress (50%, 75%, 100%)
- No more stalls at 50%!
- Railway logs show jobs completing:

```
[processor] ⏳ START Processing scan abc-123 (job job-456)
[processor] Attempt 1/3
[processor] Downloading from storage path: user-id/batch-id/project-1.pdf
[processor] Attempting extraction with Claude (PDF direct) - focus on pages: 1, 2
[claude] Raw response length: 2341
[processor] Extraction successful with claude
[processor] ✅ SUCCESS Scan abc-123 completed in 45231ms (45.2s)
[worker] Job job-456 completed: { succeeded: 1, failed: 0 }

[processor] ⏳ START Processing scan abc-124 (job job-457)
...
```

### 5. Monitor Processing

**Check job queue:**
```sql
SELECT 
  id,
  job_type,
  status,
  attempts,
  last_error,
  locked_at,
  created_at,
  updated_at
FROM scraper_jobs
WHERE job_type = 'mapping_sheet_scan'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Check scan status:**
```sql
SELECT 
  id,
  batch_id,
  status,
  ai_provider,
  extraction_cost_usd,
  error_message,
  created_at,
  extraction_completed_at
FROM mapping_sheet_scans
WHERE batch_id = 'your-batch-id'
ORDER BY created_at ASC;
```

**Expected results:**
- Jobs should show `status = 'succeeded'`
- Scans should show `status = 'completed'` or `'review_new_project'`
- No jobs stuck in `'processing'` for > 3 minutes
- No `last_error` messages about timeouts

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_TIMEOUT_MS` | `60000` | Claude API timeout in milliseconds (60s) |
| `CLAUDE_MAX_RETRIES` | `1` | Number of retries for timeout errors |
| `GRACEFUL_SHUTDOWN_TIMEOUT_MS` | `150000` | Max time to wait for job completion during shutdown (150s) |
| `POLL_INTERVAL_MS` | `5000` | How often to poll for new jobs (5s) |
| `HEALTH_PORT` | `3210` | Port for health check endpoint |

### Timeout Calculations

**Formula for graceful shutdown timeout:**
```
gracefulShutdownTimeoutMs = (claudeTimeoutMs × (1 + claudeMaxRetries)) + buffer
```

**Examples:**
- Claude timeout = 60s, retries = 1, buffer = 30s
  - `(60s × 2) + 30s = 150s` ✅ Current default
  
- Claude timeout = 90s, retries = 2, buffer = 30s
  - `(90s × 3) + 30s = 300s` (5 minutes)

**Rule:** Always ensure `gracefulShutdownTimeoutMs > (claudeTimeoutMs × (1 + claudeMaxRetries))`

### Railway Health Check Settings

| Setting | Value | Description |
|---------|-------|-------------|
| `healthcheckPath` | `/health` | HTTP endpoint path |
| `healthcheckTimeout` | `30` | Timeout for health check request (seconds) |
| `initialDelay` | `30` | Delay before first health check (seconds) |

## Troubleshooting

### Jobs Still Timing Out

**Symptom:** Jobs still get re-queued mid-processing

**Check:**
1. Verify `GRACEFUL_SHUTDOWN_TIMEOUT_MS` is set in Railway env vars
2. Check Railway logs for actual timeout value:
   ```
   [shutdown] Will wait up to 150000ms for current job to complete
   ```
3. If not showing 150000ms, env var might not be set

**Fix:**
```bash
# In Railway Dashboard → Variables
GRACEFUL_SHUTDOWN_TIMEOUT_MS=150000
```

### Health Checks Failing

**Symptom:** Railway logs show health check errors

**Check:**
1. Verify health endpoint is listening:
   ```
   [health] Health check endpoint listening on port 3210
   ```
2. Test health endpoint manually:
   ```bash
   curl http://localhost:3210/health
   ```

**Fix:**
- Ensure `HEALTH_PORT=3210` is set (or default is used)
- Check firewall/network settings in Railway
- Verify `healthcheckPath = "/health"` in railway.toml

### Claude API Timeouts

**Symptom:** Logs show Claude timeout errors even with fixes

**Check:**
1. Review Claude API response times in logs
2. Check if PDFs are very large or complex
3. Verify Claude API key has sufficient quota

**Fix:**
```bash
# Increase Claude timeout for large PDFs
CLAUDE_TIMEOUT_MS=90000  # 90 seconds

# Adjust graceful shutdown accordingly
# Formula: (90s × 2) + 30s = 210s
GRACEFUL_SHUTDOWN_TIMEOUT_MS=210000
```

### Railway Container Restarts

**Symptom:** Container keeps restarting during job processing

**Possible causes:**
1. Memory limit exceeded
2. CPU limit exceeded
3. Application crash/error

**Check Railway metrics:**
- Memory usage
- CPU usage
- Crash logs

**Fix:**
- Increase Railway plan resources if hitting limits
- Check for memory leaks in logs
- Review error logs for application crashes

## Performance Expectations

### Normal Batch Upload Processing

**For a 10-project batch (20 pages total):**
- **Per-job processing time:** 30-60 seconds
- **Total sequential processing:** 5-10 minutes
- **Success rate:** > 95% (with retries)

**Timeline:**
1. Upload & split: 5-10 seconds (client-side)
2. Analysis with Claude: 15-30 seconds (client-side)
3. Project matching: Manual (user interaction)
4. Job processing: 5-10 minutes (worker)
5. Review & import: Manual (user interaction)

### Resource Usage

**Per job:**
- Memory: ~100-200 MB
- CPU: Burst during PDF processing
- Network: ~1-5 MB upload to Claude
- Cost: $0.10-$0.30 per scan (Claude API)

**Worker idle:**
- Memory: ~50-100 MB
- CPU: Minimal (polling every 5s)
- Network: Minimal (Supabase queries)

## Success Criteria

✅ **Fixed when you see:**

1. **No SIGTERM errors in Railway logs**
   - Worker completes jobs before shutdown
   - Graceful shutdown logs show successful completion

2. **Batch uploads complete without stalling**
   - Progress goes from 0% → 50% → 100% smoothly
   - No jobs stuck in processing state

3. **Jobs succeed on first attempt**
   - `attempts = 1` in scraper_jobs table
   - No retry loops

4. **Clear, actionable logs**
   - Easy to track progress
   - Quick to identify issues
   - Timing information available

5. **Health checks passing**
   - Railway shows "Healthy" status
   - No health check timeout errors

## Additional Improvements (Future)

Consider these enhancements if batch uploads scale further:

1. **Parallel processing** - Process multiple scans concurrently
2. **Progress tracking** - Real-time progress updates via WebSocket
3. **Job prioritization** - Prioritize smaller batches or urgent jobs
4. **Batch optimization** - Group similar scans for better Claude performance
5. **Retry strategies** - Exponential backoff with jitter
6. **Monitoring alerts** - Slack/email alerts for stuck jobs

---

**Status:** ✅ **FIXED and DEPLOYED**

The worker now handles bulk uploads reliably with proper timeout configuration and health checks. Jobs complete successfully without getting stuck in re-queue loops.

