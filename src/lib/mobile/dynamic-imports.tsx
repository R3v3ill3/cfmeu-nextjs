"use client"

import { useState, useEffect, useCallback, useMemo, useRef, memo, Suspense } from 'react'
import type { ReactNode, ComponentType, RefObject } from 'react'
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

// Loading component for dynamic imports
interface LoadingFallbackProps {
  height?: string
  className?: string
}

export function LoadingFallback({ height = "200px", className = "" }: LoadingFallbackProps) {
  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="h-4 bg-muted rounded w-2/3" />
      </div>
    </div>
  )
}

// Card skeleton for mobile components
export function CardSkeleton() {
  return (
    <div className="p-4 border rounded-lg">
      <div className="animate-pulse space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-muted rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-muted rounded w-full" />
          <div className="h-3 bg-muted rounded w-2/3" />
        </div>
      </div>
    </div>
  )
}

// List skeleton for mobile lists
export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  )
}

// Dynamic import wrapper with suspense and error boundary
interface DynamicComponentProps {
  loader: () => Promise<{ default: ComponentType<any> }>
  fallback?: ReactNode
  errorFallback?: ReactNode
  [key: string]: any
}

function DynamicComponentWrapper({
  loader,
  fallback = <LoadingFallback />,
  errorFallback = <div className="p-4 text-center text-muted-foreground">Failed to load component</div>,
  ...props
}: DynamicComponentProps) {
  const LazyComponent = useMemo(() => dynamic(loader, {
    loading: () => <>{fallback}</>,
    ssr: false // Disable SSR for mobile components for better performance
  }), [loader, fallback])

  return (
    <Suspense fallback={fallback}>
      <LazyComponent {...props} />
    </Suspense>
  )
}

// Preloading utilities
const preloadCache = new Map<string, Promise<any>>()

export function preloadComponent(componentName: string, loader: () => Promise<any>) {
  if (!preloadCache.has(componentName)) {
    const promise = loader()
    preloadCache.set(componentName, promise)
  }
  return preloadCache.get(componentName)!
}

// Mobile rating system components
export const DynamicTrafficLightDisplay = memo((props: any) => (
  <DynamicComponentWrapper
    loader={() => import("@/components/mobile/rating-system/TrafficLightDisplay")}
    fallback={<LoadingFallback height="60px" />}
    {...props}
  />
))

export const DynamicEmployerRatingCard = memo((props: any) => (
  <DynamicComponentWrapper
    loader={() => import("@/components/mobile/rating-system/EmployerRatingCard")}
    fallback={<CardSkeleton />}
    {...props}
  />
))

export const DynamicRatingWizard = memo((props: any) => (
  <DynamicComponentWrapper
    loader={() => import("@/components/mobile/rating-system/RatingWizard")}
    fallback={<LoadingFallback height="400px" />}
    {...props}
  />
))

export const DynamicRatingDashboard = memo((props: any) => (
  <DynamicComponentWrapper
    loader={() => import("@/components/mobile/rating-system/RatingDashboard")}
    fallback={<LoadingFallback height="500px" />}
    {...props}
  />
))

export const DynamicRatingBreakdown = memo((props: any) => (
  <DynamicComponentWrapper
    loader={() => import("@/components/mobile/rating-system/RatingBreakdown")}
    fallback={<LoadingFallback height="300px" />}
    {...props}
  />
))

export const DynamicRatingComparison = memo((props: any) => (
  <DynamicComponentWrapper
    loader={() => import("@/components/mobile/rating-system/RatingComparison")}
    fallback={<LoadingFallback height="350px" />}
    {...props}
  />
))

export const DynamicWeightingManagerMobile = memo((props: any) => (
  <DynamicComponentWrapper
    loader={() => import("@/components/mobile/rating-system/WeightingManagerMobile")}
    fallback={<LoadingFallback height="400px" />}
    {...props}
  />
))

export const DynamicRatingHistory = memo((props: any) => (
  <DynamicComponentWrapper
    loader={() => import("@/components/mobile/rating-system/RatingHistory")}
    fallback={<LoadingFallback height="300px" />}
    {...props}
  />
))

// Mobile shared components
export const DynamicBottomSheet = memo((props: any) => (
  <DynamicComponentWrapper
    loader={() => import("@/components/mobile/shared/BottomSheet")}
    fallback={<div className="fixed inset-x-0 bottom-0 bg-white border-t animate-pulse" style={{ height: '200px' }} />}
    {...props}
  />
))

export const DynamicPullToRefresh = memo((props: any) => (
  <DynamicComponentWrapper
    loader={() => import("@/components/mobile/shared/PullToRefresh")}
    fallback={props.children}
    {...props}
  />
))

export const DynamicSwipeActions = memo((props: any) => (
  <DynamicComponentWrapper
    loader={() => import("@/components/mobile/shared/SwipeActions")}
    fallback={props.children}
    {...props}
  />
))

export const DynamicHapticFeedback = memo((props: any) => (
  <DynamicComponentWrapper
    loader={() => import("@/components/mobile/shared/HapticFeedback")}
    fallback={props.children}
    {...props}
  />
))

export const DynamicMobileForm = memo((props: any) => (
  <DynamicComponentWrapper
    loader={() => import("@/components/mobile/shared/MobileForm")}
    fallback={<LoadingFallback height="300px" />}
    {...props}
  />
))

// Bundle optimization utilities
export class BundleOptimizer {
  private static loadedChunks = new Set<string>()

  // Preload critical components
  static async preloadCritical() {
    const criticalComponents = [
      () => import("@/components/mobile/rating-system/TrafficLightDisplay"),
      () => import("@/components/mobile/rating-system/EmployerRatingCard"),
      () => import("@/components/mobile/shared/HapticFeedback"),
    ]

    await Promise.all(criticalComponents.map(loader => {
      const componentName = loader.toString()
      if (!this.loadedChunks.has(componentName)) {
        this.loadedChunks.add(componentName)
        return preloadComponent(componentName, loader)
      }
    }))
  }

  // Preload components based on user interaction
  static preloadOnInteraction(componentName: string, loader: () => Promise<any>) {
    const preload = () => {
      if (!this.loadedChunks.has(componentName)) {
        this.loadedChunks.add(componentName)
        preloadComponent(componentName, loader)
      }
    }

    // Preload on touch events for mobile
    if (typeof window !== 'undefined') {
      const events = ['touchstart', 'mousedown', 'keydown']
      events.forEach(event => {
        document.addEventListener(event, preload, { once: true, passive: true })
      })

      // Also preload after a delay
      setTimeout(preload, 2000)
    }

    return preload
  }

  // Get current bundle usage
  static getBundleUsage() {
    return {
      loadedChunks: Array.from(this.loadedChunks),
      totalLoaded: this.loadedChunks.size,
    }
  }

  // Clear cache for testing
  static clearCache() {
    this.loadedChunks.clear()
    preloadCache.clear()
  }
}

// Intersection Observer for lazy loading
export function useIntersectionObserver(
  ref: RefObject<Element>,
  callback: () => void,
  options: IntersectionObserverInit = {}
) {
  useEffect(() => {
    if (!ref.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          callback()
          observer.disconnect()
        }
      },
      {
        rootMargin: '50px',
        threshold: 0.1,
        ...options
      }
    )

    observer.observe(ref.current)

    return () => observer.disconnect()
  }, [ref, callback, options])
}

// Hook for lazy loading components
export function useLazyLoad<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  options: {
    threshold?: number
    rootMargin?: string
    fallback?: ReactNode
  } = {}
) {
  const [Component, setComponent] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const elementRef = useRef<HTMLDivElement>(null)

  const loadComponent = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const module = await loader()
      setComponent(() => module.default)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load component'))
    } finally {
      setLoading(false)
    }
  }, [loader])

  useIntersectionObserver(
    elementRef,
    loadComponent,
    {
      threshold: options.threshold || 0.1,
      rootMargin: options.rootMargin || '50px'
    }
  )

  const LazyComponent = useMemo(() => {
    if (Component) {
      return Component
    }

    return () => (
      <div ref={elementRef}>
        {options.fallback || <LoadingFallback />}
      </div>
    )
  }, [Component, options.fallback])

  return {
    Component: LazyComponent,
    loading,
    error,
    ref: elementRef
  }
}

// Resource hint utilities
export const resourceHints = {
  // Preconnect to external domains
  preconnect: (href: string) => {
    if (typeof document !== 'undefined') {
      const link = document.createElement('link')
      link.rel = 'preconnect'
      link.href = href
      document.head.appendChild(link)
    }
  },

  // DNS prefetch for external domains
  dnsPrefetch: (href: string) => {
    if (typeof document !== 'undefined') {
      const link = document.createElement('link')
      link.rel = 'dns-prefetch'
      link.href = href
      document.head.appendChild(link)
    }
  },

  // Prefetch critical resources
  prefetch: (href: string, as: string = 'script') => {
    if (typeof document !== 'undefined') {
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.href = href
      link.as = as
      document.head.appendChild(link)
    }
  },

  // Preload critical resources
  preload: (href: string, as: string, type?: string) => {
    if (typeof document !== 'undefined') {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.href = href
      link.as = as
      if (type) {
        link.type = type
      }
      document.head.appendChild(link)
    }
  }
}

// Initialize resource hints
if (typeof window !== 'undefined') {
  // Preconnect to common external services
  resourceHints.preconnect('https://fonts.googleapis.com')
  resourceHints.preconnect('https://fonts.gstatic.com')
  resourceHints.preconnect('https://api.supabase.co')

  // DNS prefetch for potential external resources
  resourceHints.dnsPrefetch('https://www.googletagmanager.com')
}