"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { PerformanceMetrics } from "@/lib/performance/performance-monitoring"

// Hook for monitoring mobile performance
export function useMobilePerformance() {
  const [metrics, setMetrics] = React.useState<PerformanceMetrics | null>(null)
  const [isMonitoring, setIsMonitoring] = React.useState(false)
  const [fps, setFps] = React.useState(60)
  const [memoryUsage, setMemoryUsage] = React.useState(0)

  // FPS monitoring
  const fpsMonitorRef = React.useRef<{
    frameCount: number
    lastTime: number
    animationId: number | null
  }>({
    frameCount: 0,
    lastTime: 0,
    animationId: null
  })

  // Performance observer refs
  const performanceObserversRef = React.useRef<{
    fcp?: PerformanceObserver
    lcp?: PerformanceObserver
    fid?: PerformanceObserver
    cls?: PerformanceObserver
    tti?: PerformanceObserver
  }>({})

  // Monitor FPS
  const monitorFPS = React.useCallback(() => {
    const now = performance.now()
    const { frameCount, lastTime } = fpsMonitorRef.current

    if (lastTime > 0) {
      const delta = now - lastTime
      const currentFps = Math.round(1000 / delta)
      setFps(currentFps)
    }

    fpsMonitorRef.current.frameCount = frameCount + 1
    fpsMonitorRef.current.lastTime = now

    fpsMonitorRef.current.animationId = requestAnimationFrame(monitorFPS)
  }, [])

  // Monitor memory usage
  const monitorMemory = React.useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      const usedMemory = memory.usedJSHeapSize
      setMemoryUsage(usedMemory)
    }
  }, [])

  // Observe web vitals
  const observeWebVitals = React.useCallback(() => {
    if (typeof window === 'undefined' || !window.PerformanceObserver) return

    // First Contentful Paint
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint')
        if (fcpEntry) {
          setMetrics(prev => prev ? { ...prev, fcp: fcpEntry.startTime } : {
            fcp: fcpEntry.startTime,
            timestamp: Date.now()
          })
        }
      })
      fcpObserver.observe({ type: 'paint', buffered: true })
      performanceObserversRef.current.fcp = fcpObserver
    } catch (error) {
      console.debug('FCP observation not supported:', error)
    }

    // Largest Contentful Paint
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        if (lastEntry) {
          setMetrics(prev => prev ? { ...prev, lcp: lastEntry.startTime } : {
            lcp: lastEntry.startTime,
            timestamp: Date.now()
          })
        }
      })
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
      performanceObserversRef.current.lcp = lcpObserver
    } catch (error) {
      console.debug('LCP observation not supported:', error)
    }

    // First Input Delay
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if (entry instanceof PerformanceEventTiming && entry.processingStart) {
            const fid = entry.processingStart - entry.startTime
            setMetrics(prev => prev ? { ...prev, fid } : {
              fid,
              timestamp: Date.now()
            })
          }
        })
      })
      fidObserver.observe({ type: 'first-input', buffered: true })
      performanceObserversRef.current.fid = fidObserver
    } catch (error) {
      console.debug('FID observation not supported:', error)
    }

    // Cumulative Layout Shift
    try {
      let clsValue = 0
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value
            setMetrics(prev => prev ? { ...prev, cls: clsValue } : {
              cls: clsValue,
              timestamp: Date.now()
            })
          }
        })
      })
      clsObserver.observe({ type: 'layout-shift', buffered: true })
      performanceObserversRef.current.cls = clsObserver
    } catch (error) {
      console.debug('CLS observation not supported:', error)
    }
  }, [])

  // Calculate Time to Interactive
  const calculateTTI = React.useCallback(() => {
    if (typeof window === 'undefined') return

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const longTasks = entries.filter((entry) => entry.duration > 50)

      if (longTasks.length > 0) {
        const lastLongTask = longTasks[longTasks.length - 1]
        const tti = lastLongTask.startTime + lastLongTask.duration
        setMetrics(prev => prev ? { ...prev, tti } : {
          tti,
          timestamp: Date.now()
        })
      }
    })

    try {
      observer.observe({ type: 'longtask', buffered: true })
      performanceObserversRef.current.tti = observer
    } catch (error) {
      console.debug('TTI observation not supported:', error)
    }
  }, [])

  // Get device and network information
  const getDeviceInfo = React.useCallback(() => {
    if (typeof window === 'undefined') return {}

    const deviceInfo: any = {
      deviceType: 'unknown'
    }

    // Detect device type
    const userAgent = navigator.userAgent
    if (/iPhone|iPad|iPod/.test(userAgent)) {
      deviceInfo.deviceType = 'ios'
    } else if (/Android/.test(userAgent)) {
      deviceInfo.deviceType = 'android'
    } else if (/Mobile/.test(userAgent)) {
      deviceInfo.deviceType = 'mobile'
    } else {
      deviceInfo.deviceType = 'desktop'
    }

    // Get network information
    const connection = (navigator as any).connection
    if (connection) {
      deviceInfo.networkType = connection.effectiveType
      deviceInfo.downlink = connection.downlink
      deviceInfo.rtt = connection.rtt
    }

    // Get hardware information
    deviceInfo.hardwareConcurrency = navigator.hardwareConcurrency
    deviceInfo.deviceMemory = (navigator as any).deviceMemory

    return deviceInfo
  }, [])

  // Start monitoring
  const startMonitoring = React.useCallback(() => {
    if (typeof window === 'undefined') return

    setIsMonitoring(true)

    // Initialize device info
    const deviceInfo = getDeviceInfo()
    setMetrics(prev => ({
      ...prev,
      ...deviceInfo,
      timestamp: Date.now()
    }))

    // Start FPS monitoring
    fpsMonitorRef.current.animationId = requestAnimationFrame(monitorFPS)

    // Start memory monitoring
    const memoryInterval = setInterval(monitorMemory, 5000)

    // Start web vitals observation
    observeWebVitals()

    // Calculate TTI after a delay
    setTimeout(calculateTTI, 1000)

    return () => {
      if (fpsMonitorRef.current.animationId) {
        cancelAnimationFrame(fpsMonitorRef.current.animationId)
      }
      clearInterval(memoryInterval)

      // Disconnect observers
      Object.values(performanceObserversRef.current).forEach(observer => {
        observer?.disconnect()
      })
    }
  }, [monitorFPS, monitorMemory, observeWebVitals, calculateTTI, getDeviceInfo])

  // Stop monitoring
  const stopMonitoring = React.useCallback(() => {
    setIsMonitoring(false)

    if (fpsMonitorRef.current.animationId) {
      cancelAnimationFrame(fpsMonitorRef.current.animationId)
      fpsMonitorRef.current.animationId = null
    }

    Object.values(performanceObserversRef.current).forEach(observer => {
      observer?.disconnect()
    })
  }, [])

  // Update metrics when FPS or memory changes
  React.useEffect(() => {
    if (isMonitoring) {
      setMetrics(prev => ({
        ...prev,
        fps,
        memoryUsage,
        timestamp: Date.now()
      }))
    }
  }, [fps, memoryUsage, isMonitoring])

  // Auto-cleanup on unmount
  React.useEffect(() => {
    return stopMonitoring
  }, [stopMonitoring])

  return {
    metrics,
    isMonitoring,
    fps,
    memoryUsage,
    startMonitoring,
    stopMonitoring
  }
}

// Hook for bundle size monitoring
export function useBundleSizeMonitoring() {
  const [bundleSize, setBundleSize] = React.useState(0)
  const [components, setComponents] = React.useState<string[]>([])

  const measureBundleSize = React.useCallback(async () => {
    if (typeof window === 'undefined') return

    try {
      // Measure current bundle
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      const jsResources = resources.filter(resource =>
        resource.name.endsWith('.js') || resource.name.endsWith('.mjs')
      )

      const totalSize = jsResources.reduce((sum, resource) => {
        return sum + (resource.transferSize || resource.encodedBodySize || 0)
      }, 0)

      setBundleSize(totalSize)

      // Extract component names from loaded scripts
      const loadedComponents: string[] = []
      jsResources.forEach(resource => {
        const matches = resource.name.match(/\/([^\/]+)\.js$/)
        if (matches) {
          loadedComponents.push(matches[1])
        }
      })

      setComponents(loadedComponents)
    } catch (error) {
      console.debug('Bundle size measurement failed:', error)
    }
  }, [])

  React.useEffect(() => {
    // Initial measurement
    setTimeout(measureBundleSize, 2000)

    // Periodic measurements
    const interval = setInterval(measureBundleSize, 10000)

    return () => clearInterval(interval)
  }, [measureBundleSize])

  return {
    bundleSize,
    components,
    measureBundleSize
  }
}

// Hook for network performance optimization
export function useNetworkOptimization() {
  const [networkInfo, setNetworkInfo] = React.useState<{
    type: string
    downlink: number
    rtt: number
    effectiveType: string
    saveData: boolean
  } | null>(null)

  const [isOnline, setIsOnline] = React.useState(true)

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const updateNetworkInfo = () => {
      const connection = (navigator as any).connection
      if (connection) {
        setNetworkInfo({
          type: connection.type || 'unknown',
          downlink: connection.downlink || 0,
          rtt: connection.rtt || 0,
          effectiveType: connection.effectiveType || 'unknown',
          saveData: connection.saveData || false
        })
      }
    }

    const updateOnlineStatus = () => setIsOnline(navigator.onLine)

    // Initial update
    updateNetworkInfo()
    updateOnlineStatus()

    // Listen for changes
    const connection = (navigator as any).connection
    if (connection) {
      connection.addEventListener('change', updateNetworkInfo)
    }

    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)

    return () => {
      if (connection) {
        connection.removeEventListener('change', updateNetworkInfo)
      }
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

  const isSlowNetwork = React.useMemo(() => {
    if (!networkInfo) return false
    return (
      networkInfo.effectiveType === 'slow-2g' ||
      networkInfo.effectiveType === '2g' ||
      networkInfo.saveData ||
      networkInfo.downlink < 0.5
    )
  }, [networkInfo])

  const isFastNetwork = React.useMemo(() => {
    if (!networkInfo) return true
    return (
      networkInfo.effectiveType === '4g' &&
      networkInfo.downlink > 2 &&
      !networkInfo.saveData
    )
  }, [networkInfo])

  return {
    networkInfo,
    isOnline,
    isSlowNetwork,
    isFastNetwork
  }
}

// Hook for device capability detection
export function useDeviceCapabilities() {
  const [capabilities, setCapabilities] = React.useState<{
    isLowEnd: boolean
    prefersReducedMotion: boolean
    touchSupport: boolean
    devicePixelRatio: number
    viewport: { width: number; height: number }
    memory: number
    cores: number
  }>({
    isLowEnd: false,
    prefersReducedMotion: false,
    touchSupport: false,
    devicePixelRatio: 1,
    viewport: { width: 0, height: 0 },
    memory: 0,
    cores: 0
  })

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const updateCapabilities = () => {
      // Check for low-end device
      const connection = (navigator as any).connection
      const hardwareConcurrency = navigator.hardwareConcurrency
      const deviceMemory = (navigator as any).deviceMemory

      const isLowEnd = (
        (connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g')) ||
        (hardwareConcurrency && hardwareConcurrency < 4) ||
        (deviceMemory && deviceMemory < 4)
      )

      setCapabilities({
        isLowEnd,
        prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        devicePixelRatio: window.devicePixelRatio || 1,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        memory: deviceMemory || 0,
        cores: hardwareConcurrency || 0
      })
    }

    updateCapabilities()

    // Update viewport on resize
    const handleResize = () => {
      setCapabilities(prev => ({
        ...prev,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      }))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return capabilities
}