/**
 * Utility functions for deriving progress steps from scraper job status and events
 */

export type ScraperJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export type ScraperJobEvent = {
  id: number
  event_type: string
  payload: Record<string, unknown> | null
  created_at: string
}

export type ScraperJob = {
  id: string
  status: ScraperJobStatus
  progress_total: number | null
  progress_completed: number | null
  created_at: string
  updated_at: string
}

/**
 * Job steps for FWC lookup process
 */
export const FWC_JOB_STEPS = ['Queued', 'Searching FWC', 'Processing Results', 'Finalizing'] as const

/**
 * Derives the current step index based on job events
 * Uses event types to determine the actual processing stage
 */
export function deriveStepFromEvents(
  job: ScraperJob | null | undefined,
  events: ScraperJobEvent[]
): number {
  if (!job) return 0

  const status = job.status

  // Terminal states always show final step
  if (status === 'succeeded' || status === 'failed' || status === 'cancelled') {
    return 3
  }

  // If no events, fall back to status-based logic
  if (!events || events.length === 0) {
    return deriveStepFromStatus(status, job.progress_completed ?? 0, job.progress_total ?? 1)
  }

  // Sort events by creation time (most recent first)
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  // Check for job completion event
  const hasJobCompleted = sortedEvents.some((e) => e.event_type === 'job_completed')
  if (hasJobCompleted) {
    return 3 // Finalizing
  }

  // Check for results/candidates events (processing results stage)
  const hasResults = sortedEvents.some(
    (e) =>
      e.event_type === 'fwc_employer_results' ||
      e.event_type === 'fwc_employer_candidates' ||
      e.event_type === 'fwc_employer_succeeded'
  )
  if (hasResults) {
    return 2 // Processing Results
  }

  // Check for job started or employer started events (searching stage)
  const hasStarted = sortedEvents.some(
    (e) =>
      e.event_type === 'job_started' ||
      e.event_type === 'job_locked' ||
      e.event_type === 'fwc_employer_started' ||
      e.event_type === 'fwc_employer_query_attempt' ||
      e.event_type === 'fwc_search_retry'
  )
  if (hasStarted) {
    return 1 // Searching FWC
  }

  // Default to queued if status is queued
  if (status === 'queued') {
    return 0
  }

  // Fallback to status-based logic
  return deriveStepFromStatus(status, job.progress_completed ?? 0, job.progress_total ?? 1)
}

/**
 * Fallback step derivation based on status and progress percentage
 */
function deriveStepFromStatus(
  status: ScraperJobStatus,
  completed: number,
  total: number
): number {
  if (status === 'queued') return 0

  if (status === 'running') {
    const percent = total > 0 ? (completed / total) * 100 : 0
    if (percent < 10) return 0
    if (percent < 90) return 1
    return 2
  }

  // succeeded, failed, cancelled
  return 3
}

/**
 * Main function to derive step index - uses events if available, falls back to status
 */
export function deriveStepIndexForJob(
  job: ScraperJob | null | undefined,
  events: ScraperJobEvent[] = []
): number {
  return deriveStepFromEvents(job, events)
}

