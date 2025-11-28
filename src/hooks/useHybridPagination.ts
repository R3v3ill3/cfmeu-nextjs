import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useIsMobile } from '@/hooks/use-mobile'
import { useDebounce } from '@/hooks/useDebounce'

// Types for paginated data
export interface PaginatedResponse<T> {
  items: T[]
  pagination: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
  debug?: {
    queryTime: number
    cacheHit: boolean
    via?: string
  }
}

export interface PaginationParams {
  page: number
  pageSize: number
  sort?: string
  dir?: 'asc' | 'desc'
  // Additional filter parameters
  [key: string]: any
}

export interface UseHybridPaginationOptions<T> {
  // Fetch function should accept pagination parameters and return PaginatedResponse
  fetchFn: (params: PaginationParams) => Promise<PaginatedResponse<T>>

  // Base query key for React Query
  queryKey: string[]

  // Initial parameters
  initialParams?: Partial<PaginationParams>

  // Mobile specific options
  mobile?: {
    pageSize?: number // Default: 20 for mobile
    loadMoreThreshold?: number // Default: 5 items from bottom
    prefetchNextPage?: boolean // Default: true
  }

  // Desktop specific options
  desktop?: {
    pageSize?: number // Default: 50 for desktop
  }

  // Debounce options for search/filter changes
  debounce?: {
    delay?: number // Default: 300ms
    enabled?: boolean // Default: true for mobile, false for desktop
  }

  // React Query options
  queryOptions?: {
    staleTime?: number
    gcTime?: number
    refetchOnWindowFocus?: boolean
    retry?: boolean | number
  }

  // Performance monitoring
  enablePerformanceLogging?: boolean // Default: false
}

/**
 * Hybrid pagination hook that optimizes for mobile and desktop:
 *
 * MOBILE (Infinite Scroll):
 * - Loads data progressively
 * - Prefetches next page for smooth scrolling
 * - Debounced parameter changes
 * - Optimized for touch interactions
 *
 * DESKTOP (Traditional Pagination):
 * - Traditional page-based navigation
 * - Larger page sizes for desktop viewing
 * - Immediate parameter changes
 * - Keyboard navigation support
 */
export function useHybridPagination<T>(
  options: UseHybridPaginationOptions<T>
) {
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()

  // Merge mobile/desktop defaults with provided options
  const pageSize = isMobile
    ? options.mobile?.pageSize || 20
    : options.desktop?.pageSize || 50

  const debounceEnabled = options.debounce?.enabled ?? isMobile
  const debounceDelay = options.debounce?.delay ?? 300

  // State management
  const [params, setParams] = useState<PaginationParams>(() => ({
    page: 1,
    pageSize,
    sort: 'name',
    dir: 'asc',
    ...options.initialParams
  }))

  // Mobile-specific infinite scroll state
  const [mobileItems, setMobileItems] = useState<T[]>([])
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasReachedEnd, setHasReachedEnd] = useState(false)

  // Refs for infinite scroll detection
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const lastPageRef = useRef<number>(1)

  // Debounced parameters for mobile (prevents excessive API calls during typing)
  const debouncedParams = useDebounce(params, debounceEnabled ? debounceDelay : 0)

  // Determine current parameters to use for query
  const currentParams = debounceEnabled ? debouncedParams : params

  // Build query key that includes all relevant parameters
  const queryKey = [
    ...options.queryKey,
    'hybrid-pagination',
    currentParams,
    { isMobile }
  ]

  // Main data fetching query
  const query = useQuery({
    queryKey,
    queryFn: () => options.fetchFn(currentParams),
    staleTime: options.queryOptions?.staleTime || (isMobile ? 60 * 1000 : 30 * 1000),
    gcTime: options.queryOptions?.gcTime || 5 * 60 * 1000,
    refetchOnWindowFocus: options.queryOptions?.refetchOnWindowFocus ?? !isMobile,
    retry: options.queryOptions?.retry ?? 2,
    enabled: true
  })

  const serverPagination = query.data?.pagination
  const normalizedHasNextPage = serverPagination
    ? (typeof serverPagination.hasNextPage === 'boolean'
        ? serverPagination.hasNextPage
        : ((serverPagination.page ?? 1) * (serverPagination.pageSize ?? pageSize) < (serverPagination.totalCount ?? 0)))
    : false
  const normalizedHasPrevPage = serverPagination
    ? (typeof serverPagination.hasPrevPage === 'boolean'
        ? serverPagination.hasPrevPage
        : (serverPagination.page ?? 1) > 1)
    : false

  // Performance logging
  useEffect(() => {
    if (options.enablePerformanceLogging && query.data?.debug) {
      console.log(`[HybridPagination] Query performance:`, {
        queryTime: query.data.debug.queryTime,
        cacheHit: query.data.debug.cacheHit,
        itemCount: query.data.items.length,
        isMobile,
        params: currentParams
      })
    }
  }, [query.data, options.enablePerformanceLogging, isMobile, currentParams])

  // Handle mobile infinite scroll logic
  useEffect(() => {
    if (!isMobile || !serverPagination) return

    if (serverPagination.page === 1) {
      // Reset mobile items when starting a new search
      setMobileItems(query.data.items)
      setHasReachedEnd(!normalizedHasNextPage)
      lastPageRef.current = 1
    } else if (serverPagination.page > lastPageRef.current) {
      // Append new items when loading more pages
      setMobileItems(prev => [...prev, ...query.data.items])
      setHasReachedEnd(!normalizedHasNextPage)
      lastPageRef.current = serverPagination.page
      setIsLoadingMore(false)
    }
  }, [query.data, isMobile, normalizedHasNextPage, serverPagination])

  // Setup intersection observer for infinite scroll
  useEffect(() => {
    if (!isMobile || !loadMoreRef.current || hasReachedEnd) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && !query.isLoading && !hasReachedEnd) {
          loadNextPage()
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px' // Start loading before user reaches bottom
      }
    )

    observerRef.current.observe(loadMoreRef.current)

    return () => {
      observerRef.current?.disconnect()
    }
  }, [isMobile, hasReachedEnd, query.isLoading])

  // Prefetch next page for smoother mobile experience
  useEffect(() => {
    if (!isMobile || !options.mobile?.prefetchNextPage || !query.data || !serverPagination) return

    if (normalizedHasNextPage && !isLoadingMore) {
      const nextPageParams = { ...currentParams, page: serverPagination.page + 1 }
      const nextQueryKey = [...options.queryKey, 'hybrid-pagination', nextPageParams, { isMobile }]

      queryClient.prefetchQuery({
        queryKey: nextQueryKey,
        queryFn: () => options.fetchFn(nextPageParams),
        staleTime: 30 * 1000
      })
    }
  }, [query.data, isMobile, currentParams, isLoadingMore, options, normalizedHasNextPage, queryClient, serverPagination])

  // Update page size when switching between mobile/desktop
  useEffect(() => {
    if (params.pageSize !== pageSize) {
      setParams(prev => ({ ...prev, pageSize, page: 1 }))
    }
  }, [pageSize, params.pageSize])

  // Actions
  const updateParams = useCallback((newParams: Partial<PaginationParams>) => {
    setParams(prev => {
      const updated = { ...prev, ...newParams }
      // Reset to page 1 for most parameter changes
      if (newParams.page === undefined) {
        updated.page = 1
      }
      return updated
    })

    // Reset mobile state for new searches
    if (isMobile) {
      setMobileItems([])
      setHasReachedEnd(false)
      lastPageRef.current = 1
    }
  }, [isMobile])

  const goToPage = useCallback((page: number) => {
    updateParams({ page })
  }, [updateParams])

  const nextPage = useCallback(() => {
    if (normalizedHasNextPage) {
      if (isMobile) {
        loadNextPage()
      } else {
        goToPage(currentParams.page + 1)
      }
    }
  }, [normalizedHasNextPage, isMobile, currentParams.page, goToPage, loadNextPage])

  const prevPage = useCallback(() => {
    if (normalizedHasPrevPage && !isMobile) {
      goToPage(currentParams.page - 1)
    }
  }, [normalizedHasPrevPage, isMobile, currentParams.page, goToPage])

  const loadNextPage = useCallback(() => {
    if (isLoadingMore || hasReachedEnd) return

    setIsLoadingMore(true)
    const nextPage = currentParams.page + 1
    setParams(prev => ({ ...prev, page: nextPage }))
  }, [currentParams.page, isLoadingMore, hasReachedEnd])

  const reset = useCallback(() => {
    setParams(prev => ({ ...prev, page: 1 }))
    if (isMobile) {
      setMobileItems([])
      setHasReachedEnd(false)
      lastPageRef.current = 1
    }
  }, [isMobile])

  // Determine current items based on platform
  const items = isMobile ? mobileItems : (query.data?.items || [])

  // Computed values
  const pagination = serverPagination ? {
    ...serverPagination,
    hasNextPage: normalizedHasNextPage,
    hasPrevPage: normalizedHasPrevPage,
    currentPage: serverPagination.page,
    isFirstPage: serverPagination.page === 1,
    isLastPage: !normalizedHasNextPage
  } : undefined

  return {
    // Data
    items,
    pagination,

    // Loading states
    isLoading: query.isLoading,
    isLoadingMore: isMobile ? isLoadingMore : false,
    isError: query.isError,
    error: query.error,

    // Actions
    updateParams,
    goToPage,
    nextPage,
    prevPage,
    reset,
    refetch: query.refetch,

    // Mobile-specific
    loadMoreRef, // Ref for infinite scroll detection
    hasReachedEnd,

    // Debug info
    debug: query.data?.debug,

    // Internal state (exposed for advanced use cases)
    currentParams,
    queryKey
  }
}

/**
 * Utility hook for common search + pagination patterns
 */
export function useSearchPagination<T>(
  searchQuery: string,
  fetchFn: (params: PaginationParams & { q: string }) => Promise<PaginatedResponse<T>>,
  baseQueryKey: string[],
  additionalParams?: Record<string, any>
) {
  return useHybridPagination<T>({
    fetchFn: (params) => fetchFn({ ...params, q: searchQuery, ...additionalParams }),
    queryKey: [...baseQueryKey, 'search', searchQuery],
    initialParams: additionalParams,
    mobile: {
      pageSize: 20,
      loadMoreThreshold: 5
    },
    desktop: {
      pageSize: 50
    },
    debounce: {
      delay: 300,
      enabled: true // Always debounce search
    },
    queryOptions: {
      staleTime: 30 * 1000, // Search results get stale faster
      refetchOnWindowFocus: false
    }
  })
}

/**
 * Performance monitoring hook for pagination
 */
export function usePaginationPerformance() {
  const metricsRef = useRef<{
    queryCount: number
    totalQueryTime: number
    averageQueryTime: number
    cacheHits: number
    cacheMisses: number
  }>({
    queryCount: 0,
    totalQueryTime: 0,
    averageQueryTime: 0,
    cacheHits: 0,
    cacheMisses: 0
  })

  const recordMetric = useCallback((debug?: { queryTime?: number; cacheHit?: boolean }) => {
    if (!debug) return

    const metrics = metricsRef.current
    metrics.queryCount++

    if (debug.queryTime) {
      metrics.totalQueryTime += debug.queryTime
      metrics.averageQueryTime = metrics.totalQueryTime / metrics.queryCount
    }

    if (debug.cacheHit) {
      metrics.cacheHits++
    } else {
      metrics.cacheMisses++
    }

    // Log performance warnings
    if (debug.queryTime > 500) {
      console.warn(`[PaginationPerformance] Slow query detected: ${debug.queryTime}ms`)
    }

    const cacheHitRate = metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) * 100
    if (cacheHitRate < 50 && metrics.queryCount > 10) {
      console.warn(`[PaginationPerformance] Low cache hit rate: ${cacheHitRate.toFixed(1)}%`)
    }
  }, [])

  const getMetrics = useCallback(() => {
    const metrics = metricsRef.current
    return {
      ...metrics,
      cacheHitRate: metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) * 100 || 0
    }
  }, [])

  return { recordMetric, getMetrics }
}