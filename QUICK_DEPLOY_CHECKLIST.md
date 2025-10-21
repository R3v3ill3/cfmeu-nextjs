# Site Visit Enhancement - Quick Deploy Checklist

## ✅ Pre-Deployment Checklist

- [ ] All new files are committed to git
- [ ] Development server running without errors
- [ ] No TypeScript errors (`pnpm build` passes)
- [ ] Reviewed migration files

## 🗄️ Step 1: Apply Database Migrations

### Using Supabase CLI (Recommended)
```bash
# Make sure you're connected to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

### Using Supabase Dashboard (Alternative)
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Copy and paste content from:
   - `supabase/migrations/20251016170000_enhance_site_visits.sql`
   - Click "Run"
   - Then: `supabase/migrations/20251016170100_site_visit_analytics.sql`
   - Click "Run"

### Verify Migrations
Run this query in SQL Editor:
```sql
-- Check new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'site_visit_reasons',
    'site_visit_reason_definitions',
    'site_visit_follow_ups'
  );

-- Check new views exist
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE '%visit%';

-- Check seed data loaded
SELECT count(*) as global_reasons 
FROM site_visit_reason_definitions 
WHERE is_global = true;
-- Should return 8
```

## 🚀 Step 2: Deploy Application

### If using Vercel
```bash
git add .
git commit -m "feat: Add site visit enhancement feature"
git push origin main
```

Vercel will auto-deploy. Monitor build logs.

### If using other platforms
```bash
pnpm build
# Then deploy according to your platform
```

## ✅ Step 3: Post-Deployment Testing

### Test 1: Site Visit Form
1. Navigate to `/site-visits`
2. Click "New Visit"
3. **Verify**:
   - [ ] Form opens with new enhanced layout
   - [ ] Visit reasons section shows 8 global reasons
   - [ ] "Show more reasons" collapsible works
   - [ ] Can add follow-up actions
   - [ ] Can see context links (Open Mapping Sheet, etc.)
   - [ ] "Save Draft" and "Complete Visit" buttons work

### Test 2: Mapping Sheet Badge
1. Navigate to any project
2. Go to "Mapping Sheets" tab
3. **Verify**:
   - [ ] Visit badge appears in project header
   - [ ] Badge shows "Never visited" (grey) or actual date
   - [ ] Badge color matches recency

### Test 3: Lead Organiser Features (if applicable)
1. Log in as a lead organiser
2. Navigate to lead console
3. **Verify**:
   - [ ] "Manage Site Visit Reasons" button appears
   - [ ] Button navigates to `/lead-console/site-visit-reasons`
   - [ ] Can create custom visit reason
   - [ ] Custom reason has fields: display_name, description, always_visible, display_order

### Test 4: Custom Reasons (as organiser)
1. Log in as regular organiser (assigned to a lead)
2. Navigate to site visits
3. Click "New Visit"
4. **Verify**:
   - [ ] Custom reasons created by lead appear
   - [ ] Always visible reasons show by default
   - [ ] Other reasons in "Show more" section

### Test 5: Geofencing (Optional - Mobile)
1. Open app on mobile device
2. Navigate to `/settings` (or wherever GeofencingSetup is placed)
3. Enable geofencing
4. Grant permissions
5. **Verify**:
   - [ ] Location permission granted
   - [ ] Notification permission granted
   - [ ] When near a job site (100m), notification appears

## 🐛 Troubleshooting

### Issue: "Module not found" errors
**Solution**: 
```bash
pnpm install
rm -rf .next
pnpm dev
```

### Issue: Migrations fail
**Solution**:
- Check if tables already exist: `SELECT * FROM site_visit;`
- If needed, manually run specific CREATE TABLE commands
- Check Supabase logs for detailed error

### Issue: Badge shows "Loading..." forever
**Solution**:
- Check browser console for errors
- Verify view exists: `SELECT * FROM v_project_last_visit LIMIT 1;`
- Check database connection in Supabase dashboard

### Issue: Custom reasons don't appear
**Solution**:
- Verify organiser is assigned to a lead: 
  ```sql
  SELECT * FROM v_organiser_lead_assignments WHERE organiser_id = 'YOUR_ID';
  ```
- Check reason is active:
  ```sql
  SELECT * FROM site_visit_reason_definitions WHERE is_active = true;
  ```

### Issue: Geofencing not working
**Cause**: Geofencing requires:
- HTTPS (works on localhost:3000 in dev)
- Browser location permission
- Browser notification permission
- App to be open (foreground only)

**Solution**:
- Check permissions in browser settings
- Try on different browser
- Test on actual mobile device (not simulator)

## 📊 Monitoring After Deployment

### Week 1 Checks
- [ ] Monitor for any console errors in browser
- [ ] Check database for new site_visit records
- [ ] Verify visit reasons are being used:
  ```sql
  SELECT 
    svrd.display_name,
    COUNT(svr.id) as usage_count
  FROM site_visit_reason_definitions svrd
  LEFT JOIN site_visit_reasons svr ON svr.reason_definition_id = svrd.id
  GROUP BY svrd.id, svrd.display_name
  ORDER BY usage_count DESC;
  ```

### Month 1 Analysis
- [ ] Review visit coverage metrics:
  ```sql
  SELECT * FROM v_patch_visit_coverage ORDER BY pct_visited_3m DESC;
  ```
- [ ] Identify never-visited projects:
  ```sql
  SELECT 
    p.name,
    COALESCE(plv.last_visit_date::text, 'Never') as last_visit
  FROM projects p
  LEFT JOIN v_project_last_visit plv ON plv.project_id = p.id
  WHERE plv.last_visit_date IS NULL OR plv.last_visit_date < CURRENT_DATE - INTERVAL '12 months'
  ORDER BY p.name;
  ```

## 🎯 Success Metrics

After 1 month, you should see:
- **Adoption**: 50%+ of organisers using the feature
- **Coverage**: Increasing % of projects visited
- **Quality**: Average 2+ visit reasons per visit
- **Follow-ups**: 30%+ of visits have follow-up actions

## 📈 Optional: Complete Remaining Integrations

Once core features are stable, complete remaining integrations:

1. **Project Table** - Add last visit column (10 min)
2. **Patch Dashboard** - Add coverage card (5 min)
3. **Project Detail** - Add visit overview (5 min)
4. **Lead Console** - Add team coverage card (5 min)

See `INTEGRATION_GUIDE.md` for detailed steps.

## 🎉 You're Done!

The site visit enhancement is now live. Users can:
- ✅ Record comprehensive site visits
- ✅ Select from predefined reasons
- ✅ Add custom reasons (lead organisers)
- ✅ Track follow-up actions
- ✅ Export to calendar
- ✅ See visit badges on mapping sheets
- ✅ Access context-aware quick links

## 📚 Resources

- **User Guide**: `SITE_VISIT_QUICKSTART.md`
- **Technical Docs**: `SITE_VISIT_ENHANCEMENT_IMPLEMENTATION.md`
- **Integration Guide**: `INTEGRATION_GUIDE.md`
- **Status**: `INTEGRATION_STATUS.md`

---

**Questions?** Check the troubleshooting section or review the documentation files listed above.

