'use client'

import { NavigationLoadingProvider, NavigationLoadingOverlay } from '@/hooks/useNavigationLoading'
import { ReactNode } from 'react'

export function NavigationLoadingWrapper({ children }: { children: ReactNode }) {
  return (
    <NavigationLoadingProvider>
      {children}
      <NavigationLoadingOverlay />
    </NavigationLoadingProvider>
  )
}

