import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/hooks/useAuth"

export interface PatchSummaryDataServerSide {
  patchId: string
  patchName: string
  organiserNames: string[]
  projectCount: number
  ebaProjectsCount: number
  ebaProjectsPercentage: number
  knownBuilderCount: number
  knownBuilderPercentage: number
  keyContractorCoverage: number
  keyContractorEbaPercentage: number
  lastUpdated: string
}

export interface PatchSummariesFilters {
  tier?: string
  stage?: string
  universe?: string
  eba?: string
}

const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return ''
  }
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  }
  return 'http://localhost:3000'
}

/**
 * Server-side hook for patch summary data based on user role
 */
export function usePatchSummariesServerSide(filters: PatchSummariesFilters = {}) {
  const { user } = useAuth()
  
  return useQuery({
    queryKey: ["patch-summaries-server", user?.id, filters],
    enabled: !!user?.id,
    staleTime: 90 * 1000, // 90 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('4')) {
        return false
      }
      return failureCount < 2
    },
    queryFn: async () => {
      if (!user?.id) throw new Error('User ID required')
      
      const baseUrl = getBaseUrl()
      
      // Get user role first
      const roleResponse = await fetch(`${baseUrl}/api/user/profile`)
      if (!roleResponse.ok) throw new Error('Failed to fetch user profile')
      const userProfile = await roleResponse.json()
      
      // Build URL parameters
      const searchParams = new URLSearchParams()
      searchParams.set('userId', user.id)
      searchParams.set('userRole', userProfile.role)
      
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

      const url = `${baseUrl}/api/dashboard/patch-summaries?${searchParams.toString()}`
      console.log('🔄 Fetching patch summaries from server:', url)
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch patch summaries: ${response.status} ${errorText}`)
      }

      const data = await response.json()
      
      // Log performance metrics
      if (data.debug) {
        console.log(`📊 Patch summaries query completed in ${data.debug.queryTime}ms for ${data.debug.patchCount} patches`)
        if (data.debug.queryTime > 1500) {
          console.warn('⚠️ Slow patch summaries query detected:', data.debug)
        }
      }

      return data
    }
  })
}

/**
 * Server-side hook for individual patch summary (compatible with existing interface)
 */
export function usePatchSummaryServerSide(patchId: string, filters: PatchSummariesFilters = {}) {
  const allSummaries = usePatchSummariesServerSide(filters)
  
  return {
    data: allSummaries.data?.summaries?.find((s: PatchSummaryDataServerSide) => s.patchId === patchId) || null,
    isLoading: allSummaries.isLoading,
    isFetching: allSummaries.isFetching,
    error: allSummaries.error,
    refetch: allSummaries.refetch
  }
}

/**
 * Server-side hook for lead organizer specific patch summaries
 */
export function useLeadOrganizerSummariesServerSide(leadOrganizerId: string, filters: PatchSummariesFilters = {}) {
  const { user } = useAuth()
  
  return useQuery({
    queryKey: ["lead-organizer-summaries-server", leadOrganizerId, filters],
    enabled: !!user?.id && !!leadOrganizerId,
    staleTime: 90 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!user?.id) throw new Error('User ID required')
      
      const baseUrl = getBaseUrl()
      const searchParams = new URLSearchParams()
      searchParams.set('userId', user.id)
      searchParams.set('userRole', 'admin') // Admin can view any lead organizer
      searchParams.set('leadOrganizerId', leadOrganizerId)
      
      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          searchParams.set(key, value)
        }
      })

      const response = await fetch(`${baseUrl}/api/dashboard/patch-summaries?${searchParams.toString()}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch lead organizer summaries: ${response.status}`)
      }

      return await response.json()
    }
  })
}
