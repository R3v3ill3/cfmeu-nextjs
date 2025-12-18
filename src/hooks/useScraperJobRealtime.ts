import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type ScraperJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export type ScraperJob = {
  id: string
  status: ScraperJobStatus
  progress_total: number | null
  progress_completed: number | null
  created_at: string
  updated_at: string
  completed_at?: string | null
}

export type ScraperJobEvent = {
  id: number
  event_type: string
  payload: Record<string, unknown> | null
  created_at: string
}

interface UseScraperJobRealtimeOptions {
  /**
   * Job ID to subscribe to
   */
  jobId: string | null
  /**
   * Whether to enable real-time updates (default: true)
   */
  enabled?: boolean
  /**
   * Polling interval in milliseconds when real-time is unavailable (default: 2000)
   */
  pollingInterval?: number
  /**
   * Callback when job status changes to a terminal state
   */
  onJobComplete?: (job: ScraperJob) => void
  /**
   * Callback when job is updated
   */
  onJobUpdate?: (job: ScraperJob) => void
}

interface UseScraperJobRealtimeReturn {
  /**
   * Current job data
   */
  job: ScraperJob | null
  /**
   * Job events
   */
  events: ScraperJobEvent[]
  /**
   * Whether real-time subscription is active
   */
  isRealtimeActive: boolean
  /**
   * Whether polling is active (fallback)
   */
  isPolling: boolean
  /**
   * Error if any
   */
  error: Error | null
  /**
   * Manually refetch job status
   */
  refetch: () => Promise<void>
}

/**
 * Hook for real-time updates of scraper job status
 * Uses Supabase real-time subscriptions with polling fallback
 */
export function useScraperJobRealtime(
  options: UseScraperJobRealtimeOptions
): UseScraperJobRealtimeReturn {
  const {
    jobId,
    enabled = true,
    pollingInterval = 2000,
    onJobComplete,
    onJobUpdate,
  } = options

  const [job, setJob] = useState<ScraperJob | null>(null)
  const [events, setEvents] = useState<ScraperJobEvent[]>([])
  const [isRealtimeActive, setIsRealtimeActive] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastJobIdRef = useRef<string | null>(null)
  // Track if onJobComplete has already been fired for this job to prevent duplicates
  const completedCallbackFiredRef = useRef<string | null>(null)

  const fetchJobStatus = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/scraper-jobs?id=${id}&includeEvents=1`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const data = (await response.json()) as {
        job: ScraperJob
        events?: ScraperJobEvent[]
      }

      setJob(data.job)
      setEvents(data.events ?? [])
      setError(null)

      // Call update callback
      onJobUpdate?.(data.job)

      // Check if job is complete - only fire callback once per job
      const terminalStatuses: ScraperJobStatus[] = ['succeeded', 'failed', 'cancelled']
      if (terminalStatuses.includes(data.job.status)) {
        if (completedCallbackFiredRef.current !== data.job.id) {
          completedCallbackFiredRef.current = data.job.id
          onJobComplete?.(data.job)
        }
      }

      return data.job
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch job status')
      setError(error)
      throw error
    }
  }, [onJobUpdate, onJobComplete])

  // Cleanup function
  const cleanup = useCallback(() => {
    // Unsubscribe from real-time
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
      setIsRealtimeActive(false)
    }

    // Clear polling interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
      setIsPolling(false)
    }
  }, [])

  // Setup real-time subscription
  useEffect(() => {
    if (!enabled || !jobId) {
      cleanup()
      return
    }

    // Reset state when job ID changes
    if (lastJobIdRef.current !== jobId) {
      cleanup()
      setJob(null)
      setEvents([])
      setError(null)
      lastJobIdRef.current = jobId
      completedCallbackFiredRef.current = null // Reset callback guard for new job
    }

    // Initial fetch
    fetchJobStatus(jobId).catch((err) => {
      console.error('Failed to fetch initial job status:', err)
    })

    // Setup real-time subscription
    const channel = supabase
      .channel(`scraper_job_${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scraper_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          console.log('[realtime] Job update received:', payload.new)
          const updatedJob = payload.new as ScraperJob
          setJob(updatedJob)
          onJobUpdate?.(updatedJob)

          // Check if job is complete - only fire callback once per job
          const terminalStatuses: ScraperJobStatus[] = ['succeeded', 'failed', 'cancelled']
          if (terminalStatuses.includes(updatedJob.status)) {
            if (completedCallbackFiredRef.current !== updatedJob.id) {
              completedCallbackFiredRef.current = updatedJob.id
              onJobComplete?.(updatedJob)
            }
            // Stop polling when complete
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current)
              pollIntervalRef.current = null
              setIsPolling(false)
            }
          } else {
            // Refetch to get latest events when status changes
            fetchJobStatus(jobId).catch((err) => {
              console.error('Failed to refetch job after real-time update:', err)
            })
          }
        }
      )
      .subscribe((status) => {
        console.log('[realtime] Subscription status:', status)
        if (status === 'SUBSCRIBED') {
          setIsRealtimeActive(true)
          setIsPolling(false)
          // Clear any existing polling when real-time is active
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[realtime] Real-time subscription failed, falling back to polling')
          setIsRealtimeActive(false)
          // Fallback to polling
          if (!pollIntervalRef.current) {
            setIsPolling(true)
            pollIntervalRef.current = setInterval(() => {
              fetchJobStatus(jobId).catch((err) => {
                console.error('Failed to poll job status:', err)
              })
            }, pollingInterval)
          }
        }
      })

    channelRef.current = channel

    // Fallback polling if real-time doesn't activate quickly
    const pollingTimeout = setTimeout(() => {
      if (!isRealtimeActive && !pollIntervalRef.current) {
        console.log('[realtime] Real-time not active, starting polling fallback')
        setIsPolling(true)
        pollIntervalRef.current = setInterval(() => {
          fetchJobStatus(jobId).catch((err) => {
            console.error('Failed to poll job status:', err)
          })
        }, pollingInterval)
      }
    }, 5000) // Wait 5 seconds before starting fallback polling

    return () => {
      clearTimeout(pollingTimeout)
      cleanup()
    }
  }, [jobId, enabled, pollingInterval, fetchJobStatus, onJobUpdate, onJobComplete, cleanup, isRealtimeActive])

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  const refetch = useCallback(async () => {
    if (jobId) {
      await fetchJobStatus(jobId)
    }
  }, [jobId, fetchJobStatus])

  return {
    job,
    events,
    isRealtimeActive,
    isPolling,
    error,
    refetch,
  }
}

