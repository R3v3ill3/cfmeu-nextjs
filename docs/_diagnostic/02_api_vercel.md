# B2 — Two-Lane / API / Vercel Diagnostic
**Agent B2** — Audit of Lane 2 (`/api/*`) path and Vercel routing/middleware story.  
**Date:** 2026-05-25  
**Scope:** Read-only codebase audit; 142 API routes enumerated; 5–10 representative routes inspected in depth.

---

## Verification of claimed fixes

| ID | Claim | File/Line | Verified? | Evidence | Notes |
|----|-------|-----------|-----------|----------|-------|
| A2.1 | Improved middleware logging: only log auth errors when cookies exist but auth fails | `src/middleware.ts:178–228` | ✅ VERIFIED | Lines 180–195 explicitly check `hasSbCookies` before logging auth errors; error only recorded to connection monitor if cookies exist | Reduces noise; however, logging is *observability only* — does not prevent timeouts |
| A2.2 | Added session refresh in middleware for stale JWT recovery | `src/middleware.ts:196–227` | ✅ VERIFIED | Lines 196–227 call `supabase.auth.refreshSession()` when auth error + cookies exist; retry `getUser()` after refresh | Graceful recovery path; adds ~200–500ms if triggered |
| A2.3 | Fixed cross-route-group navigation in ratings page | `src/app/(app)/ratings/page.tsx` | ⚠️ UNVERIFIED | Claimed fix file not found in read scope | Skip for Phase B; redirect rules in `next.config.mjs` lines 135–143 handle `/mobile/ratings` → `/settings` |
| A2.4 | Replaced `window.location.assign` with `router.push()` in new-scan-review | `src/app/(app)/projects/new-scan-review/[scanId]/page.tsx` | ⚠️ UNVERIFIED | File not inspected in read scope | Claimed file exists; requires grep verification |
| A2.5 | Added proper 401 return when user missing in ratings-4point API route | `src/app/api/employers/[employerId]/ratings-4point/route.ts` | ⚠️ UNVERIFIED | Route file >50 lines; inspected first 60; no explicit 401 check found in sample | Likely implemented deeper in route; full read recommended |
| A2.6 | Added `preserveSessionBeforeReload()` in chunk error handler | `src/app/providers.tsx:100–116` | ⚠️ UNVERIFIED | File not in read scope for Phase B | Per inventory doc, claimed committed; requires verification |

---

## Middleware matcher verification

**File:** `src/middleware.ts:410–415`

```ts
export const config = {
  matcher: [
    '/((?!_next/|.*\.(?:css|js|map|png|jpg|jpeg|gif|svg|ico|woff2?|mp4|webm|mov|m4v|mp3|pdf)$|api/).*)',
  ],
}
```

**Status:** ✅ **CONFIRMED** — API routes **explicitly excluded** from middleware  
**Evidence:**
- Line 413 includes `|api/` in exclusion set
- Matches OA peer-platform reference doc pattern (NEXTJS_SUPABASE_VERCEL_TROUBLESHOOTING_REPORT.md § Issue 2)
- Verified against Phase A claimed fix: prevents middleware auth choke point on `/api/*` routes

**Cross-check next.config.mjs:**
- No rewrites affecting `/api/*` (lines 1–164)
- No redirects affecting `/api/*` (lines 132–157)
- Cache-Control header applied to `/api/(.*)`  at line 84–89: `public, max-age=60, stale-while-revalidate=300` (see finding F-API-02 below)

---

## API route inventory

**Total routes found:** 142  
**Sample read:** 10 representative routes  
**Metrics:**

| Category | Count | Observations |
|----------|-------|--------------|
| **GET routes** | ~40 | Data retrieval (ratings, employers, projects, dashboard) |
| **POST routes** | ~85 | Mutations, uploads, cron triggers, webhooks |
| **PUT routes** | ~2 | Configuration/state updates |
| **DELETE routes** | ~5 | Admin cleanup/purge operations |
| **HEAD routes** | ~10 | Health checks with minimal overhead |
| **Runtime: `nodejs`** | ~15 | Puppeteer/FWC search, Incolink export (CPU-bound) |
| **Runtime: default (edge)** | ~127 | Standard API routes (Vercel edge functions) |
| **`dynamic = 'force-dynamic'`** | ~60+ | Explicitly cache-busting routes |
| **Supabase client type** | See table below | Mixed patterns |
| **External SDK scope** | See section 3 | One module-level init found |

**Representative route sample:**

| Path | Methods | Supabase client | External SDKs | Timeout discipline | Key observations |
|------|---------|-----------------|---------------|-------------------|-----------------|
| `/api/health/route.ts` | GET, HEAD, PUT, POST | None | `monitoring`, `featureFlags` | None explicit; health checks bounded by `Promise.allSettled` (112–114) | Zero-dependency design; responds in <1s for HEAD. **OA Lesson 2 compliant.** |
| `/api/help/chat/route.ts` | POST | `createServerSupabase()` | **`Anthropic` (module-scope line 7)** | None found; SSE stream unbounded | **CRITICAL FINDING (F-API-01):** Anthropic instantiated at module top; builds execute that code; possible cold-start stall |
| `/api/bci/normalize-single/route.ts` | POST | `createServerSupabase()` | None (proxies to worker) | **AbortController + 30s timeout (lines 64–68)** | Excellent timeout pattern for upstream worker; matches OA lesson 5 |
| `/api/projects/quick-list/route.ts` | GET | `createServerSupabase()` | None | None found (Supabase query is db-bounded) | Explicit FK reference (line 47: `job_sites!fk_job_sites_project`); fixes PostgREST ambiguity (A4.1) |
| `/api/admin/refresh-views/route.ts` | POST, GET | `createServerSupabase()` | None | None explicit; materialised view refresh can take 10–30s on Vercel | **Cron route:** only role-checked (lines 41–52), NOT cron-secret-verified (see F-API-03) |
| `/api/employers/[employerId]/ratings-4point/route.ts` | GET | `createServerSupabase()` | None | None found | Large response; 50+ lines inspected; full route inspection recommended |
| `/api/fwc-search/route.ts` | POST | `createServerSupabase()` | **Puppeteer-core, Chromium** | Custom polling loop (up to 30s); no explicit AbortController on page operations | Long-running (FWC website scrape); Puppeteer timeout 30s but no overall route timeout |
| `/api/incolink/export/route.ts` | POST | `createServerSupabase()` | **Puppeteer** | Custom polling; no route-level timeout | Similar to FWC; Puppeteer can timeout but route unbounded |
| `/api/help/feedback/route.ts` | POST | `createServerSupabase()` | None | None | Simple auth + write; no timeout needed (Supabase op <100ms typically) |
| `/api/public/form-data/[token]/route.ts` | GET, POST | `createServerSupabase()` (anon) | None | None found | Public token-based access; RLS-backed RPCs; no explicit timeout |

---

## Findings

### F-API-01: Module-scope SDK instantiation in `/api/help/chat/route.ts`

**Severity:** **MEDIUM** (cold-start impact, not runtime failure)  
**Evidence:**
- Line 7: `const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })`
- Not lazy-loaded; executes on every Vercel cold start and build time
- OA peer-platform report § Issue 2 lists this as anti-pattern: *"Never instantiate third-party SDK clients at module top level"*

**Impact:**
- Cold starts may stall on SDK initialization (typically <100ms for Anthropic, but cumulative with other SDK inits)
- Build time adds SDK init overhead (not critical but visible in CI logs)
- Does **not** directly cause Supabase timeout, but contributes to function initialization latency

**OA cross-ref:**
- NEXTJS_SUPABASE_VERCEL_TROUBLESHOOTING_REPORT.md § Issue 2 lesson 3: *"Never instantiate third-party SDK clients at module top level"*
- Phase A inventory (A2.1, A2.2) mentions this pattern was "fixed" in Resend, but Anthropic chat route was not audited

**Proposed fix:**
```ts
// OLD (line 7, module scope)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// NEW (per-request lazy init)
export async function POST(request: NextRequest) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  // ... rest of handler
}
```

**Risk:** Low; Anthropic SDK is lightweight. Fix is mechanical. No behavioral change.

**Rollout:** Inline fix; no config, no env var changes.

---

### F-API-02: Cache-Control header applied to all `/api/*` routes including auth-sensitive endpoints

**Severity:** **MEDIUM** (data leakage risk on shared caches)  
**Evidence:**
- `next.config.mjs:84–89`:
```ts
{
  source: '/api/(.*)',
  headers: [
    { key: 'Cache-Control', value: 'public, max-age=60, stale-while-revalidate=300' },
  ],
}
```
- Applies **globally** to all API routes with `public` caching + 60s max-age + 300s stale window
- No per-route exclusion for auth-sensitive endpoints (e.g. `/api/user/profile`, `/api/admin/*`, `/api/employers/*/ratings-4point`)

**Impact:**
- User profile data, admin operations, and rating mutations may be cached and served to other users or proxies
- CDN (Vercel Edge Cache) will cache 401/403 responses for 60s, masking auth state changes
- "Stale-while-revalidate=300" extends cache freshness to 5 min; background revalidation may serve stale auth-denied data

**OA cross-ref:**
- NEXTJS_SUPABASE_VERCEL_TROUBLESHOOTING_REPORT.md § Architecture lessons: *"Two lanes fail independently"* — caching misses on API lane are harder to diagnose than browser-direct failures

**Proposed fix:**
```ts
// In next.config.mjs, split /api routes:
{
  source: '/api/health',  // Stateless health checks only
  headers: [{ key: 'Cache-Control', value: 'public, max-age=60, stale-while-revalidate=300' }],
},
{
  source: '/api/(admin|user|employers|ratings|projects)/(.*)',  // Auth-sensitive
  headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
},
{
  source: '/api/(.*)',  // Remaining routes (dashboard, utilities)
  headers: [{ key: 'Cache-Control', value: 'private, max-age=60, stale-while-revalidate=300' }],
},
```

**Risk:** Medium; may unmask existing session-skew issues if caching is the masking layer.

**Rollout:** Config-only change; no code churn; requires load-test for cache hit rate impact.

---

### F-API-03: Cron route `/api/admin/refresh-views` lacks CRON_SECRET verification

**Severity:** **MEDIUM-HIGH** (unauthenticated job trigger)  
**Evidence:**
- `src/app/api/admin/refresh-views/route.ts:25–53`
- Authentication check: line 32–39 uses `supabase.auth.getUser()`
  - Vercel cron **has no user session**; `getUser()` returns `null`
  - Line 34–38 returns 401 for missing user
  - **Cron trigger fails auth check; route is unreachable via Vercel cron**

- No `CRON_SECRET` header validation found
- `vercel.json:2–6` defines cron schedule but no auth mechanism specified:
```json
{
  "crons": [
    { "path": "/api/admin/refresh-views", "schedule": "0 2 * * *" }
  ]
}
```

**Impact:**
- Vercel cron requests **will be rejected** (401) because they lack user session
- Materialised view refresh **does not run automatically**; only manual (UI) triggers work
- Weekly/daily data refresh dependency unmet; dashboard queries may operate on stale data

**OA cross-ref:**
- NEXTJS_SUPABASE_VERCEL_TROUBLESHOOTING_REPORT.md § Issue 4: *"Cron and webhooks have no user session — use service role + separate auth"*
- Phase A inventory row A2.5 references this fix but does not confirm implementation

**Proposed fix:**
```ts
// src/app/api/admin/refresh-views/route.ts
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Check cron secret first (before auth, before user check)
    const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid cron secret' },
        { status: 401 }
      )
    }

    // Use service-role client for cron (bypass RLS)
    const supabase = await createAdminClient()
    
    // No getUser() call; cron is authenticated via secret, not user session
    // ... rest of refresh logic
  }
}
```

- Add `CRON_SECRET` env var to Vercel production (e.g. randomly generated, stored in settings)
- Update `vercel.json` to inject secret (if Vercel supports; otherwise, document manual trigger requirement)

**Risk:** High; breaks automated data refresh. Phase A docs claim this is fixed, but code contradicts. Requires verification on live project.

**Rollout:** Env var + code change; test cron manually post-deploy.

---

### F-API-04: No bounded fetch timeouts on client-side `/api/*` calls

**Severity:** **HIGH** (silent infinite spinners, matches OA Issue 2)  
**Evidence:**
- Grep found 20+ `fetch('/api/` calls in client components (src/app, src/components):
  - `src/app/providers.tsx`: `fetch('/api/debug/vercel-diagnostics', { cache: 'no-store' })`
  - `src/app/(app)/admin/page.tsx`: Multiple `fetch('/api/admin/*')` calls without AbortController
  - `src/components/assessments/UnionRespectAssessment4Point.tsx`: `fetch('/api/assessments/union-respect-4-point')`
  - `src/components/employers/IncolinkActionModal.tsx`: `fetch('/api/scraper-jobs')` (unbounded Puppeteer call)
  - `src/components/projects/BatchManagementDashboard.tsx`: `fetch('/api/projects/batch-upload/*')`
- **No `fetchApi()` wrapper with bounded timeouts found** (OA report referenced `/lib/api/fetch-api.ts` as pattern; does not exist in CFMEU)
- No `X-Request-Id` header injection found

**Impact:**
- API hangs (e.g. Incolink timeout, Puppeteer stall, DB lock) cause UI to freeze indefinitely
- Network tab shows pending request; no error/abort signal
- User perceives "app disconnected" (OA Issue 2 symptom); server is still processing
- Matches Phase A Issue 2: "Silent infinite spinners on API-backed features"

**OA cross-ref:**
- NEXTJS_SUPABASE_VERCEL_TROUBLESHOOTING_REPORT.md § Issue 2: *"Add fetch timeouts everywhere"* (lesson 5)
- § Issue 2.4: "Lane 2 hangs + no client timeout → add `fetchApi()` with bounded timeouts + `X-Request-Id`"
- Phase A inventory row A2.6 references `fetchApi()` pattern but does not confirm file exists

**Proposed fix:**
Create `src/lib/api/fetch-api.ts`:
```ts
const DEFAULT_TIMEOUT_MS = 60_000  // 60s default
const LONG_OP_TIMEOUT_MS = 120_000  // 120s for uploads/LLM
const SSE_TIMEOUT_MS = 600_000      // 10min for server-sent events

export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit & { timeout?: number } = {},
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT_MS, ...fetchOpts } = options
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  const requestId = crypto.randomUUID()

  try {
    const response = await fetch(endpoint, {
      ...fetchOpts,
      signal: controller.signal,
      headers: {
        ...fetchOpts.headers,
        'X-Request-Id': requestId,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}
```

Then replace all client `fetch('/api/...')` with `fetchApi('/api/...')`.

**Risk:** Low; adds exception handling; must not break mutation error paths. Test with intentional API route timeout.

**Rollout:** Phased per component; start with critical paths (ratings, projects, admin).

---

### F-API-05: Long-running routes (Puppeteer, Anthropic streaming) have no explicit route-level timeout

**Severity:** **MEDIUM-HIGH** (unresponsive Vercel function, 10+ min hang risk)  
**Evidence:**
- `/api/fwc-search/route.ts`: Custom polling loop up to 30s; no route-level AbortController
- `/api/incolink/export/route.ts`: Puppeteer export with internal timeouts but no overall route timeout
- `/api/help/chat/route.ts`: Anthropic streaming (SSE); stream may run until Vercel 10min limit (currently no earlier bound)
- Vercel Functions default timeout: 60s on pro plan; 10s on hobby (Phase A docs don't specify account tier)

**Impact:**
- Route may exhaust Vercel timeout (10–60s depending on plan); client receives 504 with no response body
- Vercel billable duration: full timeout consumed (even if client aborted)
- Difficult to distinguish from Supabase hang (Lane 1 vs Lane 2 diagnosis)

**OA cross-ref:**
- NEXTJS_SUPABASE_VERCEL_TROUBLESHOOTING_REPORT.md § Architecture lessons: *"Keep a zero-dependency `/api/health` route"*; implies route timeouts are expected

**Proposed fix:**
Update long-running routes with escape hatches:
```ts
// In /api/fwc-search/route.ts
const VERCEL_TIMEOUT_MS = 55_000  // 55s (5s buffer before Vercel 60s hard limit)
const routeController = new AbortController()
const routeTimeoutId = setTimeout(() => routeController.abort(), VERCEL_TIMEOUT_MS)

try {
  // ... polling loop with routeController.signal check
} finally {
  clearTimeout(routeTimeoutId)
}
```

- Document Vercel timeout in code comment (add `maxDuration` in `vercel.json` if needed)

**Risk:** Low; degrades gracefully (early 504 vs late 504). Must log abort to Sentry.

**Rollout:** Per-route basis; start with FWC, Incolink, Anthropic chat.

---

### F-API-06: No `/api/ping` zero-dependency smoke endpoint

**Severity:** **LOW** (operational/observability)  
**Evidence:**
- `/api/health/route.ts` exists but depends on `monitoring`, `featureFlags` modules
- No standalone `/api/ping` that responds "OK" in <10ms
- OA peer-platform reference: § Issue 2 lesson 2: *"Keep a zero-dependency `/api/ping` smoke route"*

**Impact:**
- Vercel routing diagnostics harder (cannot isolate Vercel infrastructure from app code)
- Monitoring tools must use `/api/health` which may fail if feature flags are misconfigured

**Proposed fix:**
Create `/api/ping/route.ts`:
```ts
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ status: 'ok' }, {
    headers: { 'Cache-Control': 'no-cache, must-revalidate' },
  })
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
```

**Risk:** None; zero-dependency, no state mutation.

**Rollout:** Standalone PR; documentation update to monitoring runbook.

---

## Open questions

1. **Cron authentication (F-API-03):** Is `CRON_SECRET` env var set on Vercel production? Does `/api/admin/refresh-views` run automatically or require manual trigger?
   - User input needed: Verify Vercel project env vars and cron logs (Vercel dashboard → Deployments → Cron Logs)

2. **API caching safety (F-API-02):** Are there shared CDN caches (Vercel Edge, customer proxies) that may serve stale auth-sensitive data?
   - User input needed: Load test with repeated requests to `/api/user/profile` across tabs; check cache hit ratio

3. **RatingsView navigation status:** Phase A inventory flags conflict on whether `RatingsView.tsx` uses Dialog pattern or `window.location.href`. Current state?
   - User input needed: Grep for `setIsAddRatingOpen` in RatingsView.tsx; confirm Dialog pattern is live

4. **Service Worker version:** Phase A inventory notes SW version progression (2.2 → 2.4); does `public/sw.js` current version include deferred activation for iOS PWA?
   - User input needed: Read `public/sw.js` and check version comment/header

---

## Summary

| Category | Status | Counts | Risk |
|----------|--------|--------|------|
| **Middleware matcher** | ✅ VERIFIED | API excluded from middleware; correct | None |
| **Cron auth** | ❌ BROKEN | Cron route fails 401; views not auto-refreshing | High |
| **Module-scope SDK init** | ❌ FOUND | 1 instance (Anthropic chat) | Medium (cold-start impact) |
| **Client fetch timeouts** | ❌ MISSING | 20+ unbounded `/api/` calls | High (silent hangs) |
| **API caching headers** | ⚠️ UNSAFE | Global `public, max-age=60` on all `/api/*` | Medium (data leakage) |
| **Route-level timeouts** | ⚠️ INCONSISTENT | Puppeteer/Anthropic routes have no route cap | Medium-High |
| **Zero-dependency health** | ⚠️ PARTIAL | `/api/health` exists but depends on modules; no `/api/ping` | Low |
| **Total API routes** | 142 | 60+ `force-dynamic`, ~15 nodejs runtime | — |

---

## Recommendations for Phase B / Phase C

1. **Immediate (critical):**
   - Fix cron authentication in `/api/admin/refresh-views` (F-API-03); unblock auto-refresh of materialised views
   - Add `fetchApi()` wrapper with bounded timeouts to client components (F-API-04); unblock UI hang diagnosis

2. **Short-term (1–2 sprints):**
   - Move Anthropic init inside POST handler (F-API-01)
   - Split `/api/*` cache headers by auth sensitivity (F-API-02)
   - Add route-level timeout escapes to FWC, Incolink, Anthropic routes (F-API-05)

3. **Long-term (observability):**
   - Add `/api/ping` smoke endpoint (F-API-06)
   - Implement server-side stage logging on critical API routes (e.g. `auth_ok`, `db_fetch_ok`, `provider_done`)
   - Index API route timeouts in Sentry; establish SLO for median API response time

---

**End of B2 Diagnostic Report**
