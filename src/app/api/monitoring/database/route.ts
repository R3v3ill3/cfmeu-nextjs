import { NextRequest, NextResponse } from 'next/server'
import {
  getConnectionStats,
  getDiagnostics,
  forceCleanup,
  getServiceMetrics
} from '@/lib/db-connection-monitor'
import {
  getConnectionMetrics,
  getMetricsHistory,
  exportMetricsToJSON,
  getAggregatedStats,
  metricsCollector
} from '@/lib/db-connection-metrics'
import {
  getMonitoringStatus,
  exportMonitoringData
} from '@/lib/db-connection-init'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'json'
    const detailed = searchParams.get('detailed') === 'true'
    const history = searchParams.get('history') === 'true'
    const aggregated = searchParams.get('aggregated') === 'true'
    const service = searchParams.get('service')
    const hours = parseInt(searchParams.get('hours') || '24', 10)

    let responseData: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      monitoring: getMonitoringStatus()
    }

    // Basic connection statistics
    responseData.connectionStats = getConnectionStats()
    responseData.currentMetrics = getConnectionMetrics()

    // Service-specific metrics if requested
    if (service) {
      const serviceMetrics = getServiceMetrics(service)
      if (serviceMetrics) {
        responseData.serviceMetrics = serviceMetrics
      } else {
        return NextResponse.json({
          status: 'error',
          error: `Service '${service}' not found`,
          availableServices: Object.keys(getConnectionStats().services)
        }, { status: 404 })
      }
    }

    // Include history if requested
    if (history) {
      const limit = parseInt(searchParams.get('limit') || '100', 10)
      responseData.history = getMetricsHistory(limit)
    }

    // Include aggregated stats if requested
    if (aggregated) {
      responseData.aggregated = {
        last1h: getAggregatedStats(1),
        last24h: getAggregatedStats(24),
        last7d: getAggregatedStats(168),
        custom: hours > 0 ? getAggregatedStats(hours) : null
      }
    }

    // Include detailed diagnostics if requested
    if (detailed) {
      responseData.diagnostics = getDiagnostics()
    }

    // Export monitoring data if comprehensive view requested
    if (searchParams.get('comprehensive') === 'true') {
      responseData.comprehensive = await exportMonitoringData()
    }

    // Handle different response formats
    switch (format) {
      case 'prometheus':
        const prometheusData = generatePrometheusMetrics(responseData.currentMetrics)
        return new NextResponse(prometheusData, {
          headers: {
            'Content-Type': 'text/plain; version=0.0.4'
          }
        })

      case 'csv':
        const csvData = generateCSV(responseData)
        return new NextResponse(csvData, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="db-connections-${Date.now()}.csv"`
          }
        })

      case 'json':
      default:
        // Pretty print if detailed view
        const prettyPrint = detailed || searchParams.get('pretty') === 'true'
        return NextResponse.json(responseData, {
          status: 200,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'X-Metrics-Timestamp': responseData.timestamp
          }
        })
    }

  } catch (error) {
    console.error('[DatabaseMonitoringAPI] Error:', error)

    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      connectionStats: {
        totalActiveConnections: 0,
        poolUtilization: 0,
        healthStatus: 'unknown'
      }
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
}

/**
 * POST endpoint for performing operations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { operation, ...params } = body

    let result: any = { timestamp: new Date().toISOString(), operation }

    switch (operation) {
      case 'cleanup':
        forceCleanup()
        result.message = 'Connection cleanup completed'
        result.connectionStats = getConnectionStats()
        break

      case 'export-json':
        const filePath = params.filePath || `/tmp/db-connections-${Date.now()}.json`
        await exportMetricsToJSON(filePath)
        result.filePath = filePath
        result.message = `Metrics exported to ${filePath}`
        break

      case 'start-collection':
        const { metricsCollector } = await import('@/lib/db-connection-metrics')
        metricsCollector.startCollection()
        result.message = 'Metrics collection started'
        break

      case 'stop-collection':
        const { metricsCollector: collector } = await import('@/lib/db-connection-metrics')
        collector.stopCollection()
        result.message = 'Metrics collection stopped'
        break

      case 'emergency-reset':
        // This should only be used in extreme cases
        if (process.env.NODE_ENV === 'production') {
          const authHeader = request.headers.get('authorization')
          if (!authHeader || !authHeader.includes('Bearer')) {
            return NextResponse.json({
              error: 'Authorization required for emergency reset in production'
            }, { status: 401 })
          }
        }

        const { connectionMonitor } = await import('@/lib/db-connection-monitor')
        connectionMonitor.emergencyReset()

        result.operation = 'emergency-reset'
        result.message = 'Emergency reset completed - all connections cleared'
        result.connectionStats = getConnectionStats()
        break

      default:
        return NextResponse.json({
          error: 'Invalid operation',
          validOperations: [
            'cleanup',
            'export-json',
            'start-collection',
            'stop-collection',
            'emergency-reset'
          ]
        }, { status: 400 })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('[DatabaseMonitoringAPI] Error performing operation:', error)

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * Generate Prometheus metrics format
 */
function generatePrometheusMetrics(metrics: any): string {
  const lines = [
    '# HELP db_connections_active Current active database connections',
    '# TYPE db_connections_active gauge',
    `db_connections_active ${metrics.summary.totalActiveConnections}`,
    '',
    '# HELP db_connections_total Total database connections created',
    '# TYPE db_connections_total counter',
    `db_connections_total ${metrics.summary.totalConnections}`,
    '',
    '# HELP db_pool_utilization Database connection pool utilization percentage',
    '# TYPE db_pool_utilization gauge',
    `db_pool_utilization ${metrics.summary.poolUtilization}`,
    '',
    '# HELP db_services_count Number of active database services',
    '# TYPE db_services_count gauge',
    `db_services_count ${metrics.summary.servicesCount}`,
    '',
    '# HELP db_alerts_total Number of active database alerts',
    '# TYPE db_alerts_total gauge',
    `db_alerts_total ${metrics.summary.alertsCount}`
  ]

  // Add per-service metrics
  metrics.services.forEach((service: any) => {
    lines.push(
      '',
      `# HELP db_service_connections_active Active connections for service ${service.name}`,
      `# TYPE db_service_connections_active gauge`,
      `db_service_connections_active{service="${service.name}"} ${service.activeConnections}`,
      '',
      `# HELP db_service_utilization Utilization percentage for service ${service.name}`,
      `# TYPE db_service_utilization gauge`,
      `db_service_utilization{service="${service.name}"} ${service.utilization}`,
      '',
      `# HELP db_service_errors_total Total errors for service ${service.name}`,
      `# TYPE db_service_errors_total gauge`,
      `db_service_errors_total{service="${service.name}"} ${service.errorCount}`
    )
  })

  return lines.join('\n')
}

/**
 * Generate CSV format
 */
function generateCSV(data: any): string {
  const headers = [
    'timestamp',
    'totalActiveConnections',
    'totalConnections',
    'poolUtilization',
    'healthStatus',
    'servicesCount',
    'alertsCount'
  ]

  const rows = [headers.join(',')]

  // Add current metrics
  const currentRow = [
    data.currentMetrics.timestamp,
    data.currentMetrics.summary.totalActiveConnections,
    data.currentMetrics.summary.totalConnections,
    data.currentMetrics.summary.poolUtilization,
    data.currentMetrics.summary.healthStatus,
    data.currentMetrics.summary.servicesCount,
    data.currentMetrics.summary.alertsCount
  ]
  rows.push(currentRow.join(','))

  // Add history if available
  if (data.history && Array.isArray(data.history)) {
    data.history.forEach((metrics: any) => {
      const historyRow = [
        metrics.timestamp,
        metrics.summary.totalActiveConnections,
        metrics.summary.totalConnections,
        metrics.summary.poolUtilization,
        metrics.summary.healthStatus,
        metrics.summary.servicesCount,
        metrics.summary.alertsCount
      ]
      rows.push(historyRow.join(','))
    })
  }

  return rows.join('\n')
}