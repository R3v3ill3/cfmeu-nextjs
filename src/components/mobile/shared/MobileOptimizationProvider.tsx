"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { PerformanceMonitor, PerformanceMetricsDisplay } from "@/lib/performance/performance-monitoring"
import { PWAProvider, PWAStatus } from "@/lib/pwa/pwa-utils"
import { GestureProvider } from "@/hooks/useMobileGestures"
import { useMobilePerformance } from "@/hooks/useMobilePerformance"
import { useNetworkOptimization } from "@/lib/network/network-optimization"
import { useDeviceCapabilities } from "@/hooks/useMobilePerformance"

interface MobileOptimizationProviderProps {
  children: ReactNode
  enablePerformanceMonitoring?: boolean
  enablePWAFeatures?: boolean
  enableGestureSupport?: boolean
  enableNetworkOptimization?: boolean
  performanceReporting?: boolean
  showDebugInfo?: boolean
}

export function MobileOptimizationProvider({
  children,
  enablePerformanceMonitoring = true,
  enablePWAFeatures = true,
  enableGestureSupport = true,
  enableNetworkOptimization = true,
  performanceReporting = false,
  showDebugInfo = false
}: MobileOptimizationProviderProps) {
  const { isOnline, networkInfo } = useNetworkOptimization()
  const { isLowEnd, prefersReducedMotion } = useDeviceCapabilities()
  const { metrics } = useMobilePerformance()

  // Apply performance optimizations based on device capabilities
  React.useEffect(() => {
    const root = document.documentElement

    // Set device capability classes
    root.classList.toggle('low-end-device', isLowEnd)
    root.classList.toggle('reduced-motion', prefersReducedMotion)
    root.classList.toggle('offline', !isOnline)

    // Set network quality classes
    if (networkInfo) {
      root.classList.toggle('slow-network', networkInfo.effectiveType === 'slow-2g' || networkInfo.effectiveType === '2g')
      root.classList.toggle('fast-network', networkInfo.effectiveType === '4g')
      root.classList.toggle('save-data', networkInfo.saveData)
    }

    // Optimize rendering for low-end devices
    if (isLowEnd) {
      root.style.setProperty('--animation-duration-multiplier', '0.5')
      root.style.setProperty('--shadow-opacity-multiplier', '0.7')
      root.style.setProperty('--blur-multiplier', '0.8')
    }

    // Apply reduced motion preferences
    if (prefersReducedMotion) {
      root.style.setProperty('--animation-duration-multiplier', '0')
    }

  }, [isLowEnd, prefersReducedMotion, isOnline, networkInfo])

  // Handle online/offline events
  React.useEffect(() => {
    const handleOnline = () => {
      document.documentElement.classList.remove('offline')
      // Show notification if needed
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.sync?.register('background-sync')
        })
      }
    }

    const handleOffline = () => {
      document.documentElement.classList.add('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Performance reporting handler
  const handlePerformanceReport = React.useCallback((report: any) => {
    if (performanceReporting) {
      console.log('Performance Report:', report)

      // Send to analytics service if needed
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'performance_report', {
          score: report.score,
          level: report.level,
          issues_count: report.issues.length
        })
      }

      // Store for debugging
      localStorage.setItem('performance_report', JSON.stringify({
        ...report,
        timestamp: Date.now()
      }))
    }
  }, [performanceReporting])

  // Preload critical resources
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      // Preload critical mobile components
      const criticalResources = [
        '/styles/mobile.css',
        '/icons/icon-192x192.png'
      ]

      criticalResources.forEach(resource => {
        const link = document.createElement('link')
        link.rel = 'preload'
        link.href = resource
        link.as = resource.endsWith('.css') ? 'style' : 'image'
        document.head.appendChild(link)
      })
    }
  }, [])

  return (
    <GestureProvider>
      <PWAProvider>
        <PerformanceMonitor
          enabled={enablePerformanceMonitoring}
          onReport={handlePerformanceReport}
          interval={performanceReporting ? 60000 : 300000} // Report every minute if enabled
        >
          <div className={`mobile-optimized ${isLowEnd ? 'low-end' : ''} ${!isOnline ? 'offline' : ''}`}>
            {children}

            {/* Debug overlay for development */}
            {showDebugInfo && (
              <div className="fixed bottom-4 left-4 z-50 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 max-w-xs">
                <h4 className="font-semibold text-xs mb-2">Mobile Debug Info</h4>

                {/* Performance metrics */}
                {metrics && (
                  <div className="text-xs space-y-1 mb-2">
                    <div>FPS: {metrics.fps || 'N/A'}</div>
                    <div>Memory: {metrics.memoryUsage ? `${(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB` : 'N/A'}</div>
                    <div>Network: {isOnline ? 'Online' : 'Offline'}</div>
                    {networkInfo && (
                      <div>Type: {networkInfo.effectiveType}</div>
                    )}
                  </div>
                )}

                {/* PWA Status */}
                <PWAStatus />

                {/* Device capabilities */}
                <div className="text-xs space-y-1 mt-2">
                  <div>Low-end: {isLowEnd ? 'Yes' : 'No'}</div>
                  <div>Reduced Motion: {prefersReducedMotion ? 'Yes' : 'No'}</div>
                </div>
              </div>
            )}

            {/* Offline indicator */}
            {!isOnline && (
              <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 px-4 z-50 text-sm">
                You're offline. Some features may be limited.
              </div>
            )}

            {/* Slow network indicator */}
            {isOnline && networkInfo?.effectiveType && (
              ['slow-2g', '2g', '3g'].includes(networkInfo.effectiveType) && (
                <div className="fixed top-12 left-0 right-0 bg-orange-500 text-white text-center py-1 px-4 z-40 text-xs">
                  Slow network detected. Performance may be reduced.
                </div>
              )
            )}

            {/* Performance warning for low-end devices */}
            {isLowEnd && (
              <div className="fixed bottom-4 right-4 bg-blue-500 text-white p-3 rounded-lg shadow-lg max-w-xs z-40">
                <p className="text-xs">
                  Performance mode enabled for your device.
                </p>
              </div>
            )}
          </div>
        </PerformanceMonitor>
      </PWAProvider>
    </GestureProvider>
  )
}

// Hook for mobile optimization context
export function useMobileOptimization() {
  const [isMobileOptimized, setIsMobileOptimized] = React.useState(false)

  React.useEffect(() => {
    // Check if we're on a mobile device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
                     window.innerWidth <= 768

    setIsMobileOptimized(isMobile)

    // Add mobile-specific classes
    if (isMobile) {
      document.documentElement.classList.add('mobile-optimized')
      document.documentElement.classList.add('touch-device')

      // Set viewport meta tag for mobile
      const viewport = document.querySelector('meta[name="viewport"]')
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes')
      }
    }

    // Handle orientation changes
    const handleOrientationChange = () => {
      const orientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
      document.documentElement.setAttribute('data-orientation', orientation)
    }

    window.addEventListener('resize', handleOrientationChange)
    handleOrientationChange() // Initial call

    return () => {
      window.removeEventListener('resize', handleOrientationChange)
    }
  }, [])

  return {
    isMobileOptimized,
    isTouchDevice: 'ontouchstart' in window,
    isStandalone: window.matchMedia('(display-mode: standalone)').matches
  }
}

// Higher-order component for mobile optimization
export function withMobileOptimization<P extends object>(
  Component: React.ComponentType<P>,
  options: MobileOptimizationProviderProps = {}
) {
  return function MobileOptimizedComponent(props: P) {
    return (
      <MobileOptimizationProvider {...options}>
        <Component {...props} />
      </MobileOptimizationProvider>
    )
  }
}

// Mobile-specific error boundary
interface MobileErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class MobileErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  MobileErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): MobileErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    // Log error for debugging
    console.error('Mobile Error Boundary caught an error:', error, errorInfo)

    // Send to error reporting service if available
    if (typeof window !== 'undefined' && window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack
          }
        }
      })
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-6">
              We're sorry, but something unexpected happened. Please try again.
            </p>
            <button
              onClick={this.handleRetry}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500">
                  Error Details
                </summary>
                <pre className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Mobile loading state component
export function MobileLoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 text-sm">{message}</p>
      </div>
    </div>
  )
}

// Mobile optimized layout wrapper
export function MobileLayout({
  children,
  title,
  showBackButton = false,
  onBack,
  actions,
  className = ""
}: {
  children: ReactNode
  title?: string
  showBackButton?: boolean
  onBack?: () => void
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={`min-h-screen bg-gray-50 mobile-layout ${className}`}>
      {/* Header */}
      {(title || showBackButton || actions) && (
        <header className="bg-white border-b border-gray-200 px-4 py-3 safe-area-inset-top">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <div className="flex items-center gap-3">
              {showBackButton && (
                <button
                  onClick={onBack}
                  className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Go back"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              {title && (
                <h1 className="text-lg font-semibold text-gray-900 truncate">
                  {title}
                </h1>
              )}
            </div>
            {actions && (
              <div className="flex items-center gap-2">
                {actions}
              </div>
            )}
          </div>
        </header>
      )}

      {/* Main content */}
      <main className="pb-safe-area-inset-bottom">
        {children}
      </main>
    </div>
  )
}