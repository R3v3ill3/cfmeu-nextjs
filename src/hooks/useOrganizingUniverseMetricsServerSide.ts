import { useQuery } from "@tanstack/react-query"
import { OrganizingUniverseMetrics, OrganizingUniverseFilters } from "./useOrganizingUniverseMetrics"

/**
 * Server-side hook for organizing universe metrics
 * Uses API route for optimized database queries
 */
export function useOrganizingUniverseMetricsServerSide(filters: OrganizingUniverseFilters = {}) {
  return useQuery({
    queryKey: ["organizing-universe-metrics-server", filters],
    staleTime: 2 * 60 * 1000, // 2 minutes - aggressive caching like employers
    gcTime: 10 * 60 * 1000, // 10 minutes in memory
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Don't retry 4xx errors
      if (error instanceof Error && error.message.includes('4')) {
        return false
      }
      return failureCount < 2
    },
    queryFn: async (): Promise<OrganizingUniverseMetrics> => {
      // Build URL parameters
      const searchParams = new URLSearchParams()
      
      if (filters.patchIds && filters.patchIds.length > 0) {
        searchParams.set('patchIds', filters.patchIds.join(','))
      }
      
      if (filters.tier && filters.tier !== 'all') {
        searchParams.set('tier', filters.tier)
      }
      
      if (filters.stage && filters.stage !== 'all') {
        searchParams.set('stage', filters.stage)
      }
      
      if (filters.universe && filters.universe !== 'all') {
        searchParams.set('universe', filters.universe)
      }
      
      if (filters.eba && filters.eba !== 'all') {
        searchParams.set('eba', filters.eba)
      }
      
      if (filters.userId) {
        searchParams.set('userId', filters.userId)
      }
      
      if (filters.userRole) {
        searchParams.set('userRole', filters.userRole)
      }

      const url = `/api/dashboard/organizing-metrics?${searchParams.toString()}`
      console.log('🔄 Fetching organizing metrics from server:', url)
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch organizing metrics: ${response.status} ${errorText}`)
      }

      const data = await response.json()
      
      // Log performance metrics
      if (data.debug) {
        console.log(`📊 Organizing metrics query completed in ${data.debug.queryTime}ms`)
        if (data.debug.queryTime > 1000) {
          console.warn('⚠️ Slow organizing metrics query detected:', data.debug)
        }
      }

      return data.metrics
    }
  })
}

/**
 * Compatibility layer for seamless migration from client-side
 * Provides same interface as original hook
 */
export function useOrganizingUniverseMetricsServerSideCompatible(filters: OrganizingUniverseFilters = {}) {
  const query = useOrganizingUniverseMetricsServerSide(filters)
  
  return {
    // Match original interface
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    
    // Additional server-side specific information
    isServerSide: true
  }
}
