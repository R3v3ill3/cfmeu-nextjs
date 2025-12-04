/**
 * Database Connection Monitoring Initialization
 *
 * This module initializes and configures the database connection monitoring system.
 * It should be imported early in the application startup process.
 */

import { connectionMonitor } from './db-connection-monitor'
import { startMetricsCollection, metricsCollector } from './db-connection-metrics'

/**
 * Initialize database connection monitoring
 */
export function initializeConnectionMonitoring(): void {
  // Only initialize in production or when explicitly enabled
  const isProduction = process.env.NODE_ENV === 'production'
  const monitoringEnabled = process.env.DB_CONNECTION_MONITORING === 'true' || isProduction

  if (!monitoringEnabled) {
    console.log('[ConnectionMonitoring] Database connection monitoring disabled')
    return
  }

  console.log('[ConnectionMonitoring] Initializing database connection monitoring...')

  // Configure metrics collection based on environment
  const metricsConfig = {
    enableConsole: true,
    enablePrometheus: process.env.PROMETHEUS_ENABLED === 'true',
    enableInfluxDB: process.env.INFLUXDB_ENABLED === 'true',
    collectionInterval: parseInt(process.env.METRICS_COLLECTION_INTERVAL || '30000', 10),
    retentionPeriod: parseInt(process.env.METRICS_RETENTION_HOURS || '24', 10) * 60 * 60 * 1000,
    prometheusPort: parseInt(process.env.PROMETHEUS_PORT || '9090', 10),
    influxDbUrl: process.env.INFLUXDB_URL,
    influxDbToken: process.env.INFLUXDB_TOKEN,
    influxDbOrg: process.env.INFLUXDB_ORG,
    influxDbBucket: process.env.INFLUXDB_BUCKET
  }

  // Start metrics collection
  try {
    startMetricsCollection(metricsConfig)
    console.log('[ConnectionMonitoring] Metrics collection started successfully')
    console.log(`[ConnectionMonitoring] Collection interval: ${metricsConfig.collectionInterval}ms`)
    console.log(`[ConnectionMonitoring] Retention period: ${metricsConfig.retentionPeriod / (60 * 60 * 1000)} hours`)
  } catch (error) {
    console.error('[ConnectionMonitoring] Failed to start metrics collection:', error)
  }

  // Set up graceful shutdown
  if (typeof process !== 'undefined') {
    const gracefulShutdown = () => {
      console.log('[ConnectionMonitoring] Shutting down gracefully...')
      try {
        metricsCollector.destroy()
        connectionMonitor.destroy()
        console.log('[ConnectionMonitoring] Shutdown complete')
      } catch (error) {
        console.error('[ConnectionMonitoring] Error during shutdown:', error)
      }
      process.exit(0)
    }

    process.on('SIGTERM', gracefulShutdown)
    process.on('SIGINT', gracefulShutdown)
    process.on('SIGUSR2', gracefulShutdown) // For nodemon
  }

  console.log('[ConnectionMonitoring] Initialization complete')
}

/**
 * Get monitoring status and configuration
 */
export function getMonitoringStatus(): any {
  return {
    enabled: process.env.DB_CONNECTION_MONITORING === 'true' || process.env.NODE_ENV === 'production',
    environment: process.env.NODE_ENV,
    metrics: metricsCollector.getConfig(),
    connectionMonitor: {
      uptime: Date.now() - (connectionMonitor as any).startTime,
      registeredServices: (connectionMonitor as any).connections?.size || 0
    }
  }
}

/**
 * Export monitoring statistics for external systems
 */
export async function exportMonitoringData(): Promise<any> {
  const { getConnectionMetrics, getAggregatedStats } = await import('./db-connection-metrics')
  const { getDiagnostics } = await import('./db-connection-monitor')

  return {
    timestamp: new Date().toISOString(),
    current: getConnectionMetrics(),
    aggregated: {
      last1h: getAggregatedStats(1),
      last24h: getAggregatedStats(24),
      last7d: getAggregatedStats(168)
    },
    diagnostics: getDiagnostics(),
    status: getMonitoringStatus()
  }
}

// Auto-initialize if this module is imported
if (process.env.NODE_ENV !== 'test') {
  // Defer initialization to allow other modules to load first
  if (typeof setTimeout !== 'undefined') {
    setTimeout(initializeConnectionMonitoring, 1000)
  } else {
    initializeConnectionMonitoring()
  }
}