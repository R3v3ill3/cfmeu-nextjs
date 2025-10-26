"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import type { ReactNode, RefObject } from "react"

interface UseMobileOptimizationsOptions {
  enableIntersectionObserver?: boolean
  enableVirtualScrolling?: boolean
  enableLazyLoading?: boolean
  enableDebouncing?: boolean
  debounceDelay?: number
  throttleDelay?: number
}

interface UseMobileOptimizationsReturn {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  screenSize: { width: number; height: number }
  orientation: 'portrait' | 'landscape'
  isOnline: boolean
  isLowEndDevice: boolean
  prefersReducedMotion: boolean
  supportsTouch: boolean
  debounce: <T extends (...args: any[]) => any>(func: T, delay?: number) => T
  throttle: <T extends (...args: any[]) => any>(func: T, delay?: number) => T
  intersectionRef: RefObject<HTMLDivElement>
  isInViewport: boolean
  virtualizeList: <T>(items: T[], renderItem: (item: T, index: number) => ReactNode, options?: VirtualScrollOptions) => ReactNode
  lazyLoad: <T>(factory: () => Promise<{ default: T }>) => Promise<T>
}

interface VirtualScrollOptions {
  itemHeight?: number
  containerHeight?: number
  overscan?: number
}

export function useMobileOptimizations(
  options: UseMobileOptimizationsOptions = {}
): UseMobileOptimizationsReturn {
  const {
    enableIntersectionObserver = true,
    enableVirtualScrolling = false,
    enableLazyLoading = true,
    enableDebouncing = true,
    debounceDelay = 300,
    throttleDelay = 100,
  } = options

  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 })
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [isOnline, setIsOnline] = useState(true)
  const [isLowEndDevice, setIsLowEndDevice] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [isInViewport, setIsInViewport] = useState(false)
  const intersectionRef = useRef<HTMLDivElement>(null)

  // Detect screen size and device type
  const isMobile = useMemo(() => screenSize.width < 768, [screenSize.width])
  const isTablet = useMemo(() => screenSize.width >= 768 && screenSize.width < 1024, [screenSize.width])
  const isDesktop = useMemo(() => screenSize.width >= 1024, [screenSize.width])
  const supportsTouch = useMemo(() => {
    return typeof window !== "undefined" && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  }, [])

  // Update screen size
  useEffect(() => {
    if (typeof window === "undefined") return

    const updateScreenSize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape')
    }

    updateScreenSize()
    window.addEventListener('resize', updateScreenSize)
    window.addEventListener('orientationchange', updateScreenSize)

    return () => {
      window.removeEventListener('resize', updateScreenSize)
      window.removeEventListener('orientationchange', updateScreenSize)
    }
  }, [])

  // Detect online status
  useEffect(() => {
    if (typeof window === "undefined") return

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Detect low-end device
  useEffect(() => {
    if (typeof window === "undefined") return

    // Simple heuristics for low-end device detection
    const isLowEnd = (
      // Hardware concurrency (CPU cores)
      (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
      // Device memory
      ('deviceMemory' in navigator && (navigator as any).deviceMemory <= 4) ||
      // Connection speed
      ('connection' in navigator && (navigator as any).connection?.effectiveType === 'slow-2g' || (navigator as any).connection?.effectiveType === '2g') ||
      // Small screen size
      screenSize.width <= 360 ||
      // User agent detection (last resort)
      /Android.*Mobi|iPhone.*OS.*[1-9]|Opera Mini|IEMobile/.test(navigator.userAgent)
    )

    setIsLowEndDevice(isLowEnd)
  }, [screenSize.width])

  // Detect reduced motion preference
  useEffect(() => {
    if (typeof window === "undefined") return

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Intersection Observer for viewport detection
  useEffect(() => {
    if (!enableIntersectionObserver || typeof window === "undefined") return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting)
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
      }
    )

    if (intersectionRef.current) {
      observer.observe(intersectionRef.current)
    }

    return () => observer.disconnect()
  }, [enableIntersectionObserver])

  // Debounce utility
  const debounce = useCallback(<T extends (...args: any[]) => any>(
    func: T,
    delay: number = debounceDelay
  ): T => {
    if (!enableDebouncing) return func

    let timeoutId: NodeJS.Timeout
    return ((...args: Parameters<T>) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => func(...args), delay)
    }) as T
  }, [enableDebouncing, debounceDelay])

  // Throttle utility
  const throttle = useCallback(<T extends (...args: any[]) => any>(
    func: T,
    delay: number = throttleDelay
  ): T => {
    let lastCall = 0
    return ((...args: Parameters<T>) => {
      const now = Date.now()
      if (now - lastCall >= delay) {
        lastCall = now
        return func(...args)
      }
    }) as T
  }, [throttleDelay])

  // Lazy loading utility
  const lazyLoad = useCallback(async <T>(
    factory: () => Promise<{ default: T }>
  ): Promise<T> => {
    if (!enableLazyLoading) {
      const module = await factory()
      return module.default
    }

    // Add a small delay for better UX on mobile
    if (isMobile) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    const module = await factory()
    return module.default
  }, [enableLazyLoading, isMobile])

  // Virtual scrolling utility - simplified version without JSX
  const virtualizeList = useCallback((
    items: any[],
    renderItem: (item: any, index: number) => any,
    options: any = {}
  ) => {
    if (!enableVirtualScrolling || items.length < 50) {
      return items.map((item, index) => renderItem(item, index))
    }

    // For now, return all items - virtual scrolling can be implemented in components
    return items.map((item, index) => renderItem(item, index))
  }, [enableVirtualScrolling])

  return {
    isMobile,
    isTablet,
    isDesktop,
    screenSize,
    orientation,
    isOnline,
    isLowEndDevice,
    prefersReducedMotion,
    supportsTouch,
    debounce,
    throttle,
    intersectionRef,
    isInViewport,
    virtualizeList,
    lazyLoad,
  }
}

// Hook for performance monitoring
interface PerformanceMetrics {
  fps: number
  memoryUsage?: number
  renderTime: number
  interactionTime: number
}

interface UsePerformanceMonitorOptions {
  enableFpsMonitoring?: boolean
  enableMemoryMonitoring?: boolean
  enableRenderTimeMonitoring?: boolean
  sampleInterval?: number
}

export function usePerformanceMonitor(
  options: UsePerformanceMonitorOptions = {}
) {
  const {
    enableFpsMonitoring = true,
    enableMemoryMonitoring = false,
    enableRenderTimeMonitoring = true,
    sampleInterval = 1000,
  } = options

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    renderTime: 0,
    interactionTime: 0,
  })

  const frameCountRef = useRef(0)
  const lastTimeRef = useRef(performance.now())
  const renderStartRef = useRef(0)

  // FPS monitoring
  useEffect(() => {
    if (!enableFpsMonitoring) return

    let animationId: number

    const measureFPS = () => {
      frameCountRef.current++
      const currentTime = performance.now()

      if (currentTime - lastTimeRef.current >= sampleInterval) {
        const fps = Math.round((frameCountRef.current * 1000) / (currentTime - lastTimeRef.current))

        setMetrics(prev => ({ ...prev, fps }))

        frameCountRef.current = 0
        lastTimeRef.current = currentTime
      }

      animationId = requestAnimationFrame(measureFPS)
    }

    animationId = requestAnimationFrame(measureFPS)

    return () => cancelAnimationFrame(animationId)
  }, [enableFpsMonitoring, sampleInterval])

  // Memory monitoring (Chrome only)
  useEffect(() => {
    if (!enableMemoryMonitoring || typeof window === "undefined") return

    const interval = setInterval(() => {
      if ('memory' in performance) {
        const memory = (performance as any).memory
        setMetrics(prev => ({
          ...prev,
          memoryUsage: memory.usedJSHeapSize / 1024 / 1024, // MB
        }))
      }
    }, sampleInterval * 2)

    return () => clearInterval(interval)
  }, [enableMemoryMonitoring, sampleInterval])

  // Render time monitoring
  const measureRenderTime = useCallback(() => {
    if (!enableRenderTimeMonitoring) return

    renderStartRef.current = performance.now()

    requestAnimationFrame(() => {
      const renderTime = performance.now() - renderStartRef.current
      setMetrics(prev => ({ ...prev, renderTime }))
    })
  }, [enableRenderTimeMonitoring])

  // Interaction time measurement
  const measureInteraction = useCallback((callback: () => void) => {
    const startTime = performance.now()
    callback()
    const endTime = performance.now()

    setMetrics(prev => ({ ...prev, interactionTime: endTime - startTime }))
  }, [])

  return {
    metrics,
    measureRenderTime,
    measureInteraction,
  }
}

// Hook for battery monitoring (Chrome only)
export function useBatteryLevel() {
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
  const [isCharging, setIsCharging] = useState<boolean | null>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !('getBattery' in navigator)) return

    let battery: any

    const updateBatteryInfo = () => {
      setBatteryLevel(battery.level)
      setIsCharging(battery.charging)
    }

    navigator.getBattery().then((b: any) => {
      battery = b
      updateBatteryInfo()

      battery.addEventListener('levelchange', updateBatteryInfo)
      battery.addEventListener('chargingchange', updateBatteryInfo)
    })

    return () => {
      if (battery) {
        battery.removeEventListener('levelchange', updateBatteryInfo)
        battery.removeEventListener('chargingchange', updateBatteryInfo)
      }
    }
  }, [])

  return { batteryLevel, isCharging }
}