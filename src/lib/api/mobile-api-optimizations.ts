/**
 * Mobile API Optimization Strategies
 *
 * Optimized API interactions for mobile devices with:
 * - Smaller page sizes for mobile
 * - Request deduplication and batching
 * - Optimistic updates with rollback capability
 * - Mobile-specific endpoint optimizations
 * - Offline support for critical business functions
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { isMobile, isSlowConnection } from '@/lib/device'

// Mobile-specific pagination settings
export const MOBILE_PAGINATION_CONFIG = {
  defaultPageSize: 20, // vs 50 on desktop
  maxPageSize: 50, // Maximum page size for mobile
  prefetchDistance: 3, // Prefetch when 3 pages from current
  batchDelay: 300, // Debounce delay for batched requests (ms)
}

// Mobile API request configuration
interface MobileApiConfig {
  useOptimisticUpdates?: boolean
  enableCaching?: boolean
  cacheTTL?: number // in milliseconds
  enableRetry?: boolean
  maxRetries?: number
  retryDelay?: number
  timeout?: number
}

class MobileApiManager {
  private requestCache = new Map<string, { data: any; timestamp: number; ttl: number }>()
  private requestQueue = new Map<string, Promise<any>>()
  private offlineQueue: Array<{ url: string; options: RequestInit; timestamp: number }> = []
  private optimisticUpdates = new Map<string, { previousData: any; timestamp: number }>()

  constructor() {
    this.setupOfflineDetection()
    this.setupPeriodicSync()
  }

  // Detect network status changes
  private setupOfflineDetection() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.processOfflineQueue())
      window.addEventListener('offline', () => this.handleOfflineStatus())
    }
  }

  // Periodic sync for queued offline requests
  private setupPeriodicSync() {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      setInterval(() => {
        if (navigator.onLine && this.offlineQueue.length > 0) {
          this.processOfflineQueue()
        }
      }, 30000) // Check every 30 seconds
    }
  }

  private handleOfflineStatus() {
    console.log('🔴 Network offline - queuing requests')
  }

  private processOfflineQueue() {
    console.log(`🟡 Processing ${this.offlineQueue.length} offline requests`)
    const requestsToProcess = [...this.offlineQueue]
    this.offlineQueue = []

    requestsToProcess.forEach(({ url, options, timestamp }) => {
      // Only process requests that are less than 5 minutes old
      if (Date.now() - timestamp < 5 * 60 * 1000) {
        this.makeRequest(url, options, { enableRetry: false })
          .catch(error => {
            console.error('Failed to process offline request:', error)
            // Re-queue failed requests
            this.offlineQueue.push({ url, options, timestamp })
          })
      }
    })
  }

  // Get mobile-specific query parameters
  private getMobileParams(baseParams?: Record<string, any>): Record<string, any> {
    if (!isMobile()) return baseParams || {}

    return {
      ...baseParams,
      // Mobile-specific optimizations
      page_size: baseParams?.page_size || MOBILE_PAGINATION_CONFIG.defaultPageSize,
      mobile_optimized: true,
      reduce_payload: true,
      exclude_fields: this.getExcludedFields(),
    }
  }

  // Fields to exclude from mobile responses to reduce payload size
  private getExcludedFields(): string[] {
    return [
      'detailed_history',
      'audit_trail',
      'performance_metrics',
      'user_activity_log',
      'system_logs'
    ]
  }

  // Request deduplication - prevents multiple identical requests
  private deduplicateRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    if (this.requestQueue.has(key)) {
      return this.requestQueue.get(key)!
    }

    const promise = requestFn().finally(() => {
      this.requestQueue.delete(key)
    })

    this.requestQueue.set(key, promise)
    return promise
  }

  // Cache management
  private getFromCache(key: string): any | null {
    const cached = this.requestCache.get(key)
    if (!cached) return null

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.requestCache.delete(key)
      return null
    }

    return cached.data
  }

  private setCache(key: string, data: any, ttl: number = 5 * 60 * 1000): void {
    this.requestCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })
  }

  // Optimistic updates
  private performOptimisticUpdate<T>(
    key: string,
    updateFn: () => Promise<T>,
    previousData: T
  ): Promise<T> {
    // Store previous data for rollback
    this.optimisticUpdates.set(key, {
      previousData,
      timestamp: Date.now(),
    })

    return updateFn().catch(error => {
      // Rollback on error
      const rollbackData = this.optimisticUpdates.get(key)
      if (rollbackData) {
        this.requestCache.set(key, {
          data: rollbackData.previousData,
          timestamp: Date.now(),
          ttl: 5 * 60 * 1000,
        })
      }
      throw error
    }).finally(() => {
      // Clean up optimistic update after 10 seconds
      setTimeout(() => {
        this.optimisticUpdates.delete(key)
      }, 10000)
    })
  }

  // Main request method with mobile optimizations
  async makeRequest<T>(
    url: string,
    options: RequestInit = {},
    config: MobileApiConfig = {}
  ): Promise<T> {
    const {
      useOptimisticUpdates = false,
      enableCaching = true,
      cacheTTL = 5 * 60 * 1000,
      enableRetry = true,
      maxRetries = 3,
      retryDelay = 1000,
      timeout = isSlowConnection() ? 15000 : 30000,
    } = config

    const cacheKey = `${url}:${JSON.stringify(options)}`

    // Check cache for GET requests
    if (enableCaching && (!options.method || options.method === 'GET')) {
      const cached = this.getFromCache(cacheKey)
      if (cached) {
        console.log('📋 Cache hit for:', url)
        return cached
      }
    }

    // Deduplicate requests
    return this.deduplicateRequest(cacheKey, async () => {
      // Add mobile-specific headers and query parameters
      const optimizedUrl = new URL(url, window.location.origin)

      if (isMobile()) {
        optimizedUrl.searchParams.set('mobile', 'true')
        optimizedUrl.searchParams.set('optimized', 'true')

        if (isSlowConnection()) {
          optimizedUrl.searchParams.set('slow_connection', 'true')
        }
      }

      const optimizedOptions: RequestInit = {
        ...options,
        headers: {
          ...options.headers,
          'X-Mobile-Optimized': isMobile() ? 'true' : 'false',
          'X-Connection-Speed': isSlowConnection() ? 'slow' : 'fast',
          'X-Requested-With': 'XMLHttpRequest',
        },
      }

      // Add mobile query parameters
      if (options.method === 'GET' || !options.method) {
        const mobileParams = this.getMobileParams()
        Object.entries(mobileParams).forEach(([key, value]) => {
          if (value !== undefined) {
            optimizedUrl.searchParams.set(key, String(value))
          }
        })
      }

      // Offline handling
      if (!navigator.onLine && options.method !== 'GET') {
        console.log('📴 Offline - queuing request:', url)
        this.offlineQueue.push({
          url: optimizedUrl.toString(),
          options: optimizedOptions,
          timestamp: Date.now(),
        })
        throw new Error('Offline - request queued for later processing')
      }

      // Retry logic with exponential backoff
      let lastError: Error | null = null
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await this.fetchWithTimeout(
            optimizedUrl.toString(),
            optimizedOptions,
            timeout
          )

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const data = await response.json()

          // Cache successful responses
          if (enableCaching && (!options.method || options.method === 'GET')) {
            this.setCache(cacheKey, data, cacheTTL)
          }

          return data
        } catch (error) {
          lastError = error as Error

          if (!enableRetry || attempt === maxRetries) {
            break
          }

          const delay = retryDelay * Math.pow(2, attempt)
          console.log(`⚠️ Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      throw lastError
    })
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`)
      }
      throw error
    }
  }

  // Batch multiple API requests
  async batchRequests<T>(requests: Array<{ url: string; options?: RequestInit }>): Promise<T[]> {
    if (!isMobile() || requests.length === 1) {
      // For desktop or single requests, process normally
      return Promise.all(requests.map(req => this.makeRequest(req.url, req.options)))
    }

    // For mobile, batch requests to reduce network overhead
    const batchUrl = '/api/batch'
    const batchBody = {
      requests: requests.map(req => ({
        url: req.url,
        options: req.options,
        mobile_optimized: true,
      }))
    }

    try {
      const response = await this.makeRequest(batchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batchBody),
      })

      return response.results
    } catch (error) {
      console.warn('Batch request failed, falling back to individual requests:', error)
      // Fallback to individual requests
      return Promise.all(requests.map(req => this.makeRequest(req.url, req.options)))
    }
  }

  // Get current status for monitoring
  getStatus() {
    return {
      cachedRequests: this.requestCache.size,
      queuedRequests: this.requestQueue.size,
      offlineQueueSize: this.offlineQueue.length,
      optimisticUpdates: this.optimisticUpdates.size,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    }
  }

  // Clear cache and reset state
  clearCache(): void {
    this.requestCache.clear()
    this.requestQueue.clear()
    this.optimisticUpdates.clear()
    console.log('🧹 Mobile API cache cleared')
  }
}

// Singleton instance
export const mobileApiManager = new MobileApiManager()

// React hook for mobile API interactions
export function useMobileApi() {
  const [status, setStatus] = useState(mobileApiManager.getStatus())
  const statusRef = useRef<NodeJS.Timeout>()

  // Update status periodically
  useEffect(() => {
    const updateStatus = () => {
      setStatus(mobileApiManager.getStatus())
    }

    // Update status every 2 seconds
    statusRef.current = setInterval(updateStatus, 2000)

    return () => {
      if (statusRef.current) {
        clearInterval(statusRef.current)
      }
    }
  }, [])

  const makeRequest = useCallback((
    url: string,
    options?: RequestInit,
    config?: MobileApiConfig
  ) => {
    return mobileApiManager.makeRequest(url, options, config)
  }, [])

  const batchRequests = useCallback((
    requests: Array<{ url: string; options?: RequestInit }>
  ) => {
    return mobileApiManager.batchRequests(requests)
  }, [])

  const clearCache = useCallback(() => {
    mobileApiManager.clearCache()
  }, [])

  return {
    makeRequest,
    batchRequests,
    clearCache,
    status,
  }
}

// Mobile API helper functions
export const mobileApi = {
  // Optimized pagination for mobile
  async getPaginatedData<T>(
    endpoint: string,
    page: number = 1,
    pageSize: number = MOBILE_PAGINATION_CONFIG.defaultPageSize,
    filters?: Record<string, any>
  ): Promise<{
    data: T[]
    pagination: {
      page: number
      pageSize: number
      total: number
      hasNext: boolean
      hasPrev: boolean
    }
  }> {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
      mobile_optimized: 'true',
      ...filters,
    })

    return mobileApiManager.makeRequest(`${endpoint}?${params}`)
  },

  // Optimized search for mobile
  async search<T>(
    query: string,
    endpoint: string,
    options: {
      limit?: number
      fields?: string[]
      fuzzy?: boolean
    } = {}
  ): Promise<T[]> {
    const params = new URLSearchParams({
      q: query,
      mobile_search: 'true',
      limit: String(options.limit || 20),
      fuzzy: String(options.fuzzy || true),
    })

    if (options.fields) {
      params.append('fields', options.fields.join(','))
    }

    return mobileApiManager.makeRequest(`${endpoint}/search?${params}`)
  },

  // Bulk operations optimized for mobile
  async bulkUpdate<T>(
    endpoint: string,
    updates: Array<{ id: string; data: Partial<T> }>,
    optimistic: boolean = true
  ): Promise<T[]> {
    if (optimistic) {
      // Store current data for optimistic updates
      updates.forEach(update => {
        const cacheKey = `${endpoint}/${update.id}`
        const currentData = mobileApiManager['requestCache'].get(cacheKey)
        if (currentData) {
          mobileApiManager['optimisticUpdates'].set(cacheKey, {
            previousData: currentData.data,
            timestamp: Date.now(),
          })
        }
      })
    }

    const response = await mobileApiManager.makeRequest(`${endpoint}/bulk`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ updates, mobile_bulk: true }),
    })

    return response.data
  },
}

export default mobileApiManager