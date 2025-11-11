import { config } from './config'
import { getAdminClient, closeAdminClient } from './supabase'
import { reserveNextJob, appendEvent, markJobStatus, releaseJobLock, updateProgress, cleanupStaleLocks } from './jobs'
import { processFwcJob } from './processors/fwc'
import { processIncolinkJob } from './processors/incolink'
import { ScraperJob } from './types'
import express from 'express'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Graceful shutdown state
let isShuttingDown = false
let currentJobId: string | null = null

async function handleJob(job: ScraperJob) {
  const client = getAdminClient()
  console.log(`[worker] handling job ${job.id} (${job.job_type})`)
  try {
    await appendEvent(client, job.id, 'job_started', {
      attempts: job.attempts,
    })

    switch (job.job_type) {
      case 'fwc_lookup': {
        const payload = job.payload as { employerIds?: string[] }
        if (Array.isArray(payload?.employerIds)) {
          const initialCompleted = Number.isFinite(job.progress_completed)
            ? job.progress_completed
            : 0
          await updateProgress(client, job.id, initialCompleted, {
            progress_total: payload.employerIds.length,
          })
        }
        const summary = await processFwcJob(client, job)
        console.log(`[worker] fwc_lookup job ${job.id} completed`, summary)
        await appendEvent(client, job.id, 'job_completed', {
          succeeded: summary.succeeded,
          failed: summary.failed,
        })
        await markJobStatus(client, job.id, 'succeeded', {
          lock_token: null,
          locked_at: null,
          last_error: null,
        })
        break
      }
      case 'incolink_sync': {
        const payload = job.payload as { employerIds?: string[] }
        if (Array.isArray(payload?.employerIds)) {
          const initialCompleted = Number.isFinite(job.progress_completed) ? job.progress_completed : 0
          await updateProgress(client, job.id, initialCompleted, {
            progress_total: payload.employerIds.length,
          })
        }

        const summary = await processIncolinkJob(client, job)
        console.log(`[worker] incolink_sync job ${job.id} completed`, summary)
        await appendEvent(client, job.id, 'job_completed', {
          succeeded: summary.succeeded,
          failed: summary.failed,
          createdWorkers: summary.createdWorkers,
          matchedWorkers: summary.matchedWorkers,
          placementsCreated: summary.placementsCreated,
          placementsSkipped: summary.placementsSkipped,
        })
        await markJobStatus(client, job.id, 'succeeded', {
          lock_token: null,
          locked_at: null,
          last_error: null,
        })
        break
      }
      default: {
        await appendEvent(client, job.id, 'job_skipped', { reason: 'Unknown job type' })
        await markJobStatus(client, job.id, 'failed', {
          lock_token: null,
          locked_at: null,
          last_error: `Unsupported job type: ${job.job_type}`,
        })
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown worker error'
    console.error(`[worker] job ${job.id} failed`, message)
    await appendEvent(client, job.id, 'job_failed', { error: message })

    const shouldRetry = job.attempts < job.max_attempts
    const nextStatus: ScraperJob['status'] = shouldRetry ? 'queued' : 'failed'

    await markJobStatus(client, job.id, nextStatus, {
      lock_token: null,
      locked_at: null,
      last_error: message,
      progress_completed: 0,
      run_at: shouldRetry ? new Date(Date.now() + config.pollIntervalMs).toISOString() : job.run_at,
    })

    if (shouldRetry) {
      await appendEvent(client, job.id, 'job_requeued', {
        attempts: job.attempts,
      })
    }
  } finally {
    try {
      await releaseJobLock(client, job.id)
    } catch (releaseError) {
      console.error('Failed to release job lock', releaseError)
    }
  }
}

async function workerLoop() {
  const client = getAdminClient()
  let lastCleanup = Date.now()
  const CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

  console.log('[worker] Starting worker loop with graceful shutdown support')

  while (!isShuttingDown) {
    try {
      // Periodic stale lock cleanup
      if (Date.now() - lastCleanup > CLEANUP_INTERVAL_MS) {
        await cleanupStaleLocks(client, config)
        lastCleanup = Date.now()
      }

      const job = await reserveNextJob(client)
      if (!job) {
        await sleep(config.pollIntervalMs)
        continue
      }

      currentJobId = job.id
      try {
        await handleJob(job)
      } finally {
        currentJobId = null
      }
    } catch (error) {
      console.error('[worker] Worker loop error:', error)
      await sleep(config.pollIntervalMs)
    }
  }

  console.log('[worker] Worker loop exited gracefully')
}

async function gracefulShutdown() {
  console.log('[shutdown] Received shutdown signal, initiating graceful shutdown...')
  isShuttingDown = true

  // Wait for current job to complete
  // FWC jobs can take up to 5 minutes with retries, so we need a longer timeout
  const maxWait = config.gracefulShutdownTimeoutMs
  const startTime = Date.now()
  
  console.log(`[shutdown] Will wait up to ${maxWait}ms (${Math.floor(maxWait/1000)}s) for current job to complete`)

  while (currentJobId && (Date.now() - startTime < maxWait)) {
    console.log(`[shutdown] Waiting for job ${currentJobId} to complete...`)
    await sleep(1000)
  }

  if (currentJobId) {
    console.warn(`[shutdown] Job ${currentJobId} did not complete in time, forcing shutdown and re-queuing`)
    // Release the lock and re-queue the job
    const client = getAdminClient()
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
        .eq('id', currentJobId)
      console.log(`[shutdown] Job ${currentJobId} re-queued successfully`)
    } catch (error) {
      console.error(`[shutdown] Failed to re-queue job ${currentJobId}:`, error)
    }
  }

  console.log('[shutdown] Graceful shutdown complete')
  closeAdminClient()
  process.exit(0)
}

function registerShutdownHandlers() {
  process.on('SIGINT', gracefulShutdown)
  process.on('SIGTERM', gracefulShutdown)
}

// Health check HTTP server
// Railway sets PORT dynamically, use that in production, fall back to 3200 for local dev
const HEALTH_PORT = Number(process.env.PORT || process.env.HEALTH_PORT || 3200)
const app = express()

app.get('/health', (req, res) => {
  const uptimeSeconds = Math.floor(process.uptime())
  res.json({
    status: 'healthy',
    currentJob: currentJobId || 'none',
    isShuttingDown,
    uptime: uptimeSeconds,
    uptimeHuman: `${Math.floor(uptimeSeconds / 60)}m ${uptimeSeconds % 60}s`,
    worker: 'cfmeu-scraper-worker',
    config: {
      gracefulShutdownTimeoutMs: config.gracefulShutdownTimeoutMs,
      pollIntervalMs: config.pollIntervalMs,
      retryMaxAttempts: config.retry.maxAttempts
    }
  })
})

app.listen(HEALTH_PORT, '0.0.0.0', () => {
  console.log(`[health] Health check endpoint listening on port ${HEALTH_PORT}`)
})

registerShutdownHandlers()

workerLoop().catch((error) => {
  console.error('[worker] Fatal worker error:', error)
  process.exit(1)
})
