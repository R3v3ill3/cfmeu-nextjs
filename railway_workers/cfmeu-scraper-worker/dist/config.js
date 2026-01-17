"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'INCOLINK_EMAIL',
    'INCOLINK_PASSWORD',
];
for (const key of required) {
    if (!process.env[key]) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
}
exports.config = {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
    incolinkEmail: process.env.INCOLINK_EMAIL,
    incolinkPassword: process.env.INCOLINK_PASSWORD,
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 5000),
    lockTimeoutMs: Number(process.env.LOCK_TIMEOUT_MS ?? 5 * 60000),
    // Environment isolation:
    // - Railway production should run with WORKER_ENV=production (default when NODE_ENV=production)
    // - Local development should run with WORKER_ENV=development (default when NODE_ENV!=production)
    workerEnv: process.env.WORKER_ENV ??
        (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
    // Retry configuration for FWC scraper
    retry: {
        maxAttempts: Number(process.env.RETRY_MAX_ATTEMPTS ?? 4),
        initialDelayMs: Number(process.env.RETRY_INITIAL_DELAY_MS ?? 2000),
        maxDelayMs: Number(process.env.RETRY_MAX_DELAY_MS ?? 30000),
        backoffMultiplier: Number(process.env.RETRY_BACKOFF_MULTIPLIER ?? 2),
        jitterMaxMs: Number(process.env.RETRY_JITTER_MAX_MS ?? 1000),
    },
    // Graceful shutdown settings
    // FWC jobs can take up to 5 minutes with retries (75s * 4 attempts)
    // Incolink jobs are typically faster but can have network delays
    // Formula: (maxJobTime * retries) + buffer
    // Default: 5 minutes (300s) to accommodate worst-case FWC retries
    gracefulShutdownTimeoutMs: Number(process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS ?? 300000),
};
