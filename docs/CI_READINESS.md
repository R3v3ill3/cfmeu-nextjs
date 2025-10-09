### CI readiness (restore type/lint gates safely)

Pipeline changes
- Add a CI step that runs and fails on:
```bash
pnpm i --frozen-lockfile
pnpm exec tsc --noEmit
pnpm exec eslint . --max-warnings 0
```
- Block merges to main if CI fails; Vercel should deploy only after CI success.

Next.js config (keep local lenience, enforce in CI)
- Keep `ignoreBuildErrors` and `ignoreDuringBuilds` for local dev only; in CI, set env `STRICT_CI=1` and wrap in `next.config.mjs`:
```js
const strict = process.env.STRICT_CI === '1'
typescript: { ignoreBuildErrors: !strict },
eslint: { ignoreDuringBuilds: !strict },
```

Prioritized fixes (first pass)
- Fix API type errors that break inserts and RPC calls:
  - `api/public/form-data/[token]`
  - `api/projects/new-from-scan`
  - `api/help/chat`
  - Admin import/merge flows
- Regenerate Supabase types after RPC additions:
```bash
npx supabase gen types typescript --project-id <PROJECT_ID> > src/types/database.ts
```
- Ensure enums align with DB (project_type, role, stage_class, etc.).

Safeguards
- Run `next build` after `tsc/eslint` in CI to catch route-level issues.
- Use feature flags to ship non-breaking partial fixes.
