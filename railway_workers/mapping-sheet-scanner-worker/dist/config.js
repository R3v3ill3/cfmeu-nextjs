"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const fs_1 = require("fs");
const dotenv_1 = require("dotenv");
const path_1 = require("path");
// Load env files without forcing developers to duplicate secrets for this worker.
// Priority: repo root (.env.local -> .env) then worker-specific overrides.
const envFiles = [
    (0, path_1.resolve)(__dirname, '../../../.env.local'),
    (0, path_1.resolve)(__dirname, '../../../.env'),
    (0, path_1.resolve)(__dirname, '../../.env.local'),
    (0, path_1.resolve)(__dirname, '../../.env'),
];
for (const envFile of envFiles) {
    if ((0, fs_1.existsSync)(envFile)) {
        (0, dotenv_1.config)({ path: envFile, override: false });
    }
}
const dotenv_2 = __importDefault(require("dotenv"));
dotenv_2.default.config();
exports.config = {
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    // AI Provider Keys
    claudeApiKey: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
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
    // Timeout settings (in milliseconds)
    claudeTimeoutMs: parseInt(process.env.CLAUDE_TIMEOUT_MS || '60000', 10), // 60 seconds default
    claudeMaxRetries: parseInt(process.env.CLAUDE_MAX_RETRIES || '1', 10), // Retry once on timeout
    // Graceful shutdown settings
    // Must be longer than Claude timeout + retries to allow jobs to complete
    // Formula: (claudeTimeoutMs * (1 + claudeMaxRetries)) + buffer
    // Default: (60s * 2) + 30s buffer = 150 seconds
    gracefulShutdownTimeoutMs: parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS || '150000', 10),
    // Worker scaling settings
    // Note: When scaling to 10+ workers, ensure:
    // - Supabase connection limits are not exceeded (JS client uses REST API, not persistent connections)
    // - Claude API rate limits are respected (50 req/min on standard tier)
    // - Each worker uses singleton Supabase client (already implemented)
    workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '1', 10), // Jobs per worker (1 = sequential)
    // Cost tracking (USD per 1K tokens/images)
    claudeCostPer1kInput: 0.003,
    claudeCostPer1kOutput: 0.015,
    openaiCostPer1kTokens: 0.01,
};
// Validate required env vars
const requiredVars = {
    'SUPABASE_URL': process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'CLAUDE_API_KEY or ANTHROPIC_API_KEY': process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY,
    'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
};
for (const [key, value] of Object.entries(requiredVars)) {
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
}
