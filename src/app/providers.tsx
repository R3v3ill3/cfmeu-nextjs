'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import type { ReactNode } from 'react'
import { GoogleMapsProvider } from '@/providers/GoogleMapsProvider'

// Ensure React and hooks are globally available for client-side bundles
if (typeof window !== 'undefined') {
  if (!window.React) {
    window.React = React;
  }
  // Ensure hooks are available on global React
  if (window.React) {
    window.React.useState = useState;
    window.React.useEffect = useEffect;
    window.React.useCallback = useCallback;
    window.React.useMemo = useMemo;
    window.React.useRef = useRef;
  }
}
if (typeof globalThis !== 'undefined') {
  if (!globalThis.React) {
    globalThis.React = React;
  }
  // Ensure hooks are available on global React
  if (globalThis.React) {
    globalThis.React.useState = useState;
    globalThis.React.useEffect = useEffect;
    globalThis.React.useCallback = useCallback;
    globalThis.React.useMemo = useMemo;
    globalThis.React.useRef = useRef;
  }
}

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

