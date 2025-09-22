-- Apply the fix for draft lead organiser patch assignments
-- This migration updates the get_patch_summaries_for_user RPC function to properly handle draft lead organizers

-- Execute the migration file
\i supabase/sql/migrations/0048_fix_draft_lead_organiser_patch_summaries.sql

-- Optional: Verify the function exists and works correctly
-- SELECT proname, prokind FROM pg_proc WHERE proname = 'get_patch_summaries_for_user';

-- Test the function with a sample query (replace with actual user ID)
-- SELECT * FROM get_patch_summaries_for_user(
--   '00000000-0000-0000-0000-000000000000'::UUID,
--   'admin',
--   NULL,
--   NULL
-- ) LIMIT 5;
