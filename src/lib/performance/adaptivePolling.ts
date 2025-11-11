// Performance and network optimization utilities

export interface AdaptivePollingOptions {
  initialInterval?: number // Initial polling interval in ms (default: 1000)
  maxInterval?: number // Maximum polling interval in ms (default: 30000)
  backoffMultiplier?: number // Multiplier for backoff (default: 2)
  backoffOnFailure?: boolean // Whether to backoff on failures (default: true)
  fastInterval?: number // Fast polling during active processing (default: 1000)
  idleInterval?: number // Slower polling when idle (default: 5000)
  maxAttempts?: number // Maximum number of attempts (default: 300)
  timeout?: number // Overall timeout in ms (default: 600000 = 10 minutes)
}

export interface PollingState {
  attempts: number
  currentInterval: number
  lastActivity: number
  consecutiveFailures: number
  isActive: boolean
}

export class AdaptivePoller {
  private state: PollingState = {
    attempts: 0,
    currentInterval: 1000,
    lastActivity: Date.now(),
    consecutiveFailures: 0,
    isActive: false
  }

  private abortController: AbortController | null = null
  private timeoutId: NodeJS.Timeout | null = null
  private options: Required<AdaptivePollingOptions>

  constructor(options: AdaptivePollingOptions = {}) {
    this.options = {
      initialInterval: options.initialInterval ?? 1000,
      maxInterval: options.maxInterval ?? 30000,
      backoffMultiplier: options.backoffMultiplier ?? 2,
      backoffOnFailure: options.backoffOnFailure ?? true,
      fastInterval: options.fastInterval ?? 1000,
      idleInterval: options.idleInterval ?? 5000,
      maxAttempts: options.maxAttempts ?? 300,
      timeout: options.timeout ?? 600000, // 10 minutes
    }
  }

  async start<T>(
    pollFn: (signal: AbortSignal) => Promise<T>,
    checkComplete: (result: T) => boolean,
    checkActivity?: (result: T) => boolean
  ): Promise<T> {
    if (this.abortController) {
      throw new Error('Polling already in progress')
    }

    this.abortController = new AbortController()
    this.state = {
      attempts: 0,
      currentInterval: this.options.initialInterval,
      lastActivity: Date.now(),
      consecutiveFailures: 0,
      isActive: false
    }

    const startTime = Date.now()

    while (this.state.attempts < this.options.maxAttempts) {
      // Check overall timeout
      if (Date.now() - startTime > this.options.timeout) {
        throw new Error(`Polling timeout after ${this.options.timeout}ms`)
      }

      // Check if aborted
      if (this.abortController.signal.aborted) {
        throw new Error('Polling was aborted')
      }

      try {
        const result = await pollFn(this.abortController.signal)
        this.state.attempts++

        // Check if complete
        if (checkComplete(result)) {
          return result
        }

        // Check for activity to adjust polling interval
        if (checkActivity) {
          const hasActivity = checkActivity(result)
          this.updateActivity(hasActivity)
        }

        // Reset consecutive failures on success
        this.state.consecutiveFailures = 0

        // Calculate next interval
        this.calculateNextInterval()

        // Wait for next interval
        await this.delay(this.state.currentInterval)

      } catch (error) {
        this.state.consecutiveFailures++

        if (this.options.backoffOnFailure) {
          this.applyFailureBackoff()
        }

        // If this is an abort error, re-throw
        if (error instanceof Error && error.name === 'AbortError') {
          throw error
        }

        // Log error but continue polling
        console.warn('Polling attempt failed:', error)

        // If too many consecutive failures, throw
        if (this.state.consecutiveFailures >= 5) {
          throw new Error(`Polling failed after ${this.state.consecutiveFailures} consecutive failures`)
        }

        // Wait before retrying
        await this.delay(this.state.currentInterval)
      }
    }

    throw new Error(`Polling stopped after ${this.options.maxAttempts} attempts`)
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }

  private updateActivity(hasActivity: boolean): void {
    const wasActive = this.state.isActive
    this.state.isActive = hasActivity

    if (hasActivity) {
      this.state.lastActivity = Date.now()
      // If we just became active, switch to fast polling
      if (!wasActive) {
        this.state.currentInterval = this.options.fastInterval
      }
    } else {
      // If we've been idle for a while, switch to slower polling
      const idleTime = Date.now() - this.state.lastActivity
      if (idleTime > 30000 && this.state.currentInterval < this.options.idleInterval) {
        this.state.currentInterval = this.options.idleInterval
      }
    }
  }

  private calculateNextInterval(): void {
    if (this.state.isActive) {
      // Keep fast polling during activity
      this.state.currentInterval = this.options.fastInterval
    } else {
      // Gradually increase interval when idle
      if (this.state.currentInterval < this.options.idleInterval) {
        this.state.currentInterval = Math.min(
          this.state.currentInterval * 1.1,
          this.options.idleInterval
        )
      }
    }
  }

  private applyFailureBackoff(): void {
    this.state.currentInterval = Math.min(
      this.state.currentInterval * this.options.backoffMultiplier,
      this.options.maxInterval
    )
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.abortController?.signal.aborted) {
        resolve()
        return
      }

      const timeoutId = setTimeout(resolve, ms)
      this.timeoutId = timeoutId

      this.abortController?.signal.addEventListener('abort', () => {
        clearTimeout(timeoutId)
        resolve()
      })
    })
  }

  getState(): Readonly<PollingState> {
    return { ...this.state }
  }
}

// Request deduplication utility
export class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<any>>()

  async deduplicate<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // If request is already pending, return that promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)
    }

    // Create new request
    const promise = requestFn().finally(() => {
      // Clean up after request completes
      this.pendingRequests.delete(key)
    })

    // Store pending request
    this.pendingRequests.set(key, promise)

    return promise
  }

  clear(): void {
    this.pendingRequests.clear()
  }

  getPendingCount(): number {
    return this.pendingRequests.size
  }
}

// Performance monitoring utilities
export interface PerformanceMetrics {
  memoryUsage?: {
    used: number
    total: number
    percentage: number
  }
  timing: {
    startTime: number
    duration: number
  }
  network: {
    requests: number
    failures: number
    totalBytes: number
  }
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    timing: {
      startTime: 0,
      duration: 0
    },
    network: {
      requests: 0,
      failures: 0,
      totalBytes: 0
    }
  }

  private updateInterval: NodeJS.Timeout | null = null

  start(): void {
    this.metrics.timing.startTime = Date.now()
    this.metrics.network.requests = 0
    this.metrics.network.failures = 0
    this.metrics.network.totalBytes = 0

    // Update memory usage every 5 seconds
    this.updateInterval = setInterval(() => {
      this.updateMemoryUsage()
    }, 5000)
  }

  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
    this.metrics.timing.duration = Date.now() - this.metrics.timing.startTime
  }

  recordRequest(bytes?: number): void {
    this.metrics.network.requests++
    if (bytes) {
      this.metrics.network.totalBytes += bytes
    }
  }

  recordFailure(): void {
    this.metrics.network.failures++
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  private updateMemoryUsage(): void {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (performance as any)) {
      const memory = (performance as any).memory
      this.metrics.memoryUsage = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
      }
    }
  }
}

// Network optimization utilities
export function createBatchedRequest<T, R = void>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R>,
  concurrency: number = 3
): Promise<R[]> {
  return new Promise((resolve, reject) => {
    type BatchEntry = { index: number; items: T[] }

    const queue: BatchEntry[] = []
    for (let i = 0; i < items.length; i += batchSize) {
      queue.push({
        index: queue.length,
        items: items.slice(i, i + batchSize),
      })
    }

    const totalBatches = queue.length
    if (totalBatches === 0) {
      resolve([])
      return
    }

    const results: R[] = new Array(totalBatches)
    let completedBatches = 0
    let hasError = false

    const startNextBatch = () => {
      if (hasError) return

      if (completedBatches === totalBatches) {
        resolve(results)
        return
      }

      if (queue.length === 0) {
        return
      }

      const nextBatch = queue.shift()!

      processor(nextBatch.items)
        .then((value) => {
          results[nextBatch.index] = value as R
        })
        .catch((error) => {
          if (!hasError) {
            hasError = true
            reject(error)
          }
        })
        .finally(() => {
          completedBatches++
          if (!hasError) {
            if (completedBatches === totalBatches) {
              resolve(results)
            } else {
              startNextBatch()
            }
          }
        })
    }

    // Start initial batches based on concurrency
    for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
      startNextBatch()
    }
  })
}

// Memory optimization utilities
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function getMemoryWarning(bytes: number): { warning: boolean; message: string } {
  const MB = 1024 * 1024

  if (bytes > 50 * MB) {
    return {
      warning: true,
      message: 'Large file detected (>50MB). Processing may be slow.'
    }
  }

  if (bytes > 100 * MB) {
    return {
      warning: true,
      message: 'Very large file detected (>100MB). Consider splitting into smaller files.'
    }
  }

  return { warning: false, message: '' }
}