import { randomUUID } from 'crypto'
import { SupabaseClient } from '@supabase/supabase-js'
import { config } from './config'
import { ScraperJob, ScraperJobStatus } from './types'

const JOB_TABLE = 'scraper_jobs'
const EVENT_TABLE = 'scraper_job_events'

export async function reserveNextJob(client: SupabaseClient): Promise<ScraperJob | null> {
  const nowIso = new Date().toISOString()
  const lockExpiry = new Date(Date.now() - config.lockTimeoutMs).toISOString()

  const { data: candidates, error } = await client
    .from(JOB_TABLE)
    .select('*')
    .eq('status', 'queued')
    .in('job_type', ['fwc_lookup', 'incolink_sync']) // Only pick up jobs this worker can handle
    .lte('run_at', nowIso)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(5)

  if (error) {
    throw new Error(`Failed to fetch queued jobs: ${error.message}`)
  }

  if (!candidates || candidates.length === 0) {
    return null
  }

  for (const candidate of candidates) {
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
      continue
    }

    if (lockedJob) {
      await appendEvent(client, lockedJob.id, 'job_locked', { lockToken })
      return lockedJob
    }
  }

  return null
}

export async function appendEvent(
  client: SupabaseClient,
  jobId: string,
  eventType: string,
  payload?: Record<string, unknown>
) {
  const { error } = await client.from(EVENT_TABLE).insert({
    job_id: jobId,
    event_type: eventType,
    payload: payload ?? null,
  })

  if (error) {
    throw new Error(`Failed to insert job event: ${error.message}`)
  }
}

export async function updateProgress(
  client: SupabaseClient,
  jobId: string,
  completed: number,
  extras: Partial<ScraperJob> = {}
) {
  const fields: Record<string, unknown> = {
    progress_completed: completed,
    updated_at: new Date().toISOString(),
    ...extras,
  }

  const { error } = await client.from(JOB_TABLE).update(fields).eq('id', jobId)
  if (error) {
    throw new Error(`Failed to update progress: ${error.message}`)
  }
}

export async function markJobStatus(
  client: SupabaseClient,
  jobId: string,
  status: ScraperJobStatus,
  fields: Record<string, unknown> = {}
) {
  const payload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    ...fields,
  }

  if (status === 'succeeded' || status === 'failed' || status === 'cancelled') {
    payload.completed_at = new Date().toISOString()
  }

  const { error } = await client.from(JOB_TABLE).update(payload).eq('id', jobId)

  if (error) {
    throw new Error(`Failed to update job status: ${error.message}`)
  }
}

export async function releaseJobLock(client: SupabaseClient, jobId: string) {
  const { error } = await client.from(JOB_TABLE).update({ lock_token: null, locked_at: null }).eq('id', jobId)

  if (error) {
    throw new Error(`Failed to release job lock: ${error.message}`)
  }
}
