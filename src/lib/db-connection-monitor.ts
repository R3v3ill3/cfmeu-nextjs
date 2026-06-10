/**
 * Supabase Client Activity Monitor
 *
 * This utility tracks Supabase client instances / logical request handles and
 * related errors. It does NOT observe real Postgres pool connections (the
 * browser client speaks HTTP to Supabase/PostgREST, and server clients are
 * short-lived per request), so it must not raise "pool exhaustion" alarms.
 *
 * Public export names are kept for API compatibility with existing imports.
 */

export interface ConnectionMetrics {
  serviceName: string
  /** Logical client/request handles currently tracked, not DB pool connections. */
  activeConnections: number
  /** Total logical handles tracked since process start. */
  totalConnections: number
  /** Deprecated compatibility field; not a real pool size. */
  maxPoolSize: number
  connectionAge: number[]
  lastActivity: number
  errors: ConnectionError[]
}

export interface ConnectionError {
  timestamp: number
  error: string
  context: string
  recoveryAttempt?: number
}

export interface ConnectionAlert {
  type: 'warning' | 'critical'
  serviceName: string
  message: string
  usage: number
  threshold: number
  timestamp: number
}

export interface ConnectionStats {
  totalActiveConnections: number
  totalConnections: number
  services: Record<string, ConnectionMetrics>
  alerts: ConnectionAlert[]
  peakUsage: {
    timestamp: number
    connections: number
  }
  /** Deprecated compatibility field; always 0 because this is not pool telemetry. */
  poolUtilization: number
  healthStatus: 'healthy' | 'warning' | 'critical'
}

class ConnectionMonitor {
  private static instance: ConnectionMonitor
  private connections: Map<string, ConnectionMetrics> = new Map()
  private alerts: ConnectionAlert[] = []
  private peakUsage = { timestamp: Date.now(), connections: 0 }
  private readonly WARNING_THRESHOLD = 0.8 // retained for compatibility-only diagnostics
  private readonly CRITICAL_THRESHOLD = 0.95 // retained for compatibility-only diagnostics
  private readonly DEFAULT_MAX_POOL_SIZE = 1 // deprecated compatibility field; not a real pool size
  private readonly CLEANUP_INTERVAL = 30000 // 30 seconds
  private readonly ALERT_RETENTION = 24 * 60 * 60 * 1000 // 24 hours
  private cleanupTimer?: NodeJS.Timeout

  private constructor() {
    this.startCleanup()
  }

  static getInstance(): ConnectionMonitor {
    if (!ConnectionMonitor.instance) {
      ConnectionMonitor.instance = new ConnectionMonitor()
    }
    return ConnectionMonitor.instance
  }

  /**
   * Track a logical Supabase client/request handle.
   */
  trackConnection(serviceName: string, connectionId?: string): string {
    const id = connectionId || `${serviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const now = Date.now()

    if (!this.connections.has(serviceName)) {
      this.connections.set(serviceName, {
        serviceName,
        activeConnections: 0,
        totalConnections: 0,
        maxPoolSize: this.DEFAULT_MAX_POOL_SIZE,
        connectionAge: [],
        lastActivity: now,
        errors: []
      })
    }

    const metrics = this.connections.get(serviceName)!
    metrics.activeConnections++
    metrics.totalConnections++
    metrics.connectionAge.push(now)
    metrics.lastActivity = now

    // Update peak usage
    const totalActive = this.getTotalActiveConnections()
    if (totalActive > this.peakUsage.connections) {
      this.peakUsage = { timestamp: now, connections: totalActive }
    }

    // Log connection creation
    this.logConnectionEvent('create', serviceName, id, {
      totalActive: totalActive,
      serviceActive: metrics.activeConnections
    })

    // No threshold checks here: this is logical client activity, not real DB
    // pool telemetry. Alerting on these counts produced false "pool
    // exhaustion" signals during auth/session debugging.
    this.checkThresholds(serviceName)

    return id
  }

  /**
   * Release a database connection
   */
  releaseConnection(serviceName: string, connectionId?: string): void {
    const metrics = this.connections.get(serviceName)
    if (!metrics) {
      this.logConnectionEvent('release-error', serviceName, connectionId || 'unknown', {
        error: 'Service not found in connection tracker'
      })
      return
    }

    if (metrics.activeConnections > 0) {
      metrics.activeConnections--
      metrics.lastActivity = Date.now()
    }

    const totalActive = this.getTotalActiveConnections()

    this.logConnectionEvent('release', serviceName, connectionId || 'unknown', {
      totalActive: totalActive,
      serviceActive: metrics.activeConnections
    })
  }

  /**
   * Record a connection error
   */
  recordConnectionError(serviceName: string, error: Error | string, context?: string): void {
    const metrics = this.connections.get(serviceName)
    if (!metrics) return

    const errorMessage = error instanceof Error ? error.message : error
    const normalizedContext = context || 'unknown'
    const isAuthSessionError =
      /auth session missing|invalid refresh token/i.test(errorMessage) ||
      normalizedContext.toLowerCase().includes('auth.')

    const connectionError: ConnectionError = {
      timestamp: Date.now(),
      error: errorMessage,
      context: normalizedContext,
      recoveryAttempt: 0
    }

    metrics.errors.push(connectionError)
    metrics.lastActivity = Date.now()

    // Keep only recent errors (last 50)
    if (metrics.errors.length > 50) {
      metrics.errors = metrics.errors.slice(-50)
    }

    this.logConnectionEvent('error', serviceName, 'system', {
      error: connectionError.error,
      context: connectionError.context
    })

    // Trigger immediate alert for connection errors
    // Note: auth/session errors are not "DB pool exhaustion" signals; classify separately to reduce noise.
    this.triggerAlert({
      type: isAuthSessionError ? 'warning' : 'critical',
      serviceName,
      message: isAuthSessionError
        ? `Auth/session error: ${connectionError.error}`
        : `Database connection error: ${connectionError.error}`,
      usage: this.getPoolUtilization(),
      threshold: this.CRITICAL_THRESHOLD,
      timestamp: Date.now()
    })
  }

  /**
   * Get current connection statistics
   */
  getConnectionStats(): ConnectionStats {
    const totalActive = this.getTotalActiveConnections()
    const totalConnections = this.getTotalConnections()
    const poolUtilization = this.getPoolUtilization()

    // This monitor does not observe database pool capacity. Keep health
    // status tied to recorded errors/recent activity, not handle counts.
    let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy'
    const recentErrors = Array.from(this.connections.values()).some((metrics) =>
      metrics.errors.some((error) => Date.now() - error.timestamp < 5 * 60 * 1000)
    )
    if (recentErrors) {
      healthStatus = 'warning'
    }

    return {
      totalActiveConnections: totalActive,
      totalConnections: totalConnections,
      services: Object.fromEntries(this.connections),
      alerts: this.getRecentAlerts(),
      peakUsage: this.peakUsage,
      poolUtilization,
      healthStatus
    }
  }

  /**
   * Get connection metrics for a specific service
   */
  getServiceMetrics(serviceName: string): ConnectionMetrics | null {
    return this.connections.get(serviceName) || null
  }

  /**
   * Deprecated compatibility shim. This monitor cannot know real Supabase /
   * Postgres pool utilization, so return 0 instead of a misleading ratio.
   */
  getPoolUtilization(): number {
    return 0
  }

  /**
   * Force cleanup of stale connections
   */
  forceCleanup(): void {
    const now = Date.now()
    const staleThreshold = 5 * 60 * 1000 // 5 minutes
    let cleanedCount = 0

    for (const [serviceName, metrics] of this.connections) {
      const initialActive = metrics.activeConnections

      // Remove stale connection age entries
      metrics.connectionAge = metrics.connectionAge.filter(timestamp => {
        return now - timestamp < staleThreshold
      })

      // Estimate active logical handles based on recent activity
      const recentConnections = metrics.connectionAge.filter(timestamp =>
        now - timestamp < staleThreshold
      ).length

      metrics.activeConnections = Math.min(initialActive, recentConnections)
      cleanedCount += initialActive - metrics.activeConnections
    }

    if (cleanedCount > 0) {
      this.logConnectionEvent('cleanup', 'system', 'all', {
        cleanedConnections: cleanedCount
      })
    }
  }

  /**
   * Reset all tracking (emergency use only)
   */
  emergencyReset(): void {
    this.logConnectionEvent('emergency-reset', 'system', 'all', {
      previousConnections: this.getTotalActiveConnections(),
      services: Array.from(this.connections.keys())
    })

    this.connections.clear()
    this.alerts = []
    this.peakUsage = { timestamp: Date.now(), connections: 0 }
  }

  /**
   * Get detailed diagnostics for troubleshooting
   */
  getDiagnostics(): any {
    const now = Date.now()
    const recentErrors = Array.from(this.connections.values())
      .flatMap(metrics => metrics.errors)
      .filter(error => now - error.timestamp < 60 * 60 * 1000) // Last hour

    const serviceHealth = Array.from(this.connections.entries()).map(([name, metrics]) => ({
      name,
      activeConnections: metrics.activeConnections,
      maxPoolSize: metrics.maxPoolSize,
      utilization: metrics.activeConnections / metrics.maxPoolSize,
      errorRate: metrics.errors.length,
      lastActivity: now - metrics.lastActivity,
      status: metrics.activeConnections / metrics.maxPoolSize >= this.CRITICAL_THRESHOLD ? 'critical' :
             metrics.activeConnections / metrics.maxPoolSize >= this.WARNING_THRESHOLD ? 'warning' : 'healthy'
    }))

    return {
      timestamp: new Date().toISOString(),
      summary: this.getConnectionStats(),
      serviceHealth,
      recentErrors: recentErrors.slice(0, 10), // Last 10 errors
      recommendations: this.generateRecommendations()
    }
  }

  private getTotalActiveConnections(): number {
    return Array.from(this.connections.values())
      .reduce((sum, metrics) => sum + metrics.activeConnections, 0)
  }

  private getTotalConnections(): number {
    return Array.from(this.connections.values())
      .reduce((sum, metrics) => sum + metrics.totalConnections, 0)
  }

  private checkThresholds(serviceName: string): void {
    const metrics = this.connections.get(serviceName)
    if (!metrics) return

    // Intentionally no-op. This class tracks logical client/request handles,
    // not real DB pool connections, so count-based capacity alerts are false
    // positives. Errors are still recorded via recordConnectionError().
    void serviceName
    void metrics
  }

  private triggerAlert(alert: ConnectionAlert): void {
    // Check for duplicate alerts within cooldown period
    const cooldownPeriod = 5 * 60 * 1000 // 5 minutes
    const recentSimilar = this.alerts.find(existing =>
      existing.serviceName === alert.serviceName &&
      existing.type === alert.type &&
      (alert.timestamp - existing.timestamp) < cooldownPeriod
    )

    if (recentSimilar) return

    this.alerts.push(alert)
    this.logAlert(alert)
  }

  private getRecentAlerts(): ConnectionAlert[] {
    const now = Date.now()
    return this.alerts.filter(alert => now - alert.timestamp < this.ALERT_RETENTION)
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.forceCleanup()
      this.cleanupOldAlerts()
    }, this.CLEANUP_INTERVAL)
  }

  private cleanupOldAlerts(): void {
    const now = Date.now()
    const initialCount = this.alerts.length
    this.alerts = this.alerts.filter(alert => now - alert.timestamp < this.ALERT_RETENTION)

    if (this.alerts.length < initialCount) {
      this.logConnectionEvent('cleanup-alerts', 'system', 'all', {
        removed: initialCount - this.alerts.length
      })
    }
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = []
    const stats = this.getConnectionStats()

    const servicesWithHighErrors = Object.entries(stats.services)
      .filter(([, metrics]) => metrics.errors.length > 5)
      .map(([name]) => name)

    if (servicesWithHighErrors.length > 0) {
      recommendations.push(`High error rates detected in: ${servicesWithHighErrors.join(', ')}`)
      recommendations.push('Review Supabase/auth/API error handling for these services')
    }

    const inactiveServices = Object.entries(stats.services)
      .filter(([, metrics]) => Date.now() - metrics.lastActivity > 10 * 60 * 1000) // 10 minutes
      .map(([name]) => name)

    if (inactiveServices.length > 0) {
      recommendations.push(`Inactive tracked logical handles: ${inactiveServices.join(', ')}`)
      recommendations.push('Review lifecycle cleanup for stale client/request tracking')
    }

    if (recommendations.length === 0) {
      recommendations.push('Supabase client activity is within normal parameters')
    }

    return recommendations
  }

  private logConnectionEvent(event: string, serviceName: string, connectionId: string, data: any): void {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[SupabaseActivityMonitor] ${event.toUpperCase()}`, {
        serviceName,
        connectionId: connectionId.substring(0, 20),
        timestamp: new Date().toISOString(),
        ...data
      })
    }
  }

  private logAlert(alert: ConnectionAlert): void {
    const logLevel = alert.type === 'critical' ? 'error' : 'warn'
    console[logLevel](`[SupabaseActivityMonitor] ALERT ${alert.type.toUpperCase()}`, {
      service: alert.serviceName,
      message: alert.message,
      usage: `${Math.round(alert.usage * 100)}%`,
      threshold: `${Math.round(alert.threshold * 100)}%`,
      timestamp: new Date(alert.timestamp).toISOString()
    })
  }

  /**
   * Cleanup method for graceful shutdown
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
    this.emergencyReset()
  }
}

// Export singleton instance
export const connectionMonitor = ConnectionMonitor.getInstance()

// Export convenience functions
export function trackConnection(serviceName: string, connectionId?: string): string {
  return connectionMonitor.trackConnection(serviceName, connectionId)
}

export function releaseConnection(serviceName: string, connectionId?: string): void {
  connectionMonitor.releaseConnection(serviceName, connectionId)
}

export function recordConnectionError(serviceName: string, error: Error | string, context?: string): void {
  connectionMonitor.recordConnectionError(serviceName, error, context)
}

export function getConnectionStats(): ConnectionStats {
  return connectionMonitor.getConnectionStats()
}

export function getServiceMetrics(serviceName: string): ConnectionMetrics | null {
  return connectionMonitor.getServiceMetrics(serviceName)
}

export function getPoolUtilization(): number {
  return connectionMonitor.getPoolUtilization()
}

export function forceCleanup(): void {
  connectionMonitor.forceCleanup()
}

export function getDiagnostics(): any {
  return connectionMonitor.getDiagnostics()
}