"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Zap,
  Activity,
  Database,
  Monitor,
  Smartphone,
  Wifi,
  WifiOff,
  Timer,
  CheckCircle2,
  AlertTriangle,
  Info,
  RefreshCw,
  Settings,
  BarChart3
} from 'lucide-react'

interface PerformanceMetrics {
  renderTime: number
  memoryUsage: number
  dataProcessingTime: number
  networkRequests: number
  cacheHitRate: number
  componentRerenders: number
}

interface OptimizationOptions {
  enableVirtualization?: boolean
  enableCaching?: boolean
  enableLazyLoading?: boolean
  enableDebouncing?: boolean
  batchOperations?: boolean
  prefetchData?: boolean
  compressImages?: boolean
  minifyData?: boolean
}

interface SubcontractorReviewOptimizationProps {
  totalEntries?: number
  isVisible?: boolean
  onOptimizationChange?: (options: OptimizationOptions) => void
  className?: string
}

// Performance monitoring hook
function usePerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    dataProcessingTime: 0,
    networkRequests: 0,
    cacheHitRate: 0,
    componentRerenders: 0
  })

  const renderStartTime = useRef<number>(0)
  const rerenderCount = useRef<number>(0)

  const startRenderTimer = useCallback(() => {
    renderStartTime.current = performance.now()
  }, [])

  const endRenderTimer = useCallback(() => {
    const renderTime = performance.now() - renderStartTime.current
    rerenderCount.current++

    setMetrics(prev => ({
      ...prev,
      renderTime,
      componentRerenders: rerenderCount.current
    }))
  }, [])

  const measureDataProcessing = useCallback<T>((fn: () => T): T => {
    const startTime = performance.now()
    const result = fn()
    const processingTime = performance.now() - startTime

    setMetrics(prev => ({
      ...prev,
      dataProcessingTime: processingTime
    }))

    return result
  }, [])

  const updateMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      setMetrics(prev => ({
        ...prev,
        memoryUsage: memory.usedJSHeapSize / 1024 / 1024 // Convert to MB
      }))
    }
  }, [])

  const incrementNetworkRequests = useCallback(() => {
    setMetrics(prev => ({
      ...prev,
      networkRequests: prev.networkRequests + 1
    }))
  }, [])

  const updateCacheHitRate = useCallback((hits: number, total: number) => {
    setMetrics(prev => ({
      ...prev,
      cacheHitRate: total > 0 ? (hits / total) * 100 : 0
    }))
  }, [])

  return {
    metrics,
    startRenderTimer,
    endRenderTimer,
    measureDataProcessing,
    updateMemoryUsage,
    incrementNetworkRequests,
    updateCacheHitRate
  }
}

// Virtual scrolling hook for large datasets
function useVirtualScrolling<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  enabled: boolean = true
) {
  const [scrollTop, setScrollTop] = useState(0)

  const visibleRange = useMemo(() => {
    if (!enabled || items.length === 0) {
      return { start: 0, end: items.length }
    }

    const start = Math.floor(scrollTop / itemHeight)
    const visibleCount = Math.ceil(containerHeight / itemHeight)
    const end = Math.min(start + visibleCount + 1, items.length) // +1 for buffer

    return { start, end }
  }, [scrollTop, itemHeight, containerHeight, items.length, enabled])

  const visibleItems = useMemo(() => {
    if (!enabled) return items
    return items.slice(visibleRange.start, visibleRange.end)
  }, [items, visibleRange, enabled])

  const totalHeight = enabled ? items.length * itemHeight : 'auto'

  return {
    visibleItems,
    totalHeight,
    visibleRange,
    setScrollTop,
    offsetY: enabled ? visibleRange.start * itemHeight : 0
  }
}

// Data caching hook
function useDataCache<T>(maxSize: number = 100) {
  const cacheRef = useRef<Map<string, { data: T; timestamp: number; hits: number }>>(new Map())
  const hitsRef = useRef(0)
  const totalRef = useRef(0)

  const get = useCallback((key: string): T | null => {
    totalRef.current++
    const entry = cacheRef.current.get(key)

    if (entry) {
      entry.hits++
      hitsRef.current++
      return entry.data
    }

    return null
  }, [])

  const set = useCallback((key: string, data: T): void => {
    const cache = cacheRef.current

    // Remove least recently used item if cache is full
    if (cache.size >= maxSize) {
      let lruKey = ''
      let lruTime = Date.now()

      cache.forEach((entry, key) => {
        if (entry.timestamp < lruTime) {
          lruTime = entry.timestamp
          lruKey = key
        }
      })

      if (lruKey) {
        cache.delete(lruKey)
      }
    }

    cache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 0
    })
  }, [maxSize])

  const clear = useCallback(() => {
    cacheRef.current.clear()
    hitsRef.current = 0
    totalRef.current = 0
  }, [])

  const getStats = useCallback(() => {
    return {
      size: cacheRef.current.size,
      maxSize,
      hits: hitsRef.current,
      total: totalRef.current,
      hitRate: totalRef.current > 0 ? (hitsRef.current / totalRef.current) * 100 : 0
    }
  }, [maxSize])

  return { get, set, clear, getStats }
}

// Debounced search hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export function SubcontractorReviewOptimization({
  totalEntries = 0,
  isVisible = true,
  onOptimizationChange,
  className
}: SubcontractorReviewOptimizationProps) {
  const [options, setOptions] = useState<OptimizationOptions>({
    enableVirtualization: totalEntries > 100,
    enableCaching: true,
    enableLazyLoading: true,
    enableDebouncing: true,
    batchOperations: totalEntries > 50,
    prefetchData: false,
    compressImages: true,
    minifyData: true
  })

  const [showMetrics, setShowMetrics] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline' | 'slow'>('online')

  const {
    metrics,
    startRenderTimer,
    endRenderTimer,
    measureDataProcessing,
    updateMemoryUsage,
    incrementNetworkRequests,
    updateCacheHitRate
  } = usePerformanceMonitor()

  const dataCache = useDataCache(200)

  // Monitor network status
  useEffect(() => {
    const updateNetworkStatus = () => {
      if (!navigator.onLine) {
        setNetworkStatus('offline')
      } else {
        // Simple speed test
        const startTime = performance.now()
        fetch('/api/health', { method: 'HEAD' })
          .then(() => {
            const duration = performance.now() - startTime
            setNetworkStatus(duration > 1000 ? 'slow' : 'online')
          })
          .catch(() => setNetworkStatus('slow'))
      }
    }

    updateNetworkStatus()

    window.addEventListener('online', updateNetworkStatus)
    window.addEventListener('offline', updateNetworkStatus)

    return () => {
      window.removeEventListener('online', updateNetworkStatus)
      window.removeEventListener('offline', updateNetworkStatus)
    }
  }, [])

  // Update memory usage periodically
  useEffect(() => {
    const interval = setInterval(updateMemoryUsage, 5000)
    return () => clearInterval(interval)
  }, [updateMemoryUsage])

  // Handle option changes
  const handleOptionChange = useCallback((key: keyof OptimizationOptions, value: boolean) => {
    const newOptions = { ...options, [key]: value }
    setOptions(newOptions)
    onOptimizationChange?.(newOptions)
  }, [options, onOptimizationChange])

  // Run optimization
  const runOptimization = useCallback(async () => {
    setIsOptimizing(true)
    startRenderTimer()

    try {
      // Simulate optimization tasks
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Clear cache if needed
      if (!options.enableCaching) {
        dataCache.clear()
      }

      // Update cache hit rate
      const cacheStats = dataCache.getStats()
      updateCacheHitRate(cacheStats.hits, cacheStats.total)

      endRenderTimer()
    } finally {
      setIsOptimizing(false)
    }
  }, [options, startRenderTimer, endRenderTimer, dataCache, updateCacheHitRate])

  // Get performance score
  const performanceScore = useMemo(() => {
    const factors = [
      { weight: 0.3, value: Math.max(0, 100 - metrics.renderTime) },
      { weight: 0.2, value: Math.max(0, 100 - metrics.memoryUsage / 10) },
      { weight: 0.2, value: Math.max(0, 100 - metrics.dataProcessingTime) },
      { weight: 0.2, value: metrics.cacheHitRate },
      { weight: 0.1, value: Math.max(0, 100 - metrics.networkRequests) }
    ]

    return Math.round(
      factors.reduce((score, factor) => score + factor.value * factor.weight, 0)
    )
  }, [metrics])

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getPerformanceLabel = (score: number) => {
    if (score >= 80) return 'Excellent'
    if (score >= 60) return 'Good'
    if (score >= 40) return 'Fair'
    return 'Poor'
  }

  // Responsive design helpers
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const isTablet = typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 1024

  if (!isVisible) return null

  return (
    <div className={className}>
      {/* Performance Summary Card */}
      <Card className="border-purple-200 bg-purple-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Performance Optimization
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Score: {performanceScore}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMetrics(!showMetrics)}
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`font-medium ${getPerformanceColor(performanceScore)}`}>
                {getPerformanceLabel(performanceScore)} Performance
              </div>
              <Progress value={performanceScore} className="w-20 h-2" />
            </div>
            <div className="flex items-center gap-1">
              {networkStatus === 'online' && <Wifi className="h-4 w-4 text-green-500" />}
              {networkStatus === 'slow' && <Wifi className="h-4 w-4 text-yellow-500" />}
              {networkStatus === 'offline' && <WifiOff className="h-4 w-4 text-red-500" />}
              <span className="text-xs text-gray-600 capitalize">{networkStatus}</span>
            </div>
          </div>

          {/* Optimization Options */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={options.enableVirtualization}
                onChange={(e) => handleOptionChange('enableVirtualization', e.target.checked)}
                className="rounded"
              />
              <span>Virtual Scrolling</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={options.enableCaching}
                onChange={(e) => handleOptionChange('enableCaching', e.target.checked)}
                className="rounded"
              />
              <span>Data Caching</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={options.enableLazyLoading}
                onChange={(e) => handleOptionChange('enableLazyLoading', e.target.checked)}
                className="rounded"
              />
              <span>Lazy Loading</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={options.enableDebouncing}
                onChange={(e) => handleOptionChange('enableDebouncing', e.target.checked)}
                className="rounded"
              />
              <span>Debounced Search</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={options.batchOperations}
                onChange={(e) => handleOptionChange('batchOperations', e.target.checked)}
                className="rounded"
              />
              <span>Batch Operations</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={options.minifyData}
                onChange={(e) => handleOptionChange('minifyData', e.target.checked)}
                className="rounded"
              />
              <span>Data Minification</span>
            </label>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              onClick={runOptimization}
              disabled={isOptimizing}
              className="gap-2"
            >
              {isOptimizing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4" />
                  Run Optimization
                </>
              )}
            </Button>
            <span className="text-xs text-gray-600">
              {totalEntries} entries loaded
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Metrics */}
      {showMetrics && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Render Time</span>
                  <span className="font-medium">{metrics.renderTime.toFixed(2)}ms</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Memory Usage</span>
                  <span className="font-medium">{metrics.memoryUsage.toFixed(1)}MB</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Data Processing</span>
                  <span className="font-medium">{metrics.dataProcessingTime.toFixed(2)}ms</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Network Requests</span>
                  <span className="font-medium">{metrics.networkRequests}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Cache Hit Rate</span>
                  <span className="font-medium">{metrics.cacheHitRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Component Renders</span>
                  <span className="font-medium">{metrics.componentRerenders}</span>
                </div>
              </div>
            </div>

            {/* Responsive Design Info */}
            <div className="mt-4 p-3 bg-white rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-sm">Responsive Design</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className={`text-center p-2 rounded ${
                  isMobile ? 'bg-blue-100 text-blue-800' : 'bg-gray-50 text-gray-600'
                }`}>
                  Mobile {isMobile && '✓'}
                </div>
                <div className={`text-center p-2 rounded ${
                  isTablet ? 'bg-blue-100 text-blue-800' : 'bg-gray-50 text-gray-600'
                }`}>
                  Tablet {isTablet && '✓'}
                </div>
                <div className={`text-center p-2 rounded ${
                  !isMobile && !isTablet ? 'bg-blue-100 text-blue-800' : 'bg-gray-50 text-gray-600'
                }`}>
                  Desktop {(!isMobile && !isTablet) && '✓'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Recommendations */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Info className="h-5 w-5" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {metrics.renderTime > 100 && (
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <span>Enable virtual scrolling for better performance with large datasets</span>
              </div>
            )}
            {metrics.memoryUsage > 50 && (
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <span>High memory usage detected. Consider enabling data minification</span>
              </div>
            )}
            {metrics.cacheHitRate < 50 && (
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <span>Low cache hit rate. Ensure caching is enabled for better performance</span>
              </div>
            )}
            {networkStatus === 'slow' && (
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <span>Slow network detected. Enable lazy loading and batch operations</span>
              </div>
            )}
            {performanceScore >= 80 && (
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Great performance! Your settings are well optimized.</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Skeleton loading component for better perceived performance
export function SubcontractorReviewSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center space-x-4">
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-40" />
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Export utility functions for other components
export const optimizationUtils = {
  useVirtualScrolling,
  useDataCache,
  useDebounce,
  usePerformanceMonitor
}