-- Update member counting logic to explicitly exclude Incolink-only workers
-- Workers imported from Incolink should have 'unknown' union status and should NOT
-- be counted as union members unless explicitly changed to 'member' status

-- Update project dashboard summary view to clarify member counting logic
COMMENT ON VIEW public.project_dashboard_summary IS 
'Project dashboard summary with worker and member counts. 
Members are counted only when union_membership_status = ''member''. 
Workers with ''unknown'' status (typically Incolink imports) are excluded from member counts.';

-- Update any materialized views that may need refresh
-- (None currently exist for worker counts, but this ensures consistency)
