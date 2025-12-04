/**
 * Database Connection Monitor - Prevents connection pool exhaustion
 *
 * This utility tracks database connections across all services to prevent
 * pool exhaustion that could cause session loss and system instability.
 */

export interface ConnectionMetrics {
  serviceName: string
  activeConnections: number
  totalConnections: number
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
  poolUtilization: number
  healthStatus: 'healthy' | 'warning' | 'critical'
}

class ConnectionMonitor {
  private static instance: ConnectionMonitor
  private connections: Map<string, ConnectionMetrics> = new Map()
  private alerts: ConnectionAlert[] = []
  private peakUsage = { timestamp: Date.now(), connections: 0 }
  private readonly WARNING_THRESHOLD = 0.8 // 80%
  private readonly CRITICAL_THRESHOLD = 0.95 // 95%
  private readonly DEFAULT_MAX_POOL_SIZE = 25 // Supabase default
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
   * Track a new database connection
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

    // Check thresholds
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

    const connectionError: ConnectionError = {
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : error,
      context: context || 'unknown',
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
    this.triggerAlert({
      type: 'critical',
      serviceName,
      message: `Database connection error: ${connectionError.error}`,
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

    // Determine health status
    let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (poolUtilization >= this.CRITICAL_THRESHOLD) {
      healthStatus = 'critical'
    } else if (poolUtilization >= this.WARNING_THRESHOLD) {
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
   * Get overall pool utilization percentage
   */
  getPoolUtilization(): number {
    const totalActive = this.getTotalActiveConnections()
    const maxPoolSize = Array.from(this.connections.values())
      .reduce((sum, metrics) => sum + metrics.maxPoolSize, 0)

    return maxPoolSize > 0 ? totalActive / maxPoolSize : 0
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

      // Estimate active connections based on recent activity
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

    const utilization = metrics.activeConnections / metrics.maxPoolSize
    const totalUtilization = this.getPoolUtilization()

    // Service-level threshold check
    if (utilization >= this.CRITICAL_THRESHOLD) {
      this.triggerAlert({
        type: 'critical',
        serviceName,
        message: `Service connection pool at ${Math.round(utilization * 100)}% capacity`,
        usage: utilization,
        threshold: this.CRITICAL_THRESHOLD,
        timestamp: Date.now()
      })
    } else if (utilization >= this.WARNING_THRESHOLD) {
      this.triggerAlert({
        type: 'warning',
        serviceName,
        message: `Service connection pool at ${Math.round(utilization * 100)}% capacity`,
        usage: utilization,
        threshold: this.WARNING_THRESHOLD,
        timestamp: Date.now()
      })
    }

    // Global threshold check
    if (totalUtilization >= this.CRITICAL_THRESHOLD) {
      this.triggerAlert({
        type: 'critical',
        serviceName: 'global',
        message: `Global connection pool at ${Math.round(totalUtilization * 100)}% capacity`,
        usage: totalUtilization,
        threshold: this.CRITICAL_THRESHOLD,
        timestamp: Date.now()
      })
    }
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

    if (stats.poolUtilization >= this.CRITICAL_THRESHOLD) {
      recommendations.push('URGENT: Connection pool at critical capacity - immediate investigation required')
      recommendations.push('Consider implementing connection pooling or reducing concurrent operations')
      recommendations.push('Check for connection leaks in application code')
    } else if (stats.poolUtilization >= this.WARNING_THRESHOLD) {
      recommendations.push('Monitor connection pool usage - approaching capacity limits')
      recommendations.push('Review connection lifecycle management')
    }

    const servicesWithHighErrors = Object.entries(stats.services)
      .filter(([, metrics]) => metrics.errors.length > 5)
      .map(([name]) => name)

    if (servicesWithHighErrors.length > 0) {
      recommendations.push(`High error rates detected in: ${servicesWithHighErrors.join(', ')}`)
      recommendations.push('Review database connectivity and error handling')
    }

    const inactiveServices = Object.entries(stats.services)
      .filter(([, metrics]) => Date.now() - metrics.lastActivity > 10 * 60 * 1000) // 10 minutes
      .map(([name]) => name)

    if (inactiveServices.length > 0) {
      recommendations.push(`Inactive services with open connections: ${inactiveServices.join(', ')}`)
      recommendations.push('Consider implementing connection timeout for inactive services')
    }

    if (recommendations.length === 0) {
      recommendations.push('Connection pool usage within normal parameters')
    }

    return recommendations
  }

  private logConnectionEvent(event: string, serviceName: string, connectionId: string, data: any): void {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[ConnectionMonitor] ${event.toUpperCase()}`, {
        serviceName,
        connectionId: connectionId.substring(0, 20),
        timestamp: new Date().toISOString(),
        ...data
      })
    }
  }

  private logAlert(alert: ConnectionAlert): void {
    const logLevel = alert.type === 'critical' ? 'error' : 'warn'
    console[logLevel](`[ConnectionMonitor] ALERT ${alert.type.toUpperCase()}`, {
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