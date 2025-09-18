import { config } from './config'
import { getAdminClient } from './supabase'
import { reserveNextJob, appendEvent, markJobStatus, releaseJobLock, updateProgress } from './jobs'
import { processFwcJob } from './processors/fwc'
import { processIncolinkJob } from './processors/incolink'
import { ScraperJob } from './types'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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
  for (;;) {
    try {
      const job = await reserveNextJob(client)
      if (!job) {
        await sleep(config.pollIntervalMs)
        continue
      }
      await handleJob(job)
    } catch (error) {
      console.error('Worker loop error:', error)
      await sleep(config.pollIntervalMs)
    }
  }
}

function registerShutdownHandlers() {
  const shutdown = async () => {
    console.log('Shutting down worker...')
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

registerShutdownHandlers()

workerLoop().catch((error) => {
  console.error('Fatal worker error:', error)
  process.exit(1)
})
