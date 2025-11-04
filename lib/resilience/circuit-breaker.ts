/**
 * Circuit Breaker Pattern Implementation
 *
 * Provides circuit breaker functionality for external service calls to prevent
 * cascading failures and provide graceful degradation when services are unavailable.
 */

export enum CircuitState {
  CLOSED = 'CLOSED',      // Normal operation
  OPEN = 'OPEN',          // Circuit is open, calls fail immediately
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

export interface CircuitBreakerConfig {
  failureThreshold?: number    // Number of failures before opening
  successThreshold?: number    // Number of successes to close circuit
  timeout?: number             // Time to wait before trying again (ms)
  monitoringPeriod?: number    // Time window for failure counting (ms)
  resetTimeout?: number        // Time to stay in open state (ms)
  name?: string                // Circuit breaker name for monitoring
}

export interface CallResult<T> {
  success: boolean
  result?: T
  error?: Error
  duration: number
  timestamp: number
}

export interface CircuitBreakerStats {
  state: CircuitState
  failureCount: number
  successCount: number
  totalCalls: number
  lastFailureTime?: number
  lastSuccessTime?: number
  averageResponseTime: number
  stateChangedAt?: number
}

/**
 * Circuit Breaker implementation for external service resilience
 */
export class CircuitBreaker<T = any> {
  private config: Required<CircuitBreakerConfig>
  private state: CircuitState = CircuitState.CLOSED
  private failureCount = 0
  private successCount = 0
  private totalCalls = 0
  private lastFailureTime?: number
  private lastSuccessTime?: number
  private stateChangedAt = Date.now()
  private responseTimes: number[] = []
  private callHistory: CallResult<T>[] = []
  private stateChangeListeners: ((state: CircuitState, previousState: CircuitState) => void)[] = []

  constructor(config: CircuitBreakerConfig = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      successThreshold: config.successThreshold ?? 3,
      timeout: config.timeout ?? 60000,        // 1 minute
      monitoringPeriod: config.monitoringPeriod ?? 120000, // 2 minutes
      resetTimeout: config.resetTimeout ?? 30000,         // 30 seconds
      name: config.name ?? 'unnamed'
    }
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<R = T>(fn: () => Promise<R>): Promise<R> {
    const startTime = Date.now()

    // Check if we should allow the call
    if (!this.shouldAllowCall()) {
      const error = new Error(`Circuit breaker is ${this.state}`)
      error.name = 'CircuitBreakerOpenError'
      throw error
    }

    this.totalCalls++

    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Operation timeout')), this.config.timeout)
        )
      ])

      this.onSuccess()
      this.recordCallResult({
        success: true,
        result: result as unknown as T,
        duration: Date.now() - startTime,
        timestamp: Date.now()
      })

      return result
    } catch (error) {
      this.onFailure()
      this.recordCallResult({
        success: false,
        error: error as Error,
        duration: Date.now() - startTime,
        timestamp: Date.now()
      })
      throw error
    }
  }

  /**
   * Check if a call should be allowed based on current state
   */
  private shouldAllowCall(): boolean {
    const now = Date.now()

    switch (this.state) {
      case CircuitState.CLOSED:
        return true

      case CircuitState.OPEN:
        // Check if we should try again
        if (now - this.stateChangedAt >= this.config.resetTimeout) {
          this.setState(CircuitState.HALF_OPEN)
          return true
        }
        return false

      case CircuitState.HALF_OPEN:
        return true

      default:
        return false
    }
  }

  /**
   * Handle successful call
   */
  private onSuccess(): void {
    this.lastSuccessTime = Date.now()

    switch (this.state) {
      case CircuitState.CLOSED:
        // Reset failure count on success
        this.failureCount = Math.max(0, this.failureCount - 1)
        this.successCount++
        break

      case CircuitState.HALF_OPEN:
        // Success in half-open state, check if we should close
        this.successCount++
        if (this.successCount >= this.config.successThreshold) {
          this.setState(CircuitState.CLOSED)
          this.failureCount = 0
          this.successCount = 0
        }
        break

      case CircuitState.OPEN:
        // This shouldn't happen, but handle it gracefully
        this.setState(CircuitState.HALF_OPEN)
        break
    }
  }

  /**
   * Handle failed call
   */
  private onFailure(): void {
    this.lastFailureTime = Date.now()

    switch (this.state) {
      case CircuitState.CLOSED:
        this.failureCount++
        this.successCount = 0

        // Check if we should open the circuit
        if (this.failureCount >= this.config.failureThreshold) {
          this.setState(CircuitState.OPEN)
        }
        break

      case CircuitState.HALF_OPEN:
        // Failure in half-open state, open the circuit again
        this.setState(CircuitState.OPEN)
        this.failureCount = this.config.failureThreshold
        this.successCount = 0
        break

      case CircuitState.OPEN:
        // This shouldn't happen, but track it
        break
    }
  }

  /**
   * Change circuit state and notify listeners
   */
  private setState(newState: CircuitState): void {
    const previousState = this.state
    this.state = newState
    this.stateChangedAt = Date.now()

    this.stateChangeListeners.forEach(listener => {
      try {
        listener(newState, previousState)
      } catch (error) {
        console.error(`Circuit breaker ${this.config.name} state change listener error:`, error)
      }
    })

    console.log(`🔌 Circuit breaker ${this.config.name} state: ${previousState} -> ${newState}`)
  }

  /**
   * Record call result for metrics
   */
  private recordCallResult(result: CallResult<T>): void {
    this.callHistory.push(result)

    // Keep only recent history (last 100 calls)
    if (this.callHistory.length > 100) {
      this.callHistory = this.callHistory.slice(-100)
    }

    // Update response time metrics
    if (result.success) {
      this.responseTimes.push(result.duration)
      if (this.responseTimes.length > 50) {
        this.responseTimes = this.responseTimes.slice(-50)
      }
    }
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalCalls: this.totalCalls,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      averageResponseTime: this.responseTimes.length > 0
        ? this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length
        : 0,
      stateChangedAt: this.stateChangedAt
    }
  }

  /**
   * Get detailed call history
   */
  getCallHistory(limit: number = 50): CallResult<T>[] {
    return this.callHistory.slice(-limit)
  }

  /**
   * Get recent call statistics
   */
  getRecentStats(timeWindow: number = 300000): {
    totalCalls: number
    successRate: number
    averageResponseTime: number
    errorRate: number
  } {
    const now = Date.now()
    const recentCalls = this.callHistory.filter(call =>
      now - call.timestamp <= timeWindow
    )

    if (recentCalls.length === 0) {
      return {
        totalCalls: 0,
        successRate: 0,
        averageResponseTime: 0,
        errorRate: 0
      }
    }

    const successCount = recentCalls.filter(call => call.success).length
    const totalResponseTime = recentCalls.reduce((sum, call) => sum + call.duration, 0)

    return {
      totalCalls: recentCalls.length,
      successRate: (successCount / recentCalls.length) * 100,
      averageResponseTime: totalResponseTime / recentCalls.length,
      errorRate: ((recentCalls.length - successCount) / recentCalls.length) * 100
    }
  }

  /**
   * Force the circuit breaker into a specific state (for testing/admin)
   */
  forceState(state: CircuitState): void {
    this.setState(state)
    if (state === CircuitState.CLOSED) {
      this.failureCount = 0
      this.successCount = 0
    }
  }

  /**
   * Reset the circuit breaker to initial state
   */
  reset(): void {
    this.setState(CircuitState.CLOSED)
    this.failureCount = 0
    this.successCount = 0
    this.totalCalls = 0
    this.lastFailureTime = undefined
    this.lastSuccessTime = undefined
    this.responseTimes = []
    this.callHistory = []
  }

  /**
   * Add state change listener
   */
  onStateChange(listener: (state: CircuitState, previousState: CircuitState) => void): () => void {
    this.stateChangeListeners.push(listener)

    return () => {
      const index = this.stateChangeListeners.indexOf(listener)
      if (index > -1) {
        this.stateChangeListeners.splice(index, 1)
      }
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state
  }

  /**
   * Check if circuit is open (blocking calls)
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN
  }

  /**
   * Check if circuit is closed (allowing calls)
   */
  isClosed(): boolean {
    return this.state === CircuitState.CLOSED
  }
}

/**
 * Circuit breaker registry for managing multiple breakers
 */
class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>()

  register<T = any>(name: string, config?: CircuitBreakerConfig): CircuitBreaker<T> {
    if (this.breakers.has(name)) {
      return this.breakers.get(name) as CircuitBreaker<T>
    }

    const breaker = new CircuitBreaker<T>({ ...config, name })
    this.breakers.set(name, breaker)
    return breaker
  }

  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name)
  }

  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers)
  }

  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {}
    this.breakers.forEach((breaker, name) => {
      stats[name] = breaker.getStats()
    })
    return stats
  }

  destroy(name: string): boolean {
    const breaker = this.breakers.get(name)
    if (breaker) {
      breaker.reset()
      this.breakers.delete(name)
      return true
    }
    return false
  }

  destroyAll(): void {
    this.breakers.forEach((_, name) => this.destroy(name))
  }
}

// Global circuit breaker registry
export const circuitBreakerRegistry = new CircuitBreakerRegistry()

// Pre-configured circuit breakers for common services
export const circuitBreakers = {
  supabase: circuitBreakerRegistry.register('supabase', {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 10000,
    resetTimeout: 30000
  }),

  scraperWorker: circuitBreakerRegistry.register('scraper-worker', {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 30000,
    resetTimeout: 60000
  }),

  scannerWorker: circuitBreakerRegistry.register('scanner-worker', {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 25000,
    resetTimeout: 60000
  }),

  bciWorker: circuitBreakerRegistry.register('bci-worker', {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 20000,
    resetTimeout: 60000
  }),

  dashboardWorker: circuitBreakerRegistry.register('dashboard-worker', {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 15000,
    resetTimeout: 30000
  })
}

/**
 * Execute a function through a named circuit breaker
 */
export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  config?: CircuitBreakerConfig
): Promise<T> {
  const breaker = circuitBreakerRegistry.get(name) ||
                  circuitBreakerRegistry.register(name, config)

  return breaker.execute(fn)
}

export default {
  CircuitBreaker,
  CircuitBreakerRegistry,
  circuitBreakerRegistry,
  circuitBreakers,
  withCircuitBreaker
}