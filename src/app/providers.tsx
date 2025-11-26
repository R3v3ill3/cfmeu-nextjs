'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import type { ReactNode } from 'react'
import { PostHogProvider } from '@/providers/PostHogProvider'
import { AuthProvider } from '@/hooks/useAuth'

type ProvidersProps = {
  children: ReactNode
}

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
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    const registerServiceWorker = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((error) => {
          console.error('[PWA] Failed to register service worker', error)
        })
    }

    if (document.readyState === 'complete') {
      registerServiceWorker()
    } else {
      window.addEventListener('load', registerServiceWorker, { once: true })
    }

    return () => {
      window.removeEventListener('load', registerServiceWorker)
    }
  }, [])

  // AuthProvider is placed inside QueryClientProvider so it can use React Query
  // This is a single instance that persists across all navigations
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Suspense fallback={null}>
          <PostHogProvider>
            {children}
            <Toaster richColors position="top-right" />
          </PostHogProvider>
        </Suspense>
      </AuthProvider>
    </QueryClientProvider>
  )
}

