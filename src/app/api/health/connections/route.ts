import { NextRequest, NextResponse } from 'next/server'
import {
  getConnectionStats,
  getServiceMetrics,
  getPoolUtilization,
  getDiagnostics,
  forceCleanup
} from '@/lib/db-connection-monitor'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const detailed = searchParams.get('detailed') === 'true'
    const diagnostics = searchParams.get('diagnostics') === 'true'
    const cleanup = searchParams.get('cleanup') === 'true'

    // Perform cleanup if requested
    if (cleanup) {
      forceCleanup()
    }

    // Get basic connection statistics
    const connectionStats = getConnectionStats()
    const poolUtilization = getPoolUtilization()

    // Build response data
    const responseData: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      summary: {
        totalActiveConnections: connectionStats.totalActiveConnections,
        totalConnections: connectionStats.totalConnections,
        poolUtilization: Math.round(poolUtilization * 100),
        healthStatus: connectionStats.healthStatus,
        activeServices: Object.keys(connectionStats.services).length,
        recentAlerts: connectionStats.alerts.length
      },
      services: Object.entries(connectionStats.services).map(([name, metrics]) => ({
        name,
        activeConnections: metrics.activeConnections,
        totalConnections: metrics.totalConnections,
        maxPoolSize: metrics.maxPoolSize,
        utilization: Math.round((metrics.activeConnections / metrics.maxPoolSize) * 100),
        lastActivity: new Date(metrics.lastActivity).toISOString(),
        errorCount: metrics.errors.length,
        status: metrics.activeConnections / metrics.maxPoolSize >= 0.95 ? 'critical' :
               metrics.activeConnections / metrics.maxPoolSize >= 0.8 ? 'warning' : 'healthy'
      })),
      recentAlerts: connectionStats.alerts.slice(-10).map(alert => ({
        type: alert.type,
        serviceName: alert.serviceName,
        message: alert.message,
        usage: Math.round(alert.usage * 100),
        threshold: Math.round(alert.threshold * 100),
        timestamp: new Date(alert.timestamp).toISOString()
      })),
      peakUsage: {
        connections: connectionStats.peakUsage.connections,
        timestamp: new Date(connectionStats.peakUsage.timestamp).toISOString()
      }
    }

    // Add detailed metrics if requested
    if (detailed) {
      responseData.detailedMetrics = {
        ...connectionStats,
        services: connectionStats.services
      }

      // Add individual service metrics
      responseData.serviceMetrics = {}
      for (const serviceName of Object.keys(connectionStats.services)) {
        const serviceMetrics = getServiceMetrics(serviceName)
        if (serviceMetrics) {
          responseData.serviceMetrics[serviceName] = serviceMetrics
        }
      }
    }

    // Add diagnostics if requested
    if (diagnostics) {
      responseData.diagnostics = getDiagnostics()
    }

    // Determine HTTP status based on connection health
    let httpStatus = 200
    if (connectionStats.healthStatus === 'critical') {
      httpStatus = 503  // Service Unavailable
    } else if (connectionStats.healthStatus === 'warning') {
      httpStatus = 200  // OK but with warnings
    }

    // Add appropriate headers
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Connection-Pool-Utilization': Math.round(poolUtilization * 100).toString(),
      'X-Connection-Health-Status': connectionStats.healthStatus,
      'X-Active-Connections': connectionStats.totalActiveConnections.toString()
    })

    return new NextResponse(JSON.stringify(responseData, null, detailed ? 2 : 0), {
      status: httpStatus,
      headers
    })

  } catch (error) {
    console.error('[HealthAPI] Error getting connection health:', error)

    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      summary: {
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
 * POST endpoint to perform cleanup operations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { operation } = body

    let result: any = { timestamp: new Date().toISOString() }

    switch (operation) {
      case 'cleanup':
        forceCleanup()
        result.operation = 'cleanup'
        result.message = 'Connection cleanup completed'
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

        // Import the monitor for emergency reset
        const { connectionMonitor } = await import('@/lib/db-connection-monitor')
        connectionMonitor.emergencyReset()

        result.operation = 'emergency-reset'
        result.message = 'Emergency reset completed - all connections cleared'
        break

      default:
        return NextResponse.json({
          error: 'Invalid operation. Supported operations: cleanup, emergency-reset'
        }, { status: 400 })
    }

    // Return updated stats after operation
    result.connectionStats = getConnectionStats()

    return NextResponse.json(result)

  } catch (error) {
    console.error('[HealthAPI] Error performing operation:', error)

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}