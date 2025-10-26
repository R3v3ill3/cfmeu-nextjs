"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'

// PWA Installation hook
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null)
  const [isInstallable, setIsInstallable] = React.useState(false)
  const [isInstalled, setIsInstalled] = React.useState(false)

  React.useEffect(() => {
    // Check if app is already installed
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      const isInWebAppiOS = (window.navigator as any).standalone === true
      setIsInstalled(isStandalone || isInWebAppiOS)
    }

    checkInstalled()

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsInstallable(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const install = React.useCallback(async () => {
    if (!deferredPrompt) {
      console.warn('Install prompt not available')
      return false
    }

    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        console.log('User accepted the install prompt')
        setDeferredPrompt(null)
        setIsInstallable(false)
        return true
      } else {
        console.log('User dismissed the install prompt')
        return false
      }
    } catch (error) {
      console.error('Error during installation:', error)
      return false
    }
  }, [deferredPrompt])

  return {
    isInstallable,
    isInstalled,
    install,
    deferredPrompt
  }
}

// Service Worker registration hook
export function useServiceWorker() {
  const [registration, setRegistration] = React.useState<ServiceWorkerRegistration | null>(null)
  const [isSupported, setIsSupported] = React.useState(false)
  const [isRegistered, setIsRegistered] = React.useState(false)

  React.useEffect(() => {
    setIsSupported('serviceWorker' in navigator)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('Service Worker registered:', reg)
          setRegistration(reg)
          setIsRegistered(true)

          // Check for updates periodically
          setInterval(() => {
            reg.update().catch(() => {
              // Ignore update errors
            })
          }, 60 * 60 * 1000) // Check every hour
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error)
        })
    }
  }, [])

  const update = React.useCallback(async () => {
    if (!registration) return false

    try {
      await registration.update()
      return true
    } catch (error) {
      console.error('Service Worker update failed:', error)
      return false
    }
  }, [registration])

  const unregister = React.useCallback(async () => {
    if (!registration) return false

    try {
      await registration.unregister()
      setRegistration(null)
      setIsRegistered(false)
      return true
    } catch (error) {
      console.error('Service Worker unregistration failed:', error)
      return false
    }
  }, [registration])

  return {
    isSupported,
    isRegistered,
    registration,
    update,
    unregister
  }
}

// Push notification hook
export function usePushNotifications() {
  const [subscription, setSubscription] = React.useState<PushSubscription | null>(null)
  const [permission, setPermission] = React.useState<NotificationPermission>('default')
  const [isSupported, setIsSupported] = React.useState(false)

  React.useEffect(() => {
    setIsSupported('PushManager' in window && 'Notification' in window)

    if ('Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  const requestPermission = React.useCallback(async () => {
    if (!isSupported) {
      console.warn('Push notifications not supported')
      return false
    }

    try {
      const permission = await Notification.requestPermission()
      setPermission(permission)

      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '')
        })

        setSubscription(subscription)

        // Send subscription to server
        await sendSubscriptionToServer(subscription)

        return true
      }

      return false
    } catch (error) {
      console.error('Error requesting push notification permission:', error)
      return false
    }
  }, [isSupported])

  const unsubscribe = React.useCallback(async () => {
    if (!subscription) return false

    try {
      await subscription.unsubscribe()
      setSubscription(null)
      return true
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error)
      return false
    }
  }, [subscription])

  return {
    isSupported,
    permission,
    subscription,
    requestPermission,
    unsubscribe
  }
}

// Background sync hook
export function useBackgroundSync() {
  const [isSupported, setIsSupported] = React.useState(false)
  const [registration, setRegistration] = React.useState<ServiceWorkerRegistration | null>(null)

  React.useEffect(() => {
    const checkSupport = async () => {
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        const reg = await navigator.serviceWorker.ready
        setIsSupported(true)
        setRegistration(reg)
      }
    }

    checkSupport()
  }, [])

  const registerSync = React.useCallback(async (tag: string) => {
    if (!isSupported || !registration) {
      console.warn('Background sync not supported')
      return false
    }

    try {
      await registration.sync.register(tag)
      console.log(`Background sync registered: ${tag}`)
      return true
    } catch (error) {
      console.error('Error registering background sync:', error)
      return false
    }
  }, [isSupported, registration])

  return {
    isSupported,
    registerSync
  }
}

// Network status hook
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = React.useState(true)
  const [connectionType, setConnectionType] = React.useState<string>('unknown')
  const [effectiveType, setEffectiveType] = React.useState<string>('unknown')

  React.useEffect(() => {
    const updateNetworkStatus = () => {
      setIsOnline(navigator.onLine)

      const connection = (navigator as any).connection
      if (connection) {
        setConnectionType(connection.type || 'unknown')
        setEffectiveType(connection.effectiveType || 'unknown')
      }
    }

    const handleOnline = () => {
      setIsOnline(true)
      updateNetworkStatus()
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    const handleConnectionChange = () => {
      updateNetworkStatus()
    }

    // Initial status
    updateNetworkStatus()

    // Event listeners
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const connection = (navigator as any).connection
    if (connection) {
      connection.addEventListener('change', handleConnectionChange)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)

      if (connection) {
        connection.removeEventListener('change', handleConnectionChange)
      }
    }
  }, [])

  return {
    isOnline,
    connectionType,
    effectiveType
  }
}

// App badge hook
export function useAppBadge() {
  const [isSupported, setIsSupported] = React.useState(false)

  React.useEffect(() => {
    setIsSupported('setAppBadge' in navigator && 'clearAppBadge' in navigator)
  }, [])

  const setBadge = React.useCallback(async (count: number) => {
    if (!isSupported) return false

    try {
      if (count === 0) {
        await (navigator as any).clearAppBadge()
      } else {
        await (navigator as any).setAppBadge(count)
      }
      return true
    } catch (error) {
      console.error('Error setting app badge:', error)
      return false
    }
  }, [isSupported])

  const clearBadge = React.useCallback(async () => {
    if (!isSupported) return false

    try {
      await (navigator as any).clearAppBadge()
      return true
    } catch (error) {
      console.error('Error clearing app badge:', error)
      return false
    }
  }, [isSupported])

  return {
    isSupported,
    setBadge,
    clearBadge
  }
}

// Screen wake lock hook
export function useWakeLock() {
  const [isSupported, setIsSupported] = React.useState(false)
  const [wakeLock, setWakeLock] = React.useState<any>(null)

  React.useEffect(() => {
    setIsSupported('wakeLock' in navigator)
  }, [])

  const requestWakeLock = React.useCallback(async () => {
    if (!isSupported) return false

    try {
      const lock = await (navigator as any).wakeLock.request('screen')
      setWakeLock(lock)

      lock.addEventListener('release', () => {
        setWakeLock(null)
      })

      return true
    } catch (error) {
      console.error('Error requesting wake lock:', error)
      return false
    }
  }, [isSupported])

  const releaseWakeLock = React.useCallback(async () => {
    if (!wakeLock) return false

    try {
      await wakeLock.release()
      setWakeLock(null)
      return true
    } catch (error) {
      console.error('Error releasing wake lock:', error)
      return false
    }
  }, [wakeLock])

  return {
    isSupported,
    isActive: !!wakeLock,
    requestWakeLock,
    releaseWakeLock
  }
}

// Share API hook
export function useShareAPI() {
  const [isSupported, setIsSupported] = React.useState(false)

  React.useEffect(() => {
    setIsSupported('share' in navigator)
  }, [])

  const share = React.useCallback(async (data: ShareData) => {
    if (!isSupported) return false

    try {
      await navigator.share(data)
      return true
    } catch (error) {
      console.error('Error sharing:', error)
      return false
    }
  }, [isSupported])

  return {
    isSupported,
    share
  }
}

// File handling hook
export function useFileHandling() {
  const [isSupported, setIsSupported] = React.useState(false)

  React.useEffect(() => {
    setIsSupported('launchQueue' in navigator && 'launchParams' in navigator)
  }, [])

  const handleFiles = React.useCallback((callback: (files: File[]) => void) => {
    if (!isSupported) return

    const launchQueue = (navigator as any).launchQueue
    if (launchQueue) {
      launchQueue.setConsumer((launchParams: any) => {
        if (launchParams.files && launchParams.files.length > 0) {
          callback(Array.from(launchParams.files))
        }
      })
    }
  }, [isSupported])

  return {
    isSupported,
    handleFiles
  }
}

// Utility functions
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

async function sendSubscriptionToServer(subscription: PushSubscription) {
  try {
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription)
    })
  } catch (error) {
    console.error('Error sending subscription to server:', error)
  }
}

// PWA status component
export function PWAStatus() {
  const { isInstallable, isInstalled, install } = usePWAInstall()
  const { isRegistered } = useServiceWorker()
  const { isOnline } = useNetworkStatus()

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="font-semibold mb-2">PWA Status</h3>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Service Worker:</span>
          <span className={isRegistered ? 'text-green-600' : 'text-red-600'}>
            {isRegistered ? 'Registered' : 'Not Registered'}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Network:</span>
          <span className={isOnline ? 'text-green-600' : 'text-red-600'}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Installation:</span>
          <span className={
            isInstalled ? 'text-green-600' :
            isInstallable ? 'text-yellow-600' :
            'text-gray-600'
          }>
            {isInstalled ? 'Installed' :
             isInstallable ? 'Installable' :
             'Not Installable'}
          </span>
        </div>

        {isInstallable && !isInstalled && (
          <button
            onClick={install}
            className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Install App
          </button>
        )}
      </div>
    </div>
  )
}

// PWA Provider component
export function PWAProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      {/* PWA-related components can be added here */}
    </>
  )
}