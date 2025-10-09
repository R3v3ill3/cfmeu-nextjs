### Decision log (soft launch)

Scope: Convert high-priority findings from REVIEW_EXPORT.json into explicit decisions for action.

Legend
- Decision: Approve (do now) | Defer (post‑launch) | Reject (won’t do)
- Owner: unassigned unless specified

| Finding | Title | Severity | Decision | Owner | Target date | Rationale |
| --- | --- | --- | --- | --- | --- | --- |
| F-001 | Public form API uses service-role key | Critical | Approve | unassigned | T+3d | Service-role in a public route is a hard blocker; must move to server-only RPC/worker with RLS. |
| F-011 | Help chat uses service-role key | Critical | Approve | unassigned | T+3d | Same risk pattern; relocate writes to trusted backend and enforce RLS. |
| F-002 | Projects API refreshes matview on request | Serious | Approve | unassigned | T+2d | Hot-path refresh increases p95 under load; schedule via worker only. |
| F-003 | Employers list fetches 5000 rows client-side | Serious | Approve | unassigned | T+4d | Page and reduce columns via API/worker; necessary for capacity and UX. |
| F-006 | Type/lint errors hidden in production builds | Serious | Approve | unassigned | T+5d | Re-enable CI gates; fix top TS errors to avoid silent prod defects. |
| F-005 | CSP allows unsafe inline/eval | Serious | Approve | unassigned | T+5d | Harden prod CSP (nonce-based); reduce XSS exposure. |
| F-012 | New-from-scan depends on missing RPC types and service-role | Critical | Approve | unassigned | T+6d | Provide RPCs/types; move transaction + service-role to worker. |
| F-020 | Pending employers merge untyped RPCs | Serious | Approve | unassigned | T+7d | Regenerate types; typed RPC or server/worker merge to protect data quality. |

Verification per item
- F-001/F-011: No service-role usage in any Next.js route; RLS tests pass; security scan confirms absence in client bundle.
- F-002: Requests with patch filters show no RPC refresh in logs; worker cron refreshes confirmed.
- F-003: Network traces show ≤100 rows per page; response payload ≤200KB.
- F-006: CI fails on TS/lint errors; main branch protected; Vercel deploys only after CI green.
- F-005: Response headers exclude 'unsafe-inline'/'unsafe-eval'; Maps still loads via allowed origins + nonce.
- F-012/F-020: RPCs visible in generated types; happy-path and error-path tests pass.


