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
import { AdminPatchProvider } from '@/context/AdminPatchContext'
import { GoogleMapsProvider } from '@/providers/GoogleMapsProvider'
import { AppRole } from '@/constants/roles'
import { ReactNode } from 'react'

interface UserProfile {
  id: string
  email: string | null
  role: AppRole | null
  is_active: boolean | null
}

async function getUserProfile(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string
): Promise<UserProfile | null> {
  const startTime = Date.now()
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, is_active')
      .eq('id', userId)
      .maybeSingle()
    const duration = Date.now() - startTime
    
    if (error) {
      console.error('[AppLayout] Error fetching user profile:', 
        `userId=${userId}, error=${error.message}, code=${error.code}, duration=${duration}ms`)
      return null
    }
    
    if (duration > 200) {
      console.warn('[AppLayout] Slow profile fetch:',
        `userId=${userId}, duration=${duration}ms, hasRole=${!!data?.role}`)
    }
    
    return data as UserProfile | null
  } catch (err) {
    const duration = Date.now() - startTime
    console.error('[AppLayout] Exception fetching user profile:',
      `userId=${userId}, error=${err instanceof Error ? err.message : String(err)}, duration=${duration}ms`)
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
  
  // Step 1: Auth check
  let user = null as null | { id: string }
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    console.error('[AppLayout] Auth getUser error:',
      `error=${err instanceof Error ? err.message : String(err)}`)
  }
  
  if (!user) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[AppLayout] No user found, redirecting to /auth')
    }
    redirect('/auth')
  }
  
  // Step 2: Single profile fetch (reuses same supabase client, gets all needed fields)
  // This eliminates the duplicate profile fetch that was happening before
  const profile = await getUserProfile(supabase, user.id)
  const role = profile?.role ?? null
  
  const hdrs = await headers()
  const userAgent = hdrs.get('user-agent') || undefined
  const isMobile = isMobileOrTablet(userAgent)
  const currentPath = hdrs.get('x-pathname') || ''
  const layoutDuration = Date.now() - layoutStartTime

  // SECURITY: Validate user has a valid profile with a role
  // This prevents unauthorized OAuth users from accessing the app
  if (!profile) {
    // No profile at all - redirect to auth
    console.warn('[AppLayout] User has no profile, redirecting to auth:',
      `userId=${user.id}`)
    redirect('/auth')
  } else if (!profile.is_active || !profile.role) {
    // Profile exists but is inactive or has no role - unauthorized OAuth user
    console.warn('[AppLayout] User profile is inactive or has no role, redirecting to auth:',
      `userId=${user.id}, email=${profile.email}, role=${profile.role}, isActive=${profile.is_active}`)
    // Sign out the user and redirect
    await supabase.auth.signOut()
    redirect('/auth?error=unauthorized&error_description=Your account is not authorized. Please contact your administrator.')
  }
  
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
      <GoogleMapsProvider>
        <HelpContextProvider initialPathname={currentPath || '/'} initialRole={role}>
          <SafeRatingProvider>
            <AdminPatchProvider>
              <NavigationLoadingWrapper>
                {isMobile ? <Layout>{children}</Layout> : <DesktopLayout>{children}</DesktopLayout>}
              </NavigationLoadingWrapper>
            </AdminPatchProvider>
          </SafeRatingProvider>
        </HelpContextProvider>
      </GoogleMapsProvider>
    </AuthProvider>
  )
}

