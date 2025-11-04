import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { AuthProvider } from '@/hooks/useAuth'
import Layout from '@/components/Layout'
import DesktopLayout from '@/components/DesktopLayout'
import { headers } from 'next/headers'
import { isMobileOrTablet } from '@/lib/device'
import { NavigationLoadingWrapper } from '@/components/NavigationLoadingWrapper'
import { HelpContextProvider } from '@/context/HelpContext'
import { SafeRatingProvider } from '@/components/ratings/SafeRatingProvider'
import { AppRole } from '@/constants/roles'
import { DesktopDashboardView } from '@/components/dashboard/DesktopDashboardView'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

async function getUserRole(userId: string): Promise<AppRole | null> {
  const supabase = await createServerSupabase()
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  if (!data) return null
  return (data.role as AppRole) ?? null
}

// Root page that handles authentication and renders dashboard
// This ensures Next.js recognizes the route properly
// Uses the same layout structure as (app)/layout.tsx to maintain consistency
export default async function RootPage() {
  if (process.env.NODE_ENV === 'development') {
    console.log('[RootPage] Root page.tsx called')
  }
  
  // Check authentication
  const supabase = await createServerSupabase()
  let user = null as null | { id: string }
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    // Ignore auth errors
  }
  
  if (!user) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[RootPage] No user, redirecting to /auth')
    }
    redirect('/auth')
  }
  
  const role = user ? await getUserRole(user.id) : null
  const hdrs = await headers()
  const userAgent = hdrs.get('user-agent') || undefined
  const isMobile = isMobileOrTablet(userAgent)
  const currentPath = hdrs.get('x-pathname') || '/'
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[RootPage] User authenticated, rendering dashboard with mobile:', isMobile)
  }
  
  // Use the same provider structure as (app)/layout.tsx
  return (
    <AuthProvider>
      <HelpContextProvider initialPathname={currentPath} initialRole={role}>
        <SafeRatingProvider>
          <NavigationLoadingWrapper>
            {isMobile ? (
              <Layout>
                <DesktopDashboardView />
              </Layout>
            ) : (
              <DesktopLayout>
                <DesktopDashboardView />
              </DesktopLayout>
            )}
          </NavigationLoadingWrapper>
        </SafeRatingProvider>
      </HelpContextProvider>
    </AuthProvider>
  )
}

