### Load test plan (no changes executed)

Targets
- Web: `GET /api/projects` (paged), `GET /api/health/workers` (admin only; skip without token), `GET /` (SSR)
- Worker: `GET {DASHBOARD_WORKER}/v1/projects`, `GET {DASHBOARD_WORKER}/v1/dashboard`

Test data strategy
- Use a limited set of patchIds (3–5) that map to 50–200 projects.
- Use tiers/stages/universe combinations that exist.
- Use pageSize=24 and 100; pages 1–3.

Success criteria
- p95 latency ≤ 500ms for projects/dashboard endpoints
- Error rate < 1%
- No timeouts; no 5xx spikes; DB remains below 70% CPU during test window

Abort criteria
- p95 > 800ms for 3 consecutive minutes
- Error rate ≥ 5% for 1 minute

Warm-up
- 5 minutes ramp: 1 → 10 VUs
- Keep-alive enabled

k6 script (template)
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 25,
  duration: '15m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
  scenarios: {
    projects_browse: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '5m', target: 10 },
        { duration: '5m', target: 25 },
        { duration: '5m', target: 25 },
      ],
      exec: 'browseProjects',
    },
    dashboard_metrics: {
      executor: 'shared-iterations',
      vus: 5,
      iterations: 500,
      exec: 'dashboard',
      startTime: '2m',
    },
  },
};

const BASE = __ENV.APP_URL || 'https://your-vercel-app.vercel.app';
const WORKER = __ENV.WORKER_URL || 'https://your-dashboard-worker.railway.app';
const TOKEN = __ENV.USER_JWT || '';

export function browseProjects() {
  const pages = [1, 2, 3];
  const sorts = ['name', 'workers', 'members'];
  const tier = 'tier1';
  const stage = 'construction';

  const page = pages[Math.floor(Math.random() * pages.length)];
  const sort = sorts[Math.floor(Math.random() * sorts.length)];

  const url = `${BASE}/api/projects?page=${page}&pageSize=24&sort=${sort}&dir=asc&tier=${tier}&stage=${stage}`;
  const res = http.get(url);
  check(res, {
    '200': (r) => r.status === 200,
    'body': (r) => r.body && r.body.length > 0,
  });
  sleep(1);
}

export function dashboard() {
  if (!TOKEN) return; // skip if not provided
  const url = `${WORKER}/v1/dashboard?tier=tier1`;
  const res = http.get(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  check(res, {
    '200': (r) => r.status === 200,
  });
  sleep(1);
}
```

autocannon quick checks
```bash
# Projects first-page
autocannon -c 25 -d 180 "${APP_URL}/api/projects?page=1&pageSize=24&sort=name&dir=asc"

# Worker projects with JWT
autocannon -c 25 -d 180 -H "Authorization: Bearer $USER_JWT" "${WORKER_URL}/v1/projects?page=1&pageSize=24&sort=name&dir=asc"

# Dashboard metrics
autocannon -c 10 -d 120 -H "Authorization: Bearer $USER_JWT" "${WORKER_URL}/v1/dashboard?tier=tier1"
```

Observability during tests
- Capture `debug.queryTime`, `X-Cache` headers from worker
- Monitor Supabase logs for slow queries; capture top predicates

Follow-ups if SLO not met
- Paginate employers and heavy client lists via server/worker
- Add/verify indexes in `INDEXES_AND_QUERIES.md`
- Remove hot-path materialized view refresh from Next.js route
