/**
 * Enhanced offline storage using IndexedDB for mobile applications
 * Provides better performance, larger storage capacity, and more reliable data persistence
 */

interface StoredItem<T> {
  id: string
  data: T
  timestamp: number
  version: number
  checksum?: string
}

interface StorageConfig {
  dbName: string
  version: number
  storeName: string
  maxAge?: number // in milliseconds
  maxSize?: number // in bytes
}

interface SyncOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  endpoint: string
  data: any
  timestamp: number
  retries: number
  status: 'pending' | 'syncing' | 'completed' | 'failed'
  lastError?: string
}

class IndexedDBStorage {
  private db: IDBDatabase | null = null
  private config: StorageConfig
  private initPromise: Promise<void> | null = null

  constructor(config: StorageConfig) {
    this.config = {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      maxSize: 50 * 1024 * 1024, // 50MB
      ...config
    }
  }

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.version)

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error}`))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object stores
        if (!db.objectStoreNames.contains(this.config.storeName)) {
          const store = db.createObjectStore(this.config.storeName, { keyPath: 'id' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('version', 'version', { unique: false })
        }

        // Create sync operations store
        if (!db.objectStoreNames.contains('sync_operations')) {
          const syncStore = db.createObjectStore('sync_operations', { keyPath: 'id' })
          syncStore.createIndex('status', 'status', { unique: false })
          syncStore.createIndex('timestamp', 'timestamp', { unique: false })
        }

        // Create metadata store for storage management
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' })
        }
      }
    })

    return this.initPromise
  }

  /**
   * Store an item in IndexedDB
   */
  async set<T>(id: string, data: T): Promise<void> {
    await this.init()

    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const item: StoredItem<T> = {
      id,
      data,
      timestamp: Date.now(),
      version: 1,
      checksum: await this.calculateChecksum(data)
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readwrite')
      const store = transaction.objectStore(this.config.storeName)
      const request = store.put(item)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.updateMetadata()
        resolve()
      }
    })
  }

  /**
   * Retrieve an item from IndexedDB
   */
  async get<T>(id: string): Promise<T | null> {
    await this.init()

    if (!this.db) {
      throw new Error('Database not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readonly')
      const store = transaction.objectStore(this.config.storeName)
      const request = store.get(id)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const result = request.result
        if (!result) {
          resolve(null)
          return
        }

        // Check if item is expired
        if (this.config.maxAge && Date.now() - result.timestamp > this.config.maxAge) {
          this.delete(id).catch(console.error)
          resolve(null)
          return
        }

        resolve(result.data)
      }
    })
  }

  /**
   * Get all items from IndexedDB
   */
  async getAll<T>(): Promise<Array<{ id: string; data: T; timestamp: number }>> {
    await this.init()

    if (!this.db) {
      throw new Error('Database not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readonly')
      const store = transaction.objectStore(this.config.storeName)
      const request = store.getAll()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const results = request.result
        const filtered = results.filter(item => {
          // Filter expired items
          if (this.config.maxAge && Date.now() - item.timestamp > this.config.maxAge) {
            return false
          }
          return true
        })

        resolve(filtered.map(item => ({
          id: item.id,
          data: item.data,
          timestamp: item.timestamp
        })))
      }
    })
  }

  /**
   * Delete an item from IndexedDB
   */
  async delete(id: string): Promise<void> {
    await this.init()

    if (!this.db) {
      throw new Error('Database not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readwrite')
      const store = transaction.objectStore(this.config.storeName)
      const request = store.delete(id)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.updateMetadata()
        resolve()
      }
    })
  }

  /**
   * Clear all items from IndexedDB
   */
  async clear(): Promise<void> {
    await this.init()

    if (!this.db) {
      throw new Error('Database not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readwrite')
      const store = transaction.objectStore(this.config.storeName)
      const request = store.clear()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.updateMetadata()
        resolve()
      }
    })
  }

  /**
   * Store a sync operation
   */
  async addSyncOperation(operation: SyncOperation): Promise<void> {
    await this.init()

    if (!this.db) {
      throw new Error('Database not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sync_operations'], 'readwrite')
      const store = transaction.objectStore('sync_operations')
      const request = store.put(operation)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  /**
   * Get pending sync operations
   */
  async getPendingSyncOperations(): Promise<SyncOperation[]> {
    await this.init()

    if (!this.db) {
      throw new Error('Database not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sync_operations'], 'readonly')
      const store = transaction.objectStore('sync_operations')
      const index = store.index('status')
      const request = index.getAll('pending')

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        resolve(request.result || [])
      }
    })
  }

  /**
   * Update sync operation status
   */
  async updateSyncOperation(id: string, updates: Partial<SyncOperation>): Promise<void> {
    await this.init()

    if (!this.db) {
      throw new Error('Database not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sync_operations'], 'readwrite')
      const store = transaction.objectStore('sync_operations')

      store.get(id).onsuccess = (event) => {
        const existing = (event.target as IDBRequest).result
        if (existing) {
          const updated = { ...existing, ...updates }
          const request = store.put(updated)
          request.onerror = () => reject(request.error)
          request.onsuccess = () => resolve()
        } else {
          resolve()
        }
      }
    })
  }

  /**
   * Delete sync operation
   */
  async deleteSyncOperation(id: string): Promise<void> {
    await this.init()

    if (!this.db) {
      throw new Error('Database not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sync_operations'], 'readwrite')
      const store = transaction.objectStore('sync_operations')
      const request = store.delete(id)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  /**
   * Get storage usage information
   */
  async getStorageInfo(): Promise<{
    used: number
    available: number
    itemCount: number
    operationCount: number
  }> {
    await this.init()

    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const [storageEstimate, items, operations] = await Promise.allSettled([
      'storage' in navigator && navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve({ quota: 0, usage: 0 }),
      this.getAll(),
      this.getPendingSyncOperations()
    ])

    const estimate = storageEstimate.status === 'fulfilled' ? storageEstimate.value : { quota: 0, usage: 0 }
    const itemCount = items.status === 'fulfilled' ? items.value.length : 0
    const operationCount = operations.status === 'fulfilled' ? operations.value.length : 0

    return {
      used: estimate.usage || 0,
      available: (estimate.quota || 0) - (estimate.usage || 0),
      itemCount,
      operationCount
    }
  }

  /**
   * Clean up expired items
   */
  async cleanup(): Promise<void> {
    await this.init()

    if (!this.db) {
      throw new Error('Database not initialized')
    }

    if (!this.config.maxAge) return

    const cutoffTime = Date.now() - this.config.maxAge

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readwrite')
      const store = transaction.objectStore(this.config.storeName)
      const index = store.index('timestamp')
      const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime))

      request.onerror = () => reject(request.error)
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          this.updateMetadata()
          resolve()
        }
      }
    })
  }

  /**
   * Calculate simple checksum for data integrity
   */
  private async calculateChecksum(data: any): Promise<string> {
    const json = JSON.stringify(data)
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(json)

    if ('crypto' in window && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    }

    // Fallback for browsers without crypto support
    let hash = 0
    for (let i = 0; i < dataBuffer.length; i++) {
      const char = dataBuffer[i]
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(16)
  }

  /**
   * Update metadata for storage management
   */
  private async updateMetadata(): Promise<void> {
    if (!this.db) return

    const storageInfo = await this.getStorageInfo()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['metadata'], 'readwrite')
      const store = transaction.objectStore('metadata')

      store.put({
        key: 'storage_info',
        value: storageInfo,
        timestamp: Date.now()
      })

      store.put({
        key: 'last_cleanup',
        value: Date.now(),
        timestamp: Date.now()
      })

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
    this.initPromise = null
  }
}

// Storage instances for different data types
export const projectMappingStorage = new IndexedDBStorage({
  dbName: 'CFMEU-Mobile-ProjectMapping',
  version: 1,
  storeName: 'mappings',
  maxAge: 90 * 24 * 60 * 60 * 1000 // 90 days
})

export const complianceAuditStorage = new IndexedDBStorage({
  dbName: 'CFMEU-Mobile-Compliance',
  version: 1,
  storeName: 'audits',
  maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
})

export const generalStorage = new IndexedDBStorage({
  dbName: 'CFMEU-Mobile-General',
  version: 1,
  storeName: 'data',
  maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
})

// Export the class for custom storage instances
export { IndexedDBStorage }
export type { SyncOperation }