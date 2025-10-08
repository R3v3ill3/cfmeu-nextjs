"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const supabase_1 = require("./supabase");
const jobs_1 = require("./jobs");
const fwc_1 = require("./processors/fwc");
const incolink_1 = require("./processors/incolink");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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
            console.error('Worker loop error:', error);
            await sleep(config_1.config.pollIntervalMs);
        }
    }
}
function registerShutdownHandlers() {
    const shutdown = async () => {
        console.log('Shutting down worker...');
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
registerShutdownHandlers();
workerLoop().catch((error) => {
    console.error('Fatal worker error:', error);
    process.exit(1);
});
