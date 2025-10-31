-- Test query to debug organiser names in get_employer_sites
-- Replace 'YOUR_EMPLOYER_ID' with an actual employer ID from your database

-- First, let's check if organisers exist for patches linked to the employer's projects
WITH test_employer_id AS (
  SELECT 'YOUR_EMPLOYER_ID'::uuid AS id
),
employer_projects AS (
  SELECT DISTINCT js.project_id
  FROM worker_placements wp
  JOIN job_sites js ON wp.job_site_id = js.id
  WHERE wp.employer_id = (SELECT id FROM test_employer_id)
  UNION
  SELECT DISTINCT pe.project_id
  FROM project_employer_roles pe
  WHERE pe.employer_id = (SELECT id FROM test_employer_id)
  UNION
  SELECT DISTINCT pr.id AS project_id
  FROM projects pr
  WHERE pr.builder_id = (SELECT id FROM test_employer_id)
  UNION
  SELECT DISTINCT pct.project_id
  FROM project_contractor_trades pct
  WHERE pct.employer_id = (SELECT id FROM test_employer_id)
  UNION
  SELECT DISTINCT js.project_id
  FROM site_contractor_trades sct
  JOIN job_sites js ON sct.job_site_id = js.id
  WHERE sct.employer_id = (SELECT id FROM test_employer_id)
  UNION
  SELECT DISTINCT pa.project_id
  FROM project_assignments pa
  WHERE pa.employer_id = (SELECT id FROM test_employer_id)
    AND pa.assignment_type = 'contractor_role'
),
project_job_sites AS (
  SELECT js.id, js.name, js.project_id
  FROM job_sites js
  JOIN employer_projects ep ON ep.project_id = js.project_id
),
site_patches_for_orgs AS (
  SELECT DISTINCT
    pjs.id AS site_id,
    pjs_link.patch_id
  FROM project_job_sites pjs
  LEFT JOIN patch_job_sites pjs_link ON pjs_link.job_site_id = pjs.id AND pjs_link.effective_to IS NULL
)
-- Check what patches we're getting
SELECT 
  'Patches for sites' AS check_type,
  spo.site_id,
  spo.patch_id,
  pat.name AS patch_name
FROM site_patches_for_orgs spo
LEFT JOIN patches pat ON pat.id = spo.patch_id
ORDER BY spo.site_id, spo.patch_id;

-- Check organisers for those patches
WITH test_employer_id AS (
  SELECT 'YOUR_EMPLOYER_ID'::uuid AS id
),
employer_projects AS (
  SELECT DISTINCT js.project_id
  FROM worker_placements wp
  JOIN job_sites js ON wp.job_site_id = js.id
  WHERE wp.employer_id = (SELECT id FROM test_employer_id)
  UNION
  SELECT DISTINCT pe.project_id
  FROM project_employer_roles pe
  WHERE pe.employer_id = (SELECT id FROM test_employer_id)
  UNION
  SELECT DISTINCT pr.id AS project_id
  FROM projects pr
  WHERE pr.builder_id = (SELECT id FROM test_employer_id)
  UNION
  SELECT DISTINCT pct.project_id
  FROM project_contractor_trades pct
  WHERE pct.employer_id = (SELECT id FROM test_employer_id)
  UNION
  SELECT DISTINCT js.project_id
  FROM site_contractor_trades sct
  JOIN job_sites js ON sct.job_site_id = js.id
  WHERE sct.employer_id = (SELECT id FROM test_employer_id)
  UNION
  SELECT DISTINCT pa.project_id
  FROM project_assignments pa
  WHERE pa.employer_id = (SELECT id FROM test_employer_id)
    AND pa.assignment_type = 'contractor_role'
),
project_job_sites AS (
  SELECT js.id, js.name, js.project_id
  FROM job_sites js
  JOIN employer_projects ep ON ep.project_id = js.project_id
),
site_patches_for_orgs AS (
  SELECT DISTINCT
    pjs.id AS site_id,
    pjs_link.patch_id
  FROM project_job_sites pjs
  LEFT JOIN patch_job_sites pjs_link ON pjs_link.job_site_id = pjs.id AND pjs_link.effective_to IS NULL
)
SELECT 
  'Live organisers' AS source,
  spo.site_id,
  spo.patch_id,
  prof.full_name AS organiser_name
FROM site_patches_for_orgs spo
JOIN organiser_patch_assignments opa ON opa.patch_id = spo.patch_id AND opa.effective_to IS NULL
JOIN profiles prof ON prof.id = opa.organiser_id
WHERE spo.patch_id IS NOT NULL

UNION ALL

SELECT 
  'Draft/invited organisers' AS source,
  spo.site_id,
  spo.patch_id,
  CASE 
    WHEN pu.role = 'lead_organiser' THEN pu.full_name || ' (lead)'
    ELSE pu.full_name
  END AS organiser_name
FROM site_patches_for_orgs spo
JOIN pending_users pu ON spo.patch_id = ANY(pu.assigned_patch_ids::uuid[])
WHERE pu.status IN ('draft', 'invited')
  AND pu.full_name IS NOT NULL
  AND spo.patch_id IS NOT NULL

ORDER BY site_id, source, organiser_name;

