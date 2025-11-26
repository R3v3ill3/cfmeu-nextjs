import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { NavigationLoadingWrapper } from '@/components/NavigationLoadingWrapper'
import { HelpContextProvider } from '@/context/HelpContext'
import { SafeRatingProvider } from '@/components/ratings/SafeRatingProvider'
import { GoogleMapsProvider } from '@/providers/GoogleMapsProvider'
import { AppRole } from '@/constants/roles'
import { ReactNode } from 'react'
import { randomUUID } from 'crypto'
import * as Sentry from '@sentry/nextjs'

function logMobileLayout(message: string, data?: Record<string, unknown>) {
  const payload = { ...data, timestamp: new Date().toISOString() }
  console.log('[MobileLayout]', message, payload)
  Sentry.addBreadcrumb({
    category: 'mobile-layout',
    message,
    data: payload,
    level: 'info',
  })
}

async function getUserRole(userId: string, context?: { requestId: string; path?: string }): Promise<AppRole | null> {
  const supabase = await createServerSupabase()
  const start = Date.now()
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  const duration = Date.now() - start

  if (error) {
    Sentry.captureException(error, {
      tags: { component: 'MobileLayout', requestId: context?.requestId },
      extra: { userId, path: context?.path, duration },
    })
    return null
  }

  if (duration > 200) {
    logMobileLayout('Slow mobile role fetch', {
      requestId: context?.requestId,
      userId,
      duration,
      path: context?.path,
    })
  }

  if (!data) return null
  return (data.role as AppRole) ?? null
}

export const dynamic = 'force-dynamic'

export default async function MobileLayout({ children }: { children: ReactNode }) {
  const hdrs = await headers()
  const requestId = hdrs.get('x-request-id') ?? randomUUID()
  const currentPath = hdrs.get('x-pathname') || ''

  try {
    Sentry.setTag?.('mobileLayout.requestId', requestId)
    Sentry.setContext?.('mobileLayout', {
      path: currentPath || '/',
    })
  } catch {
    // Ignore missing Sentry helpers on server-only bundles
  }

  logMobileLayout('Rendering mobile layout', { requestId, path: currentPath || '/' })

  const supabase = await createServerSupabase()
  let user = null as null | { id: string }
  
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    // Ignore and treat as unauthenticated
    logMobileLayout('Auth getUser error', {
      requestId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
  
  if (!user) {
    logMobileLayout('No user found, redirecting to /auth', { requestId })
    redirect('/auth')
  }
  
  const role = user ? await getUserRole(user.id, { requestId, path: currentPath || '/' }) : null
  logMobileLayout('Mobile layout user resolved', {
    requestId,
    userId: user?.id ?? null,
    role,
    path: currentPath || '/',
  })
  
  // AuthProvider is now in the root Providers component (src/app/providers.tsx)
  // This prevents remounting on navigation between route groups
  return (
    <GoogleMapsProvider>
      <HelpContextProvider initialPathname={currentPath || '/'} initialRole={role}>
        <SafeRatingProvider>
          <NavigationLoadingWrapper>
            {children}
          </NavigationLoadingWrapper>
        </SafeRatingProvider>
      </HelpContextProvider>
    </GoogleMapsProvider>
  )
}

