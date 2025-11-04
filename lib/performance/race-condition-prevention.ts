/**
 * Race Condition Prevention Utilities
 *
 * Provides utilities to prevent race conditions in concurrent operations
 * throughout the CFMEU platform, particularly for data synchronization and
 * state management.
 */

export interface LockInfo {
  id: string
  resourceId: string
  ownerId: string
  acquiredAt: number
  expiresAt: number
  metadata?: Record<string, any>
}

export interface QueueItem<T = any> {
  id: string
  type: string
  data: T
  priority: number
  createdAt: number
  retryCount: number
  maxRetries: number
}

export interface ConcurrencyControlOptions {
  lockTimeout?: number // milliseconds
  maxQueueSize?: number
  retryDelay?: number
  maxConcurrent?: number
}

/**
 * Manages distributed locks to prevent concurrent access to shared resources
 */
export class LockManager {
  private locks = new Map<string, LockInfo>()
  private lockTimeout: number
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(options: ConcurrencyControlOptions = {}) {
    this.lockTimeout = options.lockTimeout ?? 30000 // 30 seconds default
    this.startCleanup()
  }

  /**
   * Acquire a lock for a resource
   */
  acquire(resourceId: string, ownerId: string, metadata?: Record<string, any>): string | null {
    // Check if lock already exists and is not expired
    const existingLock = this.locks.get(resourceId)
    const now = Date.now()

    if (existingLock && existingLock.expiresAt > now) {
      return null // Lock is already held
    }

    // Create new lock
    const lockId = `lock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const lock: LockInfo = {
      id: lockId,
      resourceId,
      ownerId,
      acquiredAt: now,
      expiresAt: now + this.lockTimeout,
      metadata
    }

    this.locks.set(resourceId, lock)
    return lockId
  }

  /**
   * Release a lock
   */
  release(resourceId: string, lockId: string): boolean {
    const lock = this.locks.get(resourceId)
    if (lock && lock.id === lockId) {
      this.locks.delete(resourceId)
      return true
    }
    return false
  }

  /**
   * Check if a resource is locked
   */
  isLocked(resourceId: string): boolean {
    const lock = this.locks.get(resourceId)
    if (!lock) return false

    // Check if lock is expired
    if (lock.expiresAt <= Date.now()) {
      this.locks.delete(resourceId)
      return false
    }

    return true
  }

  /**
   * Get lock information
   */
  getLockInfo(resourceId: string): LockInfo | null {
    const lock = this.locks.get(resourceId)
    if (!lock) return null

    // Check if lock is expired
    if (lock.expiresAt <= Date.now()) {
      this.locks.delete(resourceId)
      return null
    }

    return lock
  }

  /**
   * Extend a lock's expiration time
   */
  extendLock(resourceId: string, lockId: string, additionalTime: number = this.lockTimeout): boolean {
    const lock = this.locks.get(resourceId)
    if (lock && lock.id === lockId) {
      lock.expiresAt = Date.now() + additionalTime
      return true
    }
    return false
  }

  /**
   * Force release a lock (emergency use only)
   */
  forceRelease(resourceId: string): boolean {
    return this.locks.delete(resourceId)
  }

  /**
   * Get all active locks
   */
  getAllLocks(): LockInfo[] {
    const now = Date.now()
    const activeLocks: LockInfo[] = []

    this.locks.forEach((lock, resourceId) => {
      if (lock.expiresAt > now) {
        activeLocks.push(lock)
      } else {
        this.locks.delete(resourceId)
      }
    })

    return activeLocks
  }

  /**
   * Start cleanup interval for expired locks
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000) // Clean up every minute
  }

  /**
   * Clean up expired locks
   */
  private cleanup(): void {
    const now = Date.now()
    const expiredKeys: string[] = []

    this.locks.forEach((lock, resourceId) => {
      if (lock.expiresAt <= now) {
        expiredKeys.push(resourceId)
      }
    })

    expiredKeys.forEach(key => this.locks.delete(key))
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.locks.clear()
  }
}

/**
 * Manages a priority queue for sequential task execution
 */
export class TaskQueue<T = any> {
  private queue: QueueItem<T>[] = []
  private processing = new Set<string>()
  private maxConcurrent: number
  private retryDelay: number
  private maxQueueSize: number
  private isProcessing = false

  constructor(options: ConcurrencyControlOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 3
    this.retryDelay = options.retryDelay ?? 1000
    this.maxQueueSize = options.maxQueueSize ?? 1000
  }

  /**
   * Add a task to the queue
   */
  add(
    type: string,
    data: T,
    priority: number = 0,
    maxRetries: number = 3
  ): string {
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error('Queue is full')
    }

    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const item: QueueItem<T> = {
      id: taskId,
      type,
      data,
      priority,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries
    }

    // Insert maintaining priority order (higher priority first)
    let insertIndex = this.queue.length
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].priority < priority) {
        insertIndex = i
        break
      }
    }

    this.queue.splice(insertIndex, 0, item)
    return taskId
  }

  /**
   * Get the next batch of tasks to process
   */
  getNextBatch(batchSize: number = this.maxConcurrent): QueueItem<T>[] {
    const batch: QueueItem<T>[] = []
    const toRemove: string[] = []

    for (let i = 0; i < this.queue.length && batch.length < batchSize; i++) {
      const item = this.queue[i]
      if (!this.processing.has(item.id)) {
        batch.push(item)
        this.processing.add(item.id)
        toRemove.push(item.id)
      }
    }

    // Remove processed items from queue
    this.queue = this.queue.filter(item => !toRemove.includes(item.id))

    return batch
  }

  /**
   * Mark a task as completed
   */
  complete(taskId: string, success: boolean = true): void {
    this.processing.delete(taskId)

    if (!success) {
      // Find the task and retry if possible
      const taskIndex = this.queue.findIndex(item => item.id === taskId)
      if (taskIndex !== -1) {
        const task = this.queue[taskIndex]
        task.retryCount++

        if (task.retryCount < task.maxRetries) {
          // Reduce priority and move to back of queue
          task.priority = Math.max(0, task.priority - 1)
          this.queue.splice(taskIndex, 1)
          this.queue.push(task)
        } else {
          // Remove task after max retries
          this.queue.splice(taskIndex, 1)
        }
      }
    }
  }

  /**
   * Get queue status
   */
  getStatus(): {
    pending: number
    processing: number
    total: number
    oldestItemAge: number
  } {
    const now = Date.now()
    const oldestItem = this.queue[0]

    return {
      pending: this.queue.length,
      processing: this.processing.size,
      total: this.queue.length + this.processing.size,
      oldestItemAge: oldestItem ? now - oldestItem.createdAt : 0
    }
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = []
    this.processing.clear()
  }

  /**
   * Remove a specific task
   */
  remove(taskId: string): boolean {
    const queueIndex = this.queue.findIndex(item => item.id === taskId)
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1)
      return true
    }

    if (this.processing.has(taskId)) {
      this.processing.delete(taskId)
      return true
    }

    return false
  }
}

/**
 * Utility function to execute an operation with automatic retry and locking
 */
export async function executeWithLock<T>(
  lockManager: LockManager,
  resourceId: string,
  ownerId: string,
  operation: () => Promise<T>,
  options: {
    lockTimeout?: number
    maxRetries?: number
    retryDelay?: number
  } = {}
): Promise<T> {
  const {
    lockTimeout = 30000,
    maxRetries = 3,
    retryDelay = 1000
  } = options

  let lockId: string | null = null
  let attempt = 0

  while (attempt < maxRetries) {
    try {
      // Try to acquire lock
      lockId = lockManager.acquire(resourceId, ownerId)

      if (!lockId) {
        // Lock is held, wait and retry
        attempt++
        if (attempt >= maxRetries) {
          throw new Error(`Failed to acquire lock for resource ${resourceId} after ${maxRetries} attempts`)
        }

        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1)))
        continue
      }

      // Execute operation
      const result = await operation()

      // Extend lock if operation takes longer than expected
      const operationStart = Date.now()
      if (Date.now() - operationStart > lockTimeout * 0.8) {
        lockManager.extendLock(resourceId, lockId, lockTimeout)
      }

      return result

    } catch (error) {
      attempt++
      if (attempt >= maxRetries) {
        throw error
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1)))
    } finally {
      // Always release lock if acquired
      if (lockId) {
        lockManager.release(resourceId, lockId)
      }
    }
  }

  throw new Error(`Operation failed after ${maxRetries} attempts`)
}

/**
 * Utility function to batch operations
 */
export function batchOperations<T, R>(
  operations: Array<() => Promise<T>>,
  batchFn: (batch: Array<() => Promise<T>>) => Promise<R[]>,
  batchSize: number = 5
): Promise<R[]> {
  const batches: Array<Array<() => Promise<T>>> = []

  for (let i = 0; i < operations.length; i += batchSize) {
    batches.push(operations.slice(i, i + batchSize))
  }

  return Promise.all(
    batches.map(batch => batchFn(batch))
  ).then(results => results.flat())
}

// Global instances
export const globalLockManager = new LockManager({
  lockTimeout: 30000,
  maxQueueSize: 1000
})

export const globalTaskQueue = new TaskQueue({
  maxConcurrent: 5,
  retryDelay: 1000,
  maxQueueSize: 500
})

export default {
  LockManager,
  TaskQueue,
  executeWithLock,
  batchOperations,
  globalLockManager,
  globalTaskQueue
}