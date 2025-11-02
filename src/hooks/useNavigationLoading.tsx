'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'

interface NavigationLoadingContextType {
  isNavigating: boolean
  startNavigation: (targetPath: string) => void
  setNavigationLoading: (loading: boolean, path?: string) => void
  targetPath: string | null
}

const NavigationLoadingContext = createContext<NavigationLoadingContextType | undefined>(undefined)

export function NavigationLoadingProvider({ children }: { children: ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(false)
  const [targetPath, setTargetPath] = useState<string | null>(null)
  const pathname = usePathname()
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear navigation loading when pathname changes
  useEffect(() => {
    if (isNavigating && targetPath) {
      // Extract the base path (without query params) from targetPath
      const targetBasePath = targetPath.split('?')[0]
      
      // Check if the current pathname matches the target (with or without query params)
      if (pathname === targetBasePath || pathname === targetPath) {
        // Add small delay to ensure smooth transition
        const timer = setTimeout(() => {
          setIsNavigating(false)
          setTargetPath(null)
          if (cancelTimerRef.current) {
            clearTimeout(cancelTimerRef.current)
            cancelTimerRef.current = null
          }
        }, 150)
        
        return () => clearTimeout(timer)
      }
    }
  }, [pathname, isNavigating, targetPath])

  useEffect(() => {
    if (isNavigating) {
      if (cancelTimerRef.current) {
        clearTimeout(cancelTimerRef.current)
      }
      cancelTimerRef.current = setTimeout(() => {
        setIsNavigating(false)
        setTargetPath(null)
        cancelTimerRef.current = null
      }, 8000)
      return () => {
        if (cancelTimerRef.current) {
          clearTimeout(cancelTimerRef.current)
          cancelTimerRef.current = null
        }
      }
    }

    return () => {
      if (cancelTimerRef.current) {
        clearTimeout(cancelTimerRef.current)
        cancelTimerRef.current = null
      }
    }
  }, [isNavigating])

  const startNavigation = (path: string) => {
    // Extract base paths for comparison
    const currentBasePath = pathname.split('?')[0]
    const targetBasePath = path.split('?')[0]

    // Only start navigation if actually changing pages (ignore query param changes on same page)
    if (currentBasePath !== targetBasePath) {
      setTargetPath(path)
      setIsNavigating(true)
    }
  }

  // Direct method to set loading state (for page-level loading that bypasses navigation logic)
  const setNavigationLoading = (loading: boolean, path?: string) => {
    setIsNavigating(loading)
    if (path) {
      setTargetPath(path)
    }
    if (!loading && cancelTimerRef.current) {
      clearTimeout(cancelTimerRef.current)
      cancelTimerRef.current = null
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
