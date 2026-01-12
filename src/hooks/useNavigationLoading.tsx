'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import * as Sentry from '@sentry/nextjs'

interface NavigationLoadingContextType {
  isNavigating: boolean
  startNavigation: (targetPath: string) => void
  setNavigationLoading: (loading: boolean, path?: string) => void
  targetPath: string | null
}

const NavigationLoadingContext = createContext<NavigationLoadingContextType | undefined>(undefined)

// Navigation event logging for debugging session loss
function logNavigationEvent(message: string, data?: Record<string, unknown>) {
  const payload = { ...data, timestamp: Date.now(), isoTime: new Date().toISOString() }
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[Navigation] ${message}`, payload)
  }
  if (typeof window !== 'undefined') {
    Sentry.addBreadcrumb({
      category: 'navigation',
      level: 'info',
      message,
      data: payload,
    })
  }
}

export function NavigationLoadingProvider({ children }: { children: ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(false)
  const [targetPath, setTargetPath] = useState<string | null>(null)
  const pathname = usePathname()
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigationStartTimeRef = useRef<number | null>(null)
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear navigation loading when pathname changes
  useEffect(() => {
    if (isNavigating && targetPath) {
      // Extract the base path (without query params) from targetPath
      const targetBasePath = targetPath.split('?')[0]
      
      // Check if the current pathname matches the target (with or without query params)
      if (pathname === targetBasePath || pathname === targetPath) {
        // Clear any existing clear timer
        if (clearTimerRef.current) {
          clearTimeout(clearTimerRef.current)
        }

        // Calculate how long we've been navigating
        const navigationDuration = navigationStartTimeRef.current 
          ? Date.now() - navigationStartTimeRef.current 
          : 0
        
        // Minimum display time to ensure smooth transition (800ms)
        // This ensures the overlay stays visible long enough for the page to actually render
        const MIN_DISPLAY_TIME = 800
        const remainingTime = Math.max(0, MIN_DISPLAY_TIME - navigationDuration)
        
        // Add a small additional delay to allow React to render the new page content
        const RENDER_DELAY = 200
        const totalDelay = remainingTime + RENDER_DELAY

        // Set timer to clear loading state after minimum display time + render delay
        clearTimerRef.current = setTimeout(() => {
          logNavigationEvent('Navigation completed', {
            from: pathname,
            to: targetPath,
            duration: navigationDuration,
          })
          
          // Notify service worker that navigation is complete
          // This allows deferred SW operations to proceed
          if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
            try {
              navigator.serviceWorker.controller.postMessage({ 
                type: 'NAVIGATION_END',
                pathname
              })
            } catch {
              // Ignore errors - SW may not be available
            }
          }
          
          setIsNavigating(false)
          setTargetPath(null)
          navigationStartTimeRef.current = null
          if (cancelTimerRef.current) {
            clearTimeout(cancelTimerRef.current)
            cancelTimerRef.current = null
          }
          clearTimerRef.current = null
        }, totalDelay)
        
        return () => {
          if (clearTimerRef.current) {
            clearTimeout(clearTimerRef.current)
            clearTimerRef.current = null
          }
        }
      }
    }
  }, [pathname, isNavigating, targetPath])

  // Safety timeout: clear loading state after 8 seconds to prevent infinite loading
  useEffect(() => {
    if (isNavigating) {
      if (cancelTimerRef.current) {
        clearTimeout(cancelTimerRef.current)
      }
      cancelTimerRef.current = setTimeout(() => {
        setIsNavigating(false)
        setTargetPath(null)
        navigationStartTimeRef.current = null
        cancelTimerRef.current = null
        if (clearTimerRef.current) {
          clearTimeout(clearTimerRef.current)
          clearTimerRef.current = null
        }
      }, 8000)
      return () => {
        if (cancelTimerRef.current) {
          clearTimeout(cancelTimerRef.current)
          cancelTimerRef.current = null
        }
      }
    } else {
      // Reset navigation start time when not navigating
      navigationStartTimeRef.current = null
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current)
        clearTimerRef.current = null
      }
    }

    return () => {
      if (cancelTimerRef.current) {
        clearTimeout(cancelTimerRef.current)
        cancelTimerRef.current = null
      }
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current)
        clearTimerRef.current = null
      }
    }
  }, [isNavigating])

  const startNavigation = useCallback((path: string) => {
    // Extract base paths for comparison
    const currentBasePath = pathname.split('?')[0]
    const targetBasePath = path.split('?')[0]

    // Only start navigation if actually changing pages (ignore query param changes on same page)
    if (currentBasePath !== targetBasePath) {
      const navigationId = `nav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      
      // Log navigation start for debugging session loss during navigation
      logNavigationEvent('startNavigation called', {
        navigationId,
        from: currentBasePath,
        to: targetBasePath,
        fullPath: path,
        isIOS: typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent),
        isStandalone: typeof window !== 'undefined' && (
          window.matchMedia?.('(display-mode: standalone)')?.matches ||
          (navigator as any).standalone === true
        ),
      })
      
      // Notify service worker that navigation is starting
      // This prevents the SW from triggering page reload mid-navigation
      if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
        try {
          navigator.serviceWorker.controller.postMessage({ 
            type: 'NAVIGATION_START',
            from: currentBasePath,
            to: targetBasePath
          })
        } catch {
          // Ignore errors - SW may not be available
        }
      }
      
      // Track when navigation starts for minimum display time calculation
      navigationStartTimeRef.current = Date.now()
      setTargetPath(path)
      setIsNavigating(true)
    }
  }, [pathname])

  // Direct method to set loading state (for page-level loading that bypasses navigation logic)
  const setNavigationLoading = (loading: boolean, path?: string) => {
    setIsNavigating(loading)
    if (loading) {
      navigationStartTimeRef.current = Date.now()
    } else {
      navigationStartTimeRef.current = null
    }
    if (path) {
      setTargetPath(path)
    }
    if (!loading) {
      if (cancelTimerRef.current) {
        clearTimeout(cancelTimerRef.current)
        cancelTimerRef.current = null
      }
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current)
        clearTimerRef.current = null
      }
    }
  }

  return (
    <NavigationLoadingContext.Provider value={{ isNavigating, startNavigation, setNavigationLoading, targetPath }}>
      {children}
    </NavigationLoadingContext.Provider>
  )
}

export function useNavigationLoading() {
  const context = useContext(NavigationLoadingContext)
  if (context === undefined) {
    throw new Error('useNavigationLoading must be used within a NavigationLoadingProvider')
  }
  return context
}

// Navigation Loading Overlay Component
export function NavigationLoadingOverlay() {
  const { isNavigating, targetPath } = useNavigationLoading()

  if (!isNavigating) return null

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 99999 }}
    >
      {/* Dimmed background */}
      <div className="absolute inset-0 bg-black/50" />
      
      {/* Loading indicator */}
      <div className="relative bg-white rounded-lg shadow-xl p-6 mx-4 max-w-sm w-full border border-gray-200">
        <div className="flex flex-col items-center space-y-4">
          <Image 
            src="/spinner.gif" 
            alt="Loading" 
            width={32}
            height={32}
            unoptimized
            className="w-8 h-8" 
          />
          <div className="text-center">
            <h3 className="font-medium text-gray-900">Loading Page...</h3>
            <p className="text-sm text-gray-600 mt-1">
              {targetPath ? `Navigating to ${getPageTitle(targetPath)}` : 'Please wait'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper function to get readable page titles
function getPageTitle(path: string): string {
  const routes: Record<string, string> = {
    '/': 'Dashboard',
    '/projects': 'Projects',
    '/employers': 'Employers', 
    '/workers': 'Workers',
    '/map': 'Map',
    '/patch': 'Patch Management',
    '/site-visits': 'Site Visits',
    '/campaigns': 'Campaigns',
    '/lead': 'Co-ordinator Console',
    '/admin': 'Administration'
  }
  
  // Check for project pages
  if (path.startsWith('/projects/')) {
    if (path.includes('/mappingsheets-mobile')) {
      return 'Mapping Sheets'
    }
    if (path.includes('?tab=mappingsheets')) {
      return 'Mapping Sheets'
    }
    if (path.includes('?tab=contractors')) {
      return 'Project Contractors'
    }
    return 'Project Details'
  }
  
  return routes[path] || 'Page'
}
