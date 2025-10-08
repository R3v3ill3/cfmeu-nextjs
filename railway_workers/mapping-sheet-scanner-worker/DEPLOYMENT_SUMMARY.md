# 🚀 Mapping Sheet Scanner Worker - Deployment Summary

## ✅ What I Fixed

### Critical Issue: Missing Dependencies
Your `package.json` was missing **4 critical dependencies** that the code imports:

```diff
  "dependencies": {
    "@anthropic-ai/sdk": "^0.20.0",
    "@supabase/supabase-js": "^2.39.0",
+   "canvas": "^2.11.2",
    "dotenv": "^17.2.3",
+   "openai": "^4.28.0",
+   "pdfjs-dist": "^3.11.174",
+   "sharp": "^0.33.2"
  }
```

**Without these, the build would fail when trying to import them in `src/pdf/converter.ts` and `src/ai/openai.ts`.**

## ⚠️ Environment Variable Correction

You mentioned setting `SUPABASE_ANON_KEY`, but **the worker doesn't use this variable**.

### What to do in Railway Dashboard:

**Remove:**
- ❌ `SUPABASE_ANON_KEY` (not used)

**Keep these:**
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (critical - worker needs admin access!)
- ✅ `CLAUDE_API_KEY` (or `ANTHROPIC_API_KEY`)
- ✅ `OPENAI_API_KEY`

## 📋 Code Review - Everything Else Looks Great! ✅

I reviewed all the source files in depth:

### ✅ Worker Architecture (Excellent)
- **Job polling system** - Uses proper locking with `lock_token` to prevent race conditions
- **Retry logic** - Handles failures with configurable retry attempts
- **Claude PDF processing** - Uses Claude's native PDF support (no image conversion needed!)
- **Cost tracking** - Tracks every API call cost in `mapping_sheet_scan_costs` table
- **Error handling** - Comprehensive try/catch with detailed logging

### ✅ Database Schema (Complete)
All required tables exist in migrations:
- `scraper_jobs` - Job queue with proper indexes
- `mapping_sheet_scans` - Scan records with RLS policies
- `mapping_sheet_scan_costs` - Cost tracking
- `mapping_sheet_scan_employer_matches` - Employer matching decisions

### ✅ Storage Configuration (Ready)
- Bucket: `mapping-sheet-scans` exists
- RLS policies allow authenticated uploads
- Service role can download files

### ✅ Main App Integration (No Changes Needed)
The Vercel app already has all the code to:
1. Upload PDFs to Supabase Storage
2. Create `mapping_sheet_scan` jobs in `scraper_jobs` table
3. Poll for completion and show results

**No changes needed to the main app!**

## 🎯 Action Required: Deploy to Railway

### Step 1: Install Dependencies Locally (Recommended)

```bash
cd railway_workers/mapping-sheet-scanner-worker
npm install
```

This creates `package-lock.json` for consistent builds.

### Step 2: Commit and Push

```bash
git add railway_workers/mapping-sheet-scanner-worker/package.json
git add railway_workers/mapping-sheet-scanner-worker/package-lock.json  # if created
git commit -m "fix: add missing dependencies to mapping-sheet-scanner-worker"
git push
```

### Step 3: Railway Auto-Deploys

Railway will detect the push and automatically:
1. Build Docker image using your Dockerfile
2. Install native dependencies (canvas, pdfjs-dist, sharp)
3. Build TypeScript → JavaScript
4. Start the worker with `npm start`

**Expected build time:** 3-5 minutes (canvas has native bindings)

### Step 4: Verify Deployment

**Watch Railway Logs** - You should see:
```
[worker] Starting mapping sheet scanner worker
[worker] Configuration: {
  supabaseUrl: 'https://your-project.supabase.co',
  pollIntervalMs: 5000,
  maxRetries: 3,
  claudeModel: 'claude-sonnet-4-5-20250929'
}
```

**If you see this, the worker is running successfully!** 🎉

### Step 5: Test with Real Upload

1. Go to your Vercel app
2. Navigate to any project
3. Click "Upload Mapping Sheet"
4. Upload a test PDF (max 3 pages, 10MB)

**Expected Railway logs:**
```
[jobs] Found 1 queued mapping sheet scan jobs
[jobs] Attempting to lock job abc-123
[jobs] Successfully locked job abc-123
[worker] Handling job abc-123 (mapping_sheet_scan)
[processor] Processing scan xyz-456
[processor] Attempting extraction with Claude (PDF direct) - focus on pages: 1, 2, 3
[claude] Raw response length: 2847
[processor] Extraction successful with claude
[worker] Job abc-123 completed: { succeeded: 1, failed: 0 }
```

## 🐛 Troubleshooting

### Build fails with "cannot find module canvas"
- Dependencies weren't installed. Railway should install automatically from package.json
- Check Railway build logs for npm install errors

### Worker logs show "Missing required environment variable"
- Check Railway env vars
- Make sure you have `SUPABASE_SERVICE_ROLE_KEY` (NOT anon key)

### Jobs stay in "queued" status forever
- Worker might not be running (check Railway logs)
- Database connection issue (check SUPABASE_URL and service key)

### Scans fail with "Failed to download PDF"
- Check Storage bucket `mapping-sheet-scans` exists
- Verify service role key has access to storage

## 💰 Cost Monitoring

**Expected costs per scan:**
- Claude Sonnet 4: ~$0.10 - $0.30 per 3-page scan
- Input tokens: ~2-4K (PDF is efficient!)
- Output tokens: ~1-2K (JSON response)

**Monitor via database:**
```sql
SELECT 
  COUNT(*) as total_scans,
  SUM(cost_usd) as total_cost,
  AVG(cost_usd) as avg_per_scan
FROM mapping_sheet_scan_costs
WHERE created_at > NOW() - INTERVAL '7 days';
```

## 📊 How It All Works

```
User uploads PDF in Vercel app
         ↓
PDF saved to Supabase Storage (bucket: mapping-sheet-scans)
         ↓
Job created in scraper_jobs table
  - job_type: 'mapping_sheet_scan'
  - status: 'queued'
  - payload: { scanId, fileUrl, selectedPages }
         ↓
Railway worker polls scraper_jobs every 5s
         ↓
Worker locks job, downloads PDF
         ↓
Claude processes PDF directly (no image conversion!)
         ↓
Worker saves results to mapping_sheet_scans
  - extracted_data: JSON
  - confidence_scores: JSON
  - status: 'completed'
         ↓
Vercel app shows extracted data in review UI
```

**Key insight:** No HTTP connection between Vercel and Railway! They communicate through Supabase database. [[memory:9218171]]

## ✅ Checklist Before Going Live

- [x] Missing dependencies added to package.json
- [x] Code review completed (no issues found)
- [x] Database schema verified (all tables exist)
- [x] Storage bucket verified (mapping-sheet-scans)
- [ ] Railway env vars set correctly (verify service role key)
- [ ] Deploy to Railway (git push)
- [ ] Check Railway logs for successful startup
- [ ] Test with 1 real scan upload
- [ ] Monitor costs in database

## 🎉 You're Ready!

The worker code is solid and production-ready. Just need to:

1. **Install dependencies** (`npm install`)
2. **Commit and push** (Railway auto-deploys)
3. **Verify env vars** (remove anon key, keep service role key)
4. **Test with a scan** (upload PDF via Vercel app)

The deployment guide has more details: `RAILWAY_DEPLOYMENT_GUIDE.md`

---

**Status:** ✅ Ready to deploy

**Confidence:** 🟢 High - Code is well-architected, just needed missing dependencies

