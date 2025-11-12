import { AuthProvider } from '@/hooks/useAuth'
import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Layout from '@/components/Layout'
import DesktopLayout from '@/components/DesktopLayout'
import { headers } from 'next/headers'
import { isMobileOrTablet } from '@/lib/device'
import { NavigationLoadingWrapper } from '@/components/NavigationLoadingWrapper'
import { HelpContextProvider } from '@/context/HelpContext'
import { SafeRatingProvider } from '@/components/ratings/SafeRatingProvider'
import { AppRole } from '@/constants/roles'
import { ReactNode } from 'react'

async function getUserRole(userId: string): Promise<AppRole | null> {
  const startTime = Date.now()
  const supabase = await createServerSupabase()
  try {
    const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
    const duration = Date.now() - startTime
    
    if (error) {
      console.error('[AppLayout] Error fetching user role:', {
        userId,
        error: error.message,
        errorCode: error.code,
        duration,
        timestamp: new Date().toISOString(),
      })
      return null
    }
    
    if (duration > 200) {
      console.warn('[AppLayout] Slow role fetch:', {
        userId,
        duration,
        hasRole: !!data?.role,
        timestamp: new Date().toISOString(),
      })
    }
    
    return (data?.role as AppRole) ?? null
  } catch (err) {
    const duration = Date.now() - startTime
    console.error('[AppLayout] Exception fetching user role:', {
      userId,
      error: err instanceof Error ? err.message : String(err),
      duration,
      timestamp: new Date().toISOString(),
    })
    return null
  }
}

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const layoutStartTime = Date.now()
  if (process.env.NODE_ENV === 'development') {
    console.log('[AppLayout] Rendering layout for (app) route group')
  }
  const supabase = await createServerSupabase()
  let user = null as null | { id: string }
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    console.error('[AppLayout] Auth getUser error:', {
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    })
  }
  if (!user) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[AppLayout] No user found, redirecting to /auth')
    }
    redirect('/auth')
  }
  const role = user ? await getUserRole(user.id) : null
  const hdrs = await headers()
  const userAgent = hdrs.get('user-agent') || undefined
  const isMobile = isMobileOrTablet(userAgent)
  const currentPath = hdrs.get('x-pathname') || ''
  const layoutDuration = Date.now() - layoutStartTime
  
  if (process.env.NODE_ENV === 'development' || layoutDuration > 500) {
    console.log('[AppLayout] Layout rendered:', {
      userId: user.id,
      role,
      isMobile,
      path: currentPath,
      duration: layoutDuration,
      timestamp: new Date().toISOString(),
    })
  }
  return (
    <AuthProvider>
      <HelpContextProvider initialPathname={currentPath || '/'} initialRole={role}>
        <SafeRatingProvider>
          <NavigationLoadingWrapper>
            {isMobile ? <Layout>{children}</Layout> : <DesktopLayout>{children}</DesktopLayout>}
          </NavigationLoadingWrapper>
        </SafeRatingProvider>
      </HelpContextProvider>
    </AuthProvider>
  )
}

