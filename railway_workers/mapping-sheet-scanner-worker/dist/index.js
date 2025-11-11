"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const supabase_1 = require("./supabase");
const jobs_1 = require("./jobs");
const mappingSheetProcessor_1 = require("./processors/mappingSheetProcessor");
const express_1 = __importDefault(require("express"));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Graceful shutdown state
let isShuttingDown = false;
let currentJobId = null;
async function handleJob(job) {
    const client = (0, supabase_1.getAdminClient)();
    console.log(`[worker] Handling job ${job.id} (${job.job_type})`);
    try {
        const result = await (0, mappingSheetProcessor_1.processMappingSheetScan)(client, job);
        console.log(`[worker] Job ${job.id} completed:`, result);
        await (0, jobs_1.markJobStatus)(client, job.id, 'succeeded', {
            lock_token: null,
            locked_at: null,
            last_error: null,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[worker] Job ${job.id} failed (attempt ${job.attempts}/${job.max_attempts}):`, message);
        const shouldRetry = job.attempts < job.max_attempts;
        const nextStatus = shouldRetry ? 'queued' : 'failed';
        // Exponential backoff: 5s, 10s, 20s, 40s...
        // Formula: baseDelay * 2^(attempts - 1), capped at 60 seconds
        const backoffDelayMs = shouldRetry
            ? Math.min(config_1.config.pollIntervalMs * Math.pow(2, job.attempts - 1), 60000)
            : 0;
        if (shouldRetry) {
            console.log(`[worker] Scheduling retry for job ${job.id} in ${backoffDelayMs}ms`);
        }
        await (0, jobs_1.markJobStatus)(client, job.id, nextStatus, {
            lock_token: null,
            locked_at: null,
            last_error: message,
            run_at: shouldRetry
                ? new Date(Date.now() + backoffDelayMs).toISOString()
                : job.run_at,
        });
    }
    finally {
        await (0, jobs_1.releaseJobLock)(client, job.id);
    }
}
async function workerLoop() {
    const client = (0, supabase_1.getAdminClient)();
    let lastCleanup = Date.now();
    const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    console.log('[worker] Starting mapping sheet scanner worker with graceful shutdown support');
    if (config_1.config.verboseLogs) {
        console.log('[worker] Configuration:', {
            supabaseUrl: config_1.config.supabaseUrl,
            pollIntervalMs: config_1.config.pollIntervalMs,
            maxRetries: config_1.config.maxRetries,
            claudeModel: config_1.config.claudeModel,
        });
    }
    while (!isShuttingDown) {
        try {
            // Periodic stale lock cleanup
            if (Date.now() - lastCleanup > CLEANUP_INTERVAL_MS) {
                await (0, jobs_1.cleanupStaleLocks)(client, config_1.config);
                lastCleanup = Date.now();
            }
            const job = await (0, jobs_1.reserveNextJob)(client);
            if (!job) {
                await sleep(config_1.config.pollIntervalMs);
                continue;
            }
            currentJobId = job.id;
            try {
                await handleJob(job);
            }
            finally {
                currentJobId = null;
            }
        }
        catch (error) {
            console.error('[worker] Loop error:', error);
            await sleep(config_1.config.pollIntervalMs);
        }
    }
    console.log('[worker] Worker loop exited gracefully');
}
async function gracefulShutdown() {
    console.log('[shutdown] Received shutdown signal, initiating graceful shutdown...');
    isShuttingDown = true;
    // Wait for current job to complete
    // Timeout must be longer than Claude timeout + retries to allow job completion
    const maxWait = config_1.config.gracefulShutdownTimeoutMs;
    const startTime = Date.now();
    console.log(`[shutdown] Will wait up to ${maxWait}ms for current job to complete`);
    while (currentJobId && (Date.now() - startTime < maxWait)) {
        console.log(`[shutdown] Waiting for job ${currentJobId} to complete...`);
        await sleep(1000);
    }
    if (currentJobId) {
        console.warn(`[shutdown] Job ${currentJobId} did not complete in time, forcing shutdown and re-queuing`);
        // Release the lock and re-queue the job
        const client = (0, supabase_1.getAdminClient)();
        try {
            await client
                .from('scraper_jobs')
                .update({
                lock_token: null,
                locked_at: null,
                status: 'queued',
                last_error: 'Job interrupted by worker shutdown',
                run_at: new Date().toISOString()
            })
                .eq('id', currentJobId);
            console.log(`[shutdown] Job ${currentJobId} re-queued successfully`);
        }
        catch (error) {
            console.error(`[shutdown] Failed to re-queue job ${currentJobId}:`, error);
        }
    }
    console.log('[shutdown] Graceful shutdown complete');
    (0, supabase_1.closeAdminClient)();
    process.exit(0);
}
function registerShutdownHandlers() {
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
}
// Health check HTTP server
// Railway sets PORT dynamically, use that in production, fall back to 3210 for local dev
const HEALTH_PORT = Number(process.env.PORT || process.env.HEALTH_PORT || 3210);
const app = (0, express_1.default)();
app.get('/health', (req, res) => {
    const uptimeSeconds = Math.floor(process.uptime());
    res.json({
        status: 'healthy',
        currentJob: currentJobId || 'none',
        isShuttingDown,
        uptime: uptimeSeconds,
        uptimeHuman: `${Math.floor(uptimeSeconds / 60)}m ${uptimeSeconds % 60}s`,
        worker: 'mapping-sheet-scanner-worker',
        config: {
            claudeTimeoutMs: config_1.config.claudeTimeoutMs,
            gracefulShutdownTimeoutMs: config_1.config.gracefulShutdownTimeoutMs,
            pollIntervalMs: config_1.config.pollIntervalMs
        }
    });
});
app.listen(HEALTH_PORT, () => {
    console.log(`[health] Health check endpoint listening on port ${HEALTH_PORT}`);
});
registerShutdownHandlers();
workerLoop().catch((error) => {
    console.error('[worker] Fatal error:', error);
    process.exit(1);
});
