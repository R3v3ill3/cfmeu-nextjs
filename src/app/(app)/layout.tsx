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
import { randomUUID } from 'crypto'

const __AGENT_DEBUG_INGEST_ENDPOINT =
  'http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2'

interface UserProfile {
  id: string
  email: string | null
  role: AppRole | null
  is_active: boolean | null
}

async function getUserProfile(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  context?: { requestId: string; path?: string }
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
        `userId=${userId}, error=${error.message}, code=${error.code}, duration=${duration}ms, requestId=${context?.requestId}`)
      return null
    }
    
    if (duration > 200) {
      // Log as structured string to avoid [object Object] in Sentry
      // Format: key=value pairs for consistent parsing
      const logMessage = `userId=${userId}, duration=${duration}ms, hasRole=${!!data?.role}, requestId=${context?.requestId}, path=${context?.path}`
      console.warn('[AppLayout] Slow profile fetch:', logMessage)
    }
    
    return data as UserProfile | null
  } catch (err) {
    const duration = Date.now() - startTime
    console.error('[AppLayout] Exception fetching user profile:',
      `userId=${userId}, error=${err instanceof Error ? err.message : String(err)}, duration=${duration}ms, requestId=${context?.requestId}`)
    return null
  }
}

function logAppLayout(message: string, data?: Record<string, unknown>) {
  const payload = { ...data, timestamp: new Date().toISOString() }
  console.log('[AppLayout]', message, payload)
}

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const layoutStartTime = Date.now()

  const hdrs = await headers()
  const requestId = hdrs.get('x-request-id') ?? randomUUID()
  const currentPath = hdrs.get('x-pathname') || ''
  const cookieHeader = hdrs.get('cookie')
  const hasCookieHeader = !!cookieHeader
  const hasSupabaseCookie = cookieHeader ? cookieHeader.includes('sb-') : false
  const shouldDebugAuthPath = (currentPath || '').startsWith('/projects')
  const userAgent = hdrs.get('user-agent') || undefined
  const isMobile = isMobileOrTablet(userAgent)

  logAppLayout('Rendering layout for (app) route group', {
    requestId,
    path: currentPath || '/',
    userAgent,
  })

  if (process.env.NODE_ENV !== 'production' && shouldDebugAuthPath) {
    // #region agent log
    fetch(__AGENT_DEBUG_INGEST_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H4',location:'src/app/(app)/layout.tsx:request-snapshot',message:'AppLayout request snapshot (projects path)',data:{requestIdSuffix:requestId.slice(-6),path:currentPath||'/',hasCookieHeader,hasSupabaseCookie},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }

  const supabase = await createServerSupabase()
  
  // Step 1: Auth check
  let user = null as null | { id: string }
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    logAppLayout('Auth getUser error', {
      requestId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
  
  if (!user) {
    if (process.env.NODE_ENV !== 'production' && shouldDebugAuthPath) {
      // #region agent log
      fetch(__AGENT_DEBUG_INGEST_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H4',location:'src/app/(app)/layout.tsx:no-user',message:'AppLayout saw no user; redirecting to /auth',data:{requestIdSuffix:requestId.slice(-6),path:currentPath||'/',hasCookieHeader,hasSupabaseCookie},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    }
    logAppLayout('No user found, redirecting to /auth', { requestId })
    redirect('/auth')
  }
  
  // Step 2: Single profile fetch (reuses same supabase client, gets all needed fields)
  // This eliminates the duplicate profile fetch that was happening before
  const profile = await getUserProfile(supabase, user.id, {
    requestId,
    path: currentPath || '/',
  })
  const role = profile?.role ?? null
  const layoutDuration = Date.now() - layoutStartTime

  if (process.env.NODE_ENV !== 'production' && shouldDebugAuthPath) {
    // #region agent log
    fetch(__AGENT_DEBUG_INGEST_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H4',location:'src/app/(app)/layout.tsx:profile-resolved',message:'AppLayout resolved auth/profile (projects path)',data:{requestIdSuffix:requestId.slice(-6),path:currentPath||'/',userIdSuffix:user.id.slice(-6),hasProfile:!!profile,role,isActive:profile?.is_active??null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }

  // SECURITY: Validate user has a valid profile with a role
  // This prevents unauthorized OAuth users from accessing the app
  if (!profile) {
    // No profile at all - redirect to auth
    logAppLayout('User has no profile, redirecting to auth', {
      requestId,
      userId: user.id,
    })
    redirect('/auth')
  } else if (!profile.is_active || !profile.role) {
    // Profile exists but is inactive or has no role - unauthorized OAuth user
    logAppLayout('User profile inactive or missing role, redirecting', {
      requestId,
      userId: user.id,
      email: profile.email,
      role: profile.role,
      isActive: profile.is_active,
    })
    // Sign out the user and redirect
    await supabase.auth.signOut()
    redirect('/auth?error=unauthorized&error_description=Your account is not authorized. Please contact your administrator.')
  }
  
  if (process.env.NODE_ENV === 'development' || layoutDuration > 500) {
    logAppLayout('Layout rendered', {
      requestId,
      userId: user.id,
      role,
      isMobile,
      path: currentPath,
      duration: layoutDuration,
    })
  }
  // AuthProvider is now in the root Providers component (src/app/providers.tsx)
  // This prevents remounting on navigation between route groups
  return (
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
  )
}

