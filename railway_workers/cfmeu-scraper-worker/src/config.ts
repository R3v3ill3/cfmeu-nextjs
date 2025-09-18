import dotenv from 'dotenv'

dotenv.config()

const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'INCOLINK_EMAIL',
  'INCOLINK_PASSWORD',
]

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

export const config = {
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY!,
  incolinkEmail: process.env.INCOLINK_EMAIL!,
  incolinkPassword: process.env.INCOLINK_PASSWORD!,
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 5000),
  lockTimeoutMs: Number(process.env.LOCK_TIMEOUT_MS ?? 5 * 60_000),
}
