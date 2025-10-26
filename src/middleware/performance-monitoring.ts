import { NextRequest, NextResponse } from 'next/server'
import { requestMetric, createPerformanceMetrics } from '@/lib/performance/metrics'

interface PerformanceMiddlewareConfig {
  enableMetrics?: boolean
  enableCacheControl?: boolean
  enableCompression?: boolean
  slowQueryThreshold?: number
}

/**
 * Performance monitoring middleware for API routes and page requests
 * Tracks response times, cache hits, and performance bottlenecks
 */
export function performanceMiddleware(config: PerformanceMiddlewareConfig = {}) {
  const {
    enableMetrics = process.env.NODE_ENV === 'production',
    enableCacheControl = true,
    enableCompression = true,
    slowQueryThreshold = 1000 // 1 second
  } = config

  return async function middleware(request: NextRequest) {
    const startTime = Date.now()
    const url = request.nextUrl

    // Generate unique request ID for tracking
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Create response object
    const response = NextResponse.next({
      request: {
        headers: new Headers(request.headers)
      }
    })

    // Add request ID to response headers for debugging
    response.headers.set('X-Request-ID', requestId)
    response.headers.set('X-Start-Time', startTime.toString())

    // Performance monitoring for API routes
    if (url.pathname.startsWith('/api/')) {
      response.headers.set('X-API-Request', 'true')

      // Enhanced cache control for organizing metrics endpoint
      if (url.pathname.includes('organizing-metrics')) {
        if (enableCacheControl) {
          response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
          response.headers.set('Vercel-CDN-Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
        }

        // Track organizing metrics performance
        if (enableMetrics) {
          const endTime = Date.now()
          const duration = endTime - startTime

          response.headers.set('X-Response-Time', `${duration}ms`)
          response.headers.set('X-Performance-Score', duration < slowQueryThreshold ? 'FAST' : 'SLOW')

          // Log performance metrics
          if (duration > slowQueryThreshold) {
            console.warn(`🐌 Slow API Request: ${url.pathname} took ${duration}ms (Request: ${requestId})`)
          } else {
            console.info(`✅ Fast API Request: ${url.pathname} took ${duration}ms`)
          }

          // Send metrics to monitoring service
          try {
            await requestMetric({
              endpoint: url.pathname,
              method: request.method,
              duration,
              statusCode: response.status,
              userAgent: request.headers.get('user-agent') || '',
              timestamp: new Date().toISOString(),
              requestId,
              isSlow: duration > slowQueryThreshold
            })
          } catch (error) {
            console.error('Failed to record performance metric:', error)
          }
        }
      }

      // General API performance tracking
      else if (enableMetrics) {
        // Wrap the response to track completion time
        const originalJson = response.json
        response.json = async function(...args: any[]) {
          const endTime = Date.now()
          const duration = endTime - startTime

          response.headers.set('X-Response-Time', `${duration}ms`)

          // Log slow API requests
          if (duration > slowQueryThreshold) {
            console.warn(`🐌 Slow API: ${url.pathname} - ${duration}ms`)
          }

          return originalJson.apply(this, args)
        }
      }
    }

    // Page performance monitoring
    if (url.pathname.startsWith('/')) {
      // Add performance hints for mobile optimization
      if (enableCompression) {
        response.headers.set('Content-Encoding', 'gzip')
      }

      // Add mobile optimization headers
      if (request.headers.get('user-agent')?.match(/Mobile|Android|iPhone/)) {
        response.headers.set('X-Mobile-Optimized', 'true')
        response.headers.set('Vary', 'User-Agent')
      }

      // Preload critical resources for dashboard pages
      if (url.pathname.includes('dashboard') || url.pathname.includes('rating')) {
        response.headers.set('Link', [
          '</api/dashboard/organizing-metrics>; rel=preload; as=fetch',
          '</styles/mobile.css>; rel=preload; as=style'
        ].join(', '))
      }
    }

    // Add security and performance headers
    if (enableCacheControl) {
      // Different cache strategies for different content types
      if (url.pathname.includes('/api/')) {
        // API endpoints - shorter cache
        response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
      } else if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
        // Static assets - longer cache
        response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      } else {
        // HTML pages - no cache
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
      }
    }

    // Compression headers
    if (enableCompression) {
      response.headers.set('Vary', 'Accept-Encoding')
      response.headers.set('Content-Encoding', 'gzip')
    }

    // Device detection headers for client-side optimization
    const userAgent = request.headers.get('user-agent') || ''
    const isMobile = /Mobile|Android|iPhone|iPad|iPod/.test(userAgent)
    const isSlowDevice = /Android.*[234]/.test(userAgent) || /iPhone.*[6789]/.test(userAgent)

    if (isMobile) {
      response.headers.set('X-Device-Type', 'mobile')
    } else {
      response.headers.set('X-Device-Type', 'desktop')
    }

    if (isSlowDevice) {
      response.headers.set('X-Device-Class', 'low-end')
    } else {
      response.headers.set('X-Device-Class', 'high-end')
    }

    return response
  }
}

// Default export with standard configuration
export default performanceMiddleware({
  enableMetrics: process.env.NODE_ENV === 'production',
  enableCacheControl: true,
  enableCompression: true,
  slowQueryThreshold: 1000
})

// Performance monitoring utilities
export class PerformanceTracker {
  private static metrics: Map<string, number[]> = new Map()

  static trackRequest(endpoint: string, duration: number) {
    if (!this.metrics.has(endpoint)) {
      this.metrics.set(endpoint, [])
    }
    this.metrics.get(endpoint)!.push(duration)
  }

  static getAverageResponseTime(endpoint: string): number {
    const times = this.metrics.get(endpoint) || []
    if (times.length === 0) return 0
    return times.reduce((a, b) => a + b, 0) / times.length
  }

  static getSlowEndpoints(threshold: number = 1000): string[] {
    const slowEndpoints: string[] = []

    for (const [endpoint, times] of this.metrics.entries()) {
      const average = this.getAverageResponseTime(endpoint)
      if (average > threshold) {
        slowEndpoints.push(endpoint)
      }
    }

    return slowEndpoints
  }

  static getPerformanceReport() {
    const report: Record<string, any> = {
      totalRequests: 0,
      averageResponseTime: 0,
      slowEndpoints: [],
      endpointMetrics: {}
    }

    let totalTime = 0
    let totalRequests = 0

    for (const [endpoint, times] of this.metrics.entries()) {
      const average = times.reduce((a, b) => a + b, 0) / times.length
      const max = Math.max(...times)
      const min = Math.min(...times)

      report.endpointMetrics[endpoint] = {
        requests: times.length,
        average: Math.round(average),
        min,
        max,
        isSlow: average > 1000
      }

      if (average > 1000) {
        report.slowEndpoints.push(endpoint)
      }

      totalTime += times.reduce((a, b) => a + b, 0)
      totalRequests += times.length
    }

    report.totalRequests = totalRequests
    report.averageResponseTime = totalRequests > 0 ? Math.round(totalTime / totalRequests) : 0

    return report
  }

  static reset() {
    this.metrics.clear()
  }
}

// Create a performance monitoring API endpoint
export async function registerPerformanceAPI() {
  // This would be called in your API route setup
  return {
    GET: async () => {
      const report = PerformanceTracker.getPerformanceReport()
      return Response.json(report)
    },
    POST: async (request: Request) => {
      PerformanceTracker.reset()
      return Response.json({ message: 'Performance metrics reset' })
    }
  }
}