# Site Visit Fix - Deployment Instructions

## Current Status

The code has been updated but **the database migration has not been applied yet**. This is why the site visits page is not working properly.

## Issue

The site visit form and list page expect the enhanced schema columns:
- `date` (timestamptz)
- `organiser_id` (uuid)
- `project_id` (uuid) 
- `notes` (text)
- `visit_status` (text)
- etc.

But these columns don't exist yet because the migration `20251221180000_ensure_site_visit_schema_integrity.sql` hasn't been applied.

## What Needs to Happen

### Step 1: Apply the Database Migration

```bash
# Push the migration to Supabase
npx supabase db push

# Or apply manually via Supabase dashboard
# Migration file: supabase/migrations/20251221180000_ensure_site_visit_schema_integrity.sql
```

**What the migration does:**
1. Adds all enhanced columns (`date`, `organiser_id`, `project_id`, etc.)
2. Creates trigger to validate project_id matches job_site's project
3. Backfills `project_id` from existing `job_site_id` relationships
4. Adds performance indexes

### Step 2: Verify Migration Applied

Check that these columns exist in `site_visit` table:
- ✅ `date` 
- ✅ `organiser_id`
- ✅ `project_id`
- ✅ `notes`
- ✅ `visit_status`
- ✅ `created_by`
- ✅ `updated_by`

### Step 3: Test the Features

After migration is applied:

**Test List Page** (`/site-visits`):
- Should load without errors
- Should show visits filtered by user's patches
- Admins see all visits
- Organisers see only their patch visits

**Test Form** (click "New Visit"):
- Project dropdown should populate
- Sites should filter based on selected project
- Auto-select single site when only one exists
- Validation should prevent invalid site selection

## Temporary Workaround Applied

I've updated the list page query to use `created_at` instead of `date` as a fallback, but the form will still not work properly until the migration is applied because it tries to save to the new columns.

## Why This Happened

The migration adds new columns that are referenced by the enhanced form components. Without these columns:
- Queries fail (column doesn't exist)
- Inserts fail (column doesn't exist)
- The form can't function

## Next Steps

1. **Apply migration** (see Step 1 above)
2. **Verify** columns exist
3. **Test** with different user roles
4. **Monitor** console for any remaining errors

Once the migration is applied, all the features should work as designed:
- ✅ Patch-based filtering
- ✅ Project-site validation  
- ✅ Mobile-optimized form
- ✅ Data integrity triggers

