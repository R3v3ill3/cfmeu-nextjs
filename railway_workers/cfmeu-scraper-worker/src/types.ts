export type ScraperJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export interface ScraperJob {
  id: string
  job_type: 'fwc_lookup' | 'incolink_sync'
  payload: Record<string, unknown>
  progress_total: number
  progress_completed: number
  status: ScraperJobStatus
  priority: number
  attempts: number
  max_attempts: number
  lock_token: string | null
  locked_at: string | null
  run_at: string
  last_error: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface ScraperJobEvent {
  id: number
  job_id: string
  event_type: string
  payload: Record<string, unknown> | null
  created_at: string
}

export interface FwcJobPayload {
  employerIds: string[]
  options?: Record<string, unknown>
  projectId?: string
}

export interface IncolinkJobPayload {
  employerIds: string[]
  invoiceNumber?: string
}
