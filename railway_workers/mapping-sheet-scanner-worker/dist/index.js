"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const supabase_1 = require("./supabase");
const jobs_1 = require("./jobs");
const mappingSheetProcessor_1 = require("./processors/mappingSheetProcessor");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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
    console.log('[worker] Starting mapping sheet scanner worker');
    if (config_1.config.verboseLogs) {
        console.log('[worker] Configuration:', {
            supabaseUrl: config_1.config.supabaseUrl,
            pollIntervalMs: config_1.config.pollIntervalMs,
            maxRetries: config_1.config.maxRetries,
            claudeModel: config_1.config.claudeModel,
        });
    }
    for (;;) {
        try {
            const job = await (0, jobs_1.reserveNextJob)(client);
            if (!job) {
                await sleep(config_1.config.pollIntervalMs);
                continue;
            }
            await handleJob(job);
        }
        catch (error) {
            console.error('[worker] Loop error:', error);
            await sleep(config_1.config.pollIntervalMs);
        }
    }
}
function registerShutdownHandlers() {
    const shutdown = () => {
        console.log('[worker] Shutting down...');
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
registerShutdownHandlers();
workerLoop().catch((error) => {
    console.error('[worker] Fatal error:', error);
    process.exit(1);
});
