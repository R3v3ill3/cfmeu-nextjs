"use client"

import * as React from "react"

// Network optimization utilities for mobile

interface NetworkConfig {
  baseURL: string
  timeout: number
  retryAttempts: number
  retryDelay: number
  cacheStrategy: 'cache-first' | 'network-first' | 'cache-only' | 'network-only'
  cacheTTL: number
  compressionEnabled: boolean
  requestDeduplication: boolean
}

const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  timeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000,
  cacheStrategy: 'network-first',
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  compressionEnabled: true,
  requestDeduplication: true
}

// Request cache for deduplication
const requestCache = new Map<string, Promise<Response>>()

// Response cache for offline support
const responseCache = new Map<string, { response: Response; timestamp: number }>()

// Network optimization class
export class NetworkOptimizer {
  private config: NetworkConfig
  private pendingRequests: Map<string, AbortController> = new Map()

  constructor(config: Partial<NetworkConfig> = {}) {
    this.config = { ...DEFAULT_NETWORK_CONFIG, ...config }
  }

  // Optimized fetch with caching, retries, and deduplication
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    const cacheKey = this.getCacheKey(url, options)

    // Request deduplication
    if (this.config.requestDeduplication && requestCache.has(cacheKey)) {
      return requestCache.get(cacheKey)!
    }

    const fetchPromise = this.performFetch(url, options)

    if (this.config.requestDeduplication) {
      requestCache.set(cacheKey, fetchPromise)
    }

    try {
      const response = await fetchPromise
      return response
    } finally {
      requestCache.delete(cacheKey)
    }
  }

  private async performFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const cacheKey = this.getCacheKey(url, options)

    // Check cache based on strategy
    if (this.config.cacheStrategy !== 'network-only') {
      const cachedResponse = this.getCachedResponse(cacheKey)
      if (cachedResponse) {
        if (this.config.cacheStrategy === 'cache-first' || this.config.cacheStrategy === 'cache-only') {
          return cachedResponse
        }
      }
    }

    // Setup timeout and abort controller
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)
    this.pendingRequests.set(cacheKey, controller)

    try {
      // Prepare headers
      const headers = new Headers(options.headers)

      if (this.config.compressionEnabled) {
        headers.set('Accept-Encoding', 'gzip, deflate, br')
      }

      headers.set('Cache-Control', 'no-cache')
      headers.set('X-Requested-With', 'XMLHttpRequest')

      // Perform fetch with retries
      let lastError: Error | null = null
      for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
        try {
          const response = await fetch(`${this.config.baseURL}${url}`, {
            ...options,
            headers,
            signal: controller.signal
          })

          if (response.ok) {
            // Cache successful response
            this.cacheResponse(cacheKey, response.clone())
            return response
          }

          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)

          // Don't retry client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            break
          }
        } catch (error) {
          lastError = error as Error

          if (attempt === this.config.retryAttempts) {
            break
          }

          // Exponential backoff
          const delay = this.config.retryDelay * Math.pow(2, attempt)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      throw lastError || new Error('Request failed')
    } finally {
      clearTimeout(timeoutId)
      this.pendingRequests.delete(cacheKey)
    }
  }

  private getCacheKey(url: string, options: RequestInit): string {
    const method = options.method || 'GET'
    const body = options.body ? JSON.stringify(options.body) : ''
    return `${method}:${url}:${body}`
  }

  private getCachedResponse(cacheKey: string): Response | null {
    const cached = responseCache.get(cacheKey)
    if (!cached) return null

    const isExpired = Date.now() - cached.timestamp > this.config.cacheTTL
    if (isExpired) {
      responseCache.delete(cacheKey)
      return null
    }

    return cached.response
  }

  private cacheResponse(cacheKey: string, response: Response): void {
    if (this.config.cacheStrategy === 'network-only') return

    responseCache.set(cacheKey, {
      response: response.clone(),
      timestamp: Date.now()
    })

    // Limit cache size
    if (responseCache.size > 100) {
      const oldestKey = responseCache.keys().next().value
      responseCache.delete(oldestKey)
    }
  }

  // Cancel all pending requests
  cancelAllRequests(): void {
    this.pendingRequests.forEach(controller => {
      controller.abort()
    })
    this.pendingRequests.clear()
  }

  // Clear cache
  clearCache(): void {
    responseCache.clear()
  }

  // Get network statistics
  getNetworkStats() {
    return {
      cacheSize: responseCache.size,
      pendingRequests: this.pendingRequests.size,
      config: this.config
    }
  }
}

// React hook for network optimization
export function useNetworkOptimization(config: Partial<NetworkConfig> = {}) {
  const optimizerRef = React.useRef<NetworkOptimizer>()
  const [isOnline, setIsOnline] = React.useState(true)
  const [networkInfo, setNetworkInfo] = React.useState<any>(null)

  React.useEffect(() => {
    optimizerRef.current = new NetworkOptimizer(config)

    // Monitor network status
    const updateNetworkStatus = () => {
      setIsOnline(navigator.onLine)

      const connection = (navigator as any).connection
      if (connection) {
        setNetworkInfo({
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData
        })
      }
    }

    updateNetworkStatus()

    window.addEventListener('online', updateNetworkStatus)
    window.addEventListener('offline', updateNetworkStatus)

    const connection = (navigator as any).connection
    if (connection) {
      connection.addEventListener('change', updateNetworkStatus)
    }

    return () => {
      window.removeEventListener('online', updateNetworkStatus)
      window.removeEventListener('offline', updateNetworkStatus)

      if (connection) {
        connection.removeEventListener('change', updateNetworkStatus)
      }

      optimizerRef.current?.cancelAllRequests()
    }
  }, [config])

  const optimizedFetch = React.useCallback(async (url: string, options?: RequestInit) => {
    if (!optimizerRef.current) {
      throw new Error('Network optimizer not initialized')
    }

    try {
      return await optimizerRef.current.fetch(url, options)
    } catch (error) {
      if (!isOnline) {
        // Try to serve from cache if offline
        const cacheKey = `${options?.method || 'GET'}:${url}:${options?.body ? JSON.stringify(options.body) : ''}`
        const cached = (optimizerRef.current as any).getCachedResponse(cacheKey)
        if (cached) {
          return cached
        }
      }
      throw error
    }
  }, [isOnline])

  return {
    fetch: optimizedFetch,
    isOnline,
    networkInfo,
    clearCache: () => optimizerRef.current?.clearCache(),
    cancelAllRequests: () => optimizerRef.current?.cancelAllRequests(),
    getNetworkStats: () => optimizerRef.current?.getNetworkStats()
  }
}

// Offline data storage utilities
export class OfflineStorage {
  private dbName = 'cfmeu-offline-db'
  private version = 1
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object stores for different data types
        if (!db.objectStoreNames.contains('employers')) {
          db.createObjectStore('employers', { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains('ratings')) {
          db.createObjectStore('ratings', { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains('pending-actions')) {
          db.createObjectStore('pending-actions', { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains('cached-data')) {
          db.createObjectStore('cached-data', { keyPath: 'key' })
        }
      }
    })
  }

  async store(storeName: string, data: any): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.put(data)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async get(storeName: string, key: string): Promise<any> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.get(key)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async getAll(storeName: string): Promise<any[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.getAll()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async remove(storeName: string, key: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.delete(key)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async clear(storeName: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.clear()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }
}

// React hook for offline storage
export function useOfflineStorage() {
  const storageRef = React.useRef<OfflineStorage>()

  React.useEffect(() => {
    storageRef.current = new OfflineStorage()
  }, [])

  const store = React.useCallback(async (storeName: string, data: any) => {
    if (!storageRef.current) throw new Error('Storage not initialized')
    return storageRef.current.store(storeName, data)
  }, [])

  const get = React.useCallback(async (storeName: string, key: string) => {
    if (!storageRef.current) throw new Error('Storage not initialized')
    return storageRef.current.get(storeName, key)
  }, [])

  const getAll = React.useCallback(async (storeName: string) => {
    if (!storageRef.current) throw new Error('Storage not initialized')
    return storageRef.current.getAll(storeName)
  }, [])

  const remove = React.useCallback(async (storeName: string, key: string) => {
    if (!storageRef.current) throw new Error('Storage not initialized')
    return storageRef.current.remove(storeName, key)
  }, [])

  const clear = React.useCallback(async (storeName: string) => {
    if (!storageRef.current) throw new Error('Storage not initialized')
    return storageRef.current.clear(storeName)
  }, [])

  return {
    store,
    get,
    getAll,
    remove,
    clear
  }
}

// Background sync manager
export class BackgroundSyncManager {
  private storage: OfflineStorage
  private networkOptimizer: NetworkOptimizer

  constructor(storage: OfflineStorage, networkOptimizer: NetworkOptimizer) {
    this.storage = storage
    this.networkOptimizer = networkOptimizer
  }

  async queueAction(action: {
    id: string
    type: string
    url: string
    method: string
    data?: any
    timestamp: number
  }): Promise<void> {
    await this.storage.store('pending-actions', action)
  }

  async processPendingActions(): Promise<void> {
    const actions = await this.storage.getAll('pending-actions')

    for (const action of actions) {
      try {
        const response = await this.networkOptimizer.fetch(action.url, {
          method: action.method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: action.data ? JSON.stringify(action.data) : undefined
        })

        if (response.ok) {
          await this.storage.remove('pending-actions', action.id)
        }
      } catch (error) {
        console.error('Failed to sync action:', action.id, error)
      }
    }
  }

  async getPendingActionsCount(): Promise<number> {
    const actions = await this.storage.getAll('pending-actions')
    return actions.length
  }
}

// React hook for background sync
export function useBackgroundSync() {
  const { fetch } = useNetworkOptimization()
  const storage = useOfflineStorage()
  const syncManagerRef = React.useRef<BackgroundSyncManager>()

  React.useEffect(() => {
    const storageInstance = new OfflineStorage()
    const networkOptimizer = new NetworkOptimizer()
    syncManagerRef.current = new BackgroundSyncManager(storageInstance, networkOptimizer)

    // Process pending actions when coming online
    const handleOnline = async () => {
      if (syncManagerRef.current) {
        await syncManagerRef.current.processPendingActions()
      }
    }

    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  const queueAction = React.useCallback(async (action: {
    type: string
    url: string
    method: string
    data?: any
  }) => {
    if (!syncManagerRef.current) throw new Error('Sync manager not initialized')

    const actionWithId = {
      ...action,
      id: `${action.type}-${Date.now()}-${Math.random()}`,
      timestamp: Date.now()
    }

    await syncManagerRef.current.queueAction(actionWithId)
  }, [])

  const getPendingCount = React.useCallback(async () => {
    if (!syncManagerRef.current) return 0
    return syncManagerRef.current.getPendingActionsCount()
  }, [])

  return {
    queueAction,
    getPendingCount
  }
}

// Network-aware data fetching hook
export function useNetworkAwareFetch<T = any>(
  url: string,
  options: RequestInit = {},
  deps: React.DependencyList = []
) {
  const { fetch, isOnline, networkInfo } = useNetworkOptimization()
  const { get, store } = useOfflineStorage()
  const [data, setData] = React.useState<T | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)

  const executeFetch = React.useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Try network first if online
      if (isOnline) {
        const response = await fetch(url, options)
        const result = await response.json()

        // Cache the result
        await store('cached-data', {
          key: url,
          data: result,
          timestamp: Date.now()
        })

        setData(result)
      } else {
        // Try to get from cache
        const cached = await get('cached-data', url)
        if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minutes
          setData(cached.data)
        } else {
          throw new Error('No cached data available')
        }
      }
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [url, options, isOnline, fetch, store, get])

  React.useEffect(() => {
    executeFetch()
  }, deps)

  return {
    data,
    loading,
    error,
    refetch: executeFetch,
    isOnline,
    networkInfo
  }
}

// Prefetching utility for critical resources
export function usePrefetching() {
  const { fetch } = useNetworkOptimization()

  const prefetch = React.useCallback(async (urls: string[]) => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(async () => {
        for (const url of urls) {
          try {
            await fetch(url, { method: 'HEAD' })
          } catch (error) {
            // Ignore prefetch errors
          }
        }
      })
    } else {
      setTimeout(async () => {
        for (const url of urls) {
          try {
            await fetch(url, { method: 'HEAD' })
          } catch (error) {
            // Ignore prefetch errors
          }
        }
      }, 1000)
    }
  }, [fetch])

  return { prefetch }
}