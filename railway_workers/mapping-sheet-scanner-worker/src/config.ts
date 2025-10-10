import { existsSync } from 'fs'
import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'path'

// Load env files without forcing developers to duplicate secrets for this worker.
// Priority: repo root (.env.local -> .env) then worker-specific overrides.
const envFiles = [
  resolve(__dirname, '../../../.env.local'),
  resolve(__dirname, '../../../.env'),
  resolve(__dirname, '../../.env.local'),
  resolve(__dirname, '../../.env'),
]

for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    dotenvConfig({ path: envFile, override: false })
  }
}

import dotenv from 'dotenv'

dotenv.config()

export const config = {
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  
  // AI Provider Keys
  claudeApiKey: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY!,
  openaiApiKey: process.env.OPENAI_API_KEY!,
  
  // Worker settings
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '5000', 10),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
  verboseLogs: process.env.SCANNER_VERBOSE_LOGS === 'true',
  
  // PDF settings
  maxPdfPages: 3,
  maxFileSizeMB: 10,
  
  // AI settings
  claudeModel: 'claude-sonnet-4-5-20250929',
  openaiModel: 'gpt-4-vision-preview',
  maxTokens: 4096,
  
  // Cost tracking (USD per 1K tokens/images)
  claudeCostPer1kInput: 0.003,
  claudeCostPer1kOutput: 0.015,
  openaiCostPer1kTokens: 0.01,
}

// Validate required env vars
const requiredVars = {
  'SUPABASE_URL': process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
  'CLAUDE_API_KEY or ANTHROPIC_API_KEY': process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY,
  'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
}

for (const [key, value] of Object.entries(requiredVars)) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}
