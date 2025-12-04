/**
 * Database Connection Metrics Collection
 *
 * This module provides comprehensive metrics collection and export capabilities
 * for database connection monitoring data.
 */

import { getConnectionStats, getDiagnostics, connectionMonitor } from './db-connection-monitor'

export interface ConnectionMetricsExport {
  timestamp: string
  summary: {
    totalActiveConnections: number
    totalConnections: number
    poolUtilization: number
    healthStatus: string
    servicesCount: number
    alertsCount: number
    peakUsage: number
  }
  services: Array<{
    name: string
    activeConnections: number
    totalConnections: number
    maxPoolSize: number
    utilization: number
    lastActivity: string
    errorCount: number
    status: string
  }>
  alerts: Array<{
    type: string
    serviceName: string
    message: string
    usage: number
    threshold: number
    timestamp: string
  }>
  diagnostics: {
    recommendations: string[]
    serviceHealth: Array<{
      name: string
      activeConnections: number
      maxPoolSize: number
      utilization: number
      errorRate: number
      lastActivity: string
      status: string
    }>
    recentErrors: Array<{
      timestamp: string
      serviceName: string
      error: string
      context: string
    }>
  }
  metadata: {
    environment: string
    version: string
    uptime: number
    nodeVersion: string
    platform: string
  }
}

export interface MetricsCollectionConfig {
  enablePrometheus: boolean
  enableInfluxDB: boolean
  enableConsole: boolean
  prometheusPort?: number
  prometheusEndpoint?: string
  influxDbUrl?: string
  influxDbToken?: string
  influxDbOrg?: string
  influxDbBucket?: string
  collectionInterval: number // milliseconds
  retentionPeriod: number // milliseconds
}

export class ConnectionMetricsCollector {
  private static instance: ConnectionMetricsCollector
  private config: MetricsCollectionConfig
  private collectionTimer?: NodeJS.Timeout
  private metricsHistory: ConnectionMetricsExport[] = []
  private isCollecting = false

  private constructor(config: Partial<MetricsCollectionConfig> = {}) {
    this.config = {
      enablePrometheus: false,
      enableInfluxDB: false,
      enableConsole: true,
      collectionInterval: 30000, // 30 seconds
      retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      ...config
    }
  }

  static getInstance(config?: Partial<MetricsCollectionConfig>): ConnectionMetricsCollector {
    if (!ConnectionMetricsCollector.instance) {
      ConnectionMetricsCollector.instance = new ConnectionMetricsCollector(config)
    }
    return ConnectionMetricsCollector.instance
  }

  /**
   * Start metrics collection
   */
  startCollection(): void {
    if (this.isCollecting) {
      console.warn('[ConnectionMetricsCollector] Collection already started')
      return
    }

    this.isCollecting = true
    console.log(`[ConnectionMetricsCollector] Starting collection with ${this.config.collectionInterval}ms interval`)

    this.collectionTimer = setInterval(() => {
      this.collectMetrics()
    }, this.config.collectionInterval)

    // Collect initial metrics
    this.collectMetrics()
  }

  /**
   * Stop metrics collection
   */
  stopCollection(): void {
    if (!this.isCollecting) {
      return
    }

    this.isCollecting = false
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer)
      this.collectionTimer = undefined
    }

    console.log('[ConnectionMetricsCollector] Collection stopped')
  }

  /**
   * Collect current metrics
   */
  private collectMetrics(): void {
    try {
      const metrics = this.generateMetricsExport()

      // Store in history
      this.metricsHistory.push(metrics)

      // Cleanup old metrics
      this.cleanupOldMetrics()

      // Export to configured destinations
      this.exportMetrics(metrics)

    } catch (error) {
      console.error('[ConnectionMetricsCollector] Error collecting metrics:', error)
    }
  }

  /**
   * Generate comprehensive metrics export
   */
  generateMetricsExport(): ConnectionMetricsExport {
    const connectionStats = getConnectionStats()
    const diagnostics = getDiagnostics()
    const now = new Date()

    return {
      timestamp: now.toISOString(),
      summary: {
        totalActiveConnections: connectionStats.totalActiveConnections,
        totalConnections: connectionStats.totalConnections,
        poolUtilization: Math.round(connectionStats.poolUtilization * 100),
        healthStatus: connectionStats.healthStatus,
        servicesCount: Object.keys(connectionStats.services).length,
        alertsCount: connectionStats.alerts.length,
        peakUsage: connectionStats.peakUsage.connections
      },
      services: Object.entries(connectionStats.services).map(([name, metrics]) => ({
        name,
        activeConnections: metrics.activeConnections,
        totalConnections: metrics.totalConnections,
        maxPoolSize: metrics.maxPoolSize,
        utilization: Math.round((metrics.activeConnections / metrics.maxPoolSize) * 100),
        lastActivity: new Date(metrics.lastActivity).toISOString(),
        errorCount: metrics.errors.length,
        status: this.getServiceStatus(metrics)
      })),
      alerts: connectionStats.alerts.map(alert => ({
        type: alert.type,
        serviceName: alert.serviceName,
        message: alert.message,
        usage: Math.round(alert.usage * 100),
        threshold: Math.round(alert.threshold * 100),
        timestamp: new Date(alert.timestamp).toISOString()
      })),
      diagnostics: {
        recommendations: diagnostics.recommendations || [],
        serviceHealth: diagnostics.serviceHealth || [],
        recentErrors: (diagnostics.recentErrors || []).slice(0, 10).map(error => ({
          timestamp: new Date(error.timestamp).toISOString(),
          serviceName: error.serviceName || 'unknown',
          error: error.error,
          context: error.context || 'unknown'
        }))
      },
      metadata: {
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime ? process.uptime() * 1000 : 0,
        nodeVersion: process.version,
        platform: process.platform
      }
    }
  }

  private getServiceStatus(metrics: any): string {
    const utilization = metrics.activeConnections / metrics.maxPoolSize
    if (utilization >= 0.95) return 'critical'
    if (utilization >= 0.8) return 'warning'
    if (metrics.errors.length > 10) return 'warning'
    return 'healthy'
  }

  /**
   * Export metrics to configured destinations
   */
  private exportMetrics(metrics: ConnectionMetricsExport): void {
    if (this.config.enableConsole) {
      this.exportToConsole(metrics)
    }

    if (this.config.enablePrometheus) {
      this.exportToPrometheus(metrics)
    }

    if (this.config.enableInfluxDB) {
      this.exportToInfluxDB(metrics)
    }
  }

  /**
   * Export metrics to console
   */
  private exportToConsole(metrics: ConnectionMetricsExport): void {
    const utilizationStatus = metrics.summary.poolUtilization >= 95 ? '🔴 CRITICAL' :
                              metrics.summary.poolUtilization >= 80 ? '🟡 WARNING' : '🟢 HEALTHY'

    console.log(`\n[ConnectionMetrics] ${utilizationStatus} - ${metrics.summary.poolUtilization}% utilized`)
    console.log(`  Active Connections: ${metrics.summary.totalActiveConnections}/${metrics.summary.totalConnections}`)
    console.log(`  Services: ${metrics.summary.servicesCount} | Alerts: ${metrics.summary.alertsCount}`)
    console.log(`  Peak Usage: ${metrics.summary.peakUsage} connections`)

    if (metrics.alerts.length > 0) {
      console.log('\n  Recent Alerts:')
      metrics.alerts.slice(-3).forEach(alert => {
        console.log(`    - ${alert.type.toUpperCase()}: ${alert.message}`)
      })
    }

    if (metrics.diagnostics.recommendations.length > 0) {
      console.log('\n  Recommendations:')
      metrics.diagnostics.recommendations.slice(0, 3).forEach(rec => {
        console.log(`    - ${rec}`)
      })
    }
  }

  /**
   * Export metrics to Prometheus format
   */
  private exportToPrometheus(metrics: ConnectionMetricsExport): void {
    // This would implement Prometheus metrics export
    // For now, just log the metrics in Prometheus format
    const prometheusMetrics = [
      `# HELP db_connections_active Current active database connections`,
      `# TYPE db_connections_active gauge`,
      `db_connections_active ${metrics.summary.totalActiveConnections}`,
      '',
      `# HELP db_connections_total Total database connections created`,
      `# TYPE db_connections_total counter`,
      `db_connections_total ${metrics.summary.totalConnections}`,
      '',
      `# HELP db_pool_utilization Database connection pool utilization percentage`,
      `# TYPE db_pool_utilization gauge`,
      `db_pool_utilization ${metrics.summary.poolUtilization}`,
      '',
      `# HELP db_services_count Number of active database services`,
      `# TYPE db_services_count gauge`,
      `db_services_count ${metrics.summary.servicesCount}`,
      '',
      `# HELP db_alerts_total Number of active database alerts`,
      `# TYPE db_alerts_total gauge`,
      `db_alerts_total ${metrics.summary.alertsCount}`
    ]

    // Add per-service metrics
    metrics.services.forEach(service => {
      prometheusMetrics.push(
        `# HELP db_service_connections_active Active connections for service ${service.name}`,
        `# TYPE db_service_connections_active gauge`,
        `db_service_connections_active{service="${service.name}"} ${service.activeConnections}`,
        '',
        `# HELP db_service_utilization Utilization percentage for service ${service.name}`,
        `# TYPE db_service_utilization gauge`,
        `db_service_utilization{service="${service.name}"} ${service.utilization}`
      )
    })

    // In a real implementation, this would expose the metrics on an HTTP endpoint
    if (process.env.NODE_ENV !== 'test') {
      console.log('[ConnectionMetrics] Prometheus metrics:')
      prometheusMetrics.forEach(line => console.log(line))
    }
  }

  /**
   * Export metrics to InfluxDB
   */
  private exportToInfluxDB(metrics: ConnectionMetricsExport): void {
    // This would implement InfluxDB metrics export
    // For now, just log that it would be sent
    console.log(`[ConnectionMetrics] Would send to InfluxDB: ${metrics.timestamp} - ${metrics.summary.poolUtilization}% utilization`)
  }

  /**
   * Cleanup old metrics based on retention period
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - this.config.retentionPeriod
    const initialCount = this.metricsHistory.length

    this.metricsHistory = this.metricsHistory.filter(metric => {
      const metricTime = new Date(metric.timestamp).getTime()
      return metricTime > cutoffTime
    })

    const removedCount = initialCount - this.metricsHistory.length
    if (removedCount > 0 && process.env.NODE_ENV !== 'test') {
      console.log(`[ConnectionMetrics] Cleaned up ${removedCount} old metrics entries`)
    }
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit?: number): ConnectionMetricsExport[] {
    if (limit) {
      return this.metricsHistory.slice(-limit)
    }
    return this.metricsHistory
  }

  /**
   * Get current metrics without collecting
   */
  getCurrentMetrics(): ConnectionMetricsExport {
    return this.generateMetricsExport()
  }

  /**
   * Export metrics to JSON file
   */
  async exportToJSON(filePath: string): Promise<void> {
    const fs = await import('fs/promises')
    const metrics = this.getCurrentMetrics()

    try {
      await fs.writeFile(filePath, JSON.stringify(metrics, null, 2))
      console.log(`[ConnectionMetrics] Exported metrics to ${filePath}`)
    } catch (error) {
      console.error(`[ConnectionMetrics] Error exporting to ${filePath}:`, error)
      throw error
    }
  }

  /**
   * Get aggregation statistics over time period
   */
  getAggregatedStats(hours: number = 24): any {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000)
    const recentMetrics = this.metricsHistory.filter(metric =>
      new Date(metric.timestamp).getTime() > cutoffTime
    )

    if (recentMetrics.length === 0) {
      return null
    }

    const utilizations = recentMetrics.map(m => m.summary.poolUtilization)
    const activeConnections = recentMetrics.map(m => m.summary.totalActiveConnections)

    return {
      period: `${hours}h`,
      dataPoints: recentMetrics.length,
      utilization: {
        average: utilizations.reduce((a, b) => a + b, 0) / utilizations.length,
        min: Math.min(...utilizations),
        max: Math.max(...utilizations),
        current: utilizations[utilizations.length - 1]
      },
      activeConnections: {
        average: activeConnections.reduce((a, b) => a + b, 0) / activeConnections.length,
        min: Math.min(...activeConnections),
        max: Math.max(...activeConnections),
        current: activeConnections[activeConnections.length - 1]
      },
      alerts: {
        total: recentMetrics.reduce((sum, m) => sum + m.summary.alertsCount, 0),
        peak: Math.max(...recentMetrics.map(m => m.summary.alertsCount))
      }
    }
  }

  /**
   * Configure metrics collection
   */
  updateConfig(newConfig: Partial<MetricsCollectionConfig>): void {
    this.config = { ...this.config, ...newConfig }

    // Restart collection if interval changed
    if (this.isCollecting && newConfig.collectionInterval) {
      this.stopCollection()
      this.startCollection()
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): MetricsCollectionConfig {
    return { ...this.config }
  }

  /**
   * Cleanup method for graceful shutdown
   */
  destroy(): void {
    this.stopCollection()
    this.metricsHistory = []
  }
}

// Export singleton instance and convenience functions
export const metricsCollector = ConnectionMetricsCollector.getInstance()

export function startMetricsCollection(config?: Partial<MetricsCollectionConfig>): void {
  const collector = ConnectionMetricsCollector.getInstance(config)
  collector.startCollection()
}

export function stopMetricsCollection(): void {
  metricsCollector.stopCollection()
}

export function getConnectionMetrics(): ConnectionMetricsExport {
  return metricsCollector.getCurrentMetrics()
}

export function getMetricsHistory(limit?: number): ConnectionMetricsExport[] {
  return metricsCollector.getMetricsHistory(limit)
}

export async function exportMetricsToJSON(filePath: string): Promise<void> {
  await metricsCollector.exportToJSON(filePath)
}

export function getAggregatedStats(hours: number = 24): any {
  return metricsCollector.getAggregatedStats(hours)
}