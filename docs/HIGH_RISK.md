### Top production-blocking risks

1) Public form API uses service-role key
Evidence:
```1:12:src/app/api/public/form-data/[token]/route.ts
const supabase = createClient<Database>(
  supabaseUrl!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```
Impact: Privilege escalation and RLS bypass if token scheme abused.
Action (post-review): Move to server-only route behind signature; minimize scope; use RPC with RLS.

2) Typecheck off; many TS errors across API and UI
Evidence: `tsc --noEmit` shows incompatible inserts, missing RPC types, enum mismatches.
Impact: Runtime failures hidden by Next ignoreBuildErrors.
Action: Enable typecheck in CI; fix top 20 errors first.

3) Projects API refreshes materialized view on request path
```166:172:src/app/api/projects/route.ts
await supabase.rpc('refresh_patch_project_mapping_view')
```
Impact: p95 latency spikes under patch filters.
Action: Background refresh via worker; remove from hot path.

4) Large client-side fetches (Employers list 5000 rows)
```55:77:src/components/employers/EmployersDesktopView.tsx
.limit(5000)
```
Impact: Bandwidth/CPU heavy; slow UX; risk of timeouts on mobile.
Action: Server/worker pagination and summary endpoints.

5) CSP overly permissive in prod
```41:50:next.config.mjs
script-src 'self' 'unsafe-eval' 'unsafe-inline' ...
```
Impact: XSS window.
Action: Production CSP without inline/eval; use nonce.


