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
