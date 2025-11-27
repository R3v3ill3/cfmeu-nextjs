import dotenv from 'dotenv'

dotenv.config()

const requiredVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_ANON_KEY',
]

for (const key of requiredVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

// Default allowed origins for CORS (production + local development)
const DEFAULT_CORS_ORIGINS = [
  'https://cfmeu.uconstruct.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]

// Parse CORS_ORIGIN env var - can be comma-separated list or single origin or '*'
function parseCorsOrigins(): string[] | '*' {
  const envOrigin = process.env.CORS_ORIGIN
  if (!envOrigin) return DEFAULT_CORS_ORIGINS
  if (envOrigin === '*') return '*'
  // Support comma-separated list of origins
  return envOrigin.split(',').map(o => o.trim()).filter(Boolean)
}

export const config = {
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY!,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
  databaseUrl: process.env.DATABASE_URL ?? null,
  refreshCron: process.env.REFRESH_CRON ?? '*/10 * * * *',
  dashboardSnapshotCron: process.env.DASHBOARD_SNAPSHOT_CRON ?? '0 2 * * 1', // Every Monday at 2 AM
  port: Number(process.env.PORT ?? 3000),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 15000),
  corsOrigins: parseCorsOrigins(),
  organizingMetricsWarmUrl: process.env.ORGANIZING_METRICS_WARM_URL ?? null,
  organizingMetricsWarmToken: process.env.ORGANIZING_METRICS_WARM_TOKEN ?? null,
}
