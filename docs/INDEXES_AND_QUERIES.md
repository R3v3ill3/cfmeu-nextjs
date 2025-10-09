### Query hotspots and index guidance

Endpoints
- `/api/projects` and `{WORKER}/v1/projects`
  - Base view: `project_list_comprehensive_view`
  - Filters: `tier`, `organising_universe`, `stage_class`, `created_at`, `search_text ilike`, `IN(id)` from patch mapping
  - Sorts: `name`, `value`, `tier`, `created_at`, summary columns

Suggested indexes (if not already present)
- `projects (tier)`
- `projects (organising_universe)`
- `projects (stage_class)`
- `projects (created_at)`
- `job_sites (patch_id)`
- `job_sites (project_id)`
- Mapping table backing `patch_project_mapping_view`:
  - `(patch_id)` and `(patch_id, project_id)`

EXPLAIN templates
```sql
-- Patch → projects via mapping
EXPLAIN ANALYZE
SELECT p.*
FROM project_list_comprehensive_view p
WHERE p.id IN (
  SELECT m.project_id
  FROM patch_project_mapping_view m
  WHERE m.patch_id = ANY('{patch1,patch2,patch3}')
)
ORDER BY name ASC
LIMIT 24 OFFSET 0;

-- Text search on materialized column
EXPLAIN ANALYZE
SELECT id, name
FROM project_list_comprehensive_view
WHERE search_text ILIKE '%tower%'
ORDER BY name ASC
LIMIT 24;

-- Fallback path sizing (job_sites)
EXPLAIN ANALYZE
SELECT project_id
FROM job_sites
WHERE patch_id = ANY('{patch1,patch2,patch3}')
  AND project_id IS NOT NULL;
```

Notes
- Use `head: true, count: 'exact'` judiciously; `count` adds planner work.
- Avoid `ILIKE` without trigram/GIN if search volume grows; consider dedicated search or prefix matching.
- Prefer precomputed summary fields in the view to eliminate joins on hot path.


