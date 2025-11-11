# Worker Timeout Fix - Quick Start Guide 🚀

## Problem Fixed
Railway workers were getting killed mid-job, causing infinite re-queue loops.

## What Changed
- ✅ **Mapping Sheet Scanner:** Graceful shutdown timeout 30s → 150s (2.5 min)
- ✅ **CFMEU Scraper:** Graceful shutdown timeout 30s → 300s (5 min)
- ✅ Both workers: Added Railway health check configuration
- ✅ Both workers: Enhanced logging and health endpoints

---

## Deploy Now (Choose One Method)

### Method A: Git Push (Recommended)
```bash
git add .
git commit -m "fix: increase worker timeouts and add health checks"
git push origin main
```

Railway auto-deploys if connected to GitHub.

### Method B: Manual Redeploy
1. Railway Dashboard → mapping-sheet-scanner-worker → Deployments
2. Click "⋯" → "Redeploy"
3. Repeat for cfmeu-scraper-worker

---

## Verify Deployment (3 Steps)

### 1. Check Logs
Look for these lines in Railway logs:

**Mapping Sheet Scanner:**
```
[shutdown] Will wait up to 150000ms for current job to complete
[health] Health check endpoint listening on port 3210
```

**CFMEU Scraper:**
```
[shutdown] Will wait up to 300000ms (300s) for current job to complete
[health] Health check endpoint listening on port 3200
```

### 2. Test Bulk Upload
1. Go to Projects → Bulk Upload
2. Upload multi-project PDF
3. Complete analysis and matching
4. Click "Start Processing"
5. ✅ Should reach 100% without stalling

### 3. Test FWC Scraping
1. Go to Employers → Select employers
2. Click "Sync FWC"
3. ✅ Should complete without errors

---

## Success Indicators

✅ **Working if you see:**
- Progress bars complete to 100%
- No SIGTERM errors in Railway logs
- Jobs show `succeeded` status in database
- No container restarts during processing

❌ **Still broken if you see:**
- Progress stalls at 50%
- SIGTERM errors in logs
- Jobs stuck in `processing` status
- Container keeps restarting

---

## Troubleshooting

### Jobs Still Timing Out?

**Check env vars in Railway:**
```bash
# Optional - only set if you need different values
GRACEFUL_SHUTDOWN_TIMEOUT_MS=150000  # Scanner
GRACEFUL_SHUTDOWN_TIMEOUT_MS=300000  # Scraper
```

### Health Checks Failing?

**Verify Railway settings:**
- Settings → Root Directory: `railway_workers/mapping-sheet-scanner-worker`
- Settings → Root Directory: `railway_workers/cfmeu-scraper-worker`
- Both should auto-detect Dockerfile or railway.toml

---

## Quick Reference

| Worker | Port | Timeout | Job Type |
|--------|------|---------|----------|
| mapping-sheet-scanner | 3210 | 150s | PDF analysis with Claude |
| cfmeu-scraper | 3200 | 300s | FWC web scraping |

---

## Need More Info?

📖 **Full Documentation:**
- [Complete Fix Summary](WORKER_TIMEOUT_FIX_SUMMARY.md)
- [Mapping Sheet Scanner Details](railway_workers/mapping-sheet-scanner-worker/BULK_UPLOAD_TIMEOUT_FIX.md)
- [CFMEU Scraper Retry Logic](railway_workers/cfmeu-scraper-worker/RETRY_SUMMARY.md)

---

**That's it!** Deploy, verify logs, and test. Should work immediately. 🎉

