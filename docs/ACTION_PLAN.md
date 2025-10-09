### 7‑day action plan (soft launch blockers)

Day 1–2: Security and hot-path fixes
- F-001: Refactor `api/public/form-data/[token]`
  - Replace service-role client with anon SSR client and RLS-backed RPC; or proxy writes via Dashboard Worker.
  - Add signed token verification (scope-limited) and idempotency.
- F-002: Remove matview refresh from `api/projects` hot path; keep worker cron refresh only.

Day 2–3: Capacity and UX
- F-003: Employers pagination
  - Create `/api/employers` paginated endpoint (page≤100) or use worker endpoint.
  - Add typed employer search endpoint returning up to 100 matches with minimal fields.
  - Update `EmployersDesktopView` to page and select minimal columns; typeahead uses search endpoint.

Day 3–4: Security hardening
- F-005: CSP tightening for production
  - Drop `unsafe-inline`/`unsafe-eval`; add nonce-based policy; whitelist Maps.

Day 4–6: Type safety and reliability
- F-006: Re-enable CI gates (see CI_READINESS.md) and fix top 25 TS errors across APIs (new-from-scan, help/chat, import flows).
- F-012: Provide missing RPC(s) and move transaction to worker; regenerate Supabase types.
- F-020: Typed RPCs for employer merge; regenerate types; wire UI to typed endpoints.

Day 6–7: Verification
- Playwright smokes for 5 flows; run k6 (25 VUs, 10–15 min) from `docs/LOADTEST_PLAN.md`.
- Update GO_NO_GO.md; if all blockers cleared and SLO met, flip to GO.

Owners & reviews
- Assign 1–2 owners; require PR review + CI green; deploy to staging → verify → promote.


