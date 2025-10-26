/**
 * Mobile Performance Monitoring System
 *
 * Tracks and analyzes mobile performance metrics:
 * - Core Web Vitals monitoring for mobile users
 * - Mobile bundle size monitoring and alerts
 * - Mobile performance analytics and reporting
 * - Mobile error tracking and retry logic
 * - Network performance analysis
 */

import { isMobile, isSlowConnection, getDeviceInfo } from '@/lib/device'

// Core Web Vitals thresholds for mobile
const MOBILE_CWV_THRESHOLDS = {
  LCP: { good: 2.5, needsImprovement: 4.0 }, // Largest Contentful Paint (seconds)
  FID: { good: 100, needsImprovement: 300 },  // First Input Delay (milliseconds)
  CLS: { good: 0.1, needsImprovement: 0.25 }, // Cumulative Layout Shift
  FCP: { good: 1.8, needsImprovement: 3.0 }, // First Contentful Paint (seconds)
  TTFB: { good: 800, needsImprovement: 1800 }, // Time to First Byte (milliseconds)
  INP: { good: 200, needsImprovement: 500 }, // Interaction to Next Paint (milliseconds)
}

// Mobile performance targets
const MOBILE_PERFORMANCE_TARGETS = {
  pageLoadTime: { target4G: 1500, target3G: 3000 }, // milliseconds
  bundleSize: { initial: 1.5 * 1024 * 1024, total: 5 * 1024 * 1024 }, // bytes
  timeToInteractive: { target: 2000 }, // milliseconds
  imageOptimization: { reductionTarget: 0.5 }, // 50% reduction
}

interface PerformanceMetrics {
  // Core Web Vitals
  lcp?: number
  fid?: number
  cls?: number
  fcp?: number
  ttfb?: number
  inp?: number

  // Additional metrics
  pageLoadTime?: number
  domContentLoaded?: number
  timeToInteractive?: number
  bundleSize?: number
  imageOptimizationRatio?: number

  // Mobile-specific metrics
  networkType?: string
  deviceMemory?: number
  hardwareConcurrency?: number
  effectiveConnectionType?: string
  rtt?: number // Round-trip time

  // Custom metrics
  errorRate?: number
  retryRate?: number
  cacheHitRate?: number

  // Metadata
  timestamp: number
  url: string
  userAgent: string
  deviceInfo: any
}

interface PerformanceAlert {
  type: 'warning' | 'error' | 'info'
  metric: keyof PerformanceMetrics
  threshold: number
  actual: number
  message: string
  timestamp: number
}

interface BundleAnalysis {
  name: string
  size: number
  parsedSize: number
  gzippedSize: number
  modules: string[]
  isCritical: boolean
}

class MobilePerformanceMonitor {
  private metrics: PerformanceMetrics = {
    timestamp: Date.now(),
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    deviceInfo: {},
  }

  private alerts: PerformanceAlert[] = []
  private observers: Map<string, PerformanceObserver> = new Map()
  private isMonitoring = false
  private reportInterval?: NodeJS.Timeout
  private bundleMetrics: BundleAnalysis[] = []

  constructor() {
    if (typeof window !== 'undefined') {
      this.metrics.deviceInfo = getDeviceInfo()
      this.setupPerformanceObservers()
      this.monitorBundleSize()
    }
  }

  // Initialize performance monitoring
  startMonitoring(): void {
    if (this.isMonitoring || typeof window === 'undefined') return

    this.isMonitoring = true
    console.log('📱 Starting mobile performance monitoring...')

    // Start periodic reporting
    this.reportInterval = setInterval(() => {
      this.collectMetrics()
      this.analyzePerformance()
      this.reportMetrics()
    }, 30000) // Report every 30 seconds

    // Page load metrics
    this.collectPageLoadMetrics()

    // Network information
    this.collectNetworkMetrics()

    // Error tracking
    this.setupErrorTracking()
  }

  // Stop performance monitoring
  stopMonitoring(): void {
    if (!this.isMonitoring) return

    this.isMonitoring = false
    this.observers.forEach(observer => observer.disconnect())
    this.observers.clear()

    if (this.reportInterval) {
      clearInterval(this.reportInterval)
    }

    console.log('⏹️ Mobile performance monitoring stopped')
  }

  // Set up performance observers for Core Web Vitals
  private setupPerformanceObservers(): void {
    if (!window.PerformanceObserver) return

    // Largest Contentful Paint
    this.observePerformanceEntry('largest-contentful-paint', (entries) => {
      const lastEntry = entries[entries.length - 1]
      this.metrics.lcp = lastEntry.startTime
    })

    // First Input Delay
    this.observePerformanceEntry('first-input', (entries) => {
      entries.forEach(entry => {
        this.metrics.fid = entry.processingStart - entry.startTime
      })
    })

    // Cumulative Layout Shift
    this.observePerformanceEntry('layout-shift', (entries) => {
      let clsValue = 0
      entries.forEach(entry => {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value
        }
      })
      this.metrics.cls = clsValue
    })

    // First Contentful Paint
    this.observePerformanceEntry('paint', (entries) => {
      entries.forEach(entry => {
        if (entry.name === 'first-contentful-paint') {
          this.metrics.fcp = entry.startTime
        }
      })
    })

    // Interaction to Next Paint (if supported)
    this.observePerformanceEntry('event', (entries) => {
      entries.forEach(entry => {
        if ((entry as any).interactionId) {
          const inp = entry.processingStart - entry.startTime
          this.metrics.inp = Math.max(this.metrics.inp || 0, inp)
        }
      })
    })
  }

  private observePerformanceEntry(
    type: string,
    callback: (entries: PerformanceEntry[]) => void
  ): void {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries())
      })
      observer.observe({ type, buffered: true })
      this.observers.set(type, observer)
    } catch (error) {
      console.warn(`Performance observer not supported for ${type}:`, error)
    }
  }

  // Collect page load metrics
  private collectPageLoadMetrics(): void {
    if (!window.performance?.timing) return

    const timing = window.performance.timing
    const navigation = window.performance.navigation

    // Calculate load times
    this.metrics.pageLoadTime = timing.loadEventEnd - timing.navigationStart
    this.metrics.domContentLoaded = timing.domContentLoadedEventEnd - timing.navigationStart

    // Time to First Byte
    this.metrics.ttfb = timing.responseStart - timing.navigationStart

    // Estimate Time to Interactive
    this.metrics.timeToInteractive = timing.loadEventEnd - timing.domContentLoadedEventEnd
  }

  // Collect network metrics
  private collectNetworkMetrics(): void {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection

    if (connection) {
      this.metrics.networkType = connection.effectiveType
      this.metrics.effectiveConnectionType = connection.effectiveType
      this.metrics.rtt = connection.rtt
    }

    if ((navigator as any).deviceMemory) {
      this.metrics.deviceMemory = (navigator as any).deviceMemory
    }

    if ((navigator as any).hardwareConcurrency) {
      this.metrics.hardwareConcurrency = (navigator as any).hardwareConcurrency
    }
  }

  // Monitor bundle size using Webpack Bundle Analyzer data
  private monitorBundleSize(): void {
    if (typeof window === 'undefined') return

    // Try to get bundle information from webpack
    if ((window as any).__webpack_public_path__ || (window as any).__webpack_require__) {
      // This would need to be implemented with webpack plugins
      // For now, we'll use an approximation
      setTimeout(() => {
        this.estimateBundleSize()
      }, 2000)
    }
  }

  private estimateBundleSize(): void {
    if (!window.performance?.getEntriesByType) return

    const resources = window.performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    const jsResources = resources.filter(resource =>
      resource.name.endsWith('.js') || resource.name.endsWith('.mjs')
    )

    let totalSize = 0
    let criticalSize = 0

    jsResources.forEach(resource => {
      const size = resource.transferSize || resource.encodedBodySize || 0
      totalSize += size

      // Assume critical chunks are loaded early
      if (resource.startTime < 1000) {
        criticalSize += size
      }
    })

    this.metrics.bundleSize = totalSize

    // Add to bundle metrics
    this.bundleMetrics.push({
      name: 'total',
      size: totalSize,
      parsedSize: totalSize * 1.5, // Estimate
      gzippedSize: totalSize * 0.3, // Estimate
      modules: jsResources.map(r => r.name),
      isCritical: true,
    })
  }

  // Set up error tracking
  private setupErrorTracking(): void {
    if (typeof window === 'undefined') return

    let errorCount = 0
    let totalEvents = 0

    window.addEventListener('error', (event) => {
      errorCount++
      totalEvents++
      this.metrics.errorRate = errorCount / totalEvents
    })

    window.addEventListener('unhandledrejection', (event) => {
      errorCount++
      totalEvents++
      this.metrics.errorRate = errorCount / totalEvents
    })
  }

  // Collect current metrics
  private collectMetrics(): void {
    if (typeof window === 'undefined') return

    // Update timestamp
    this.metrics.timestamp = Date.now()

    // Recalculate time-dependent metrics
    if (window.performance?.now) {
      const now = window.performance.now()
      if (!this.metrics.timeToInteractive) {
        this.metrics.timeToInteractive = now
      }
    }

    // Update network metrics
    this.collectNetworkMetrics()

    // Calculate cache hit rate (if using service worker)
    this.calculateCacheHitRate()
  }

  private calculateCacheHitRate(): void {
    if (!window.performance?.getEntriesByType) return

    const resources = window.performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    const cacheHits = resources.filter(resource =>
      resource.transferSize === 0 && resource.decodedBodySize > 0
    )

    this.metrics.cacheHitRate = cacheHits.length / resources.length
  }

  // Analyze performance and create alerts
  private analyzePerformance(): void {
    if (!isMobile()) return

    this.alerts = []

    // Core Web Vitals analysis
    this.analyzeMetric('LCP', this.metrics.lcp, MOBILE_CWV_THRESHOLDS.LCP)
    this.analyzeMetric('FID', this.metrics.fid, MOBILE_CWV_THRESHOLDS.FID)
    this.analyzeMetric('CLS', this.metrics.cls, MOBILE_CWV_THRESHOLDS.CLS)
    this.analyzeMetric('FCP', this.metrics.fcp, MOBILE_CWV_THRESHOLDS.FCP)
    this.analyzeMetric('TTFB', this.metrics.ttfb, MOBILE_CWV_THRESHOLDS.TTFB)
    this.analyzeMetric('INP', this.metrics.inp, MOBILE_CWV_THRESHOLDS.INP)

    // Mobile-specific targets
    this.analyzeMobileTargets()

    // Bundle size analysis
    this.analyzeBundleSize()
  }

  private analyzeMetric(
    metric: keyof PerformanceMetrics,
    value: number | undefined,
    thresholds: { good: number; needsImprovement: number }
  ): void {
    if (value === undefined) return

    if (value > thresholds.needsImprovement) {
      this.alerts.push({
        type: 'error',
        metric,
        threshold: thresholds.needsImprovement,
        actual: value,
        message: `${metric} is significantly above recommended threshold`,
        timestamp: Date.now(),
      })
    } else if (value > thresholds.good) {
      this.alerts.push({
        type: 'warning',
        metric,
        threshold: thresholds.good,
        actual: value,
        message: `${metric} needs improvement`,
        timestamp: Date.now(),
      })
    }
  }

  private analyzeMobileTargets(): void {
    if (!this.metrics.pageLoadTime) return

    const connectionType = this.metrics.effectiveConnectionType
    const target = connectionType === 'slow-2g' || connectionType === '2g'
      ? MOBILE_PERFORMANCE_TARGETS.pageLoadTime.target3G
      : MOBILE_PERFORMANCE_TARGETS.pageLoadTime.target4G

    if (this.metrics.pageLoadTime > target) {
      this.alerts.push({
        type: 'error',
        metric: 'pageLoadTime',
        threshold: target,
        actual: this.metrics.pageLoadTime,
        message: `Page load time exceeds target for ${connectionType}`,
        timestamp: Date.now(),
      })
    }
  }

  private analyzeBundleSize(): void {
    if (!this.metrics.bundleSize) return

    const target = MOBILE_PERFORMANCE_TARGETS.bundleSize.initial

    if (this.metrics.bundleSize > target) {
      this.alerts.push({
        type: 'warning',
        metric: 'bundleSize',
        threshold: target,
        actual: this.metrics.bundleSize,
        message: `Bundle size exceeds mobile target`,
        timestamp: Date.now(),
      })
    }
  }

  // Report metrics to analytics
  private reportMetrics(): void {
    if (this.alerts.length > 0) {
      console.group('📱 Mobile Performance Alerts')
      this.alerts.forEach(alert => {
        console[alert.type === 'error' ? 'error' : alert.type === 'warning' ? 'warn' : 'log'](
          `${alert.metric}: ${alert.actual.toFixed(2)} (target: ${alert.threshold}) - ${alert.message}`
        )
      })
      console.groupEnd()
    }

    // Send to analytics service (would need implementation)
    this.sendToAnalytics()
  }

  private sendToAnalytics(): void {
    // Implementation would send metrics to analytics service
    // For now, just log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Mobile Performance Metrics:', this.metrics)
    }
  }

  // Public API methods

  // Get current metrics
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  // Get current alerts
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts]
  }

  // Get bundle analysis
  getBundleAnalysis(): BundleAnalysis[] {
    return [...this.bundleMetrics]
  }

  // Get performance score (0-100)
  getPerformanceScore(): number {
    let score = 100
    const weights = {
      LCP: 0.25,
      FID: 0.15,
      CLS: 0.20,
      FCP: 0.15,
      TTFB: 0.15,
      bundleSize: 0.10,
    }

    Object.entries(weights).forEach(([metric, weight]) => {
      const value = this.metrics[metric as keyof PerformanceMetrics] as number
      if (value === undefined) return

      const thresholds = MOBILE_CWV_THRESHOLDS[metric as keyof typeof MOBILE_CWV_THRESHOLDS]
      if (thresholds) {
        if (value > thresholds.needsImprovement) {
          score -= weight * 100
        } else if (value > thresholds.good) {
          score -= weight * 50
        }
      }
    })

    return Math.max(0, Math.round(score))
  }

  // Get optimization recommendations
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = []

    if (this.metrics.lcp && this.metrics.lcp > MOBILE_CWV_THRESHOLDS.LCP.good) {
      recommendations.push('Optimize largest contentful paint: use optimized images, lazy load content')
    }

    if (this.metrics.fid && this.metrics.fid > MOBILE_CWV_THRESHOLDS.FID.good) {
      recommendations.push('Reduce first input delay: minimize JavaScript execution time')
    }

    if (this.metrics.cls && this.metrics.cls > MOBILE_CWV_THRESHOLDS.CLS.good) {
      recommendations.push('Prevent layout shifts: specify image dimensions, avoid dynamic content insertion')
    }

    if (this.metrics.bundleSize && this.metrics.bundleSize > MOBILE_PERFORMANCE_TARGETS.bundleSize.initial) {
      recommendations.push('Reduce bundle size: implement code splitting, tree shaking, and lazy loading')
    }

    if (this.metrics.errorRate && this.metrics.errorRate > 0.01) {
      recommendations.push('Address high error rate: improve error handling and retry logic')
    }

    if (this.metrics.cacheHitRate && this.metrics.cacheHitRate < 0.8) {
      recommendations.push('Improve cache hit rate: implement better caching strategies')
    }

    return recommendations
  }
}

// Singleton instance
export const mobilePerformanceMonitor = new MobilePerformanceMonitor()

// React hook for mobile performance monitoring
export function useMobilePerformance() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
  const [performanceScore, setPerformanceScore] = useState<number>(100)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateData = () => {
      setMetrics(mobilePerformanceMonitor.getMetrics())
      setAlerts(mobilePerformanceMonitor.getAlerts())
      setPerformanceScore(mobilePerformanceMonitor.getPerformanceScore())
    }

    // Start monitoring if on mobile
    if (isMobile()) {
      mobilePerformanceMonitor.startMonitoring()
      updateData()

      // Update every 5 seconds
      const interval = setInterval(updateData, 5000)

      return () => {
        clearInterval(interval)
        mobilePerformanceMonitor.stopMonitoring()
      }
    }
  }, [])

  const recommendations = mobilePerformanceMonitor.getOptimizationRecommendations()

  return {
    metrics,
    alerts,
    performanceScore,
    recommendations,
    bundleAnalysis: mobilePerformanceMonitor.getBundleAnalysis(),
  }
}

// Utility functions
export const getPerformanceGrade = (score: number): 'A' | 'B' | 'C' | 'D' | 'F' => {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

export const getPerformanceColor = (grade: string): string => {
  const colors = {
    'A': '#10b981', // green
    'B': '#3b82f6', // blue
    'C': '#f59e0b', // yellow
    'D': '#f97316', // orange
    'F': '#ef4444', // red
  }
  return colors[grade as keyof typeof colors] || '#6b7280'
}

export default mobilePerformanceMonitor