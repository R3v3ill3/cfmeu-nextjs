'use client'

import React, { useEffect, useState, Suspense, useCallback } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import type { ReactNode } from 'react'
import { PostHogProvider } from '@/providers/PostHogProvider'
import { AuthProvider } from '@/hooks/useAuth'
import * as Sentry from '@sentry/nextjs'
import { EmployerDetailModal } from '@/components/employers/EmployerDetailModal'

type ProvidersProps = {
  children: ReactNode
}

const SHOULD_EXPOSE_QUERY_DEBUG =
  process.env.NEXT_PUBLIC_ENABLE_QUERY_DEBUG === 'true' || process.env.NODE_ENV !== 'production'

const SHOULD_ENABLE_E2E_HELPERS =
  process.env.NEXT_PUBLIC_ENABLE_E2E_HELPERS === 'true' || process.env.NODE_ENV !== 'production'

export default function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30000, // 30 seconds for regular data
        refetchOnWindowFocus: false, // Prevent unnecessary refetches
        retry: 1, // Retry failed queries once
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
      mutations: {
        retry: 1,
      },
    },
  }))

  useEffect(() => {
    if (!SHOULD_EXPOSE_QUERY_DEBUG || typeof window === 'undefined') {
      return
    }

    const globalWindow = window as typeof window & {
      __REACT_QUERY_CLIENT__?: QueryClient
      __REACT_QUERY_DEBUG_LOG__?: Array<Record<string, unknown>>
    }

    globalWindow.__REACT_QUERY_CLIENT__ = queryClient
    if (!Array.isArray(globalWindow.__REACT_QUERY_DEBUG_LOG__)) {
      globalWindow.__REACT_QUERY_DEBUG_LOG__ = []
    }

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      const entry = {
        type: event.type,
        queryHash: event.query?.queryHash,
        queryKey: event.query?.queryKey,
        timestamp: new Date().toISOString(),
      }
      globalWindow.__REACT_QUERY_DEBUG_LOG__!.push(entry)
      if (globalWindow.__REACT_QUERY_DEBUG_LOG__!.length > 500) {
        globalWindow.__REACT_QUERY_DEBUG_LOG__!.shift()
      }
    })

    return () => {
      unsubscribe()
      if (globalWindow.__REACT_QUERY_CLIENT__ === queryClient) {
        delete globalWindow.__REACT_QUERY_CLIENT__
      }
    }
  }, [queryClient])

  const logPwaEvent = useCallback((message: string, data?: Record<string, unknown>) => {
    const payload = { ...data, timestamp: new Date().toISOString() }
    console.log('[PWA]', message, payload)
    if (typeof window !== 'undefined') {
      Sentry.addBreadcrumb({
        category: 'pwa',
        message,
        data: payload,
        level: 'info',
      })
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        logPwaEvent('Service worker registered')

        // Check for updates immediately and periodically
        registration.update()
        
        // Check for updates every 5 minutes
        const updateInterval = setInterval(() => {
          registration.update()
        }, 5 * 60 * 1000)

        // Handle service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return
          logPwaEvent('New service worker installing')

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              logPwaEvent('New service worker installed, requesting activation')
              // Skip waiting and claim immediately
              newWorker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'SW_UPDATED') {
            logPwaEvent('Service worker updated', { version: event.data.version })
            // Auto-reload to get fresh content with new service worker
            window.location.reload()
          }
        })

        // When a new service worker takes over, reload to ensure fresh state
        let refreshing = false
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) {
            refreshing = true
            logPwaEvent('Service worker controller changed, reloading')
            window.location.reload()
          }
        })

        return () => clearInterval(updateInterval)
      } catch (error) {
        // Handle different error types gracefully
        // iOS Safari PWA context can throw SecurityError when SW registration is blocked
        const errorName = error instanceof Error ? error.name : 'UnknownError'
        const errorMessage = error instanceof Error ? error.message : String(error)
        
        if (errorName === 'SecurityError') {
          // SecurityError on iOS Safari - SW registration blocked by security policy
          // This can happen in PWA/standalone mode on iOS - auth should still work
          logPwaEvent('Service worker registration blocked by security policy', {
            errorName,
            errorMessage,
            userAgent: navigator.userAgent,
          })
          // Don't throw - continue without SW, auth will work via cookies
          console.warn('[PWA] Service worker registration blocked by security policy - continuing without SW')
        } else if (errorName === 'TypeError' && errorMessage.includes('load failed')) {
          // TypeError with "load failed" - script couldn't be fetched
          // This can happen on iOS Safari due to caching or network issues
          logPwaEvent('Service worker script load failed', {
            errorName,
            errorMessage,
            userAgent: navigator.userAgent,
          })
          console.warn('[PWA] Service worker script load failed - continuing without SW')
        } else {
          // Other errors - log but don't throw to prevent breaking the app
          logPwaEvent('Failed to register service worker', {
            errorName,
            errorMessage,
            userAgent: navigator.userAgent,
          })
          console.error('[PWA] Service worker registration failed:', errorMessage)
        }
      }
    }

    if (document.readyState === 'complete') {
      registerServiceWorker()
    } else {
      window.addEventListener('load', registerServiceWorker, { once: true })
    }

    return () => {
      window.removeEventListener('load', registerServiceWorker)
    }
  }, [logPwaEvent])

  // AuthProvider is placed inside QueryClientProvider so it can use React Query
  // This is a single instance that persists across all navigations
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Suspense fallback={null}>
          <PostHogProvider>
            {children}
            {SHOULD_ENABLE_E2E_HELPERS ? <DevTestHarness /> : null}
            <Toaster richColors position="top-right" />
          </PostHogProvider>
        </Suspense>
      </AuthProvider>
    </QueryClientProvider>
  )
}

type EmployerDetailModalTab = "overview" | "eba" | "sites" | "workers" | "categories" | "aliases" | "ratings"

const TEST_MODAL_FALLBACK_ID = "00000000-0000-0000-0000-000000000000"
const TEST_MODAL_DEFAULT_TAB: EmployerDetailModalTab = "overview"

function DevTestHarness() {
  const [modalState, setModalState] = useState<{
    open: boolean
    employerId: string | null
    initialTab: EmployerDetailModalTab
  }>({
    open: false,
    employerId: null,
    initialTab: TEST_MODAL_DEFAULT_TAB,
  })

  useEffect(() => {
    if (!SHOULD_ENABLE_E2E_HELPERS || typeof window === 'undefined') {
      return
    }

    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ employerId?: string | null; initialTab?: EmployerDetailModalTab }>).detail || {}
      setModalState({
        open: true,
        employerId: detail.employerId ?? TEST_MODAL_FALLBACK_ID,
        initialTab: detail.initialTab ?? TEST_MODAL_DEFAULT_TAB,
      })
    }

    const handleClose = () => {
      setModalState((prev) => ({ ...prev, open: false }))
    }

    window.addEventListener('cfmeu:test-open-employer-modal', handleOpen as EventListener)
    window.addEventListener('cfmeu:test-close-employer-modal', handleClose as EventListener)

    return () => {
      window.removeEventListener('cfmeu:test-open-employer-modal', handleOpen as EventListener)
      window.removeEventListener('cfmeu:test-close-employer-modal', handleClose as EventListener)
    }
  }, [])

  if (!modalState.open) {
    return null
  }

  return (
    <EmployerDetailModal
      employerId={modalState.employerId}
      isOpen={modalState.open}
      onClose={() => setModalState((prev) => ({ ...prev, open: false }))}
      initialTab={modalState.initialTab}
    />
  )
}

