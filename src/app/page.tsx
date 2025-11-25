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
import { AdminPatchProvider } from '@/context/AdminPatchContext'
import { GoogleMapsProvider } from '@/providers/GoogleMapsProvider'
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

async function getDashboardPreference(userId: string, supabase: any): Promise<'legacy' | 'new'> {
  // Get user preference
  const { data: profile } = await supabase
    .from('profiles')
    .select('dashboard_preference')
    .eq('id', userId)
    .maybeSingle()
  
  const userPreference = profile?.dashboard_preference
  
  // If user has explicit preference (not 'auto' or null), use it
  if (userPreference === 'legacy' || userPreference === 'new') {
    return userPreference
  }
  
  // Get admin default
  const { data: settings } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'default_dashboard')
    .maybeSingle()
  
  if (settings?.value) {
    try {
      const parsed = JSON.parse(settings.value)
      if (parsed === 'legacy' || parsed === 'new') {
        return parsed
      }
    } catch {
      // Ignore parse errors
    }
  }
  
  // Default to legacy
  return 'legacy'
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
  
  // Redirect organisers to Patch page as their default landing page
  if (role === 'organiser') {
    if (process.env.NODE_ENV === 'development') {
      console.log('[RootPage] Organiser detected, redirecting to /patch')
    }
    redirect('/patch')
  }
  
  const dashboardPreference = user ? await getDashboardPreference(user.id, supabase) : 'legacy'
  const hdrs = await headers()
  const userAgent = hdrs.get('user-agent') || undefined
  const isMobile = isMobileOrTablet(userAgent)
  const currentPath = hdrs.get('x-pathname') || '/'
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[RootPage] User authenticated, dashboard preference:', dashboardPreference, 'mobile:', isMobile)
  }
  
  // Route to new dashboard if preference is 'new'
  if (dashboardPreference === 'new') {
    redirect('/dashboard-new')
  }
  
  // Use the same provider structure as (app)/layout.tsx
  return (
    <AuthProvider>
      <GoogleMapsProvider>
        <HelpContextProvider initialPathname={currentPath} initialRole={role}>
          <SafeRatingProvider>
            <AdminPatchProvider>
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
            </AdminPatchProvider>
          </SafeRatingProvider>
        </HelpContextProvider>
      </GoogleMapsProvider>
    </AuthProvider>
  )
}

