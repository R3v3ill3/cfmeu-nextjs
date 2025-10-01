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
    console.error(`[worker] Job ${job.id} failed:`, message)

    const shouldRetry = job.attempts < job.max_attempts
    const nextStatus = shouldRetry ? 'queued' : 'failed'

    await markJobStatus(client, job.id, nextStatus as any, {
      lock_token: null,
      locked_at: null,
      last_error: message,
      run_at: shouldRetry 
        ? new Date(Date.now() + config.pollIntervalMs).toISOString() 
        : job.run_at,
    })
  } finally {
    await releaseJobLock(client, job.id)
  }
}

async function workerLoop() {
  const client = getAdminClient()
  console.log('[worker] Starting mapping sheet scanner worker')
  console.log('[worker] Configuration:', {
    supabaseUrl: config.supabaseUrl,
    pollIntervalMs: config.pollIntervalMs,
    maxRetries: config.maxRetries,
    claudeModel: config.claudeModel,
  })

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
