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

## Mobile PWA install (foreground geofencing)

Geofencing reminders on iOS require the web app to run as a Progressive Web App (PWA):

1. Visit `https://<env>/mobile` in Safari on iOS 16.4+.
2. Tap the Share icon → **Add to Home Screen** to install the shell (iOS forces installation via Safari even if you normally browse in Chrome).
3. Launch the installed app, open **Settings → Notifications**, enable **Site Visit Geofencing**, and grant *While Using the App* location access when prompted.
4. Keep the installed PWA in the foreground while moving between sites. Reminders display as in-app toasts/banners (no background notifications).

Update pages under `src/app/(app)` to render components copied into `src/components`.

## Deployment environments

| Environment | Purpose | URL / Target | Notes |
|-------------|---------|--------------|-------|
| Local dev | Full-stack development with all services running on the workstation | `http://localhost:3000` (Next.js dev server) | Service worker registration is allowed on `localhost`, so PWA tests (including foreground geofencing) work during development. |
| Production | Mobile organisers and desktop users | `https://cfmeu.uconstruct.app` (Vercel) | This is the canonical install target for iOS PWAs. All foreground geofencing messaging should reference this hostname when providing instructions. |
| Background workers | Scraper, dashboard cache, scanner, etc. | Railway deployments | These workers share the same Supabase project as the Vercel app. Ensure environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and service keys) point to the shared project in both environments. |

Key deployment considerations:
- The PWA service worker (`/sw.js`) is registered relative to the current origin, so it automatically scopes itself to either `localhost` or `cfmeu.uconstruct.app` without code changes.
- Supabase credentials are provided via environment variables; Vercel and Railway should both consume the same `.env` values (via project secrets) to guarantee a single data source.
- When documenting iOS install steps, reference the production hostname so organisers add the correct web app to their home screens.

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

## Incolink Export Probe (local validation)

To validate the automated Incolink export flow locally:

1. Create a `.env` file with:
```
INCOLINK_EMAIL=your_email
INCOLINK_PASSWORD=your_password
```
2. Run the probe script:
```
npm run probe:incolink
```
Or pass a specific employer number:
```
npx tsx scripts/incolink_probe.ts 7125150
```

### Incolink Invoice Members CSV API

Once dev server is running (`npm run dev`), you can fetch members as CSV by posting an employer number (and optional invoice number). The endpoint will log in, open the first non-zero invoice (or the provided one), extract members from the first column, and return a CSV file.

```
curl -X POST http://localhost:3000/api/incolink/invoice-members \
  -H 'Content-Type: application/json' \
  -d '{"incolinkNumber":"7125150"}' -o invoice-members.csv
```

