### System architecture (soft launch scope)

Components
- Web app: Next.js App Router on Vercel (serverless functions + edge-ready middleware)
- Database: Supabase (PostgREST + RLS + RPCs + materialized/views)
- Workers on Railway:
  - cfmeu-dashboard-worker (Express API, caching, background refreshes)
  - cfmeu-scraper-worker (headless browser jobs, FWC/Incolink integrations)
  - mapping-sheet-scanner-worker (AI PDF extraction via Anthropic/OpenAI)
  - bci-import-worker (normalize .xlsx uploads to JSON)

Mermaid — high-level data flow
```mermaid
flowchart LR
  A[Browser (Organiser/Admin)] -->|HTTPS| B[Next.js (Vercel)]
  B -->|Supabase JS (client SSR/CSR)| C[(Supabase: PostgREST/RPC/RLS)]
  B -->|Feature-flagged| D[Dashboard Worker API]
  B -->|Upload .xlsx| E[BCI Import Worker]
  D -->|read views / aggregates| C
  D -->|background refresh (cron)| C
  F[Scraper Worker] -->|poll scraper_jobs| C
  G[Mapping Sheet Scanner Worker] -->|poll scraper_jobs| C
  G -->|Claude/OpenAI| H[(AI Providers)]
```

Runtime targets
- Next.js: Node 18+; serverless functions; CSP headers set in `next.config.mjs`
- Workers: Node 18+ on Railway; long-running processes

Key entrypoints
- Web app
  - `src/app/layout.tsx` (root)
  - `src/app/(app)/layout.tsx` (auth-guarded app shell)
  - `src/middleware.ts` (route matcher)
  - API routes under `src/app/api/**/route.ts` (e.g., `projects`, `dashboard/*`, `public/form-data/[token]`)
- cfmeu-dashboard-worker: `railway_workers/cfmeu-dashboard-worker/src/index.ts`
- cfmeu-scraper-worker: `railway_workers/cfmeu-scraper-worker/src/index.ts`
- mapping-sheet-scanner-worker: `railway_workers/mapping-sheet-scanner-worker/src/index.ts`
- bci-import-worker: `railway_workers/bci-import-worker/src/index.ts`

Authentication & authorization
- Browser uses Supabase client (`src/lib/supabase/client.ts`); SSR uses `createServerSupabase()`
- App routes enforce auth in `(app)/layout.tsx`; role lookups via `profiles.role`
- Workers accept Bearer JWT (dashboard) or run service-role operations (scraper/scanner)

Queues and background work
- Job queue table: `scraper_jobs`
  - Producers: Next.js API routes, admin tools (various)
  - Consumers: cfmeu-scraper-worker, mapping-sheet-scanner-worker
- Dashboard worker performs periodic view/materialized view refresh (non-blocking for requests)

Notable integration points
- Google Maps JS (browser) — requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- Anthropic/OpenAI (scanner worker) — keys provided via Railway env

Performance posture (for capacity modeling)
- Heavy list rendering moved to server/worker endpoints (feature flags)
- Dashboard and projects endpoints use short TTL caching and pre-aggregated views
- Patch filtering prefers mapping view; job_sites fallback is guarded; background refresh avoids hot-path blocking

Security posture
- RLS on user-visible tables (enforced via anon keys in browser/SSR)
- Service role used only in server-side routes and workers
- CSP applied globally; should be tightened in production (remove inline/eval)

Operations & health
- `GET /api/health/workers` (admin-only) probes:
  - Dashboard Worker `/health` + data call
  - BCI Import Worker `/health`
  - Queue staleness checks for scanner/scraper via Supabase

Assumptions (to be validated during P1–P6)
- Vercel/Supabase envs are present in production
- Workers have service-role keys and database access; no public leak of secrets
- Dashboard worker caching windows adequate for soft-launch usage bursts


