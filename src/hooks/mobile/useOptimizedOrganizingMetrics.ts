"use client"

import { useQuery } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"
import { useNetworkOptimization } from "@/lib/network/network-optimization"
import { useDeviceCapabilities } from "@/hooks/useMobilePerformance"
import {
  fetchOrganizingUniverseMetrics,
  OrganizingUniverseMetrics,
  OrganizingUniverseFilters
} from "@/hooks/useOrganizingUniverseMetrics"

interface OptimizedOrganizingMetricsOptions {
  enableBackgroundRefresh?: boolean
  refreshInterval?: number
  prefetchOnMount?: boolean
  prioritizeFreshData?: boolean
}

/**
 * Mobile-optimized hook for organizing universe metrics with adaptive caching
 * and performance optimizations based on device capabilities and network conditions.
 */
export function useOptimizedOrganizingMetrics(
  filters: OrganizingUniverseFilters = {},
  options: OptimizedOrganizingMetricsOptions = {}
) {
  const {
    isOnline,
    networkInfo,
    isSlowConnection
  } = useNetworkOptimization()

  const {
    isLowEnd,
    memoryConstraints,
    batteryLevel
  } = useDeviceCapabilities()

  // Adaptive caching strategy based on conditions
  const adaptiveCacheConfig = useMemo(() => {
    const baseConfig = {
      staleTime: 5 * 60 * 1000, // 5 minutes base
      gcTime: 30 * 60 * 1000, // 30 minutes base
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true
    }

    // Optimize for network conditions
    if (!isOnline) {
      return {
        ...baseConfig,
        staleTime: 60 * 60 * 1000, // 1 hour when offline
        gcTime: 24 * 60 * 60 * 1000, // 24 hours
        refetchOnReconnect: true
      }
    }

    if (isSlowConnection) {
      return {
        ...baseConfig,
        staleTime: 15 * 60 * 1000, // 15 minutes on slow connection
        gcTime: 2 * 60 * 60 * 1000, // 2 hours
        refetchOnReconnect: true
      }
    }

    // Optimize for device capabilities
    if (isLowEnd || memoryConstraints) {
      return {
        ...baseConfig,
        staleTime: 10 * 60 * 1000, // 10 minutes for low-end devices
        gcTime: 60 * 60 * 1000, // 1 hour
        refetchOnWindowFocus: false
      }
    }

    // Optimize for battery level
    if (batteryLevel && batteryLevel < 0.2) {
      return {
        ...baseConfig,
        staleTime: 30 * 60 * 1000, // 30 minutes on low battery
        gcTime: 2 * 60 * 60 * 1000, // 2 hours
        refetchOnWindowFocus: false,
        enableBackgroundRefresh: false
      }
    }

    // Fast connection, good device - more aggressive refreshing
    if (options.prioritizeFreshData) {
      return {
        ...baseConfig,
        staleTime: 2 * 60 * 1000, // 2 minutes for fresh data
        gcTime: 15 * 60 * 1000, // 15 minutes
        refetchInterval: 60 * 1000 // Refresh every minute
      }
    }

    return baseConfig
  }, [
    isOnline,
    isSlowConnection,
    isLowEnd,
    memoryConstraints,
    batteryLevel,
    options.prioritizeFreshData
  ])

  // Optimized query configuration
  const queryConfig = useMemo(() => {
    const config = {
      queryKey: ["organizing-universe-metrics", filters, {
        network: networkInfo?.effectiveType,
        online: isOnline,
        deviceClass: isLowEnd ? 'low-end' : 'high-end'
      }] as const,
      ...adaptiveCacheConfig,
      retry: (failureCount: number, error: any) => {
        // Adaptive retry logic
        if (!isOnline) return false
        if (error?.status >= 400 && error?.status < 500) return false
        return failureCount < (isSlowConnection ? 1 : 3)
      },
      retryDelay: (attemptIndex: number) => {
        const baseDelay = isSlowConnection ? 2000 : 1000
        const exponentialDelay = Math.min(baseDelay * 2 ** attemptIndex, 30000)
        // Add jitter to prevent thundering herd
        return exponentialDelay + Math.random() * 1000
      },
      queryFn: () => fetchOrganizingUniverseMetrics(filters),
      meta: {
        persistent: true,
        priority: isSlowConnection ? 'low' : 'high',
        networkOptimization: true,
        deviceOptimization: true
      }
    }

    // Background refresh configuration
    if (options.enableBackgroundRefresh && isOnline && !isSlowConnection) {
      config.refetchInterval = options.refreshInterval || (5 * 60 * 1000)
    }

    return config
  }, [
    filters,
    adaptiveCacheConfig,
    networkInfo,
    isOnline,
    isLowEnd,
    isSlowConnection,
    options.enableBackgroundRefresh,
    options.refreshInterval
  ])

  const query = useQuery(queryConfig)

  // Prefetch related data if enabled
  const prefetchRelatedData = useCallback(async () => {
    if (!options.prefetchOnMount || !isOnline || isSlowConnection) return

    try {
      // Prefetch common filter variations for better UX
      const commonFilters = [
        { universe: 'active' },
        { universe: 'inactive' },
        { tier: '1' },
        { tier: '2' },
        { tier: '3' }
      ]

      // Only prefetch if we have a stable connection
      if (networkInfo?.effectiveType !== 'slow-2g' && networkInfo?.effectiveType !== '2g') {
        // Prefetch in parallel with low priority
        Promise.all(
          commonFilters.map(filter =>
            fetchOrganizingUniverseMetrics({ ...filters, ...filter })
              .catch(() => null) // Silently fail prefetches
          )
        )
      }
    } catch (error) {
      // Silently fail prefetches
      console.debug('Prefetch failed:', error)
    }
  }, [filters, options.prefetchOnMount, isOnline, isSlowConnection, networkInfo])

  // Prefetch on mount if enabled
  if (options.prefetchOnMount && query.status === 'success') {
    prefetchRelatedData()
  }

  // Performance monitoring
  const performanceMetrics = useMemo(() => {
    return {
      isOptimized: isLowEnd || isSlowConnection,
      cacheHit: query.dataUpdatedAt > 0,
      lastFetchTime: query.dataUpdatedAt,
      staleTime: adaptiveCacheConfig.staleTime,
      networkCondition: networkInfo?.effectiveType || 'unknown',
      deviceClass: isLowEnd ? 'low-end' : 'high-end',
      batteryOptimization: batteryLevel && batteryLevel < 0.2
    }
  }, [
    isLowEnd,
    isSlowConnection,
    query.dataUpdatedAt,
    adaptiveCacheConfig.staleTime,
    networkInfo,
    batteryLevel
  ])

  // Manual refresh with optimization
  const optimizedRefresh = useCallback(async (force = false) => {
    if (!isOnline && !force) {
      console.warn('Cannot refresh: device is offline')
      return
    }

    if (isSlowConnection && !force) {
      console.info('Slow connection detected, using cached data')
      return
    }

    try {
      await query.refetch()
    } catch (error) {
      console.error('Refresh failed:', error)
    }
  }, [isOnline, isSlowConnection, query])

  return {
    ...query,
    // Additional optimized methods
    optimizedRefresh,
    prefetchRelatedData,
    performanceMetrics,
    // Computed states
    isUsingOptimizedCache: isLowEnd || isSlowConnection || !isOnline,
    shouldShowRefreshWarning: isSlowConnection && query.isStale,
    isBackgroundRefreshing: options.enableBackgroundRefresh && query.isFetching && !query.isRefetching
  }
}

/**
 * Hook for organizing metrics with progressive loading for mobile
 */
export function useProgressiveOrganizingMetrics(
  filters: OrganizingUniverseFilters = {}
) {
  const { isSlowConnection, isOnline } = useNetworkOptimization()
  const { isLowEnd } = useDeviceCapabilities()

  // First load with minimal data for fast initial render
  const minimalQuery = useOptimizedOrganizingMetrics(filters, {
    prioritizeFreshData: false,
    enableBackgroundRefresh: true,
    refreshInterval: 10 * 60 * 1000 // 10 minutes
  })

  // Full data query (only on good connections)
  const fullQuery = useOptimizedOrganizingMetrics(filters, {
    prioritizeFreshData: !isSlowConnection,
    enableBackgroundRefresh: !isLowEnd,
    refreshInterval: isSlowConnection ? undefined : 2 * 60 * 1000 // 2 minutes
  })

  // Progressive loading strategy
  const data = useMemo(() => {
    // Return minimal data immediately if available
    if (minimalQuery.data) {
      return minimalQuery.data
    }

    // Fall back to full data if minimal isn't ready yet
    return fullQuery.data
  }, [minimalQuery.data, fullQuery.data])

  const isLoading = minimalQuery.isLoading || (fullQuery.isLoading && !minimalQuery.data)
  const error = minimalQuery.error || fullQuery.error

  return {
    data,
    isLoading,
    error,
    isProgressiveLoading: true,
    minimalData: minimalQuery.data,
    fullData: fullQuery.data,
    isMinimalDataReady: !!minimalQuery.data,
    isFullDataReady: !!fullQuery.data,
    refresh: minimalQuery.optimizedRefresh,
    performanceMetrics: {
      ...minimalQuery.performanceMetrics,
      progressiveLoading: true,
      usingMinimalData: !!minimalQuery.data && !fullQuery.data
    }
  }
}

export default useOptimizedOrganizingMetrics