/**
 * Enhanced sync queue management for mobile offline functionality
 * Handles retry logic, conflict resolution, and batch operations
 */

import { IndexedDBStorage, SyncOperation } from './offline-storage'

export interface SyncQueueConfig {
  maxRetries: number
  retryDelay: number
  batchDelay: number
  maxBatchSize: number
  conflictResolution: 'client' | 'server' | 'prompt'
}

export interface SyncResult {
  success: boolean
  operationId: string
  error?: string
  conflictData?: any
}

export interface ConflictInfo {
  localData: any
  serverData: any
  operation: SyncOperation
  resolution?: 'local' | 'server' | 'merge'
}

class SyncQueue {
  private storage: IndexedDBStorage
  private config: SyncQueueConfig
  private isProcessing = false
  private processingPromise: Promise<SyncResult[]> | null = null
  private onSyncCallback?: (results: SyncResult[]) => void
  private onConflictCallback?: (conflict: ConflictInfo) => Promise<'local' | 'server' | 'merge'>

  constructor(storage: IndexedDBStorage, config: Partial<SyncQueueConfig> = {}) {
    this.storage = storage
    this.config = {
      maxRetries: 3,
      retryDelay: 5000, // 5 seconds
      batchDelay: 1000, // 1 second between batches
      maxBatchSize: 10,
      conflictResolution: 'client',
      ...config
    }
  }

  /**
   * Add operation to sync queue
   */
  async addOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retries' | 'status'>): Promise<string> {
    const syncOperation: SyncOperation = {
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retries: 0,
      status: 'pending',
      ...operation
    }

    await this.storage.addSyncOperation(syncOperation)

    // Trigger sync processing if online
    if (navigator.onLine) {
      this.processQueue().catch(console.error)
    }

    return syncOperation.id
  }

  /**
   * Process the sync queue
   */
  async processQueue(): Promise<SyncResult[]> {
    if (this.isProcessing) {
      return this.processingPromise ?? Promise.resolve([])
    }

    this.isProcessing = true
    const currentPromise = this._processQueue()
    this.processingPromise = currentPromise

    try {
      const results = await currentPromise
      return results
    } finally {
      this.isProcessing = false
      this.processingPromise = null
    }
  }

  private async _processQueue(): Promise<SyncResult[]> {
    const operations = await this.storage.getPendingSyncOperations()
    const results: SyncResult[] = []

    // Process operations in batches
    for (let i = 0; i < operations.length; i += this.config.maxBatchSize) {
      const batch = operations.slice(i, i + this.config.maxBatchSize)
      const batchResults = await this.processBatch(batch)
      results.push(...batchResults)

      // Add delay between batches to avoid overwhelming the server
      if (i + this.config.maxBatchSize < operations.length) {
        await this.delay(this.config.batchDelay)
      }
    }

    // Notify about sync completion
    if (this.onSyncCallback) {
      this.onSyncCallback(results)
    }

    return results
  }

  private async processBatch(operations: SyncOperation[]): Promise<SyncResult[]> {
    const results: SyncResult[] = []

    for (const operation of operations) {
      try {
        const result = await this.processOperation(operation)
        results.push(result)

        // Update operation status based on result
        if (result.success) {
          await this.storage.updateSyncOperation(operation.id, {
            status: 'completed'
          })
          await this.storage.deleteSyncOperation(operation.id)
        } else if (result.conflictData) {
          await this.storage.updateSyncOperation(operation.id, {
            status: 'pending',
            retries: operation.retries + 1,
            lastError: result.error
          })
        } else {
          await this.storage.updateSyncOperation(operation.id, {
            status: 'failed',
            retries: operation.retries + 1,
            lastError: result.error
          })
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.push({
          success: false,
          operationId: operation.id,
          error: errorMessage
        })

        await this.storage.updateSyncOperation(operation.id, {
          status: 'failed',
          retries: operation.retries + 1,
          lastError: errorMessage
        })
      }
    }

    return results
  }

  private async processOperation(operation: SyncOperation): Promise<SyncResult> {
    const { type, endpoint, data } = operation

    try {
      // Determine the full URL for the API endpoint
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api'
      const url = `${baseUrl}${endpoint}`

      // Prepare request options
      const options: RequestInit = {
        method: type === 'create' ? 'POST' : type === 'update' ? 'PUT' : 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          // Add auth headers if available
          ...(this.getAuthHeaders && this.getAuthHeaders())
        },
        body: type !== 'delete' ? JSON.stringify(data) : undefined,
      }

      // Make the API request
      const response = await fetch(url, options)

      if (response.ok) {
        return {
          success: true,
          operationId: operation.id
        }
      } else if (response.status === 409) {
        // Conflict detected
        const serverData = await response.json()
        return await this.handleConflict(operation, serverData)
      } else {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }
    } catch (error) {
      // Check if we should retry this operation
      if (this.shouldRetry(operation, error)) {
        throw error // Will be caught and retried
      } else {
        return {
          success: false,
          operationId: operation.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }

  private async handleConflict(operation: SyncOperation, serverData: any): Promise<SyncResult> {
    const conflict: ConflictInfo = {
      localData: operation.data,
      serverData,
      operation
    }

    let resolution: 'local' | 'server' | 'merge'

    switch (this.config.conflictResolution) {
      case 'server':
        resolution = 'server'
        break
      case 'prompt':
        if (this.onConflictCallback) {
          resolution = await this.onConflictCallback(conflict)
        } else {
          resolution = 'local' // Fallback
        }
        break
      case 'client':
      default:
        resolution = 'local'
        break
    }

    // Apply conflict resolution
    switch (resolution) {
      case 'server':
        // Accept server version, remove local operation
        return {
          success: true,
          operationId: operation.id
        }
      case 'local':
        // Force local version to server
        try {
          const baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api'
          const url = `${baseUrl}${operation.endpoint}`

          const response = await fetch(url, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-Force-Update': 'true',
              ...(this.getAuthHeaders && this.getAuthHeaders())
            },
            body: JSON.stringify(operation.data)
          })

          if (response.ok) {
            return {
              success: true,
              operationId: operation.id
            }
          } else {
            throw new Error(`Failed to force update: ${response.statusText}`)
          }
        } catch (error) {
          return {
            success: false,
            operationId: operation.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      case 'merge':
        // Attempt to merge data (simplified version)
        const mergedData = this.mergeData(operation.data, serverData)
        operation.data = mergedData

        // Retry with merged data
        return this.processOperation(operation)
    }
  }

  private mergeData(localData: any, serverData: any): any {
    // Simple merge strategy - prefer most recent timestamps
    // In a real implementation, this would be more sophisticated
    const localTimestamp = new Date(localData.updated_at || 0).getTime()
    const serverTimestamp = new Date(serverData.updated_at || 0).getTime()

    if (localTimestamp > serverTimestamp) {
      return localData
    } else {
      return serverData
    }
  }

  private shouldRetry(operation: SyncOperation, error: any): boolean {
    // Don't retry if we've exceeded max retries
    if (operation.retries >= this.config.maxRetries) {
      return false
    }

    // Don't retry client errors (4xx)
    if (error.message?.includes('HTTP 4') || error.status >= 400 && error.status < 500) {
      return false
    }

    // Retry network errors and server errors (5xx)
    return true
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get the number of pending operations
   */
  async getPendingCount(): Promise<number> {
    const operations = await this.storage.getPendingSyncOperations()
    return operations.length
  }

  /**
   * Clear all pending operations
   */
  async clearQueue(): Promise<void> {
    const operations = await this.storage.getPendingSyncOperations()
    for (const operation of operations) {
      await this.storage.deleteSyncOperation(operation.id)
    }
  }

  /**
   * Get sync queue statistics
   */
  async getStats(): Promise<{
    pending: number
    failed: number
    completed: number
    totalSize: number
  }> {
    // This would need additional storage methods to get all operations by status
    // For now, return pending count
    const pending = await this.getPendingCount()

    return {
      pending,
      failed: 0, // Would need to track this separately
      completed: 0, // Would need to track this separately
      totalSize: 0 // Would need to calculate this
    }
  }

  /**
   * Set callbacks for sync events
   */
  onSync(callback: (results: SyncResult[]) => void): void {
    this.onSyncCallback = callback
  }

  onConflict(callback: (conflict: ConflictInfo) => Promise<'local' | 'server' | 'merge'>): void {
    this.onConflictCallback = callback
  }

  /**
   * Set auth headers getter
   */
  setAuthHeaders(getter: () => Record<string, string>): void {
    this.getAuthHeaders = getter
  }

  private getAuthHeaders?: () => Record<string, string>
}

// Create sync queue instances
export const projectMappingSyncQueue = new SyncQueue(
  new IndexedDBStorage({
    dbName: 'CFMEU-Mobile-ProjectMapping',
    version: 1,
    storeName: 'mappings'
  }),
  {
    maxRetries: 5,
    retryDelay: 10000, // 10 seconds
    batchDelay: 2000, // 2 seconds
    maxBatchSize: 5
  }
)

export const complianceAuditSyncQueue = new SyncQueue(
  new IndexedDBStorage({
    dbName: 'CFMEU-Mobile-Compliance',
    version: 1,
    storeName: 'audits'
  }),
  {
    maxRetries: 3,
    retryDelay: 15000, // 15 seconds
    batchDelay: 3000, // 3 seconds
    maxBatchSize: 3
  }
)

// Export the class for custom sync queues
export { SyncQueue }