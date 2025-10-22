"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reserveNextJob = reserveNextJob;
exports.appendEvent = appendEvent;
exports.updateProgress = updateProgress;
exports.markJobStatus = markJobStatus;
exports.releaseJobLock = releaseJobLock;
exports.cleanupStaleLocks = cleanupStaleLocks;
const crypto_1 = require("crypto");
const config_1 = require("./config");
const JOB_TABLE = 'scraper_jobs';
const EVENT_TABLE = 'scraper_job_events';
async function reserveNextJob(client) {
    const nowIso = new Date().toISOString();
    const lockExpiry = new Date(Date.now() - config_1.config.lockTimeoutMs).toISOString();
    const { data: candidates, error } = await client
        .from(JOB_TABLE)
        .select('*')
        .eq('status', 'queued')
        .in('job_type', ['fwc_lookup', 'incolink_sync']) // Only pick up jobs this worker can handle
        .lte('run_at', nowIso)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(5);
    if (error) {
        throw new Error(`Failed to fetch queued jobs: ${error.message}`);
    }
    if (!candidates || candidates.length === 0) {
        return null;
    }
    for (const candidate of candidates) {
        const lockToken = (0, crypto_1.randomUUID)();
        const { data: lockedJob, error: lockError } = await client
            .from(JOB_TABLE)
            .update({
            lock_token: lockToken,
            status: 'running',
            attempts: (candidate.attempts ?? 0) + 1,
            locked_at: nowIso,
            last_error: null,
        })
            .eq('id', candidate.id)
            .eq('status', 'queued')
            .lte('run_at', nowIso)
            .is('lock_token', null)
            .select()
            .single();
        if (lockError) {
            continue;
        }
        if (lockedJob) {
            await appendEvent(client, lockedJob.id, 'job_locked', { lockToken });
            return lockedJob;
        }
    }
    return null;
}
async function appendEvent(client, jobId, eventType, payload) {
    const { error } = await client.from(EVENT_TABLE).insert({
        job_id: jobId,
        event_type: eventType,
        payload: payload ?? null,
    });
    if (error) {
        throw new Error(`Failed to insert job event: ${error.message}`);
    }
}
async function updateProgress(client, jobId, completed, extras = {}) {
    const fields = {
        progress_completed: completed,
        updated_at: new Date().toISOString(),
        ...extras,
    };
    const { error } = await client.from(JOB_TABLE).update(fields).eq('id', jobId);
    if (error) {
        throw new Error(`Failed to update progress: ${error.message}`);
    }
}
async function markJobStatus(client, jobId, status, fields = {}) {
    const payload = {
        status,
        updated_at: new Date().toISOString(),
        ...fields,
    };
    if (status === 'succeeded' || status === 'failed' || status === 'cancelled') {
        payload.completed_at = new Date().toISOString();
    }
    const { error } = await client.from(JOB_TABLE).update(payload).eq('id', jobId);
    if (error) {
        throw new Error(`Failed to update job status: ${error.message}`);
    }
}
async function releaseJobLock(client, jobId) {
    const { error } = await client.from(JOB_TABLE).update({ lock_token: null, locked_at: null }).eq('id', jobId);
    if (error) {
        throw new Error(`Failed to release job lock: ${error.message}`);
    }
}
async function cleanupStaleLocks(client, config) {
    const lockExpiry = new Date(Date.now() - config.lockTimeoutMs).toISOString();
    console.log(`[cleanup] Cleaning up locks older than ${lockExpiry}`);
    const { data, error } = await client
        .from(JOB_TABLE)
        .update({
        lock_token: null,
        locked_at: null,
        status: 'queued',
        last_error: 'Lock released due to timeout (worker may have crashed)',
        run_at: new Date().toISOString()
    })
        .eq('status', 'running')
        .lt('locked_at', lockExpiry)
        .select('id');
    if (error) {
        console.error('[cleanup] Failed to clean stale locks:', error);
        return 0;
    }
    const count = data?.length || 0;
    if (count > 0) {
        console.log(`[cleanup] Released ${count} stale job locks`);
    }
    return count;
}
