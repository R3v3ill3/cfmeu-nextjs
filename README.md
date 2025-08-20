This is a Next.js App Router project prepared to migrate a Vite/React app.

## Getting Started

Environment variables (create `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GOOGLE_MAPS_API_KEY=
# Optional server-side only
SUPABASE_SERVICE_ROLE_KEY=
```

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open http://localhost:3000 with your browser. Auth is mounted at `/auth`. Protected routes live under `src/app/(app)/*`.

Update pages under `src/app/(app)` to render components copied into `src/components`.

## Deploy on Railway

Railway uses `railway.toml`. Build uses `npm run build` and start uses `npm start`.

## Learn More

See Next.js docs if needed: https://nextjs.org/docs

## Database migrations for patches

Run the following SQL files on your Supabase/Postgres instance in order:

- `sql/001_patches.sql`: creates core tables, views and helper functions
- `sql/002_patches_rls.sql`: enables RLS and basic policies
- `sql/003_patches_backfill.sql`: optional backfill from legacy `job_sites.patch`

After running, the Patch page and admin Patch Manager will populate from the new schema. The UI falls back to legacy fields until migrations are applied.