"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useMobilePerformance } from "@/hooks/useMobilePerformance"

// Performance thresholds for mobile devices
export const PERFORMANCE_THRESHOLDS = {
  FCP: 1500, // First Contentful Paint: 1.5s
  LCP: 2500, // Largest Contentful Paint: 2.5s
  TTI: 3500, // Time to Interactive: 3.5s
  CLS: 0.1, // Cumulative Layout Shift: 0.1
  FID: 100, // First Input Delay: 100ms
  BUNDLE_SIZE: 250 * 1024, // 250KB gzipped
  MEMORY_USAGE: 50 * 1024 * 1024, // 50MB
  FPS: 60, // Frames per second
} as const

// Performance levels
export type PerformanceLevel = 'excellent' | 'good' | 'fair' | 'poor'

export interface PerformanceMetrics {
  fcp?: number
  lcp?: number
  tti?: number
  cls?: number
  fid?: number
  memoryUsage?: number
  bundleSize?: number
  fps?: number
  networkType?: string
  deviceType?: string
  timestamp: number
}

export interface PerformanceReport {
  metrics: PerformanceMetrics
  level: PerformanceLevel
  issues: PerformanceIssue[]
  recommendations: string[]
  score: number // 0-100
}

export interface PerformanceIssue {
  type: 'loading' | 'runtime' | 'memory' | 'network' | 'accessibility'
  severity: 'low' | 'medium' | 'high' | 'critical'
  metric: keyof PerformanceMetrics
  value: number
  threshold: number
  description: string
}

// Calculate performance level based on metrics
export function calculatePerformanceLevel(metrics: PerformanceMetrics): PerformanceLevel {
  const issues = analyzePerformanceIssues(metrics)
  const criticalIssues = issues.filter(i => i.severity === 'critical').length
  const highIssues = issues.filter(i => i.severity === 'high').length

  if (criticalIssues > 0 || highIssues > 2) return 'poor'
  if (highIssues > 0 || issues.length > 4) return 'fair'
  if (issues.length > 1) return 'good'
  return 'excellent'
}

// Analyze performance metrics and identify issues
export function analyzePerformanceIssues(metrics: PerformanceMetrics): PerformanceIssue[] {
  const issues: PerformanceIssue[] = []

  if (metrics.fcp && metrics.fcp > PERFORMANCE_THRESHOLDS.FCP) {
    issues.push({
      type: 'loading',
      severity: metrics.fcp > PERFORMANCE_THRESHOLDS.FCP * 2 ? 'critical' : 'high',
      metric: 'fcp',
      value: metrics.fcp,
      threshold: PERFORMANCE_THRESHOLDS.FCP,
      description: `First Contentful Paint is ${metrics.fcp}ms, should be under ${PERFORMANCE_THRESHOLDS.FCP}ms`
    })
  }

  if (metrics.lcp && metrics.lcp > PERFORMANCE_THRESHOLDS.LCP) {
    issues.push({
      type: 'loading',
      severity: metrics.lcp > PERFORMANCE_THRESHOLDS.LCP * 2 ? 'critical' : 'high',
      metric: 'lcp',
      value: metrics.lcp,
      threshold: PERFORMANCE_THRESHOLDS.LCP,
      description: `Largest Contentful Paint is ${metrics.lcp}ms, should be under ${PERFORMANCE_THRESHOLDS.LCP}ms`
    })
  }

  if (metrics.tti && metrics.tti > PERFORMANCE_THRESHOLDS.TTI) {
    issues.push({
      type: 'runtime',
      severity: metrics.tti > PERFORMANCE_THRESHOLDS.TTI * 2 ? 'critical' : 'high',
      metric: 'tti',
      value: metrics.tti,
      threshold: PERFORMANCE_THRESHOLDS.TTI,
      description: `Time to Interactive is ${metrics.tti}ms, should be under ${PERFORMANCE_THRESHOLDS.TTI}ms`
    })
  }

  if (metrics.cls && metrics.cls > PERFORMANCE_THRESHOLDS.CLS) {
    issues.push({
      type: 'loading',
      severity: metrics.cls > PERFORMANCE_THRESHOLDS.CLS * 2 ? 'high' : 'medium',
      metric: 'cls',
      value: metrics.cls,
      threshold: PERFORMANCE_THRESHOLDS.CLS,
      description: `Cumulative Layout Shift is ${metrics.cls.toFixed(3)}, should be under ${PERFORMANCE_THRESHOLDS.CLS}`
    })
  }

  if (metrics.fid && metrics.fid > PERFORMANCE_THRESHOLDS.FID) {
    issues.push({
      type: 'runtime',
      severity: metrics.fid > PERFORMANCE_THRESHOLDS.FID * 2 ? 'high' : 'medium',
      metric: 'fid',
      value: metrics.fid,
      threshold: PERFORMANCE_THRESHOLDS.FID,
      description: `First Input Delay is ${metrics.fid}ms, should be under ${PERFORMANCE_THRESHOLDS.FID}ms`
    })
  }

  if (metrics.memoryUsage && metrics.memoryUsage > PERFORMANCE_THRESHOLDS.MEMORY_USAGE) {
    issues.push({
      type: 'memory',
      severity: metrics.memoryUsage > PERFORMANCE_THRESHOLDS.MEMORY_USAGE * 2 ? 'high' : 'medium',
      metric: 'memoryUsage',
      value: metrics.memoryUsage,
      threshold: PERFORMANCE_THRESHOLDS.MEMORY_USAGE,
      description: `Memory usage is ${(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB, should be under ${(PERFORMANCE_THRESHOLDS.MEMORY_USAGE / 1024 / 1024).toFixed(1)}MB`
    })
  }

  if (metrics.fps && metrics.fps < PERFORMANCE_THRESHOLDS.FPS) {
    issues.push({
      type: 'runtime',
      severity: metrics.fps < PERFORMANCE_THRESHOLDS.FPS / 2 ? 'high' : 'medium',
      metric: 'fps',
      value: metrics.fps,
      threshold: PERFORMANCE_THRESHOLDS.FPS,
      description: `Frame rate is ${metrics.fps}fps, should be ${PERFORMANCE_THRESHOLDS.FPS}fps`
    })
  }

  return issues
}

// Generate performance recommendations
export function generateRecommendations(issues: PerformanceIssue[]): string[] {
  const recommendations: string[] = []

  const loadingIssues = issues.filter(i => i.type === 'loading')
  const runtimeIssues = issues.filter(i => i.type === 'runtime')
  const memoryIssues = issues.filter(i => i.type === 'memory')
  const networkIssues = issues.filter(i => i.type === 'network')

  if (loadingIssues.length > 0) {
    recommendations.push("Implement code splitting and lazy loading for heavy components")
    recommendations.push("Optimize images and assets for mobile delivery")
    recommendations.push("Add preloading for critical resources")
  }

  if (runtimeIssues.length > 0) {
    recommendations.push("Optimize React render performance with memoization")
    recommendations.push("Reduce JavaScript execution time")
    recommendations.push("Implement virtual scrolling for large lists")
  }

  if (memoryIssues.length > 0) {
    recommendations.push("Implement proper cleanup in useEffect hooks")
    recommendations.push("Optimize state management and reduce memory leaks")
    recommendations.push("Use React.memo and useMemo for expensive computations")
  }

  if (networkIssues.length > 0) {
    recommendations.push("Implement request deduplication and caching")
    recommendations.push("Optimize API response structures")
    recommendations.push("Add offline-first data strategies")
  }

  if (recommendations.length === 0) {
    recommendations.push("Performance is optimal! Continue monitoring for regressions.")
  }

  return recommendations
}

// Calculate overall performance score
export function calculatePerformanceScore(metrics: PerformanceMetrics): number {
  const issues = analyzePerformanceIssues(metrics)
  const totalIssues = issues.length
  const criticalIssues = issues.filter(i => i.severity === 'critical').length
  const highIssues = issues.filter(i => i.severity === 'high').length

  let score = 100

  // Deduct points based on issues
  score -= criticalIssues * 25
  score -= highIssues * 15
  score -= (totalIssues - criticalIssues - highIssues) * 5

  // Bonus for excellent metrics
  if (metrics.fcp && metrics.fcp < 800) score += 5
  if (metrics.lcp && metrics.lcp < 1500) score += 5
  if (metrics.tti && metrics.tti < 2000) score += 5
  if (metrics.memoryUsage && metrics.memoryUsage < 30 * 1024 * 1024) score += 5

  return Math.max(0, Math.min(100, score))
}

// Generate comprehensive performance report
export function generatePerformanceReport(metrics: PerformanceMetrics): PerformanceReport {
  const issues = analyzePerformanceIssues(metrics)
  const level = calculatePerformanceLevel(metrics)
  const recommendations = generateRecommendations(issues)
  const score = calculatePerformanceScore(metrics)

  return {
    metrics,
    level,
    issues,
    recommendations,
    score
  }
}

// Performance monitoring component
interface PerformanceMonitorProps {
  children: ReactNode
  onReport?: (report: PerformanceReport) => void
  enabled?: boolean
  interval?: number
}

export function PerformanceMonitor({
  children,
  onReport,
  enabled = true,
  interval = 30000, // 30 seconds
}: PerformanceMonitorProps) {
  const { metrics, startMonitoring, stopMonitoring } = useMobilePerformance()

  useEffect(() => {
    if (!enabled) return

    startMonitoring()

    const intervalId = setInterval(() => {
      if (onReport && metrics) {
        const report = generatePerformanceReport(metrics)
        onReport(report)
      }
    }, interval)

    return () => {
      clearInterval(intervalId)
      stopMonitoring()
    }
  }, [enabled, interval, metrics, onReport, startMonitoring, stopMonitoring])

  return <>{children}</>
}

// Performance metrics display component
interface PerformanceMetricsDisplayProps {
  report: PerformanceReport
  detailed?: boolean
}

export function PerformanceMetricsDisplay({
  report,
  detailed = false
}: PerformanceMetricsDisplayProps) {
  const { metrics, level, issues, score } = report

  const getLevelColor = (level: PerformanceLevel) => {
    switch (level) {
      case 'excellent': return 'text-green-600'
      case 'good': return 'text-blue-600'
      case 'fair': return 'text-yellow-600'
      case 'poor': return 'text-red-600'
    }
  }

  const getSeverityColor = (severity: PerformanceIssue['severity']) => {
    switch (severity) {
      case 'low': return 'text-gray-500'
      case 'medium': return 'text-yellow-600'
      case 'high': return 'text-orange-600'
      case 'critical': return 'text-red-600'
    }
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      {/* Overall score and level */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg">Performance Score</h3>
          <p className={`text-sm ${getLevelColor(level)}`}>
            {level.charAt(0).toUpperCase() + level.slice(1)} Performance
          </p>
        </div>
        <div className="text-3xl font-bold">{score}/100</div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {metrics.fcp && (
          <div>
            <p className="text-xs text-gray-500">FCP</p>
            <p className="font-semibold">{metrics.fcp}ms</p>
          </div>
        )}
        {metrics.lcp && (
          <div>
            <p className="text-xs text-gray-500">LCP</p>
            <p className="font-semibold">{metrics.lcp}ms</p>
          </div>
        )}
        {metrics.memoryUsage && (
          <div>
            <p className="text-xs text-gray-500">Memory</p>
            <p className="font-semibold">{(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB</p>
          </div>
        )}
        {metrics.fps && (
          <div>
            <p className="text-xs text-gray-500">FPS</p>
            <p className="font-semibold">{metrics.fps}</p>
          </div>
        )}
      </div>

      {/* Issues */}
      {detailed && issues.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="font-medium mb-2">Performance Issues</h4>
          <div className="space-y-2">
            {issues.slice(0, 3).map((issue, index) => (
              <div key={index} className="text-sm">
                <p className={getSeverityColor(issue.severity)}>
                  {issue.description}
                </p>
              </div>
            ))}
            {issues.length > 3 && (
              <p className="text-xs text-gray-500">
                +{issues.length - 3} more issues
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Performance optimization utilities
export const performanceOptimizations = {
  // Debounce function for performance
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout
    return (...args: Parameters<T>) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), wait)
    }
  },

  // Throttle function for performance
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args)
        inThrottle = true
        setTimeout(() => inThrottle = false, limit)
      }
    }
  },

  // Memoize expensive computations
  memoize: <T extends (...args: any[]) => any>(fn: T): T => {
    const cache = new Map()
    return ((...args: Parameters<T>) => {
      const key = JSON.stringify(args)
      if (cache.has(key)) {
        return cache.get(key)
      }
      const result = fn(...args)
      cache.set(key, result)
      return result
    }) as T
  },

  // Check if device is low-end
  isLowEndDevice: (): boolean => {
    if (typeof window === 'undefined') return false

    const connection = (navigator as any).connection
    const hardwareConcurrency = navigator.hardwareConcurrency
    const deviceMemory = (navigator as any).deviceMemory

    // Check for slow network
    if (connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g')) {
      return true
    }

    // Check for limited hardware
    if (hardwareConcurrency && hardwareConcurrency < 4) {
      return true
    }

    // Check for limited memory
    if (deviceMemory && deviceMemory < 4) {
      return true
    }

    return false
  },

  // Optimize rendering based on device capabilities
  getOptimalSettings: () => {
    const isLowEnd = performanceOptimizations.isLowEndDevice()

    return {
      animations: !isLowEnd,
      shadows: !isLowEnd,
      filters: !isLowEnd,
      virtualScrolling: true,
      lazyLoading: true,
      imageOptimization: true,
      reducedMotion: isLowEnd || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
  }
}