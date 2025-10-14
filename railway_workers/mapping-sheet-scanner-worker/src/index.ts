import { config } from './config'
import { getAdminClient } from './supabase'
import { reserveNextJob, releaseJobLock, markJobStatus } from './jobs'
import { processMappingSheetScan } from './processors/mappingSheetProcessor'
import { MappingSheetScanJob } from './types'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function handleJob(job: MappingSheetScanJob) {
  const client = getAdminClient()
  console.log(`[worker] Handling job ${job.id} (${job.job_type})`)

  try {
    const result = await processMappingSheetScan(client, job)
    
    console.log(`[worker] Job ${job.id} completed:`, result)
    
    await markJobStatus(client, job.id, 'succeeded', {
      lock_token: null,
      locked_at: null,
      last_error: null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[worker] Job ${job.id} failed (attempt ${job.attempts}/${job.max_attempts}):`, message)

    const shouldRetry = job.attempts < job.max_attempts
    const nextStatus = shouldRetry ? 'queued' : 'failed'

    // Exponential backoff: 5s, 10s, 20s, 40s...
    // Formula: baseDelay * 2^(attempts - 1), capped at 60 seconds
    const backoffDelayMs = shouldRetry
      ? Math.min(config.pollIntervalMs * Math.pow(2, job.attempts - 1), 60000)
      : 0

    if (shouldRetry) {
      console.log(`[worker] Scheduling retry for job ${job.id} in ${backoffDelayMs}ms`)
    }

    await markJobStatus(client, job.id, nextStatus as any, {
      lock_token: null,
      locked_at: null,
      last_error: message,
      run_at: shouldRetry
        ? new Date(Date.now() + backoffDelayMs).toISOString()
        : job.run_at,
    })
  } finally {
    await releaseJobLock(client, job.id)
  }
}

async function workerLoop() {
  const client = getAdminClient()
  console.log('[worker] Starting mapping sheet scanner worker')
  if (config.verboseLogs) {
    console.log('[worker] Configuration:', {
      supabaseUrl: config.supabaseUrl,
      pollIntervalMs: config.pollIntervalMs,
      maxRetries: config.maxRetries,
      claudeModel: config.claudeModel,
    })
  }

  for (;;) {
    try {
      const job = await reserveNextJob(client)
      
      if (!job) {
        await sleep(config.pollIntervalMs)
        continue
      }

      await handleJob(job)
    } catch (error) {
      console.error('[worker] Loop error:', error)
      await sleep(config.pollIntervalMs)
    }
  }
}

function registerShutdownHandlers() {
  const shutdown = () => {
    console.log('[worker] Shutting down...')
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

registerShutdownHandlers()

workerLoop().catch((error) => {
  console.error('[worker] Fatal error:', error)
  process.exit(1)
})
