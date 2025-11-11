import express from 'express'
import { config } from './config'
import { getAdminClient, closeAdminClient } from './supabase'
import { reserveNextJob, releaseJobLock, markJobStatus, cleanupStaleLocks } from './jobs'
import { processMappingSheetScan } from './processors/mappingSheetProcessor'
import { MappingSheetScanJob } from './types'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Graceful shutdown state (declared early for health endpoint access)
let isShuttingDown = false
let currentJobId: string | null = null

// Express app for health checks (Railway requires this)
const app = express()
app.use(express.json())

// Log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`[health] Incoming request: ${req.method} ${req.path} from ${req.ip || req.socket.remoteAddress || 'unknown'}`)
  next()
})

// Health check endpoint - Railway needs this to know the container is alive
// Keep it FAST - Railway needs immediate response, no database checks
app.get('/health', (req, res) => {
  console.log('[health] Health check requested')
  
  // Immediate response - Railway just needs to know the process is alive
  // No database checks, no async operations - just return OK immediately
  const healthData = {
    status: 'healthy',
    currentJob: currentJobId || 'none',
    isShuttingDown,
    uptime: process.uptime(),
    uptimeHuman: `${Math.floor(process.uptime() / 60)}m ${Math.floor(process.uptime() % 60)}s`,
    worker: 'mapping-sheet-scanner-worker',
  }
  
  console.log('[health] Responding with:', healthData)
  res.status(200).json(healthData)
})

// Add root endpoint for Railway's initial check
app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'mapping-sheet-scanner-worker' })
})

// Error handling middleware - ensure we always respond (must be after routes)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[health] Express error:', err)
  res.status(200).json({ status: 'ok', error: err.message })
})

// Catch-all for unhandled routes (must be last)
app.use((req, res) => {
  console.log(`[health] Unhandled route: ${req.method} ${req.path}`)
  res.status(200).json({ status: 'ok', path: req.path })
})

// Start HTTP server for health checks
// Railway provides PORT env var, fallback to 3210 for local dev
const HEALTH_PORT = Number(process.env.PORT || process.env.HEALTH_PORT || 3210)

// Ensure server is fully ready before starting worker loop
const server = app.listen(HEALTH_PORT, '0.0.0.0', () => {
  console.log(`[health] Health check endpoint listening on 0.0.0.0:${HEALTH_PORT}`)
  console.log(`[health] Health check URL: http://0.0.0.0:${HEALTH_PORT}/health`)
  
  // Start worker loop only after server is ready
  workerLoop().catch((error) => {
    console.error('[worker] Fatal error:', error)
    process.exit(1)
  })
})

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
  let lastCleanup = Date.now()
  const CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

  console.log('[worker] Starting mapping sheet scanner worker with graceful shutdown support')
  if (config.verboseLogs) {
    console.log('[worker] Configuration:', {
      supabaseUrl: config.supabaseUrl,
      pollIntervalMs: config.pollIntervalMs,
      maxRetries: config.maxRetries,
      claudeModel: config.claudeModel,
    })
  }

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
      console.error('[worker] Loop error:', error)
      await sleep(config.pollIntervalMs)
    }
  }

  console.log('[worker] Worker loop exited gracefully')
}

async function gracefulShutdown() {
  console.log('[shutdown] Received shutdown signal, initiating graceful shutdown...')
  isShuttingDown = true

  // Wait for current job to complete
  // Timeout must be longer than Claude timeout + retries to allow job completion
  const maxWait = config.gracefulShutdownTimeoutMs
  const startTime = Date.now()
  
  console.log(`[shutdown] Will wait up to ${maxWait}ms for current job to complete`)

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
  
  // Close HTTP server gracefully
  server.close(() => {
    console.log('[shutdown] HTTP server closed')
    closeAdminClient()
    process.exit(0)
  })
  
  // Force exit after 5 seconds if server doesn't close
  setTimeout(() => {
    console.warn('[shutdown] Forcing exit after server close timeout')
    closeAdminClient()
    process.exit(0)
  }, 5000)
}

function registerShutdownHandlers() {
  process.on('SIGINT', gracefulShutdown)
  process.on('SIGTERM', gracefulShutdown)
}

registerShutdownHandlers()

// Worker loop is started after server is ready (see server.listen callback above)
