'use client'

import React, { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import type { ReactNode } from 'react'
import { GoogleMapsProvider } from '@/providers/GoogleMapsProvider'

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

  return (
    <QueryClientProvider client={queryClient}>
      <GoogleMapsProvider>
        {children}
        <Toaster richColors position="top-right" />
      </GoogleMapsProvider>
    </QueryClientProvider>
  )
}

