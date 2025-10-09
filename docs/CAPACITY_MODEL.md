### Capacity model (target: 25 simultaneous users; p95 ≤ 500ms)

Assumptions
- Traffic shape: 25 active organisers browsing dashboard/projects; 1–3 RPS sustained bursts.
- App: Next.js functions on Vercel; SSR/route handlers hit Supabase PostgREST; optional offload to Dashboard Worker.
- Workers: long-running on Railway (Express or loops). Supabase clients use HTTP (PostgREST), not direct PG.
- DB: Supabase (managed PostgREST + row level security + RPC + materialized/views).

Key flows and endpoints
- Projects listing (primary): `GET /api/projects` or `GET {DASHBOARD_WORKER}/v1/projects`
  - Filters: `q, patch, tier, universe, stage, workers, special, eba, newOnly, since, sort, dir, page, pageSize`
  - Hot path view: `project_list_comprehensive_view` (paged; precomputed summary columns)
  - Patch filtering: `patch_project_mapping_view` with fallback to `job_sites` when empty/stale

- Dashboard metrics: `GET {DASHBOARD_WORKER}/v1/dashboard`
  - Optional scoping by patch list → `patch_project_mapping_view` fallback strategy
  - Counts via `head: true, count: 'exact'` for big tables

- Employers listing: client-side legacy query (`.limit(5000)`) or server/worker paginated endpoint (recommended)

Latency budget (typical)
- Network (browser↔Vercel): 50–120ms
- Next.js route handler compute: 5–50ms (light transforms)
- Supabase (PostgREST) queries: 60–300ms (index-backed filters); head counts may be 100–250ms
- Worker hop (optional): +30–80ms over public network
- Predicted p95 under 25 users:
  - Projects (paged, no patch): 250–420ms
  - Projects (patch filter via mapping view): 280–480ms
  - Dashboard (with patch scope): 280–460ms
  - Employers (legacy client 5000 limit): 700ms–3s (out of SLO) → use paginated server/worker path

Concurrency and timeouts
- Next.js functions should finish < 1s; default Vercel function timeout >> 1s but SLO is 500ms p95.
- Worker endpoints are simple read flows; keep < 500ms. Background view refreshes must not block hot path.

Known/predicted bottlenecks (ranked)
1. Large client fetch in `EmployersDesktopView` (`.limit(5000)`). Use server/worker with pagination and narrow selects.
2. Patch filtering fallback to `job_sites` (extra query + potential large result sets). Ensure mapping view is refreshed in background.
3. Employer/trade charts use multiple `.in()` calls (N+1-ish patterns). Prefer a single RPC to aggregate.
4. Materialized/view freshness. Ensure scheduled refresh (worker cron) covers common usage windows.

Supabase usage posture
- All traffic via PostgREST/HTTP. No direct PG connections or pool management required in app/workers.
- Prefer count=head where possible; only request `count: 'exact'` when needed for pagination.
- Keep requests small: select only used columns; rely on view precomputations.

Caching and client state
- React Query: `staleTime` 3m; `gcTime` 15m for projects hook → good cache hit rate while browsing.
- Dashboard/Projects worker: 30s TTL cache; return `X-Cache` headers and per-request `debug.queryTime` for visibility.

Safety rails for 25-user soft launch
- Disable patch-view refresh on hot path in Next.js app API; keep background refresh in Dashboard Worker only.
- Migrate legacy client list pages (Employers) to server/worker endpoints with pagination (page≤100).
- Add short timeouts and fallbacks: 10–15s worker health probe, 500ms–1s data path retry/fallback to app route if worker returns 5xx/429.

Hot-endpoint checklist (index-backed filters)
- `project_list_comprehensive_view` underlying tables:
  - Projects: indexes on `(tier)`, `(organising_universe)`, `(stage_class)`, `(created_at)`
  - Precomputed columns: sorting by `total_workers`, `total_members`, `engaged_employer_count`, `eba_coverage_percent` relies on view materialization
- `patch_project_mapping_view` source tables:
  - Map table: index on `(patch_id)`, and ideally `(patch_id, project_id)` to support `IN(patchIds)` lookups
- `job_sites` fallback path: indexes on `(patch_id)` and `(project_id)`

Capacity verdict (expected)
- With the above, projects/dashboard flows should remain within the p95≤500ms target at 25 concurrent users.
- Employers list must not use the 5000-row client query during soft launch.


