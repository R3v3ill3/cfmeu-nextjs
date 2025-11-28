import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

export interface GeographicProject {
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

export interface GeographicSearchParams {
  lat: number | null
  lng: number | null
  address?: string | null
  radiusKm?: number
  maxResults?: number
  enabled?: boolean
  stageClass?: string | null
  projectTiers?: string[]
  organizingUniverse?: string | null
  includeBuilderOnly?: boolean
}

export function useGeographicSearch({
  lat,
  lng,
  address = null,
  radiusKm = 50,
  maxResults = 50,
  enabled = true,
  stageClass = null,
  projectTiers = null,
  organizingUniverse = null,
  includeBuilderOnly = false
}: GeographicSearchParams) {

  return useQuery<GeographicProject[]>({
    queryKey: ['geographic-search', lat, lng, address, radiusKm, maxResults, stageClass, projectTiers, organizingUniverse, includeBuilderOnly],
    queryFn: async () => {
      if (lat === null || lng === null) {
        throw new Error('Coordinates are required for geographic search')
      }

      console.log('[useGeographicSearch] Calling enhanced find_nearby_projects RPC', {
        search_lat: lat,
        search_lng: lng,
        search_address: address,
        max_results: maxResults,
        max_distance_km: radiusKm
      })

      const { data, error } = await (supabase.rpc as any)('find_nearby_projects', {
        search_lat: lat,
        search_lng: lng,
        search_address: address,
        max_results: maxResults,
        max_distance_km: radiusKm
      })

      if (error) {
        console.error('[useGeographicSearch] RPC error:', error)
        throw error
      }

      let results = (data || []) as GeographicProject[]

      // Apply additional client-side filters for more complex criteria
      if (stageClass) {
        results = results.filter(project => project.stage_class === stageClass)
      }

      if (projectTiers && projectTiers.length > 0) {
        results = results.filter(project =>
          project.project_tier && projectTiers.includes(project.project_tier)
        )
      }

      if (organizingUniverse) {
        results = results.filter(project =>
          project.organising_universe === organizingUniverse
        )
      }

      if (includeBuilderOnly) {
        results = results.filter(project =>
          project.builder_name !== null && project.builder_name !== undefined
        )
      }

      console.log('[useGeographicSearch] Found', results.length, 'projects after filtering')
      return results
    },
    enabled: enabled && lat !== null && lng !== null,
    staleTime: 60000, // Cache for 1 minute for geographic searches
    retry: 2,
    refetchOnWindowFocus: false
  })
}

// Convenience hook for common radius searches
export function useNearbyProjects(lat: number | null, lng: number | null, radiusKm: number = 10) {
  return useGeographicSearch({
    lat,
    lng,
    radiusKm,
    maxResults: Math.min(100, radiusKm * 10) // Scale results with radius
  })
}

// Hook for projects within user's patches with geographic filtering
export function usePatchGeographicSearch(patchIds: string[] | null, lat: number | null, lng: number | null, radiusKm: number = 100) {
  return useQuery<GeographicProject[]>({
    queryKey: ['patch-geographic-search', patchIds?.join(','), lat, lng, radiusKm],
    queryFn: async () => {
      if (lat === null || lng === null) {
        return []
      }

      // If admin or no patch restrictions, use full geographic search
      if (!patchIds || patchIds.length === 0) {
        const { data } = await supabase.rpc('find_nearby_projects', {
          search_lat: lat,
          search_lng: lng,
          max_results: 200,
          max_distance_km: radiusKm
        })
        return (data || []) as GeographicProject[]
      }

      // For non-admin users, intersect geographic search with patch assignments
      const { data: geoProjects } = await supabase.rpc('find_nearby_projects', {
        search_lat: lat,
        search_lng: lng,
        max_results: 200,
        max_distance_km: radiusKm
      })

      if (!geoProjects || geoProjects.length === 0) {
        return []
      }

      // Get patch-site assignments to filter geographic results
      const projectIds = Array.from(new Set((geoProjects as any[]).map(p => p.project_id)))
      const { data: patchProjects } = await supabase
        .from('v_patch_projects_current')
        .select('project_id, patch_id')
        .in('patch_id', patchIds)
        .in('project_id', projectIds)

      if (!patchProjects || patchProjects.length === 0) {
        return []
      }

      const allowedProjectIds = new Set(patchProjects.map(pp => pp.project_id))
      return (geoProjects as GeographicProject[]).filter(
        project => allowedProjectIds.has(project.project_id)
      )
    },
    enabled: lat !== null && lng !== null,
    staleTime: 120000, // Cache for 2 minutes
    retry: 1
  })
}

// Utility functions for geographic search
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

export function getRadiusLabel(radiusKm: number): string {
  if (radiusKm < 1) {
    return `${Math.round(radiusKm * 1000)}m radius`
  } else if (radiusKm <= 50) {
    return `${radiusKm}km radius`
  } else if (radiusKm <= 100) {
    return `${Math.round(radiusKm / 10) * 10}km radius`
  } else {
    return `${Math.round(radiusKm / 100) * 100}km radius`
  }
}

// Predefined radius options for UI
export const RADIUS_OPTIONS = [
  { value: 1, label: '1 km' },
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
  { value: 100, label: '100 km' },
  { value: 200, label: '200 km' }
]

// Stage class options for filtering
export const STAGE_CLASS_OPTIONS = [
  { value: 'future', label: 'Future' },
  { value: 'pre_construction', label: 'Pre-construction' },
  { value: 'construction', label: 'Under Construction' },
  { value: 'archived', label: 'Completed' }
]

// Organizing universe options
export const ORGANIZING_UNIVERSE_OPTIONS = [
  { value: 'federal', label: 'Federal' },
  { value: 'state', label: 'State' },
  { value: 'local', label: 'Local' },
  { value: 'private', label: 'Private' }
]