import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

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
}

interface UseAddressSearchParams {
  lat: number | null
  lng: number | null
  address: string | null
  enabled?: boolean
  maxResults?: number
  maxDistanceKm?: number
}

export function useAddressSearch({
  lat,
  lng,
  address,
  enabled = true,
  maxResults = 10,
  maxDistanceKm = 100
}: UseAddressSearchParams) {
  console.log('[useAddressSearch] Hook called with:', { lat, lng, address, enabled, maxResults, maxDistanceKm })
  
  return useQuery<NearbyProject[]>({
    queryKey: ['address-search', lat, lng, address, maxResults, maxDistanceKm],
    queryFn: async () => {
      console.log('[useAddressSearch] Query function executing...')
      
      if (lat === null || lng === null) {
        console.error('[useAddressSearch] Missing coordinates', { lat, lng })
        throw new Error('Coordinates are required')
      }

      console.log('[useAddressSearch] Calling find_nearby_projects RPC', {
        search_lat: lat,
        search_lng: lng,
        search_address: address,
        max_results: maxResults,
        max_distance_km: maxDistanceKm
      })

      const { data, error } = await (supabase.rpc as any)('find_nearby_projects', {
        search_lat: lat,
        search_lng: lng,
        search_address: address,
        max_results: maxResults,
        max_distance_km: maxDistanceKm
      })

      if (error) {
        console.error('[useAddressSearch] RPC error:', error)
        throw error
      }

      console.log('[useAddressSearch] RPC success, results:', data?.length || 0, 'projects')
      return (data || []) as NearbyProject[]
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
