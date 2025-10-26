"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNetworkOptimization, useOfflineStorage, useBackgroundSync } from "@/lib/network/network-optimization"
import { useDeviceCapabilities } from "@/hooks/useMobilePerformance"

// Optimized data fetching hooks for mobile

interface OptimizedFetchOptions {
  cacheKey?: string
  cacheTTL?: number
  retryOnFailure?: boolean
  backgroundSync?: boolean
  optimisticUpdate?: boolean
  staleWhileRevalidate?: boolean
}

interface OptimizedFetchResult<T> {
  data: T | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  mutate: (newData: T) => void
  isOffline: boolean
  lastUpdated: number | null
}

// Generic optimized data fetching hook
export function useOptimizedFetch<T = any>(
  url: string,
  options: RequestInit & OptimizedFetchOptions = {},
  deps: React.DependencyList = []
): OptimizedFetchResult<T> {
  const { fetch, isOnline, networkInfo } = useNetworkOptimization()
  const { get, store, remove } = useOfflineStorage()
  const { queueAction } = useBackgroundSync()
  const { isLowEnd } = useDeviceCapabilities()

  const {
    cacheKey = url,
    cacheTTL = 5 * 60 * 1000, // 5 minutes
    retryOnFailure = true,
    backgroundSync = false,
    optimisticUpdate = false,
    staleWhileRevalidate = true
  } = options

  const [data, setData] = React.useState<T | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)
  const [lastUpdated, setLastUpdated] = React.useState<number | null>(null)

  const executeFetch = React.useCallback(async (forceRefresh = false) => {
    const cacheData = staleWhileRevalidate && !forceRefresh ? await get('fetch-cache', cacheKey) : null

    // Return cached data immediately if available (stale-while-revalidate)
    if (cacheData && Date.now() - cacheData.timestamp < cacheTTL) {
      setData(cacheData.data)
      setLastUpdated(cacheData.timestamp)
    }

    // Don't fetch if offline and we have cached data
    if (!isOnline && cacheData) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Cache-Control': 'no-cache',
          ...options.headers
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      // Cache the result
      await store('fetch-cache', {
        key: cacheKey,
        data: result,
        timestamp: Date.now()
      })

      setData(result)
      setLastUpdated(Date.now())

    } catch (err) {
      const error = err as Error

      // If we have cached data, don't show error
      if (cacheData) {
        console.warn('Network request failed, serving cached data:', error)
        return
      }

      setError(error)

      // Queue for background sync if enabled
      if (backgroundSync && !isOnline) {
        await queueAction({
          type: 'fetch',
          url,
          method: options.method || 'GET',
          data: options.body
        })
      }
    } finally {
      setLoading(false)
    }
  }, [url, options, cacheKey, cacheTTL, staleWhileRevalidate, fetch, isOnline, get, store, queueAction, backgroundSync])

  const mutate = React.useCallback((newData: T) => {
    setData(newData)
    setLastUpdated(Date.now())

    // Update cache
    store('fetch-cache', {
      key: cacheKey,
      data: newData,
      timestamp: Date.now()
    })
  }, [cacheKey, store])

  React.useEffect(() => {
    // Skip initial fetch on low-end devices if we have recent cache
    if (isLowEnd) {
      get('fetch-cache', cacheKey).then(cached => {
        if (cached && Date.now() - cached.timestamp < cacheTTL) {
          setData(cached.data)
          setLastUpdated(cached.timestamp)
        } else {
          executeFetch()
        }
      })
    } else {
      executeFetch()
    }
  }, [url, ...deps])

  return {
    data,
    loading,
    error,
    refetch: () => executeFetch(true),
    mutate,
    isOffline: !isOnline,
    lastUpdated
  }
}

// Optimized mutation hook with optimistic updates
export function useOptimizedMutation<T = any, V = any>(
  url: string,
  options: {
    method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    onSuccess?: (data: T) => void
    onError?: (error: Error) => void
    optimisticUpdate?: (currentData: any, variables: V) => any
    rollbackOnError?: boolean
    invalidateCache?: string[]
  } = {}
) {
  const { fetch, isOnline } = useNetworkOptimization()
  const { store, remove } = useOfflineStorage()
  const { queueAction } = useBackgroundSync()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)

  const {
    method = 'POST',
    onSuccess,
    onError,
    optimisticUpdate,
    rollbackOnError = true,
    invalidateCache = []
  } = options

  const mutate = React.useCallback(async (variables: V) => {
    setLoading(true)
    setError(null)

    let optimisticData: any = null
    let previousCacheData: any = null

    // Handle optimistic update
    if (optimisticUpdate) {
      try {
        // Get current cached data for rollback
        previousCacheData = await store('fetch-cache', url)

        // Apply optimistic update
        optimisticData = optimisticUpdate(previousCacheData?.data, variables)

        // Update cache with optimistic data
        await store('fetch-cache', {
          key: url,
          data: optimisticData,
          timestamp: Date.now()
        })
      } catch (err) {
        console.error('Optimistic update failed:', err)
      }
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: method !== 'DELETE' ? JSON.stringify(variables) : undefined
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      // Update cache with real data
      await store('fetch-cache', {
        key: url,
        data: result,
        timestamp: Date.now()
      })

      // Invalidate related cache entries
      for (const cacheKey of invalidateCache) {
        await remove('fetch-cache', cacheKey)
      }

      onSuccess?.(result)
      return result

    } catch (err) {
      const error = err as Error

      // Rollback optimistic update on error
      if (rollbackOnError && optimisticUpdate && previousCacheData) {
        await store('fetch-cache', previousCacheData)
      }

      // Queue for background sync if offline
      if (!isOnline) {
        await queueAction({
          type: 'mutation',
          url,
          method,
          data: variables
        })
      }

      setError(error)
      onError?.(error)
      throw error

    } finally {
      setLoading(false)
    }
  }, [url, method, optimisticUpdate, rollbackOnError, invalidateCache, fetch, isOnline, store, remove, queueAction, onSuccess, onError])

  return {
    mutate,
    loading,
    error,
    isOffline: !isOnline
  }
}

// Infinite scroll with optimized fetching
export function useInfiniteScroll<T = any>(
  url: string,
  options: {
    pageSize?: number
    initialPage?: number
    enabled?: boolean
    staleTime?: number
  } = {}
) {
  const { fetch, isOnline } = useNetworkOptimization()
  const { get, store } = useOfflineStorage()

  const {
    pageSize = 20,
    initialPage = 1,
    enabled = true,
    staleTime = 5 * 60 * 1000
  } = options

  const [data, setData] = React.useState<T[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)
  const [hasMore, setHasMore] = React.useState(true)
  const [page, setPage] = React.useState(initialPage)

  const loadMore = React.useCallback(async () => {
    if (!enabled || loading || !hasMore) return

    setLoading(true)
    setError(null)

    try {
      const cacheKey = `${url}?page=${page}&limit=${pageSize}`
      const cached = await get('fetch-cache', cacheKey)

      if (cached && Date.now() - cached.timestamp < staleTime && !isOnline) {
        const newItems = cached.data
        setData(prev => [...prev, ...newItems])
        setHasMore(newItems.length === pageSize)
        setPage(prev => prev + 1)
        return
      }

      const response = await fetch(`${url}?page=${page}&limit=${pageSize}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const newItems: T[] = await response.json()

      // Cache the page
      await store('fetch-cache', {
        key: cacheKey,
        data: newItems,
        timestamp: Date.now()
      })

      setData(prev => [...prev, ...newItems])
      setHasMore(newItems.length === pageSize)
      setPage(prev => prev + 1)

    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [url, page, pageSize, enabled, loading, hasMore, isOnline, staleTime, fetch, get, store])

  const reset = React.useCallback(() => {
    setData([])
    setPage(initialPage)
    setHasMore(true)
    setError(null)
  }, [initialPage])

  React.useEffect(() => {
    if (enabled) {
      loadMore()
    }
  }, [enabled, loadMore])

  return {
    data,
    loading,
    error,
    hasMore,
    loadMore,
    reset,
    isOffline: !isOnline
  }
}

// Real-time data with polling and sync
export function useRealtimeData<T = any>(
  url: string,
  options: {
    enabled?: boolean
    refreshInterval?: number
    onError?: (error: Error) => void
    onSuccess?: (data: T) => void
  } = {}
) {
  const {
    enabled = true,
    refreshInterval = 30000, // 30 seconds
    onError,
    onSuccess
  } = options

  const { data, loading, error, refetch } = useOptimizedFetch<T>(url, {}, [enabled])

  const intervalRef = React.useRef<NodeJS.Timeout>()

  React.useEffect(() => {
    if (enabled && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        refetch().catch(onError)
      }, refreshInterval)

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }
  }, [enabled, refreshInterval, refetch, onError])

  React.useEffect(() => {
    if (data) {
      onSuccess?.(data)
    }
  }, [data, onSuccess])

  return {
    data,
    loading,
    error,
    refetch
  }
}

// Batch data fetching for multiple URLs
export function useBatchFetch<T = any>(
  urls: string[],
  options: {
    enabled?: boolean
    maxConcurrent?: number
    cacheKey?: string
  } = {}
) {
  const { fetch } = useNetworkOptimization()
  const { get, store } = useOfflineStorage()

  const {
    enabled = true,
    maxConcurrent = 3,
    cacheKey = urls.join(',')
  } = options

  const [data, setData] = React.useState<Record<string, T>>({})
  const [loading, setLoading] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, Error>>({})

  const executeBatchFetch = React.useCallback(async () => {
    if (!enabled) return

    setLoading(true)
    setErrors({})

    try {
      // Check cache first
      const cached = await get('fetch-cache', cacheKey)
      if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        setData(cached.data)
        setLoading(false)
        return
      }

      // Fetch in batches
      const results: Record<string, T> = {}
      const newErrors: Record<string, Error> = {}

      for (let i = 0; i < urls.length; i += maxConcurrent) {
        const batch = urls.slice(i, i + maxConcurrent)

        await Promise.allSettled(
          batch.map(async (url) => {
            try {
              const response = await fetch(url)
              if (!response.ok) throw new Error(`HTTP ${response.status}`)
              const result = await response.json()
              results[url] = result
            } catch (err) {
              newErrors[url] = err as Error
            }
          })
        )
      }

      // Cache results
      await store('fetch-cache', {
        key: cacheKey,
        data: results,
        timestamp: Date.now()
      })

      setData(results)
      setErrors(newErrors)

    } catch (err) {
      console.error('Batch fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [urls, enabled, maxConcurrent, cacheKey, fetch, get, store])

  React.useEffect(() => {
    executeBatchFetch()
  }, [executeBatchFetch])

  return {
    data,
    loading,
    errors,
    refetch: executeBatchFetch
  }
}

// Prefetch hook for critical data
export function usePrefetch(urls: string[], options: {
  priority?: 'high' | 'low'
  delay?: number
} = {}) {
  const { fetch } = useNetworkOptimization()
  const { isLowEnd } = useDeviceCapabilities()

  const { priority = 'low', delay = 1000 } = options

  React.useEffect(() => {
    // Don't prefetch on low-end devices or slow connections
    if (isLowEnd) return

    const prefetchData = async () => {
      for (const url of urls) {
        try {
          // Use HEAD request to check if resource exists
          await fetch(url, { method: 'HEAD' })
        } catch (error) {
          // Ignore prefetch errors
        }
      }
    }

    if (priority === 'high') {
      setTimeout(prefetchData, delay)
    } else {
      // Use requestIdleCallback for low priority prefetching
      if ('requestIdleCallback' in window) {
        requestIdleCallback(prefetchData, { timeout: 5000 })
      } else {
        setTimeout(prefetchData, 2000)
      }
    }
  }, [urls, priority, delay, fetch, isLowEnd])
}