# Railway Deployment Guide: Mapping Sheet Scanner Worker

## ✅ Code Review Summary

I've completed an in-depth review of the mapping-sheet-scanner-worker. Here's what I found:

### 🔧 Critical Issues Fixed

1. **Missing Dependencies** ✅ FIXED
   - The worker code imports `pdfjs-dist`, `canvas`, `sharp`, and `openai` but these were **NOT** in package.json
   - Added all missing dependencies:
     - `canvas: ^2.11.2` - Required for PDF-to-image conversion
     - `pdfjs-dist: ^3.11.174` - Required for PDF parsing
     - `sharp: ^0.33.2` - Required for image optimization
     - `openai: ^4.28.0` - Required for OpenAI fallback provider

### ⚠️ Environment Variable Issue

You mentioned setting `SUPABASE_ANON_KEY`, but the worker **does not use** this variable. 

**Required Environment Variables:**
- ✅ `SUPABASE_URL` - Correct
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Correct (NOT anon key!)
- ✅ `CLAUDE_API_KEY` (or `ANTHROPIC_API_KEY`) - Correct
- ✅ `OPENAI_API_KEY` - Correct

**You can remove:** `SUPABASE_ANON_KEY` (not used)

### 📋 Railway Configuration

Your Railway setup looks good:
- ✅ Root directory: `railway_workers/mapping-sheet-scanner-worker`
- ✅ Build method: Dockerfile (specified in railway.toml)
- ✅ Environment variables (except the anon key issue above)

## 🚀 Deployment Checklist

### 1. Update Dependencies (Required!)

**Before deploying**, you need to install the newly added dependencies:

```bash
cd railway_workers/mapping-sheet-scanner-worker
npm install
```

This will create a `package-lock.json` file which Railway will use for consistent builds.

**Option 2:** Commit the updated `package.json` and let Railway install on build (slower but works).

### 2. Railway Environment Variables

In your Railway dashboard, ensure these are set:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhb... (service role key, NOT anon key)
CLAUDE_API_KEY=sk-ant-... (Anthropic API key)
OPENAI_API_KEY=sk-... (OpenAI API key for fallback)
```

**Optional variables:**
```
POLL_INTERVAL_MS=5000 (default: 5000ms)
MAX_RETRIES=3 (default: 3)
```

### 3. Database Requirements

The worker requires these database tables (should already exist from migrations):
- ✅ `scraper_jobs` - Job queue table
- ✅ `mapping_sheet_scans` - Scan records
- ✅ `mapping_sheet_scan_costs` - Cost tracking
- ✅ `mapping_sheet_scan_employer_matches` - Employer matching

**Storage bucket:**
- ✅ `mapping-sheet-scans` - Must exist in Supabase Storage

### 4. How the Worker Connects to Main App

The worker operates **independently** and communicates via the database:

1. **Main App (Vercel)** → Creates jobs in `scraper_jobs` table
   - Job type: `mapping_sheet_scan`
   - Payload includes: scanId, fileUrl, fileName, selectedPages

2. **Worker (Railway)** → Polls `scraper_jobs` table every 5 seconds
   - Reserves queued jobs with status = 'queued'
   - Downloads PDF from Supabase Storage
   - Processes with Claude AI
   - Updates `mapping_sheet_scans` table with results

3. **Main App (Vercel)** → Polls `mapping_sheet_scans` for status updates
   - Shows extracted data in review UI
   - No direct HTTP connection needed!

### 5. Testing the Deployment

**After deploying to Railway:**

1. Check Railway logs to see if the worker starts:
   ```
   [worker] Starting mapping sheet scanner worker
   [worker] Configuration: { supabaseUrl: '...', pollIntervalMs: 5000, ... }
   ```

2. Upload a test scan via your Vercel app:
   - Go to any project → "Upload Mapping Sheet"
   - Upload a test PDF
   - Watch Railway logs for processing

3. Expected log sequence:
   ```
   [jobs] Found 1 queued mapping sheet scan jobs
   [jobs] Attempting to lock job <uuid>
   [jobs] Successfully locked job <uuid>
   [worker] Handling job <uuid> (mapping_sheet_scan)
   [processor] Processing scan <scanId>
   [processor] Attempting extraction with Claude (PDF direct)
   [claude] Raw response length: ...
   [processor] Extraction successful with claude
   [worker] Job <uuid> completed: { succeeded: 1, failed: 0 }
   ```

### 6. Health Checks

**Monitor these:**

1. **Railway Logs:**
   - Should see polling messages every 5 seconds when idle
   - No error messages about missing dependencies
   - Successful job processing when scans are uploaded

2. **Supabase Database:**
   - Check `scraper_jobs` table for stuck jobs (status = 'processing' for > 5 minutes)
   - Check `mapping_sheet_scans` for failed scans (status = 'failed')
   - Check `mapping_sheet_scan_costs` to monitor AI API costs

3. **Cost Monitoring:**
   - Query costs: `SELECT SUM(cost_usd) FROM mapping_sheet_scan_costs WHERE created_at > NOW() - INTERVAL '7 days'`
   - Average per scan: $0.10 - $0.30 (3 pages)

## 🔍 Architecture Overview

```
┌─────────────────┐
│  Vercel App     │
│  (Next.js)      │
└────────┬────────┘
         │
         │ Creates job in scraper_jobs
         │ Uploads PDF to Supabase Storage
         ▼
┌─────────────────────────────────────┐
│     Supabase (Shared Database)      │
│  • scraper_jobs (queue)             │
│  • mapping_sheet_scans (results)    │
│  • Storage: mapping-sheet-scans     │
└─────────┬───────────────────────────┘
          │
          │ Polls every 5s
          │ Updates results
          ▼
┌─────────────────┐
│  Railway Worker │
│  (Node.js)      │
│  • Polls jobs   │
│  • Downloads PDF│
│  • Calls Claude │
│  • Stores result│
└─────────────────┘
```

## 🐛 Troubleshooting

### Worker won't start
- Check Railway logs for dependency errors
- Ensure all env vars are set correctly
- Verify SUPABASE_SERVICE_ROLE_KEY (not anon key!)

### Jobs stuck in 'queued'
- Worker might not be running
- Check Railway logs for connection errors
- Verify worker can connect to Supabase (check service role key)

### Scans fail with "download failed"
- Check Storage bucket exists: `mapping-sheet-scans`
- Verify Storage RLS policies allow service role access
- Check file_url in mapping_sheet_scans matches actual path

### Claude API errors
- Verify CLAUDE_API_KEY is valid
- Check Anthropic API quota/limits
- Worker will fallback to OpenAI if Claude fails (requires OPENAI_API_KEY)

### High costs
- Monitor via `mapping_sheet_scan_costs` table
- Typical cost: $0.10-$0.30 per 3-page scan
- Consider limiting concurrent jobs if needed

## 📊 Monitoring Queries

**Check recent jobs:**
```sql
SELECT job_type, status, attempts, last_error, created_at, updated_at
FROM scraper_jobs
WHERE job_type = 'mapping_sheet_scan'
ORDER BY created_at DESC
LIMIT 10;
```

**Check recent scans:**
```sql
SELECT id, status, ai_provider, extraction_cost_usd, error_message, created_at
FROM mapping_sheet_scans
ORDER BY created_at DESC
LIMIT 10;
```

**Check costs (last 7 days):**
```sql
SELECT 
  ai_provider,
  COUNT(*) as scan_count,
  SUM(cost_usd) as total_cost,
  AVG(cost_usd) as avg_cost_per_scan,
  AVG(processing_time_ms) as avg_time_ms
FROM mapping_sheet_scan_costs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY ai_provider;
```

## ✅ Final Deployment Steps

1. **Commit the package.json update:**
   ```bash
   git add railway_workers/mapping-sheet-scanner-worker/package.json
   git commit -m "fix: add missing dependencies to mapping-sheet-scanner-worker"
   git push
   ```

2. **Railway will auto-deploy** (if connected to GitHub)
   - Watch build logs in Railway dashboard
   - Docker build will install canvas, pdfjs-dist, sharp, openai
   - Takes ~3-5 minutes for first build (canvas has native bindings)

3. **Verify deployment:**
   - Check Railway logs show worker starting
   - Test with a scan upload
   - Monitor database for job completion

4. **No changes needed to Vercel app** - it already has the job creation code!

## 🎯 Next Steps After Deployment

1. Test with a real mapping sheet scan
2. Verify extracted data accuracy
3. Monitor costs for first few scans
4. Set up Railway metrics/alerts (optional)
5. Consider increasing worker instances if processing many concurrent scans

---

**Status:** Ready to deploy! ✅

The worker code is solid. The missing dependencies have been added. Just need to:
1. Install dependencies locally OR commit and let Railway install
2. Verify env vars in Railway (remove SUPABASE_ANON_KEY if present)
3. Deploy and monitor logs

