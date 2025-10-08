-- Test script to verify get_employer_sites function is working
-- Run this in Supabase SQL Editor

-- Step 1: Find employers that have trade assignments (should show in worksites)
SELECT 
    e.id,
    e.name,
    COUNT(DISTINCT pct.project_id) as project_trade_count,
    COUNT(DISTINCT sct.job_site_id) as site_trade_count
FROM employers e
LEFT JOIN project_contractor_trades pct ON pct.employer_id = e.id
LEFT JOIN site_contractor_trades sct ON sct.employer_id = e.id
WHERE pct.project_id IS NOT NULL OR sct.job_site_id IS NOT NULL
GROUP BY e.id, e.name
ORDER BY project_trade_count DESC, site_trade_count DESC
LIMIT 10;

-- Step 2: Test the function with one of those employers
-- Replace 'YOUR_EMPLOYER_ID' with an ID from the results above
-- SELECT * FROM get_employer_sites('YOUR_EMPLOYER_ID');

-- Step 3: Check what projects those trade assignments link to
-- Replace 'YOUR_EMPLOYER_ID' with an ID from the results above
/*
SELECT 
    p.id,
    p.name as project_name,
    COUNT(DISTINCT js.id) as job_site_count,
    array_agg(DISTINCT js.name) as site_names
FROM project_contractor_trades pct
JOIN projects p ON p.id = pct.project_id
LEFT JOIN job_sites js ON js.project_id = p.id
WHERE pct.employer_id = 'YOUR_EMPLOYER_ID'
GROUP BY p.id, p.name;
*/
