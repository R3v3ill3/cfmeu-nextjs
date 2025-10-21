# Employer Search Optimization: Quick Start Guide

## ⚡ 5-Minute Setup (Development)

```bash
# 1. Apply database migration
psql $DATABASE_URL -f supabase/migrations/20251017000000_employers_search_materialized_view.sql

# 2. Set environment variable in .env.local
echo "NEXT_PUBLIC_USE_EMPLOYER_MAT_VIEW=true" >> .env.local

# 3. Start development server
npm run dev

# 4. Visit http://localhost:3000/employers
#    Check console for: "🚀 Using materialized view for employer search"

# 5. Test search performance
#    Should see query times drop from ~1500ms to ~200ms
```

## ✅ Quick Test

```bash
# Check view was created
psql $DATABASE_URL -c "SELECT COUNT(*) FROM employers_search_optimized;"

# Manual refresh
psql $DATABASE_URL -c "SELECT * FROM refresh_employers_search_view_logged('manual');"

# Check health
psql $DATABASE_URL -c "SELECT * FROM employers_search_view_status;"
```

## 🚀 Production Deployment

**Step 1:** Apply migration to production database
```bash
supabase db push --project-ref your-prod-project
```

**Step 2:** Set up automatic refresh (choose one)

### Option A: pg_cron (Recommended)
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'refresh-employers-search-view',
  '*/5 * * * *',
  $$SELECT refresh_employers_search_view_logged('cron');$$
);
```

### Option B: Vercel Cron
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/refresh-employer-view",
    "schedule": "*/5 * * * *"
  }]
}
```

**Step 3:** Deploy code with feature flag
```bash
# In Vercel/Railway dashboard, set:
NEXT_PUBLIC_USE_EMPLOYER_MAT_VIEW=true

# Deploy
git push production main
```

**Step 4:** Monitor
- Check console logs for "🚀 Using materialized view"
- Verify query times improved
- Monitor for errors

## 🔙 Instant Rollback

If issues occur:
```bash
# Set environment variable to false
NEXT_PUBLIC_USE_EMPLOYER_MAT_VIEW=false

# Redeploy (takes ~2-3 minutes)
git commit --allow-empty -m "Rollback: Disable materialized view"
git push production main
```

## 📊 Monitoring

```sql
-- Health check (run daily)
SELECT * FROM employers_search_view_status;

-- Refresh history
SELECT * FROM mat_view_refresh_log 
ORDER BY refreshed_at DESC LIMIT 10;

-- Check for issues
SELECT * FROM mat_view_refresh_log 
WHERE success = false 
OR duration_ms > 30000;
```

## 📖 Full Documentation

- **Start here:** [EMPLOYER_SEARCH_DEPLOYMENT_GUIDE.md](./EMPLOYER_SEARCH_DEPLOYMENT_GUIDE.md)
- **Implementation details:** [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- **Risk analysis:** [EMPLOYER_SEARCH_MATERIALIZED_VIEW_RISKS.md](./EMPLOYER_SEARCH_MATERIALIZED_VIEW_RISKS.md)
- **Performance analysis:** [EMPLOYER_SEARCH_PERFORMANCE_ANALYSIS.md](./EMPLOYER_SEARCH_PERFORMANCE_ANALYSIS.md)

## 🎯 Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Simple search | 200-500ms | 50-100ms |
| Search + filters | 700-1200ms | 100-200ms |
| With enhanced data | 1200-1800ms | 200-400ms |

**= 80-90% faster! 🚀**

## ❓ Common Questions

**Q: Will this break existing functionality?**
A: No! Feature flag allows instant rollback. Only affects employer search performance.

**Q: What about data freshness?**
A: 5-minute refresh delay (acceptable for search/analytics). Detail views are real-time.

**Q: What if the view doesn't refresh?**
A: Manual refresh: `SELECT * FROM refresh_employers_search_view_logged('manual');`

**Q: How do I check if it's working?**
A: Console should show "🚀 Using materialized view" and query times should drop dramatically.

## 🆘 Troubleshooting

**View not refreshing:**
```sql
-- Check cron job
SELECT * FROM cron.job WHERE jobname = 'refresh-employers-search-view';

-- Manual refresh
SELECT * FROM refresh_employers_search_view_logged('manual');
```

**Slow queries:**
```sql
-- Analyze table
ANALYZE employers_search_optimized;

-- Check indexes
\d employers_search_optimized
```

**Data mismatch:**
```sql
-- Force full refresh
REFRESH MATERIALIZED VIEW employers_search_optimized;
```

## ✨ Next Steps

1. ✅ Test in development
2. ✅ Deploy to staging
3. ✅ Test in staging
4. ✅ Deploy to production (gradual rollout)
5. ✅ Monitor for 1 week
6. ✅ Optimize refresh frequency if needed
7. 🔮 Consider Phase 4: Full-text search (optional)

---

**Ready to deploy?** Start with the full deployment guide: [EMPLOYER_SEARCH_DEPLOYMENT_GUIDE.md](./EMPLOYER_SEARCH_DEPLOYMENT_GUIDE.md)


