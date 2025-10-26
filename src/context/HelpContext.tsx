'use client'

import { AppRole } from '@/constants/roles'
import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type HelpScope = {
  page: string
  role?: AppRole | null
  section?: string
  entityId?: string
  extra?: Record<string, unknown>
}

export type HelpContextValue = {
  scope: HelpScope
  setScope: (scope: Partial<HelpScope>) => void
}

const HelpContext = createContext<HelpContextValue | undefined>(undefined)

function getPageKey(pathname: string): string {
  if (!pathname) return '/'
  const segments = pathname.split('?')[0]?.split('#')[0]?.split('/') ?? []
  if (segments.length <= 2) {
    return pathname || '/'
  }
  return `/${segments[1]}`
}

export function HelpContextProvider({
  initialPathname,
  initialRole,
  children
}: {
  initialPathname: string
  initialRole?: AppRole | null
  children: ReactNode
}) {
  const [scopeState, setScopeState] = useState<HelpScope>({
    page: getPageKey(initialPathname),
    role: initialRole ?? null
  })

  const value = useMemo<HelpContextValue>(
    () => ({
      scope: scopeState,
      setScope: (scopeUpdates) => {
        setScopeState((prev) => ({
          ...prev,
          ...scopeUpdates
        }))
      }
    }),
    [scopeState]
  )

  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>
}

export function useHelpContext() {
  const ctx = useContext(HelpContext)
  if (!ctx) {
    throw new Error('useHelpContext must be used within HelpContextProvider')
  }
  return ctx
}
