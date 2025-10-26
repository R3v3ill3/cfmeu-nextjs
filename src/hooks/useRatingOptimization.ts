"use client"

import { useMemo, useCallback, useRef, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { debounce, throttle } from "lodash"
import { EmployerRatingData, RatingFilters } from "@/types/rating"

// Performance optimization hooks for rating system

interface RatingCacheConfig {
  maxAge: number // Cache duration in ms
  maxSize: number // Maximum number of cached items
  strategy: "lru" | "fifo" | "custom"
}

const defaultCacheConfig: RatingCacheConfig = {
  maxAge: 5 * 60 * 1000, // 5 minutes
  maxSize: 100,
  strategy: "lru"
}

// Simple LRU cache implementation
class LRUCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number }>()
  private maxSize: number
  private maxAge: number

  constructor(maxSize: number, maxAge: number) {
    this.maxSize = maxSize
    this.maxAge = maxAge
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key)
    if (!item) return undefined

    // Check if item is expired
    if (Date.now() - item.timestamp > this.maxAge) {
      this.cache.delete(key)
      return undefined
    }

    // Move to end (LRU)
    this.cache.delete(key)
    this.cache.set(key, item)
    return item.value
  }

  set(key: K, value: V): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    this.cache.set(key, { value, timestamp: Date.now() })
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

// Rating data cache
const ratingCache = new LRUCache<string, EmployerRatingData>(
  defaultCacheConfig.maxSize,
  defaultCacheConfig.maxAge
)

export function useRatingCache() {
  const queryClient = useQueryClient()

  const getCachedRating = useCallback((employerId: string): EmployerRatingData | undefined => {
    return ratingCache.get(employerId)
  }, [])

  const setCachedRating = useCallback((employerId: string, data: EmployerRatingData): void => {
    ratingCache.set(employerId, data)
  }, [])

  const invalidateCachedRating = useCallback((employerId: string): void => {
    ratingCache.clear()
    // Also invalidate React Query cache
    queryClient.invalidateQueries({ queryKey: ["employer-ratings", employerId] })
  }, [queryClient])

  const clearCache = useCallback(() => {
    ratingCache.clear()
  }, [])

  return {
    getCachedRating,
    setCachedRating,
    invalidateCachedRating,
    clearCache
  }
}

// Debounced rating search hook
export function useDebouncedRatingSearch(
  searchFn: (query: string) => Promise<any>,
  delay: number = 300
) {
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [error, setError] = useState<Error | null>(null)

  const debouncedSearch = useMemo(
    () => debounce(async (query: string) => {
      if (!query.trim()) {
        setResults([])
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const data = await searchFn(query)
        setResults(data || [])
      } catch (err) {
        setError(err as Error)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, delay),
    [searchFn, delay]
  )

  useEffect(() => {
    return () => {
      debouncedSearch.cancel()
    }
  }, [debouncedSearch])

  return {
    search: debouncedSearch,
    isLoading,
    results,
    error
  }
}

// Throttled rating updates hook
export function useThrottledRatingUpdate(
  updateFn: (employerId: string, data: any) => Promise<void>,
  delay: number = 1000
) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateQueue, setUpdateQueue] = useState<Array<{ employerId: string; data: any }>>([])

  const throttledUpdate = useMemo(
    () => throttle(async (updates: Array<{ employerId: string; data: any }>) => {
      setIsUpdating(true)

      try {
        // Process updates in batches
        await Promise.all(
          updates.map(({ employerId, data }) => updateFn(employerId, data))
        )
        setUpdateQueue([])
      } catch (error) {
        console.error("Failed to update ratings:", error)
      } finally {
        setIsUpdating(false)
      }
    }, delay),
    [updateFn, delay]
  )

  const queueUpdate = useCallback((employerId: string, data: any) => {
    setUpdateQueue(prev => {
      // Remove existing update for same employer and add new one
      const filtered = prev.filter(u => u.employerId !== employerId)
      return [...filtered, { employerId, data }]
    })
  }, [])

  // Process queue when it changes
  useEffect(() => {
    if (updateQueue.length > 0) {
      throttledUpdate(updateQueue)
    }
  }, [updateQueue, throttledUpdate])

  useEffect(() => {
    return () => {
      throttledUpdate.cancel()
    }
  }, [throttledUpdate])

  return {
    queueUpdate,
    isUpdating,
    pendingUpdates: updateQueue.length
  }
}

// Virtual scrolling for large lists
export function useVirtualScrolling<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) {
  const [scrollTop, setScrollTop] = useState(0)

  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )

    return { startIndex, endIndex }
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length])

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1).map((item, index) => ({
      item,
      index: visibleRange.startIndex + index
    }))
  }, [items, visibleRange])

  const totalHeight = items.length * itemHeight

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  return {
    visibleItems,
    totalHeight,
    handleScroll,
    startIndex: visibleRange.startIndex
  }
}

// Rating data preloading hook
export function useRatingPreloading() {
  const queryClient = useQueryClient()

  const preloadEmployerRatings = useCallback((employerIds: string[]) => {
    employerIds.forEach(employerId => {
      queryClient.prefetchQuery({
        queryKey: ["employer-ratings", employerId],
        queryFn: async () => {
          const response = await fetch(`/api/ratings/employers/${employerId}`)
          if (!response.ok) throw new Error("Failed to fetch rating")
          return response.json()
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
      })
    })
  }, [queryClient])

  const preloadRatingStats = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ["rating-stats"],
      queryFn: async () => {
        const response = await fetch("/api/ratings/stats")
        if (!response.ok) throw new Error("Failed to fetch stats")
        return response.json()
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
    })
  }, [queryClient])

  return {
    preloadEmployerRatings,
    preloadRatingStats
  }
}

// Rating filtering optimization hook
export function useOptimizedRatingFilters() {
  const filterCache = useRef(new Map<string, any[]>())

  const filterEmployers = useCallback((
    employers: EmployerRatingData[],
    filters: RatingFilters
  ): EmployerRatingData[] => {
    // Create cache key
    const cacheKey = JSON.stringify(filters)

    // Check cache
    if (filterCache.current.has(cacheKey)) {
      return filterCache.current.get(cacheKey)!
    }

    let filtered = employers

    // Apply filters
    if (filters.rating && filters.rating.length > 0) {
      filtered = filtered.filter(employer => {
        const primaryRating = employer.project_data_rating || employer.organiser_expertise_rating
        return primaryRating && filters.rating!.includes(primaryRating.rating)
      })
    }

    if (filters.confidence && filters.confidence.length > 0) {
      filtered = filtered.filter(employer => {
        const primaryRating = employer.project_data_rating || employer.organiser_expertise_rating
        return primaryRating && filters.confidence!.includes(primaryRating.confidence)
      })
    }

    if (filters.track) {
      filtered = filtered.filter(employer => {
        return employer.project_data_rating?.track === filters.track ||
               employer.organiser_expertise_rating?.track === filters.track
      })
    }

    if (filters.role_context) {
      filtered = filtered.filter(employer => {
        return employer.project_data_rating?.role_context === filters.role_context ||
               employer.organiser_expertise_rating?.role_context === filters.role_context
      })
    }

    // Cache result
    filterCache.current.set(cacheKey, filtered)

    // Clear cache if it gets too large
    if (filterCache.current.size > 50) {
      const firstKey = filterCache.current.keys().next().value
      filterCache.current.delete(firstKey)
    }

    return filtered
  }, [])

  const clearFilterCache = useCallback(() => {
    filterCache.current.clear()
  }, [])

  return {
    filterEmployers,
    clearFilterCache
  }
}

// Performance monitoring hook
export function useRatingPerformance() {
  const metrics = useRef({
    renderCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
    apiCalls: 0,
    errors: 0
  })

  const recordRender = useCallback(() => {
    metrics.current.renderCount++
  }, [])

  const recordCacheHit = useCallback(() => {
    metrics.current.cacheHits++
  }, [])

  const recordCacheMiss = useCallback(() => {
    metrics.current.cacheMisses++
  }, [])

  const recordApiCall = useCallback(() => {
    metrics.current.apiCalls++
  }, [])

  const recordError = useCallback(() => {
    metrics.current.errors++
  }, [])

  const getMetrics = useCallback(() => {
    const { renderCount, cacheHits, cacheMisses, apiCalls, errors } = metrics.current
    const totalCacheAccess = cacheHits + cacheMisses
    const cacheHitRate = totalCacheAccess > 0 ? (cacheHits / totalCacheAccess) * 100 : 0

    return {
      renderCount,
      cacheHits,
      cacheMisses,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      apiCalls,
      errors
    }
  }, [])

  // Log metrics in development
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      const interval = setInterval(() => {
        const metrics = getMetrics()
        console.log("Rating Performance Metrics:", metrics)
      }, 30000) // Log every 30 seconds

      return () => clearInterval(interval)
    }
  }, [getMetrics])

  return {
    recordRender,
    recordCacheHit,
    recordCacheMiss,
    recordApiCall,
    recordError,
    getMetrics
  }
}