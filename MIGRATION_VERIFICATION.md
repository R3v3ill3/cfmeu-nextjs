# Migration Verification Guide

## ✅ Warnings Are Normal!

The NOTICEs you saw during `supabase db push` are **completely safe** and expected:

### What You Saw:
```
NOTICE (00000): trigger "..." does not exist, skipping
NOTICE (00000): policy "..." does not exist, skipping
NOTICE (42P07): relation "idx_job_sites_project" already exists, skipping
```

### What This Means:
- ✅ **"does not exist, skipping"** - Normal! The migration tries to DROP before CREATE. Since this is the first run, there's nothing to drop. PostgreSQL just says "nothing to drop, moving on". The CREATE then succeeds.
- ✅ **"already exists, skipping"** - Also normal! The migration uses `CREATE IF NOT EXISTS`. The index was created by a previous migration, so it skips creating it again.

**These are features, not bugs!** They make migrations safe to re-run.

---

## 🧪 Verify Migrations Succeeded

Run these queries in Supabase Dashboard → SQL Editor to verify everything worked:

### Test 1: Check New Tables Were Created
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'site_visit_reasons',
    'site_visit_reason_definitions',
    'site_visit_follow_ups'
  )
ORDER BY table_name;
```

**Expected Result**: Should return 3 rows
```
site_visit_follow_ups
site_visit_reason_definitions
site_visit_reasons
```

### Test 2: Check Global Reasons Were Seeded
```sql
SELECT name, display_name, is_global, always_visible
FROM site_visit_reason_definitions
WHERE is_global = true
ORDER BY display_order;
```

**Expected Result**: Should return 8 rows
```
compliance_audit     | Compliance Audit      | true | true
delegate_election    | Delegate Election     | true | true
eba_vote            | EBA Vote              | true | true
safety_issue        | Safety Issue          | true | true
employer_meeting    | Employer Meeting      | true | true
delegate_1on1       | Delegate 1-on-1       | true | false
site_meeting        | Site Meeting          | true | false
general_visit       | General Visit         | true | false
```

### Test 3: Check Analytics Views Were Created
```sql
SELECT table_name 
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE 'v_%visit%'
ORDER BY table_name;
```

**Expected Result**: Should return 7 views
```
v_employer_last_visit
v_job_site_last_visit
v_lead_organiser_visit_summary
v_organiser_lead_assignments
v_patch_visit_coverage
v_project_last_visit
v_project_visit_frequency
v_visit_reasons_summary
```

### Test 4: Check New Columns Added to site_visit
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'site_visit'
  AND column_name IN (
    'date', 'organiser_id', 'project_id', 'notes',
    'visit_status', 'offline_created', 'created_by',
    'attachments_meta'
  )
ORDER BY column_name;
```

**Expected Result**: Should return 8 rows with the new columns

### Test 5: Check RLS Policies Were Created
```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE '%site_visit%'
ORDER BY tablename, policyname;
```

**Expected Result**: Should return 16 policies (4 per table for the 4 site_visit-related tables)

---

## ✅ If All Tests Pass

Your migrations were **100% successful!** The NOTICEs were just PostgreSQL being verbose about normal operations.

You can now:
1. ✅ Use the site visit features in your app
2. ✅ Test the enhanced form at `/site-visits`
3. ✅ See visit badges on projects
4. ✅ Manage custom reasons as lead organiser

---

## ❌ If Any Tests Fail

If any of the verification queries return fewer rows than expected:

### Troubleshooting Steps:

1. **Check Supabase logs** - Look for actual ERROR messages (not NOTICEs)
2. **Re-run the migrations manually**:
   - Go to Supabase Dashboard → SQL Editor
   - Copy entire content of `supabase/migrations/20251016170000_enhance_site_visits.sql`
   - Paste and click "Run"
   - Then do same for `supabase/migrations/20251016170100_site_visit_analytics.sql`
3. **Check permissions** - Ensure you're connected to the right project

### Common Issues:

**If tables don't exist:**
- The migration might have failed silently
- Check for ERROR (not NOTICE) in the output
- Try manual migration via dashboard

**If seed data is missing:**
- The INSERT statement might have failed
- Run just the INSERT part manually:
```sql
INSERT INTO public.site_visit_reason_definitions 
  (name, display_name, description, is_global, always_visible, display_order)
VALUES
  ('compliance_audit', 'Compliance Audit', 'Verify employer compliance with safety, wages, and union agreements', true, true, 1),
  ('delegate_election', 'Delegate Election', 'Conduct or support delegate election process', true, true, 2),
  -- ... etc (copy from migration file)
ON CONFLICT (name, created_by_lead_organiser_id) DO NOTHING;
```

**If views don't exist:**
- Check for syntax errors in view definitions
- Run each CREATE VIEW statement individually
- Check Supabase logs for errors

---

## 📊 Success Indicators

After verification, you should see:
- ✅ 3 new tables
- ✅ 8 global visit reasons
- ✅ 7 analytics views
- ✅ 8+ new columns on site_visit
- ✅ 16 RLS policies

**Status**: NOTICEs are normal - verify with the queries above! 🎉

---

## 🎯 Summary

**Question**: Are the NOTICEs important?
**Answer**: No! They're just PostgreSQL being chatty. As long as you don't see **ERROR**, you're good.

**Question**: Do they require remedial action?
**Answer**: No! Just verify using the test queries above to confirm everything was created.

**Next**: Run the verification queries to confirm success, then test the features! 🚀


