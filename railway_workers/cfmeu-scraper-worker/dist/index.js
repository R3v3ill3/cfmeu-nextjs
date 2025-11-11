"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const supabase_1 = require("./supabase");
const jobs_1 = require("./jobs");
const fwc_1 = require("./processors/fwc");
const incolink_1 = require("./processors/incolink");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Graceful shutdown state
let isShuttingDown = false;
let currentJobId = null;
async function handleJob(job) {
    const client = (0, supabase_1.getAdminClient)();
    console.log(`[worker] handling job ${job.id} (${job.job_type})`);
    try {
        await (0, jobs_1.appendEvent)(client, job.id, 'job_started', {
            attempts: job.attempts,
        });
        switch (job.job_type) {
            case 'fwc_lookup': {
                const payload = job.payload;
                if (Array.isArray(payload?.employerIds)) {
                    const initialCompleted = Number.isFinite(job.progress_completed)
                        ? job.progress_completed
                        : 0;
                    await (0, jobs_1.updateProgress)(client, job.id, initialCompleted, {
                        progress_total: payload.employerIds.length,
                    });
                }
                const summary = await (0, fwc_1.processFwcJob)(client, job);
                console.log(`[worker] fwc_lookup job ${job.id} completed`, summary);
                await (0, jobs_1.appendEvent)(client, job.id, 'job_completed', {
                    succeeded: summary.succeeded,
                    failed: summary.failed,
                });
                await (0, jobs_1.markJobStatus)(client, job.id, 'succeeded', {
                    lock_token: null,
                    locked_at: null,
                    last_error: null,
                });
                break;
            }
            case 'incolink_sync': {
                const payload = job.payload;
                if (Array.isArray(payload?.employerIds)) {
                    const initialCompleted = Number.isFinite(job.progress_completed) ? job.progress_completed : 0;
                    await (0, jobs_1.updateProgress)(client, job.id, initialCompleted, {
                        progress_total: payload.employerIds.length,
                    });
                }
                const summary = await (0, incolink_1.processIncolinkJob)(client, job);
                console.log(`[worker] incolink_sync job ${job.id} completed`, summary);
                await (0, jobs_1.appendEvent)(client, job.id, 'job_completed', {
                    succeeded: summary.succeeded,
                    failed: summary.failed,
                    createdWorkers: summary.createdWorkers,
                    matchedWorkers: summary.matchedWorkers,
                    placementsCreated: summary.placementsCreated,
                    placementsSkipped: summary.placementsSkipped,
                });
                await (0, jobs_1.markJobStatus)(client, job.id, 'succeeded', {
                    lock_token: null,
                    locked_at: null,
                    last_error: null,
                });
                break;
            }
            default: {
                await (0, jobs_1.appendEvent)(client, job.id, 'job_skipped', { reason: 'Unknown job type' });
                await (0, jobs_1.markJobStatus)(client, job.id, 'failed', {
                    lock_token: null,
                    locked_at: null,
                    last_error: `Unsupported job type: ${job.job_type}`,
                });
            }
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown worker error';
        console.error(`[worker] job ${job.id} failed`, message);
        await (0, jobs_1.appendEvent)(client, job.id, 'job_failed', { error: message });
        const shouldRetry = job.attempts < job.max_attempts;
        const nextStatus = shouldRetry ? 'queued' : 'failed';
        await (0, jobs_1.markJobStatus)(client, job.id, nextStatus, {
            lock_token: null,
            locked_at: null,
            last_error: message,
            progress_completed: 0,
            run_at: shouldRetry ? new Date(Date.now() + config_1.config.pollIntervalMs).toISOString() : job.run_at,
        });
        if (shouldRetry) {
            await (0, jobs_1.appendEvent)(client, job.id, 'job_requeued', {
                attempts: job.attempts,
            });
        }
    }
    finally {
        try {
            await (0, jobs_1.releaseJobLock)(client, job.id);
        }
        catch (releaseError) {
            console.error('Failed to release job lock', releaseError);
        }
    }
}
async function workerLoop() {
    const client = (0, supabase_1.getAdminClient)();
    let lastCleanup = Date.now();
    const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    console.log('[worker] Starting worker loop with graceful shutdown support');
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
            console.error('[worker] Worker loop error:', error);
            await sleep(config_1.config.pollIntervalMs);
        }
    }
    console.log('[worker] Worker loop exited gracefully');
}
async function gracefulShutdown() {
    console.log('[shutdown] Received shutdown signal, initiating graceful shutdown...');
    isShuttingDown = true;
    // Wait for current job to complete
    // FWC jobs can take up to 5 minutes with retries, so we need a longer timeout
    const maxWait = config_1.config.gracefulShutdownTimeoutMs;
    const startTime = Date.now();
    console.log(`[shutdown] Will wait up to ${maxWait}ms (${Math.floor(maxWait / 1000)}s) for current job to complete`);
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
registerShutdownHandlers();
workerLoop().catch((error) => {
    console.error('[worker] Fatal worker error:', error);
    process.exit(1);
});
