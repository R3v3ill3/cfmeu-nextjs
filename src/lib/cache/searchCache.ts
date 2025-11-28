/**
 * Advanced Search Cache Implementation
 *
 * Features:
 * - 30-second stale-while-revalidate caching
 * - Request deduplication for concurrent identical searches
 * - Memory-efficient LRU eviction
 * - Cache warming and prefetching
 * - Performance monitoring and metrics
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  accessCount: number
  lastAccessed: number
  key: string
}

interface CacheMetrics {
  hits: number
  misses: number
  evictions: number
  totalSize: number
  averageResponseTime: number
  hitRate: number
}

interface CacheOptions {
  maxSize?: number // Maximum number of entries (default: 100)
  defaultTtl?: number // Default TTL in milliseconds (default: 30000)
  enableMetrics?: boolean // Enable performance tracking (default: true)
  enableDeduplication?: boolean // Enable request deduplication (default: true)
  staleWhileRevalidate?: number // SWR window in milliseconds (default: 60000)
}

class SearchCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>()
  private pendingRequests = new Map<string, Promise<T>>()
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0,
    averageResponseTime: 0,
    hitRate: 0
  }

  private options: Required<CacheOptions>
  private cleanupTimer?: NodeJS.Timeout

  constructor(options: CacheOptions = {}) {
    this.options = {
      maxSize: 100,
      defaultTtl: 30 * 1000, // 30 seconds
      enableMetrics: true,
      enableDeduplication: true,
      staleWhileRevalidate: 60 * 1000, // 1 minute SWR
      ...options
    }

    // Start cleanup timer to evict expired entries
    this.startCleanupTimer()
  }

  /**
   * Generate cache key from search parameters
   */
  private generateKey(params: Record<string, any>): string {
    // Sort keys to ensure consistent ordering
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        const value = params[key]
        if (value !== undefined && value !== null && value !== '') {
          result[key] = typeof value === 'object' ? JSON.stringify(value) : String(value)
        }
        return result
      }, {} as Record<string, string>)

    return btoa(JSON.stringify(sortedParams))
  }

  /**
   * Check if cache entry is still valid
   */
  private isEntryValid(entry: CacheEntry<T>, allowStale = false): boolean {
    const now = Date.now()
    const age = now - entry.timestamp

    if (age < entry.ttl) {
      return true // Fresh
    }

    if (allowStale && age < entry.ttl + this.options.staleWhileRevalidate) {
      return true // Stale but within SWR window
    }

    return false // Expired
  }

  /**
   * Evict least recently used entries to maintain cache size
   */
  private evictLRU(): void {
    if (this.cache.size <= this.options.maxSize) return

    // Sort entries by last accessed time
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)

    const toEvict = entries.slice(0, entries.length - this.options.maxSize)

    toEvict.forEach(([key]) => {
      this.cache.delete(key)
      this.metrics.evictions++
    })
  }

  /**
   * Update cache entry access information
   */
  private updateAccess(entry: CacheEntry<T>): void {
    entry.accessCount++
    entry.lastAccessed = Date.now()
  }

  /**
   * Record cache metrics
   */
  private recordMetrics(hit: boolean, responseTime = 0): void {
    if (!this.options.enableMetrics) return

    if (hit) {
      this.metrics.hits++
    } else {
      this.metrics.misses++
    }

    this.metrics.totalSize = this.cache.size
    this.metrics.hitRate = this.metrics.hits / (this.metrics.hits + this.metrics.misses)

    if (responseTime > 0) {
      this.metrics.averageResponseTime =
        (this.metrics.averageResponseTime * 0.9) + (responseTime * 0.1)
    }
  }

  /**
   * Cleanup timer to remove expired entries
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      const toDelete: string[] = []

      this.cache.forEach((entry, key) => {
        if (now - entry.timestamp > entry.ttl + this.options.staleWhileRevalidate) {
          toDelete.push(key)
        }
      })

      toDelete.forEach(key => {
        this.cache.delete(key)
        this.metrics.evictions++
      })
    }, 30 * 1000) // Run cleanup every 30 seconds
  }

  /**
   * Get data from cache with optional stale-while-revalidate
   */
  async get(
    params: Record<string, any>,
    fetchFn: () => Promise<T>,
    options: {
      allowStale?: boolean
      revalidateInBackground?: boolean
    } = {}
  ): Promise<T> {
    const key = this.generateKey(params)
    const startTime = Date.now()

    // Check cache first
    const entry = this.cache.get(key)

    if (entry && this.isEntryValid(entry, options.allowStale)) {
      this.updateAccess(entry)
      this.recordMetrics(true, Date.now() - startTime)

      // Revalidate in background if stale but within SWR window
      if (options.revalidateInBackground && !this.isEntryValid(entry)) {
        this.revalidate(key, fetchFn).catch(error => {
          console.warn('[SearchCache] Background revalidation failed:', error)
        })
      }

      return entry.data
    }

    // Handle request deduplication
    if (this.options.enableDeduplication) {
      const pending = this.pendingRequests.get(key)
      if (pending) {
        return pending
      }
    }

    // Fetch fresh data
    const fetchPromise = this.fetchAndCache(key, fetchFn)

    if (this.options.enableDeduplication) {
      this.pendingRequests.set(key, fetchPromise)
    }

    try {
      const result = await fetchPromise
      this.recordMetrics(false, Date.now() - startTime)
      return result
    } finally {
      if (this.options.enableDeduplication) {
        this.pendingRequests.delete(key)
      }
    }
  }

  /**
   * Fetch data and cache it
   */
  private async fetchAndCache(key: string, fetchFn: () => Promise<T>): Promise<T> {
    try {
      const data = await fetchFn()

      // Cache the result
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: this.options.defaultTtl,
        accessCount: 1,
        lastAccessed: Date.now(),
        key
      }

      this.cache.set(key, entry)
      this.evictLRU()

      return data
    } catch (error) {
      // Check if we have a stale entry we can return
      const staleEntry = this.cache.get(key)
      if (staleEntry && staleEntry.timestamp + staleEntry.ttl + this.options.staleWhileRevalidate > Date.now()) {
        console.warn('[SearchCache] Returning stale data due to fetch error:', error)
        return staleEntry.data
      }
      throw error
    }
  }

  /**
   * Revalidate cache entry in background
   */
  private async revalidate(key: string, fetchFn: () => Promise<T>): Promise<void> {
    try {
      const data = await fetchFn()
      const entry = this.cache.get(key)

      if (entry) {
        entry.data = data
        entry.timestamp = Date.now()
        this.updateAccess(entry)
      } else {
        // Entry was evicted, add it back
        const newEntry: CacheEntry<T> = {
          data,
          timestamp: Date.now(),
          ttl: this.options.defaultTtl,
          accessCount: 1,
          lastAccessed: Date.now(),
          key
        }
        this.cache.set(key, newEntry)
        this.evictLRU()
      }
    } catch (error) {
      console.warn('[SearchCache] Background revalidation failed:', error)
    }
  }

  /**
   * Prefetch data into cache
   */
  async prefetch(params: Record<string, any>, fetchFn: () => Promise<T>): Promise<void> {
    const key = this.generateKey(params)

    // Don't prefetch if already cached and fresh
    const entry = this.cache.get(key)
    if (entry && this.isEntryValid(entry)) {
      return
    }

    try {
      await this.fetchAndCache(key, fetchFn)
    } catch (error) {
      console.warn('[SearchCache] Prefetch failed:', error)
    }
  }

  /**
   * Invalidate cache entries
   */
  invalidate(params?: Record<string, any>): void {
    if (params) {
      const key = this.generateKey(params)
      this.cache.delete(key)
    } else {
      // Clear all cache
      this.cache.clear()
      this.metrics.evictions += this.cache.size
    }
  }

  /**
   * Warm cache with common searches
   */
  async warmup(commonSearches: Array<{
    params: Record<string, any>
    fetchFn: () => Promise<T>
  }>): Promise<void> {
    const warmupPromises = commonSearches.map(({ params, fetchFn }) =>
      this.prefetch(params, fetchFn).catch(error => {
        console.warn('[SearchCache] Warmup entry failed:', error)
      })
    )

    await Promise.allSettled(warmupPromises)
    console.log(`[SearchCache] Warmup completed. Cache size: ${this.cache.size}`)
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics & {
    cacheSize: number
    memoryEstimate: string
  } {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      memoryEstimate: `${(this.cache.size * 1024).toFixed(0)} bytes` // Rough estimate
    }
  }

  /**
   * Get cache entries for debugging
   */
  getEntries(): Array<{
    key: string
    timestamp: number
    ttl: number
    accessCount: number
    lastAccessed: number
    isExpired: boolean
    age: number
  }> {
    const now = Date.now()
    return Array.from(this.cache.values()).map(entry => ({
      key: entry.key,
      timestamp: entry.timestamp,
      ttl: entry.ttl,
      accessCount: entry.accessCount,
      lastAccessed: entry.lastAccessed,
      isExpired: !this.isEntryValid(entry),
      age: now - entry.timestamp
    }))
  }

  /**
   * Destroy cache and cleanup
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    this.cache.clear()
    this.pendingRequests.clear()
  }

  /**
   * Export cache state for persistence
   */
  export(): Record<string, any> {
    const entries = Array.from(this.cache.entries())
    return {
      entries: entries.map(([key, entry]) => [key, entry]),
      metrics: this.metrics,
      timestamp: Date.now()
    }
  }

  /**
   * Import cache state
   */
  import(state: Record<string, any>): void {
    if (state.entries) {
      this.cache.clear()
      state.entries.forEach(([key, entry]: [string, CacheEntry<T>]) => {
        // Only import if entry is still valid
        if (this.isEntryValid(entry)) {
          this.cache.set(key, entry)
        }
      })
      this.evictLRU()
    }

    if (state.metrics) {
      this.metrics = { ...this.metrics, ...state.metrics }
    }
  }
}

// Singleton instance for employer search
export const employerSearchCache = new SearchCache({
  maxSize: 50,
  defaultTtl: 30 * 1000, // 30 seconds
  enableMetrics: process.env.NODE_ENV === 'development',
  enableDeduplication: true,
  staleWhileRevalidate: 60 * 1000 // 1 minute
})

// Cleanup on app shutdown
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    employerSearchCache.destroy()
  })
}

export default SearchCache