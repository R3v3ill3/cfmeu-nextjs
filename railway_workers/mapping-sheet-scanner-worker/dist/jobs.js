"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reserveNextJob = reserveNextJob;
exports.releaseJobLock = releaseJobLock;
exports.markJobStatus = markJobStatus;
const crypto_1 = require("crypto");
const config_1 = require("./config");
const JOB_TABLE = 'scraper_jobs';
async function reserveNextJob(client) {
    const nowIso = new Date().toISOString();
    // Find queued jobs for mapping sheet scans (both existing and new project)
    const { data: candidates, error } = await client
        .from(JOB_TABLE)
        .select('*')
        .eq('status', 'queued')
        .eq('job_type', 'mapping_sheet_scan')
        .lte('run_at', nowIso)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(5);
    if (error) {
        console.error('[jobs] Failed to fetch queued jobs:', error);
        return null;
    }
    const candidateCount = candidates?.length ?? 0;
    if (!candidates || candidateCount === 0) {
        return null;
    }
    if (config_1.config.verboseLogs) {
        console.debug(`[jobs] Found ${candidateCount} queued mapping sheet scan job${candidateCount === 1 ? '' : 's'}`);
    }
    // Try to lock each candidate
    for (const candidate of candidates) {
        if (config_1.config.verboseLogs) {
            console.debug(`[jobs] Attempting to lock job ${candidate.id}`);
        }
        const lockToken = (0, crypto_1.randomUUID)();
        const { data: lockedJob, error: lockError } = await client
            .from(JOB_TABLE)
            .update({
            lock_token: lockToken,
            status: 'processing',
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
            console.error(`[jobs] Failed to lock job ${candidate.id}:`, lockError);
            continue;
        }
        if (lockedJob) {
            if (config_1.config.verboseLogs) {
                console.debug(`[jobs] Successfully locked job ${candidate.id}`);
            }
            return lockedJob;
        }
        else {
            if (config_1.config.verboseLogs) {
                console.debug(`[jobs] Job ${candidate.id} was locked by another process`);
            }
        }
    }
    return null;
}
async function releaseJobLock(client, jobId) {
    await client
        .from('scraper_jobs')
        .update({ lock_token: null, locked_at: null })
        .eq('id', jobId);
}
async function markJobStatus(client, jobId, status, updates = {}) {
    await client
        .from('scraper_jobs')
        .update({ status, ...updates })
        .eq('id', jobId);
}
