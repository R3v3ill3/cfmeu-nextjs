# Railway Worker Deployment Issue Log

## Original Problem

The bulk upload scraper worker was failing mid-processing. The batch upload workflow would:
1. Successfully upload PDFs
2. Complete analysis step
3. Allow project matching
4. Initiate processing
5. Show 50% progress
6. Stall indefinitely with no errors in the UI

## Railway Logs - Original Error

```
Stopping Container

npm error path /app
npm error command failed
npm error signal SIGTERM
npm error command sh -c node dist/index.js
npm error A complete log of this run can be found in: /root/.npm/_logs/2025-11-10T23_33_35_753Z-debug-0.log

npm error path /app
npm error command failed
npm error signal SIGTERM
npm error command sh -c node dist/index.js
npm error A complete log of this run can be found in: /root/.npm/_logs/2025-11-10T23_33_37_312Z-debug-0.log

[multiple similar SIGTERM errors repeated]
```

## Deployment Context

**Environment:**
- Local development: All apps (main + workers) run locally with managed ports
- Production: 
  - Main app hosted on Vercel
  - Workers hosted on Railway
  - Railway and Vercel manage their own ports dynamically

**Workers affected:**
- `mapping-sheet-scanner-worker` (the one failing on bulk uploads)
- `cfmeu-scraper-worker` (FWC web scraping)

**Note:** There is also a `cfmeu-dashboard-worker` which is an API server (not a pure background worker) that runs successfully.

## Changes Made - Attempt 1: Increase Graceful Shutdown Timeout

**Files modified:**
- `railway_workers/mapping-sheet-scanner-worker/src/config.ts`
- `railway_workers/mapping-sheet-scanner-worker/src/index.ts`
- `railway_workers/cfmeu-scraper-worker/src/config.ts`
- `railway_workers/cfmeu-scraper-worker/src/index.ts`

**Changes:**
- Added `gracefulShutdownTimeoutMs` configuration (150s for scanner, 300s for scraper)
- Updated graceful shutdown handler to use new timeout instead of hardcoded 30s
- Enhanced logging with visual indicators and timing information

**Result:** Code compiled successfully, pushed to Railway

## Railway Response - Attempt 1

Health check failure:
```
====================
Starting Healthcheck
====================
Path: /health
Retry window: 30s

Attempt #1 failed with service unavailable. Continuing to retry for 19s
Attempt #2 failed with service unavailable. Continuing to retry for 8s

5/5 replicas never became healthy!

Healthcheck failed!
```

## Changes Made - Attempt 2: Add Railway Health Check Configuration

**Files modified:**
- `railway_workers/mapping-sheet-scanner-worker/railway.toml`
- `railway_workers/mapping-sheet-scanner-worker/Dockerfile`
- `railway_workers/cfmeu-scraper-worker/railway.toml`

**Changes:**
- Added health check configuration to `railway.toml`:
  ```toml
  healthcheckPath = "/health"
  healthcheckTimeout = 30
  initialDelay = 30
  ```
- Added PORT environment variable and EXPOSE directive to Dockerfile
- Added PORT configuration to railway.toml production environment

**Result:** Deployed to Railway

## Railway Response - Attempt 2

Same health check failure as Attempt 1.

## User Clarification

User explained the deployment context:
- Railway manages ports dynamically via `PORT` environment variable
- Should not hardcode or override port management for Railway deployment
- Local development uses specific ports (3210, 3200) for testing

## Changes Made - Attempt 3: Use Railway Dynamic PORT

**Files modified:**
- `railway_workers/mapping-sheet-scanner-worker/src/index.ts`
- `railway_workers/mapping-sheet-scanner-worker/railway.toml`
- `railway_workers/mapping-sheet-scanner-worker/Dockerfile`
- `railway_workers/cfmeu-scraper-worker/src/index.ts`
- `railway_workers/cfmeu-scraper-worker/railway.toml`

**Changes:**
- Changed port resolution: `Number(process.env.PORT || process.env.HEALTH_PORT || 3210)`
- Removed PORT override from railway.toml
- Removed EXPOSE and ENV from Dockerfile

**Result:** Deployed to Railway

## Railway Response - Attempt 3

Same health check failure, worker shutting down immediately after start.

## Changes Made - Attempt 4: Bind to 0.0.0.0

**Files modified:**
- `railway_workers/mapping-sheet-scanner-worker/src/index.ts`
- `railway_workers/cfmeu-scraper-worker/src/index.ts`

**Changes:**
- Changed `app.listen(HEALTH_PORT, () => {...})` to `app.listen(HEALTH_PORT, '0.0.0.0', () => {...})`
- Added to bind to all network interfaces instead of localhost only

**Result:** Deployed to Railway

## Railway Response - Attempt 4

Logs showed:
```
> mapping-sheet-scanner-worker@1.0.0 start
> node dist/index.js

[dotenv@17.2.3] injecting env (0) from .env
[supabase] Admin client initialized (singleton pattern, REST API)
[worker] Starting mapping sheet scanner worker with graceful shutdown support
[health] Health check endpoint listening on port 8080

Stopping Container

npm error path /app
npm error command failed
npm error signal SIGTERM
npm error command sh -c node dist/index.js
npm error A complete log of this run can be found in: /root/.npm/_logs/2025-11-11T00_56_21_291Z-debug-0.log

[multiple similar SIGTERM errors repeated]
```

Health endpoint started successfully on port 8080, but container still being killed.

## Changes Made - Attempt 5: Add Verbose Health Check Logging

**Files modified:**
- `railway_workers/mapping-sheet-scanner-worker/src/index.ts`
- `railway_workers/cfmeu-scraper-worker/src/index.ts`

**Changes:**
- Added middleware to log all incoming requests
- Added explicit logging in health check handler
- Added explicit status code (200) to response
- Added catch-all route handler for 404s
- Enhanced startup logging

**Result:** Deployed to Railway

## Railway Response - Attempt 5

Logs showed:
```
[health] Health check URL: http://0.0.0.0:8080/health
[health] Health check endpoint listening on 0.0.0.0:8080
[supabase] Admin client initialized (singleton pattern, REST API)
[worker] Starting mapping sheet scanner worker with graceful shutdown support

[health] Incoming request: GET /health from 100.64.0.2
[health] Health check requested
[health] Responding with: {
  status: 'healthy',
  currentJob: 'none',
  isShuttingDown: false,
  uptime: 0,
  uptimeHuman: '0m 0s',
  worker: 'mapping-sheet-scanner-worker',
  config: {
    claudeTimeoutMs: 60000,
    gracefulShutdownTimeoutMs: 150000,
    pollIntervalMs: 5000
  }
}

Stopping Container

npm error path /app
npm error command failed
npm error signal SIGTERM
npm error command sh -c node dist/index.js

[Later in logs]

[health] Incoming request: GET /health from 100.64.0.2
[health] Health check requested
[health] Responding with: {
  status: 'healthy',
  currentJob: 'none',
  isShuttingDown: false,
  uptime: 10,
  uptimeHuman: '0m 10s',
  worker: 'mapping-sheet-scanner-worker',
  config: {
    claudeTimeoutMs: 60000,
    gracefulShutdownTimeoutMs: 150000,
    pollIntervalMs: 5000
  }
}

npm error path /app
npm error command failed
npm error signal SIGTERM
```

Health checks are reaching the endpoint successfully and receiving 200 responses with `status: 'healthy'`, but Railway is still killing the container with SIGTERM.

## Changes Made - Attempt 6: Remove Health Endpoints Entirely

**Files modified:**
- `railway_workers/mapping-sheet-scanner-worker/src/index.ts`
- `railway_workers/mapping-sheet-scanner-worker/railway.toml`
- `railway_workers/cfmeu-scraper-worker/src/index.ts`
- `railway_workers/cfmeu-scraper-worker/railway.toml`

**Changes:**
- Removed all Express HTTP server code
- Removed `express` import
- Removed health check configuration from `railway.toml`
- Workers are now pure background processes with no HTTP endpoints

**Current state:** Code compiled successfully, ready for deployment

## Changes Made - Attempt 7: Add Health Check Endpoint

**Root Cause Hypothesis:**
Railway requires background workers to expose a health check endpoint. Without it, Railway's health check system cannot verify the container is alive and kills it with SIGTERM. The `cfmeu-dashboard-worker` works because it has an Express server with a `/health` endpoint.

**Files modified:**
- `railway_workers/mapping-sheet-scanner-worker/src/index.ts`
- `railway_workers/mapping-sheet-scanner-worker/railway.toml`
- `src/app/api/projects/batch-upload/[batchId]/status/route.ts` (bonus fix for total_scans)

**Changes:**
1. **Added Express HTTP server** with `/health` endpoint:
   - Immediate 200 OK response (no database checks to avoid delays)
   - Returns worker status, current job, uptime
   - Binds to `0.0.0.0` on Railway's dynamic PORT (8080 in production)
   - Added request logging to debug Railway's health checks
   - Added root `/` endpoint for Railway's initial check
   - Error handling ensures always returns 200 OK
   
2. **Configured Railway health check** in `railway.toml`:
   ```toml
   healthcheckPath = "/health"
   healthcheckTimeout = 30
   initialDelay = 30
   ```

3. **Fixed batch status endpoint** to include `total_scans` field (frontend compatibility)

4. **Enhanced graceful shutdown** to close HTTP server before exit

5. **Server startup order**: Worker loop starts only after HTTP server is ready

**Result:** Health endpoint is working perfectly - Railway successfully hits `/health` and receives 200 OK responses with `status: 'healthy'`. However, Railway is still killing containers with SIGTERM despite successful health checks.

**Evidence from logs:**
```
[health] Incoming request: GET /health from 100.64.0.2
[health] Health check requested
[health] Responding with: {
  status: 'healthy',
  currentJob: 'none',
  isShuttingDown: false,
  uptime: 3.559423198,
  uptimeHuman: '0m 3s',
  worker: 'mapping-sheet-scanner-worker'
}
[Then Railway sends SIGTERM and kills container]
```

**Conclusion:** The health endpoint code is correct and working. Railway is successfully checking it and getting healthy responses. The issue appears to be with Railway's health check configuration not being applied, or Railway requires health check configuration to be set in the Railway Dashboard UI rather than (or in addition to) `railway.toml`.

## Current File States

### mapping-sheet-scanner-worker/railway.toml
```toml
[deploy]
startCommand = "npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

# Health check configuration
# Railway will check /health endpoint to ensure container is alive
healthcheckPath = "/health"
healthcheckTimeout = 30
initialDelay = 30
```

### mapping-sheet-scanner-worker/src/index.ts
- Express HTTP server with `/health` endpoint
- Binds to Railway's PORT env var (or 3210 for local dev)
- Health check performs lightweight database connectivity test
- Graceful shutdown closes HTTP server
- Background worker polling for jobs continues as before
- Graceful shutdown timeout: 150 seconds

### cfmeu-scraper-worker/railway.toml
```toml
[deploy]
startCommand = "npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

### cfmeu-scraper-worker/src/index.ts
- No HTTP server (may need same fix if experiencing issues)
- No port binding
- Pure background worker polling for jobs
- Graceful shutdown timeout: 300 seconds

## Other Workers for Reference

### cfmeu-dashboard-worker
- **Type:** API server with background jobs
- **Status:** Running successfully on Railway
- **Characteristics:**
  - Has Express HTTP server with `/health` endpoint
  - Exposes PORT
  - Has CORS configuration
  - Serves HTTP endpoints for caching and dashboard data
  - Also runs background cron jobs

## Timeline Summary

1. **Original issue:** Worker processes being killed with SIGTERM, jobs re-queuing infinitely
2. **Attempt 1:** Increased graceful shutdown timeout → Health check failures
3. **Attempt 2:** Added health check config → Same health check failures
4. **Attempt 3:** Used Railway dynamic PORT → Same health check failures
5. **Attempt 4:** Bind to 0.0.0.0 → Health endpoint started but container still killed
6. **Attempt 5:** Added logging → Health checks successful (200 OK) but container still killed
7. **Attempt 6:** Removed health endpoints entirely → Containers still killed (Railway requires health checks)
8. **Attempt 7:** Added Express health check endpoint → Health checks working perfectly, but Railway still kills containers

**Current Status:** Health endpoint code is correct and Railway successfully checks it. Issue appears to be Railway configuration not being applied from `railway.toml`, or requires Dashboard UI configuration.

## Key Observations

1. ✅ Health checks are successfully responding with 200 OK and `status: 'healthy'`
2. ❌ Railway is still sending SIGTERM to kill containers despite successful health checks
3. ✅ Worker logs show normal startup sequence and successful health check responses
4. ✅ The `cfmeu-dashboard-worker` (which is an API server) runs successfully with health checks
5. ✅ Health endpoint is being hit by Railway (IP: 100.64.0.2) and responding correctly
6. ❌ Railway's health check configuration in `railway.toml` may not be applied automatically
7. ⚠️ Railway may require health check configuration to be set in Dashboard UI

## Next Steps / Recommendations

### Option 1: Configure Health Check in Railway Dashboard (RECOMMENDED)

Railway's `railway.toml` health check configuration may not be automatically applied. Try configuring it in the Railway Dashboard:

1. Go to Railway Dashboard → Your Service → Settings
2. Find "Health Check" or "Deploy" section
3. Set:
   - **Health Check Path**: `/health`
   - **Health Check Timeout**: 30 seconds
   - **Initial Delay**: 30 seconds
4. Save and redeploy

### Option 2: Use railway.json Instead of railway.toml

Railway may prefer `railway.json` format. Create `railway_workers/mapping-sheet-scanner-worker/railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "initialDelay": 30
  }
}
```

### Option 3: Check Railway Service Type

Railway may treat background workers differently. Verify:
- Service type is set to "Web Service" (not "Background Worker")
- Service has proper resource allocation
- No conflicting health check settings in Dashboard

### Option 4: Contact Railway Support

Since health checks are working but containers are still being killed, this may be a Railway platform issue. Contact Railway support with:
- Service logs showing successful health checks
- Railway service configuration
- Question: "Why are containers being killed despite successful `/health` endpoint responses?"

### Option 5: Alternative Architecture

If Railway continues to kill background workers, consider:
- Running worker as part of main Next.js app (serverless functions)
- Using Railway's cron job feature instead of long-running workers
- Using a different platform (e.g., Fly.io, Render) that better supports background workers

