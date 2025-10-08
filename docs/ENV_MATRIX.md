### Environment matrix (apps and workers)

Legend
- R: required  S: secret  P: public  DevDefault: value used in dev fallback

Web app (Vercel/Local)

| Var | Scope | R | S | DevDefault |
| --- | --- | --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | client | R |  | — |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | client | R |  | — |
| SUPABASE_URL | server | R | S | falls back to NEXT_PUBLIC_* in server.ts |
| SUPABASE_ANON_KEY | server | R | S | falls back to NEXT_PUBLIC_* in server.ts |
| SUPABASE_SERVICE_ROLE_KEY | server | R (some API routes) | S | — |
| NEXT_PUBLIC_DASHBOARD_WORKER_URL | client | optional |  | http://localhost:3200 (CSP adds in dev) |
| NEXT_PUBLIC_USE_WORKER_DASHBOARD | client | optional |  | false |
| NEXT_PUBLIC_USE_WORKER_PROJECTS | client | optional |  | false |
| NEXT_PUBLIC_GOOGLE_MAPS_API_KEY | client | optional |  | — |

cfmeu-dashboard-worker (Railway)

| Var | R | S |
| --- | --- | --- |
| SUPABASE_URL | R | S |
| SUPABASE_SERVICE_KEY | R | S |
| SUPABASE_ANON_KEY | R | S |
| DATABASE_URL | optional | S |
| PORT | optional |  |
| CORS_ORIGIN | optional |  |
| REFRESH_CRON | optional |  |
| REQUEST_TIMEOUT_MS | optional |  |

cfmeu-scraper-worker (Railway)

| Var | R | S |
| --- | --- | --- |
| SUPABASE_URL | R | S |
| SUPABASE_SERVICE_KEY | R | S |
| INCOLINK_EMAIL | R | S |
| INCOLINK_PASSWORD | R | S |
| POLL_INTERVAL_MS | optional |  |
| LOCK_TIMEOUT_MS | optional |  |
| CHROME_PATH | optional |  |
| PUPPETEER_EXECUTABLE_PATH | optional |  |

mapping-sheet-scanner-worker (Railway)

| Var | R | S |
| --- | --- | --- |
| SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL | R | S |
| SUPABASE_SERVICE_ROLE_KEY | R | S |
| CLAUDE_API_KEY or ANTHROPIC_API_KEY | R | S |
| OPENAI_API_KEY | R | S |
| POLL_INTERVAL_MS | optional |  |
| MAX_RETRIES | optional |  |

bci-import-worker (Railway)

| Var | R | S |
| --- | --- | --- |
| PORT | optional |  |
| ALLOWED_ORIGIN | optional |  |

Cross-service conventions
- Service role keys are used only on server/worker processes; never shipped to browser.
- Browser and SSR use anon key; RLS policies must allow intended reads/writes per role.


