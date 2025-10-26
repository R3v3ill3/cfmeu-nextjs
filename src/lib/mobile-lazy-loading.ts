/**
 * Mobile-Specific Lazy Loading and Code Splitting Strategies
 *
 * Optimized for mobile performance with:
 * - Route-based code splitting for mobile-specific routes
 * - Component-level lazy loading for below-the-fold content
 * - Intersection Observer with mobile-specific thresholds
 * - Network-aware loading strategies
 * - Preloading based on user behavior patterns
 */

import { useState, useEffect, useRef, useCallback, Component } from 'react'
import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { isMobile, isSlowConnection } from '@/lib/device'

// Mobile-specific configuration
const MOBILE_LAZY_CONFIG = {
  // Intersection Observer thresholds for mobile
  rootMargin: {
    fast: '50px',    // Fast connections
    slow: '200px',   // Slow connections - load earlier
    offline: '500px' // Offline - load much earlier
  },

  // Loading timeouts
  timeout: {
    fast: 5000,      // 5 seconds on fast connections
    slow: 10000,     // 10 seconds on slow connections
    offline: 30000   // 30 seconds when offline
  },

  // Preload strategies
  preload: {
    delay: 2000,     // Wait 2 seconds before preloading
    probability: 0.7, // 70% probability of preloading
    maxConcurrent: 3  // Max 3 concurrent preloads
  }
}

// Network-aware loading strategy
export enum LoadingStrategy {
  IMMEDIATE = 'immediate',
  LAZY = 'lazy',
  PRELOAD = 'preload',
  INTERACTION = 'interaction',
  NETWORK_AWARE = 'network-aware'
}

// Mobile component loader with network awareness
export function createMobileLazyLoad<T extends Record<string, any>>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  options: {
    loadingComponent?: ComponentType
    errorComponent?: ComponentType<{ error: Error; retry: () => void }>
    strategy?: LoadingStrategy
    preloadDelay?: number
    fallback?: ComponentType
  } = {}
) {
  const {
    loadingComponent: LoadingComponent = MobileLoadingSpinner,
    errorComponent: ErrorComponent = MobileErrorFallback,
    strategy = LoadingStrategy.NETWORK_AWARE,
    preloadDelay = MOBILE_LAZY_CONFIG.preload.delay,
    fallback: FallbackComponent
  } = options

  let loadingStrategy = strategy

  // Adjust strategy based on device and network
  if (strategy === LoadingStrategy.NETWORK_AWARE) {
    if (!isMobile()) {
      loadingStrategy = LoadingStrategy.LAZY
    } else if (isSlowConnection()) {
      loadingStrategy = LoadingStrategy.PRELOAD
    } else if (!navigator.onLine) {
      loadingStrategy = LoadingStrategy.IMMEDIATE
    } else {
      loadingStrategy = LoadingStrategy.LAZY
    }
  }

  // Create dynamic import with loading fallback
  const DynamicComponent = dynamic(importFn, {
    loading: () => LoadingComponent ? <LoadingComponent /> : <MobileLoadingSpinner />,
    ssr: loadingStrategy === LoadingStrategy.IMMEDIATE,
  })

  // Return enhanced component with mobile optimizations
  return function MobileLazyWrapper(props: T) {
    const [shouldLoad, setShouldLoad] = useState(
      loadingStrategy === LoadingStrategy.IMMEDIATE
    )
    const [hasError, setHasError] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const elementRef = useRef<HTMLDivElement>(null)
    const preloadTimeoutRef = useRef<NodeJS.Timeout>()

    // Retry mechanism
    const retry = useCallback(() => {
      setHasError(false)
      setError(null)
      setShouldLoad(true)
    }, [])

    // Setup intersection observer for lazy loading
    useEffect(() => {
      if (loadingStrategy !== LoadingStrategy.LAZY || shouldLoad) return

      const rootMargin = MOBILE_LAZY_CONFIG.rootMargin[
        isSlowConnection() ? 'slow' : navigator.onLine ? 'fast' : 'offline'
      ]

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setShouldLoad(true)
              observer.disconnect()
            }
          })
        },
        { rootMargin }
      )

      if (elementRef.current) {
        observer.observe(elementRef.current)
      }

      return () => observer.disconnect()
    }, [loadingStrategy, shouldLoad])

    // Setup preload strategy
    useEffect(() => {
      if (loadingStrategy !== LoadingStrategy.PRELOAD || shouldLoad) return

      // Preload after delay with probability
      preloadTimeoutRef.current = setTimeout(() => {
        if (Math.random() < MOBILE_LAZY_CONFIG.preload.probability) {
          setShouldLoad(true)
        }
      }, preloadDelay)

      return () => {
        if (preloadTimeoutRef.current) {
          clearTimeout(preloadTimeoutRef.current)
        }
      }
    }, [loadingStrategy, shouldLoad, preloadDelay])

    // Setup interaction-based loading
    useEffect(() => {
      if (loadingStrategy !== LoadingStrategy.INTERACTION || shouldLoad) return

      const handleInteraction = () => {
        setShouldLoad(true)
      }

      const element = elementRef.current
      if (element) {
        element.addEventListener('click', handleInteraction, { once: true })
        element.addEventListener('touchstart', handleInteraction, { once: true })
        element.addEventListener('mouseover', handleInteraction, { once: true })
      }

      return () => {
        if (element) {
          element.removeEventListener('click', handleInteraction)
          element.removeEventListener('touchstart', handleInteraction)
          element.removeEventListener('mouseover', handleInteraction)
        }
      }
    }, [loadingStrategy, shouldLoad])

    // Error boundary
    useEffect(() => {
      if (hasError && ErrorComponent) {
        return
      }
    }, [hasError, ErrorComponent])

    if (hasError && ErrorComponent) {
      return <ErrorComponent error={error!} retry={retry} />
    }

    if (!shouldLoad && FallbackComponent) {
      return (
        <div ref={elementRef}>
          <FallbackComponent {...props} />
        </div>
      )
    }

    if (!shouldLoad) {
      return <div ref={elementRef} style={{ minHeight: '100px' }} />
    }

    return (
      <ErrorBoundary
        fallback={({ error, retry }) => (
          ErrorComponent ? <ErrorComponent error={error} retry={retry} /> : <MobileErrorFallback error={error} retry={retry} />
        )}
        onError={(error) => {
          setHasError(true)
          setError(error)
        }}
      >
        <DynamicComponent {...props} />
      </ErrorBoundary>
    )
  }
}

// Intersection Observer hook for mobile optimization
export function useMobileIntersectionObserver(
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [hasIntersected, setHasIntersected] = useState(false)
  const elementRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    // Mobile-specific default options
    const mobileOptions: IntersectionObserverInit = {
      rootMargin: isSlowConnection() ? '200px' : '50px',
      threshold: isMobile() ? 0.1 : 0.25,
      ...options
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting)

        if (entry.isIntersecting && !hasIntersected) {
          setHasIntersected(true)
        }
      },
      mobileOptions
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [options, hasIntersected])

  return { elementRef, isIntersecting, hasIntersected }
}

// Mobile image lazy loading hook
export function useMobileImageLazyLoad(
  src: string,
  options: {
    threshold?: number
    rootMargin?: string
    placeholder?: string
  } = {}
) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { elementRef, isIntersecting } = useMobileIntersectionObserver({
    threshold: options.threshold || 0.1,
    rootMargin: options.rootMargin || (isSlowConnection() ? '200px' : '50px')
  })

  useEffect(() => {
    if (!isIntersecting || !src) return

    setIsLoading(true)
    setError(null)

    const img = new Image()

    img.onload = () => {
      setImageSrc(src)
      setIsLoading(false)
    }

    img.onerror = () => {
      setError(new Error(`Failed to load image: ${src}`))
      setIsLoading(false)
    }

    // Start loading
    img.src = src

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [isIntersecting, src])

  return {
    elementRef,
    imageSrc: imageSrc || options.placeholder,
    isLoading,
    error
  }
}

// Mobile route-based code splitting
export function createMobileRouteComponent<T extends Record<string, any>>(
  componentPath: string,
  options: {
    preload?: boolean
    fallback?: ComponentType<T>
    loadingStrategy?: LoadingStrategy
  } = {}
) {
  const { preload = false, loadingStrategy = LoadingStrategy.NETWORK_AWARE } = options

  // Import the component dynamically
  const importComponent = () => import(/* webpackChunkName: "[request]" */ `../components/${componentPath}`)

  if (preload) {
    // Preload the component
    importComponent().catch(console.error)
  }

  return createMobileLazyLoad(importComponent, {
    strategy: loadingStrategy,
    fallback: options.fallback
  })
}

// Mobile-aware data preloading
export function useMobileDataPreload<T>(
  fetchFn: () => Promise<T>,
  options: {
    trigger?: 'hover' | 'focus' | 'visible' | 'delay'
    delay?: number
    probability?: number
  } = {}
) {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [preloaded, setPreloaded] = useState(false)

  const { trigger = 'visible', delay = 1000, probability = 0.7 } = options
  const elementRef = useRef<HTMLElement>(null)

  const preloadData = useCallback(async () => {
    if (preloaded || isLoading) return

    // Probability-based preloading for mobile
    if (Math.random() > probability) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchFn()
      setData(result)
      setPreloaded(true)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Preload failed'))
    } finally {
      setIsLoading(false)
    }
  }, [fetchFn, preloaded, isLoading, probability])

  useEffect(() => {
    if (preloaded) return

    let timeoutId: NodeJS.Timeout

    switch (trigger) {
      case 'visible':
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                timeoutId = setTimeout(preloadData, delay)
                observer.disconnect()
              }
            })
          },
          { rootMargin: '100px' }
        )

        if (elementRef.current) {
          observer.observe(elementRef.current)
        }

        return () => {
          observer.disconnect()
          clearTimeout(timeoutId)
        }

      case 'hover':
        const handleMouseEnter = () => {
          timeoutId = setTimeout(preloadData, delay)
        }

        const handleMouseLeave = () => {
          clearTimeout(timeoutId)
        }

        const element = elementRef.current
        if (element) {
          element.addEventListener('mouseenter', handleMouseEnter)
          element.addEventListener('mouseleave', handleMouseLeave)
        }

        return () => {
          if (element) {
            element.removeEventListener('mouseenter', handleMouseEnter)
            element.removeEventListener('mouseleave', handleMouseLeave)
          }
          clearTimeout(timeoutId)
        }

      case 'focus':
        const handleFocus = () => {
          timeoutId = setTimeout(preloadData, delay)
        }

        const handleBlur = () => {
          clearTimeout(timeoutId)
        }

        const focusElement = elementRef.current
        if (focusElement) {
          focusElement.addEventListener('focus', handleFocus)
          focusElement.addEventListener('blur', handleBlur)
        }

        return () => {
          if (focusElement) {
            focusElement.removeEventListener('focus', handleFocus)
            focusElement.removeEventListener('blur', handleBlur)
          }
          clearTimeout(timeoutId)
        }

      case 'delay':
        timeoutId = setTimeout(preloadData, delay)
        return () => clearTimeout(timeoutId)
    }
  }, [trigger, delay, preloadData, preloaded])

  return { elementRef, data, isLoading, error, preloaded, preloadData }
}

// Loading components
function MobileLoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function MobileErrorFallback({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="p-4 text-center">
      <div className="text-red-500 text-sm mb-2">
        Failed to load component
      </div>
      <button
        onClick={retry}
        className="px-3 py-1 bg-blue-500 text-white text-sm rounded"
      >
        Retry
      </button>
    </div>
  )
}

// Error boundary component
class ErrorBoundary extends Component<
  {
    fallback: ({ error, retry }: { error: Error; retry: () => void }) => ReactNode
    onError?: (error: Error) => void
    children: ReactNode
  },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback({
        error: this.state.error,
        retry: () => this.setState({ hasError: false, error: null })
      })
    }

    return this.props.children
  }
}

// Predefined lazy components for common mobile use cases
export const MobileLazyProjects = createMobileLazyLoad(
  () => import('@/components/projects/ProjectsList'),
  {
    strategy: LoadingStrategy.NETWORK_AWARE,
    fallback: () => <div className="h-64 bg-gray-100 animate-pulse rounded-lg" />
  }
)

export const MobileLazyEmployers = createMobileLazyLoad(
  () => import('@/components/employers/EmployersList'),
  {
    strategy: LoadingStrategy.NETWORK_AWARE,
    fallback: () => <div className="h-64 bg-gray-100 animate-pulse rounded-lg" />
  }
)

export const MobileLazyRatings = createMobileLazyLoad(
  () => import('@/components/ratings/RatingsDashboard'),
  {
    strategy: LoadingStrategy.NETWORK_AWARE,
    fallback: () => <div className="h-64 bg-gray-100 animate-pulse rounded-lg" />
  }
)

// Hook for network-aware loading decisions
export function useNetworkAwareLoading() {
  const [networkInfo, setNetworkInfo] = useState({
    effectiveType: '4g' as 'slow-2g' | '2g' | '3g' | '4g',
    downlink: 10,
    rtt: 100,
    saveData: false
  })

  useEffect(() => {
    const connection = (navigator as any).connection ||
                     (navigator as any).mozConnection ||
                     (navigator as any).webkitConnection

    if (connection) {
      const updateNetworkInfo = () => {
        setNetworkInfo({
          effectiveType: connection.effectiveType || '4g',
          downlink: connection.downlink || 10,
          rtt: connection.rtt || 100,
          saveData: connection.saveData || false
        })
      }

      updateNetworkInfo()
      connection.addEventListener('change', updateNetworkInfo)

      return () => {
        connection.removeEventListener('change', updateNetworkInfo)
      }
    }
  }, [])

  const shouldPreload = useCallback((priority: 'high' | 'medium' | 'low' = 'medium') => {
    if (networkInfo.saveData) return false
    if (networkInfo.effectiveType === 'slow-2g') return priority === 'high'
    if (networkInfo.effectiveType === '2g') return priority !== 'low'
    return true
  }, [networkInfo])

  const getLoadingStrategy = useCallback((priority: 'high' | 'medium' | 'low' = 'medium'): LoadingStrategy => {
    if (!navigator.onLine) return LoadingStrategy.IMMEDIATE
    if (networkInfo.saveData) return LoadingStrategy.INTERACTION
    if (networkInfo.effectiveType === 'slow-2g' && priority === 'high') return LoadingStrategy.PRELOAD
    if (networkInfo.effectiveType === '2g' && priority !== 'low') return LoadingStrategy.PRELOAD
    return LoadingStrategy.LAZY
  }, [networkInfo])

  return {
    networkInfo,
    shouldPreload,
    getLoadingStrategy,
    isSlowConnection: networkInfo.effectiveType === 'slow-2g' || networkInfo.effectiveType === '2g',
    isFastConnection: networkInfo.effectiveType === '4g' && networkInfo.downlink > 5
  }
}

export default {
  createMobileLazyLoad,
  useMobileIntersectionObserver,
  useMobileImageLazyLoad,
  createMobileRouteComponent,
  useMobileDataPreload,
  MobileLazyProjects,
  MobileLazyEmployers,
  MobileLazyRatings,
  useNetworkAwareLoading,
  LoadingStrategy
}