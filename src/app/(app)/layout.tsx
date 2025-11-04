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
  const supabase = await createServerSupabase()
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  if (!data) return null
  return (data.role as AppRole) ?? null
}

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'development') {
    console.log('[AppLayout] Rendering layout for (app) route group')
  }
  const supabase = await createServerSupabase()
  let user = null as null | { id: string }
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    // Ignore and treat as unauthenticated
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
  if (process.env.NODE_ENV === 'development') {
    console.log('[AppLayout] Rendering with mobile:', isMobile, 'path:', currentPath)
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

