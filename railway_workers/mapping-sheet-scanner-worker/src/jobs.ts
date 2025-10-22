import { randomUUID } from 'crypto'
import { MappingSheetScanJob } from './types'
import { config } from './config'

const JOB_TABLE = 'scraper_jobs'

export async function reserveNextJob(
  client: any
): Promise<MappingSheetScanJob | null> {
  const nowIso = new Date().toISOString()

  // Find queued jobs for mapping sheet scans (both existing and new project)
  const { data: candidates, error } = await client
    .from(JOB_TABLE)
    .select('*')
    .eq('status', 'queued')
    .eq('job_type', 'mapping_sheet_scan')
    .lte('run_at', nowIso)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(5)

  if (error) {
    console.error('[jobs] Failed to fetch queued jobs:', error)
    return null
  }

  const candidateCount = candidates?.length ?? 0

  if (!candidates || candidateCount === 0) {
    return null
  }

  if (config.verboseLogs) {
    console.debug(`[jobs] Found ${candidateCount} queued mapping sheet scan job${candidateCount === 1 ? '' : 's'}`)
  }

  // Try to lock each candidate
  for (const candidate of candidates) {
    if (config.verboseLogs) {
      console.debug(`[jobs] Attempting to lock job ${candidate.id}`)
    }
    const lockToken = randomUUID()
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
      .single()

    if (lockError) {
      console.error(`[jobs] Failed to lock job ${candidate.id}:`, lockError)
      continue
    }

    if (lockedJob) {
      if (config.verboseLogs) {
        console.debug(`[jobs] Successfully locked job ${candidate.id}`)
      }
      return lockedJob as MappingSheetScanJob
    } else {
      if (config.verboseLogs) {
        console.debug(`[jobs] Job ${candidate.id} was locked by another process`)
      }
    }
  }
  return null
}

export async function releaseJobLock(client: any, jobId: string) {
  await client
    .from('scraper_jobs')
    .update({ lock_token: null, locked_at: null })
    .eq('id', jobId)
}

export async function markJobStatus(
  client: any,
  jobId: string,
  status: 'succeeded' | 'failed',
  updates: Record<string, any> = {}
) {
  await client
    .from('scraper_jobs')
    .update({ status, ...updates })
    .eq('id', jobId)
}

export async function cleanupStaleLocks(
  client: any,
  config: { pollIntervalMs: number }
): Promise<number> {
  // Use 5 minutes as the lock timeout (jobs should not take this long)
  const lockTimeoutMs = 5 * 60 * 1000
  const lockExpiry = new Date(Date.now() - lockTimeoutMs).toISOString()

  console.log(`[cleanup] Cleaning up locks older than ${lockExpiry}`)

  const { data, error } = await client
    .from(JOB_TABLE)
    .update({
      lock_token: null,
      locked_at: null,
      status: 'queued',
      last_error: 'Lock released due to timeout (worker may have crashed)',
      run_at: new Date().toISOString()
    })
    .eq('status', 'processing')
    .eq('job_type', 'mapping_sheet_scan')
    .lt('locked_at', lockExpiry)
    .select('id')

  if (error) {
    console.error('[cleanup] Failed to clean stale locks:', error)
    return 0
  }

  const count = data?.length || 0
  if (count > 0) {
    console.log(`[cleanup] Released ${count} stale job locks`)
  }

  return count
}
