# BCI Import Worker (local)

- Port: 3250
- Stack: Fastify (TypeScript) + @fastify/multipart + xlsx
- Purpose: Accept a BCI .xlsx export with two sheets (Project, Company), drop the first blank row, validate headers, and return normalized JSON for the app's two-stage import.

## Run locally

```
npm install
npm run dev
# server listens on http://localhost:3250
```

## Endpoint

- POST /bci/normalize-xlsx
  - Content-Type: multipart/form-data
  - Field: file (the .xlsx)
  - Response: { projects: NormalizedProjectRow[], companies: NormalizedCompanyRow[], warnings: string[] }

Example curl:

```
curl -s -X POST \
  -F "file=@/path/to/BCI-export.xlsx" \
  http://localhost:3250/bci/normalize-xlsx | jq
```

## Limits and validation
- File size: <= 1MB
- Sheets must include: Project and Company
- Required columns:
  - Project: Project ID, Project Name, Project Stage
  - Company: Project ID, Company Name, Role on Project
- Optional fields are parsed when present (dates, value, address, lat/lng, etc.).

## Notes
- The repo's .vercelignore excludes railway_workers/** so Vercel will not build this folder.
- Intended for local development/testing and Railway deployment when ready.
