'use client'

import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { useGeofencing } from '@/hooks/useGeofencing'
import { toast } from 'sonner'

interface GeofencingPermissionContextType {
  showPermissionRequest: boolean
  hasRequestedToday: boolean
  dismissPermissionRequest: () => void
  requestPermissionsNow: () => Promise<boolean>
}

const GeofencingPermissionContext = createContext<GeofencingPermissionContextType | undefined>(undefined)

export function useGeofencingPermission() {
  const context = useContext(GeofencingPermissionContext)
  if (!context) {
    throw new Error('useGeofencingPermission must be used within GeofencingPermissionProvider')
  }
  return context
}

interface GeofencingPermissionProviderProps {
  children: ReactNode
  autoCheck?: boolean // Whether to automatically check permissions on mount
}

export function GeofencingPermissionProvider({ children, autoCheck = true }: GeofencingPermissionProviderProps) {
  const [showPermissionRequest, setShowPermissionRequest] = useState(false)
  const [hasRequestedToday, setHasRequestedToday] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Use geofencing hook with enabled=false initially
  const { requestLocationAccess, isSupported, hasLocationPermission } = useGeofencing(false)

  // Check if we've already requested permissions today
  useEffect(() => {
    if (typeof window === 'undefined') return

    const today = new Date().toDateString()
    const lastRequestDate = localStorage.getItem('geofence-permission-request-date')

    if (lastRequestDate === today) {
      setHasRequestedToday(true)
    }

    // Check if geofencing was previously enabled
    const geofencingWasEnabled = localStorage.getItem('geofencing-enabled') === 'true'

    if (geofencingWasEnabled && autoCheck && !initialized) {
      setInitialized(true)

      // If geofencing was enabled but we don't have permission, show the dialog
      setTimeout(() => {
        if (!hasLocationPermission && isSupported && !hasRequestedToday) {
          console.log('[GeofencingPermission] Showing automatic permission request')
          setShowPermissionRequest(true)
        }
      }, 2000) // Show after 2 seconds to let app load first
    }
  }, [autoCheck, hasLocationPermission, isSupported, hasRequestedToday, initialized])

  const dismissPermissionRequest = () => {
    setShowPermissionRequest(false)

    // Remember that we dismissed today so we don't bug the user
    const today = new Date().toDateString()
    localStorage.setItem('geofence-permission-dismiss-date', today)
  }

  const requestPermissionsNow = async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error('Geofencing is not supported on this device')
      return false
    }

    try {
      const granted = await requestLocationAccess()

      if (granted) {
        setShowPermissionRequest(false)

        // Remember we requested today
        const today = new Date().toDateString()
        localStorage.setItem('geofence-permission-request-date', today)
        setHasRequestedToday(true)

        toast.success('Location permission granted! Geofencing is now active.')

        // Enable geofencing automatically
        localStorage.setItem('geofencing-enabled', 'true')

        return true
      } else {
        // User denied permission
        dismissPermissionRequest()
        return false
      }
    } catch (error) {
      console.error('[GeofencingPermission] Error requesting permissions:', error)
      toast.error('Failed to request location permission')
      dismissPermissionRequest()
      return false
    }
  }

  const value: GeofencingPermissionContextType = {
    showPermissionRequest,
    hasRequestedToday,
    dismissPermissionRequest,
    requestPermissionsNow,
  }

  return (
    <GeofencingPermissionContext.Provider value={value}>
      {children}

      {/* Global Permission Request Dialog */}
      {showPermissionRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Enable Location Services
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                CFMEU needs location access to notify you when you're near job sites. This helps you quickly record site visits.
              </p>

              <div className="space-y-3">
                <button
                  onClick={requestPermissionsNow}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  Enable Location
                </button>

                <button
                  onClick={dismissPermissionRequest}
                  className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  Not Now
                </button>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">
                You can always enable this later in Settings &gt; Site Visit Geofencing
              </p>
            </div>
          </div>
        </div>
      )}
    </GeofencingPermissionContext.Provider>
  )
}