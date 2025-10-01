import { randomUUID } from 'crypto'
import { SupabaseClient } from '@supabase/supabase-js'
import { MappingSheetScanJob } from './types'

const JOB_TABLE = 'scraper_jobs'

export async function reserveNextJob(
  client: SupabaseClient
): Promise<MappingSheetScanJob | null> {
  const nowIso = new Date().toISOString()

  // Find queued jobs for mapping_sheet_scan
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

  if (!candidates || candidates.length === 0) {
    return null
  }

  // Try to lock each candidate
  for (const candidate of candidates) {
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
      continue
    }

    if (lockedJob) {
      return lockedJob as MappingSheetScanJob
    }
  }

  return null
}

export async function releaseJobLock(client: SupabaseClient, jobId: string) {
  await client
    .from('scraper_jobs')
    .update({ lock_token: null, locked_at: null })
    .eq('id', jobId)
}

export async function markJobStatus(
  client: SupabaseClient,
  jobId: string,
  status: 'succeeded' | 'failed',
  updates: Record<string, any> = {}
) {
  await client
    .from('scraper_jobs')
    .update({ status, ...updates })
    .eq('id', jobId)
}
