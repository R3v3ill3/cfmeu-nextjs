import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

/**
 * Access status for a project relative to the current user
 * - 'owned': User has access via patch assignment, lead assignment, or claim
 * - 'claimable': Project has no patch or patch has no organiser - user can claim it
 * - 'assigned_other': Project is assigned to other organisers - user cannot access
 */
export type ProjectAccessStatus = 'owned' | 'claimable' | 'assigned_other'

export interface NearbyProject {
  project_id: string
  project_name: string
  project_tier: string | null
  job_site_id: string
  job_site_name: string
  job_site_address: string
  latitude: number
  longitude: number
  distance_km: number
  is_exact_match: boolean
  builder_name: string | null
  organising_universe: string | null
  stage_class: string | null
  project_value: number | null
  // Access control fields - from find_nearby_projects_with_access RPC
  access_status: ProjectAccessStatus
  assigned_to_names: string[] | null
  patch_id: string | null
  patch_name: string | null
}

interface UseAddressSearchParams {
  lat: number | null
  lng: number | null
  address?: string | null
  enabled?: boolean
  maxResults?: number
  maxDistanceKm?: number
}

const FIND_NEARBY_PROJECTS_TIMEOUT_MS = 12_000

// Error classification for telemetry
type ErrorType = 'timeout' | 'network' | 'api' | 'validation' | 'unknown'

interface SearchErrorTelemetry {
  type: ErrorType
  message: string
  durationMs: number
  coordinates: { lat: number; lng: number }
  platform: string
  timestamp: string
  rawError?: string
}

function classifyError(error: unknown): ErrorType {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('timed out') || msg.includes('timeout')) return 'timeout'
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) return 'network'
    if (msg.includes('coordinates') || msg.includes('invalid')) return 'validation'
  }
  // Check for Supabase/Postgres errors
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return 'api'
  }
  return 'unknown'
}

function getPlatformInfo(): string {
  if (typeof navigator === 'undefined') return 'server'
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) {
    const match = ua.match(/OS (\d+[_\.]\d+)/)
    return `iOS ${match?.[1]?.replace('_', '.') || 'unknown'}`
  }
  if (/Android/.test(ua)) {
    const match = ua.match(/Android (\d+\.?\d*)/)
    return `Android ${match?.[1] || 'unknown'}`
  }
  return 'desktop'
}

function logSearchError(telemetry: SearchErrorTelemetry): void {
  // Structured error logging for debugging
  console.error('[useAddressSearch] Search failed:', {
    ...telemetry,
    // Redact exact coordinates for privacy in logs
    coordinates: {
      lat: Math.round(telemetry.coordinates.lat * 100) / 100,
      lng: Math.round(telemetry.coordinates.lng * 100) / 100,
    }
  })
  
  // If PostHog is available, send telemetry event
  if (typeof window !== 'undefined' && 'posthog' in window) {
    try {
      (window as any).posthog?.capture('nearby_search_error', {
        error_type: telemetry.type,
        error_message: telemetry.message,
        duration_ms: telemetry.durationMs,
        platform: telemetry.platform,
      })
    } catch {
      // Ignore PostHog errors
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), ms)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })
}

export function useAddressSearch({
  lat,
  lng,
  address = null,
  enabled = true,
  maxResults = 10,
  maxDistanceKm = 100
}: UseAddressSearchParams) {
  console.log('[useAddressSearch] Hook called with:', { lat, lng, address, enabled, maxResults, maxDistanceKm })
  
  return useQuery<NearbyProject[]>({
    queryKey: ['address-search', lat, lng, address, maxResults, maxDistanceKm],
    queryFn: async () => {
      const startTime = Date.now()
      console.log('[useAddressSearch] Query function executing...')
      
      if (lat === null || lng === null) {
        console.error('[useAddressSearch] Missing coordinates', { lat, lng })
        throw new Error('Coordinates are required')
      }

      console.log('[useAddressSearch] Calling find_nearby_projects_with_access RPC', {
        search_lat: lat,
        search_lng: lng,
        search_address: address,
        max_results: maxResults,
        max_distance_km: maxDistanceKm
      })

      // Use the access-aware RPC that returns access_status for each project
      const rpcPromise = (supabase.rpc as any)('find_nearby_projects_with_access', {
        search_lat: lat,
        search_lng: lng,
        search_address: address,
        max_results: maxResults,
        max_distance_km: maxDistanceKm,
      }) as Promise<{ data: unknown; error: unknown }>

      try {
        const { data, error } = await withTimeout(
          rpcPromise,
          FIND_NEARBY_PROJECTS_TIMEOUT_MS,
          'Nearby project search timed out. Please retry or use search.'
        )

        const durationMs = Date.now() - startTime

        if (error) {
          logSearchError({
            type: classifyError(error),
            message: (error as Error)?.message || 'Unknown API error',
            durationMs,
            coordinates: { lat, lng },
            platform: getPlatformInfo(),
            timestamp: new Date().toISOString(),
            rawError: JSON.stringify(error),
          })
          throw error
        }

        console.log('[useAddressSearch] RPC success', {
          resultCount: (data as any[])?.length || 0,
          durationMs,
          platform: getPlatformInfo(),
        })
        return (data || []) as NearbyProject[]
      } catch (err) {
        const durationMs = Date.now() - startTime
        
        // Log structured error for telemetry
        logSearchError({
          type: classifyError(err),
          message: (err as Error)?.message || 'Unknown error',
          durationMs,
          coordinates: { lat, lng },
          platform: getPlatformInfo(),
          timestamp: new Date().toISOString(),
          rawError: err instanceof Error ? err.stack : String(err),
        })
        
        throw err
      }
    },
    enabled: enabled && lat !== null && lng !== null,
    staleTime: 30000, // Cache for 30 seconds
    retry: 1
  })
}

// Helper function to format distance
export function formatDistance(km: number): string {
  if (km < 0.001) {
    return 'At location'
  } else if (km < 1) {
    return `${Math.round(km * 1000)} m`
  } else if (km < 10) {
    return `${km.toFixed(1)} km`
  } else {
    return `${Math.round(km)} km`
  }
}
