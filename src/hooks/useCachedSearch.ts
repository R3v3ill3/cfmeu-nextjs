import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import employerSearchCache from '@/lib/cache/searchCache'
import { useDebounce } from './useDebounce'

// Types for cached search responses
export interface CachedSearchOptions<T> {
  // Cache options
  cacheKey?: string
  ttl?: number
  enableDeduplication?: boolean
  enableStaleWhileRevalidate?: boolean

  // Query options
  staleTime?: number
  gcTime?: number
  refetchOnWindowFocus?: boolean

  // Performance options
  enableMetrics?: boolean
  logSlowQueries?: boolean
  slowQueryThreshold?: number
}

export interface CachedSearchResult<T> {
  data: T | undefined
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
  invalidateCache: () => void
  prefetch: (params: any) => Promise<void>
  cacheMetrics?: any
}

/**
 * Enhanced search hook with advanced caching and performance optimization
 *
 * Features:
 * - Automatic cache integration with employerSearchCache
 * - Request deduplication to prevent duplicate API calls
 * - Stale-while-revalidate for fresh data with fast responses
 * - Performance monitoring and logging
 * - Background refetching for optimal UX
 */
export function useCachedSearch<T>(
  params: Record<string, any>,
  fetchFn: (params: Record<string, any>) => Promise<T>,
  options: CachedSearchOptions<T> = {}
): CachedSearchResult<T> {
  const {
    cacheKey = 'default',
    ttl = 30 * 1000, // 30 seconds
    enableDeduplication = true,
    enableStaleWhileRevalidate = true,
    staleTime = 30 * 1000,
    gcTime = 5 * 60 * 1000,
    refetchOnWindowFocus = false,
    enableMetrics = false,
    logSlowQueries = true,
    slowQueryThreshold = 500
  } = options

  const queryClient = useQueryClient()
  const startTimeRef = useRef<number>()
  const abortControllerRef = useRef<AbortController>()

  // Debounce parameters to prevent excessive requests
  const debouncedParams = useDebounce(params, 300)

  // Cache-aware fetch function
  const cachedFetchFn = useCallback(async (searchParams: Record<string, any>): Promise<T> => {
    // Cancel any ongoing request for this query
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    startTimeRef.current = Date.now()

    try {
      const result = await employerSearchCache.get(
        { ...searchParams, _cacheKey: cacheKey },
        () => fetchFn(searchParams),
        {
          allowStale: enableStaleWhileRevalidate,
          revalidateInBackground: enableStaleWhileRevalidate
        }
      )

      if (enableMetrics && startTimeRef.current) {
        const responseTime = Date.now() - startTimeRef.current
        if (logSlowQueries && responseTime > slowQueryThreshold) {
          console.warn(`[useCachedSearch] Slow query detected: ${responseTime}ms`, {
            params: searchParams,
            cacheKey,
            responseTime
          })
        }
      }

      return result
    } finally {
      abortControllerRef.current = undefined
      startTimeRef.current = undefined
    }
  }, [fetchFn, cacheKey, enableStaleWhileRevalidate, enableMetrics, logSlowQueries, slowQueryThreshold])

  // React Query integration
  const query = useQuery({
    queryKey: ['cached-search', cacheKey, debouncedParams],
    queryFn: () => cachedFetchFn(debouncedParams),
    staleTime,
    gcTime,
    refetchOnWindowFocus,
    retry: (failureCount, error) => {
      // Don't retry for network errors or client errors
      if (error instanceof Error) {
        if (error.name === 'AbortError') return false
        if (error.message.includes('401') || error.message.includes('403')) return false
        if (error.message.includes('429')) return false // Rate limit
      }
      return failureCount < 2
    }
  })

  // Invalidate cache function
  const invalidateCache = useCallback(() => {
    employerSearchCache.invalidate({ ...debouncedParams, _cacheKey: cacheKey })
    queryClient.invalidateQueries({ queryKey: ['cached-search', cacheKey] })
  }, [queryClient, cacheKey, debouncedParams])

  // Prefetch function
  const prefetch = useCallback(async (prefetchParams: Record<string, any>) => {
    try {
      await employerSearchCache.prefetch(
        { ...prefetchParams, _cacheKey: cacheKey },
        () => fetchFn(prefetchParams)
      )
    } catch (error) {
      console.warn('[useCachedSearch] Prefetch failed:', error)
    }
  }, [fetchFn, cacheKey])

  // Get cache metrics
  const getCacheMetrics = useCallback(() => {
    if (enableMetrics) {
      return employerSearchCache.getMetrics()
    }
    return null
  }, [enableMetrics])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    invalidateCache,
    prefetch,
    cacheMetrics: getCacheMetrics()
  }
}

/**
 * Hook for employer-specific cached search with pre-configured options
 */
export function useCachedEmployerSearch(
  params: Record<string, any>,
  fetchFn: (params: Record<string, any>) => Promise<any>
) {
  return useCachedSearch(
    params,
    fetchFn,
    {
      cacheKey: 'employer-search',
      ttl: 30 * 1000, // 30 seconds for employer data
      enableDeduplication: true,
      enableStaleWhileRevalidate: true,
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      enableMetrics: process.env.NODE_ENV === 'development',
      logSlowQueries: true,
      slowQueryThreshold: 200 // Lower threshold for employer search
    }
  )
}

/**
 * Hook for real-time search with frequent updates
 */
export function useRealTimeSearch<T>(
  params: Record<string, any>,
  fetchFn: (params: Record<string, any>) => Promise<T>,
  options: {
    interval?: number // Refetch interval in ms
    enabled?: boolean
  } = {}
) {
  const { interval = 5000, enabled = true } = options

  const result = useCachedSearch(params, fetchFn, {
    cacheKey: 'realtime-search',
    ttl: Math.min(interval * 2, 30 * 1000), // Cache for 2x interval or 30s max
    enableDeduplication: true,
    enableStaleWhileRevalidate: true,
    staleTime: interval / 2, // Data is stale after half interval
    gcTime: 2 * 60 * 1000,
    refetchOnWindowFocus: enabled,
    enableMetrics: true
  })

  // Set up interval for real-time updates
  useEffect(() => {
    if (!enabled || !interval) return

    const intervalId = setInterval(() => {
      result.refetch()
    }, interval)

    return () => clearInterval(intervalId)
  }, [enabled, interval, result.refetch])

  return { ...result, isRealTime: enabled }
}

/**
 * Hook for search with intelligent prefetching
 */
export function useSearchWithPrefetch<T>(
  params: Record<string, any>,
  fetchFn: (params: Record<string, any>) => Promise<T>,
  prefetchStrategy?: {
    // Prefetch next page when current page loads
    nextPage?: boolean
    // Prefetch related searches based on current query
    related?: (params: Record<string, any>) => Record<string, any>[]
    // Prefetch when user hovers over results (implement in component)
    onHover?: boolean
  }
) {
  const result = useCachedSearch(params, fetchFn)

  // Prefetch next page
  useEffect(() => {
    if (prefetchStrategy?.nextPage && result.data && params.page) {
      const nextPageParams = { ...params, page: params.page + 1 }
      result.prefetch(nextPageParams)
    }
  }, [result.data, params.page, prefetchStrategy?.nextPage, result.prefetch])

  // Prefetch related searches
  useEffect(() => {
    if (prefetchStrategy?.related && params.q && result.data) {
      const relatedSearches = prefetchStrategy.related(params)
      relatedSearches.forEach(relatedParams => {
        result.prefetch(relatedParams)
      })
    }
  }, [params.q, result.data, prefetchStrategy?.related, result.prefetch])

  return result
}

/**
 * Hook for batch search operations
 */
export function useBatchSearch<T>(
  searches: Array<{
    id: string
    params: Record<string, any>
    fetchFn: (params: Record<string, any>) => Promise<T>
  }>
) {
  const queryClient = useQueryClient()
  const [results, setResults] = useState<Record<string, T>>({})
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, Error>>({})

  const executeBatch = useCallback(async () => {
    setLoading(new Set(searches.map(s => s.id)))
    setErrors({})

    try {
      const promises = searches.map(async ({ id, params, fetchFn }) => {
        try {
          const result = await employerSearchCache.get(params, () => fetchFn(params))
          return { id, result, error: null }
        } catch (error) {
          return { id, result: null, error: error as Error }
        }
      })

      const batchResults = await Promise.allSettled(promises)

      batchResults.forEach((promiseResult) => {
        if (promiseResult.status === 'fulfilled') {
          const { id, result, error } = promiseResult.value

          if (result) {
            setResults(prev => ({ ...prev, [id]: result }))
          }

          if (error) {
            setErrors(prev => ({ ...prev, [id]: error }))
          }
        } else {
          console.error('[useBatchSearch] Batch operation failed:', promiseResult.reason)
        }
      })
    } finally {
      setLoading(new Set())
    }
  }, [searches])

  const clearResults = useCallback(() => {
    setResults({})
    setErrors({})
    setLoading(new Set())
  }, [])

  return {
    results,
    loading: Array.from(loading),
    errors,
    executeBatch,
    clearResults,
    isLoading: loading.size > 0,
    hasErrors: Object.keys(errors).length > 0
  }
}

export default useCachedSearch