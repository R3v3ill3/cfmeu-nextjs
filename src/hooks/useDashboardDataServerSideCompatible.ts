import { useMemo } from 'react'
import { useOrganizingUniverseMetrics, OrganizingUniverseFilters } from './useOrganizingUniverseMetrics'
import { useOrganizingUniverseMetricsServerSideCompatible } from './useOrganizingUniverseMetricsServerSide'
import { usePatchSummaryData } from './usePatchSummaryData'
import { usePatchSummariesServerSide } from './usePatchSummaryDataServerSide'

/**
 * Compatibility layer for dashboard data that switches between client and server-side based on feature flag
 * This allows for seamless migration without changing component logic
 */

export function useOrganizingUniverseMetricsCompatible(filters: OrganizingUniverseFilters = {}) {
  // Feature flag for server-side processing
  const USE_SERVER_SIDE = process.env.NEXT_PUBLIC_USE_SERVER_SIDE_DASHBOARD === 'true'
  
  // CLIENT-SIDE (Original implementation)
  const clientSideQuery = useOrganizingUniverseMetrics(filters)
  
  // SERVER-SIDE (New implementation)  
  const serverSideQuery = useOrganizingUniverseMetricsServerSideCompatible(filters)
  
  // Return appropriate result based on feature flag
  return useMemo(() => {
    if (USE_SERVER_SIDE) {
      return {
        ...serverSideQuery,
        isServerSide: true,
        debug: { useServerSide: true }
      }
    } else {
      return {
        ...clientSideQuery,
        isServerSide: false,
        debug: { useServerSide: false }
      }
    }
  }, [USE_SERVER_SIDE, clientSideQuery, serverSideQuery])
}

export function usePatchSummaryDataCompatible(patchId: string, filters: any = {}) {
  const USE_SERVER_SIDE = process.env.NEXT_PUBLIC_USE_SERVER_SIDE_DASHBOARD === 'true'
  
  // CLIENT-SIDE (Original implementation)
  const clientSideQuery = usePatchSummaryData(patchId)
  
  // SERVER-SIDE (New implementation)
  const serverSideQuery = usePatchSummariesServerSide(filters)
  
  return useMemo(() => {
    if (USE_SERVER_SIDE) {
      // Extract single patch from server-side array result
      const patchData = (serverSideQuery.data as any)?.summaries?.find((s: any) => s.patchId === patchId)
      return {
        data: patchData ? {
          patchId: patchData.patchId,
          patchName: patchData.patchName,
          organiserNames: patchData.organiserNames,
          projectCount: patchData.projectCount,
          organizingMetrics: {
            ebaProjectsPercentage: patchData.ebaProjectsPercentage,
            ebaProjectsCount: patchData.ebaProjectsCount,
            totalActiveProjects: patchData.projectCount,
            knownBuilderPercentage: patchData.knownBuilderPercentage,
            knownBuilderCount: patchData.knownBuilderCount,
            keyContractorCoveragePercentage: patchData.keyContractorCoverage,
            mappedKeyContractors: 0,
            totalKeyContractorSlots: 0,
            keyContractorEbaBuilderPercentage: 0,
            keyContractorsOnEbaBuilderProjects: 0,
            totalKeyContractorsOnEbaBuilderProjects: 0,
            keyContractorEbaPercentage: patchData.keyContractorEbaPercentage,
            keyContractorsWithEba: 0,
            totalMappedKeyContractors: 0
          },
          lastUpdated: patchData.lastUpdated
        } : null,
        isLoading: serverSideQuery.isLoading,
        isFetching: serverSideQuery.isFetching,
        error: serverSideQuery.error,
        refetch: serverSideQuery.refetch,
        isServerSide: true
      }
    } else {
      return {
        ...clientSideQuery,
        isServerSide: false
      }
    }
  }, [USE_SERVER_SIDE, clientSideQuery, serverSideQuery, patchId])
}

/**
 * Hook to get dashboard performance info and feature flag status
 */
export function useDashboardInfo() {
  const USE_SERVER_SIDE = process.env.NEXT_PUBLIC_USE_SERVER_SIDE_DASHBOARD === 'true'
  
  return {
    useServerSide: USE_SERVER_SIDE,
    clientSide: !USE_SERVER_SIDE,
    version: USE_SERVER_SIDE ? 'server-optimized' : 'client-side'
  }
}
