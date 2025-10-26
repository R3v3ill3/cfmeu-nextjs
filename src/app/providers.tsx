'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { GoogleMapsProvider } from '@/providers/GoogleMapsProvider'

type ProvidersProps = {
  children: ReactNode
}

export default function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30000, // 30 seconds
        refetchOnWindowFocus: false, // Prevent unnecessary refetches
        retry: 1, // Retry failed queries once
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
      mutations: {
        retry: 1,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <GoogleMapsProvider>
        {children}
        <Toaster richColors position="top-right" />
      </GoogleMapsProvider>
    </QueryClientProvider>
  )
}

