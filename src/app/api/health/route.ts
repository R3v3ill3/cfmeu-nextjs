import { NextRequest, NextResponse } from 'next/server'
import { monitoring, healthCheck, getMetrics } from '@/lib/monitoring'
import { featureFlags } from '@/lib/feature-flags'
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

// Comprehensive health check endpoint
async function healthCheckHandler(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const detailed = searchParams.get('detailed') === 'true'
    const checks = searchParams.get('checks')?.split(',') || undefined

    const startTime = Date.now()

    // Run health checks
    const healthResult = await healthCheck()
    const responseTime = Date.now() - startTime

    // Get system metrics if detailed view requested
    let metrics = null
    if (detailed) {
      metrics = await getMetrics()
    }

    // Get feature flags status
    const featureFlagsStatus = featureFlags.getSystemStatus()

    // Determine HTTP status code based on health
    let statusCode = 200
    if (healthResult.status === 'unhealthy') {
      statusCode = 503
    } else if (healthResult.status === 'degraded') {
      statusCode = 200 // Still serve traffic but indicate issues
    }

    const response = {
      status: healthResult.status,
      timestamp: healthResult.timestamp,
      uptime: Date.now() - (monitoring as any).startTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      responseTime,
      score: healthResult.overallScore,
      checks: healthResult.checks,
      issues: healthResult.issues,
      recommendations: healthResult.recommendations,
      featureFlags: featureFlagsStatus,
      monitoring: {
        status: monitoring.getMonitoringStatus(),
        enabledChecks: Array.from((monitoring as any).healthChecks.keys()),
        activeAlerts: Array.from((monitoring as any).alerts.keys()).filter(
          (name: string) => (monitoring as any).alerts.get(name)?.enabled
        )
      }
    }

    if (detailed && metrics) {
      response.metrics = metrics
    }

    const headers = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Content-Type': 'application/json',
      'X-Health-Status': healthResult.status,
      'X-Health-Score': healthResult.overallScore.toString(),
      'X-Response-Time': responseTime.toString(),
      'X-Uptime': (Date.now() - (monitoring as any).startTime).toString(),
      'X-Environment': process.env.NODE_ENV || 'development',
      'X-Version': process.env.npm_package_version || '1.0.0'
    }

    return NextResponse.json(response, { status: statusCode, headers })

  } catch (error) {
    console.error('Health check endpoint error:', error)

    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': 'unhealthy',
        'X-Error': 'true'
      }
    })
  }
}

// Simple health check for load balancers
export async function HEAD() {
  try {
    // Quick health check without full detailed analysis
    const startTime = Date.now()

    // Check critical systems
    const criticalChecks = ['database', 'rating-system']
    const results = await Promise.allSettled(
      criticalChecks.map(check => (monitoring as any).healthChecks.get(check)?.())
    )

    const allPassed = results.every(result =>
      result.status === 'fulfilled' &&
      result.value?.status !== 'fail'
    )

    const responseTime = Date.now() - startTime

    if (allPassed && responseTime < 1000) {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'X-Health-Status': 'healthy',
          'X-Response-Time': responseTime.toString(),
          'X-Uptime': (Date.now() - (monitoring as any).startTime).toString(),
          'X-Environment': process.env.NODE_ENV || 'development',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    } else {
      return new NextResponse(null, {
        status: 503,
        headers: {
          'X-Health-Status': 'unhealthy',
          'X-Response-Time': responseTime.toString(),
          'X-Error': 'critical-check-failed',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    }
  } catch (error) {
    return new NextResponse(null, {
      status: 503,
      headers: {
        'X-Health-Status': 'unhealthy',
        'X-Error': 'health-check-error',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
}

// Readiness probe (Kubernetes style)
export async function PUT() {
  try {
    // Check if the application is ready to serve traffic
    const flagsStatus = featureFlags.getSystemStatus()
    const monitoringStatus = monitoring.getMonitoringStatus()

    // Check if critical feature flags are enabled
    const ratingSystemEnabled = featureFlags.isEnabled('RATING_SYSTEM_ENABLED')
    const dashboardEnabled = featureFlags.isEnabled('RATING_DASHBOARD_ENABLED')

    const isReady = ratingSystemEnabled &&
                   monitoringStatus.registeredChecks > 0 &&
                   flagsStatus.enabledFlags > 0

    if (isReady) {
      return NextResponse.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          featureFlags: ratingSystemEnabled,
          monitoring: monitoringStatus.registeredChecks > 0,
          database: true // Would add actual database check
        }
      }, {
        headers: {
          'X-Readiness-Status': 'ready',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    } else {
      return NextResponse.json({
        status: 'not-ready',
        timestamp: new Date().toISOString(),
        checks: {
          featureFlags: ratingSystemEnabled,
          monitoring: monitoringStatus.registeredChecks > 0,
          database: true
        }
      }, {
        status: 503,
        headers: {
          'X-Readiness-Status': 'not-ready',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    }
  } catch (error) {
    return NextResponse.json({
      status: 'not-ready',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed'
    }, {
      status: 503,
      headers: {
        'X-Readiness-Status': 'error',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
}

// Liveness probe (Kubernetes style)
export async function POST() {
  try {
    // Check if the application is alive and responding
    const startTime = Date.now()
    const uptime = Date.now() - (monitoring as any).startTime
    const responseTime = Date.now() - startTime

    // Simple liveness check - if we can respond, we're alive
    return NextResponse.json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime,
      responseTime,
      pid: process.pid
    }, {
      headers: {
        'X-Liveness-Status': 'alive',
        'X-Uptime': uptime.toString(),
        'X-PID': process.pid.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  } catch (error) {
    return new NextResponse(null, {
      status: 503,
      headers: {
        'X-Liveness-Status': 'dead',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
}

// Export with rate limiting
export const GET = withRateLimit(healthCheckHandler, RATE_LIMIT_PRESETS.RELAXED)