import { AuthProvider } from '@/hooks/useAuth'
import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { NavigationLoadingWrapper } from '@/components/NavigationLoadingWrapper'
import { HelpContextProvider } from '@/context/HelpContext'
import { SafeRatingProvider } from '@/components/ratings/SafeRatingProvider'
import { GoogleMapsProvider } from '@/providers/GoogleMapsProvider'
import { AppRole } from '@/constants/roles'
import { ReactNode } from 'react'

async function getUserRole(userId: string): Promise<AppRole | null> {
  const supabase = await createServerSupabase()
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  if (!data) return null
  return (data.role as AppRole) ?? null
}

export const dynamic = 'force-dynamic'

export default async function MobileLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabase()
  let user = null as null | { id: string }
  
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    // Ignore and treat as unauthenticated
  }
  
  if (!user) {
    redirect('/auth')
  }
  
  const role = user ? await getUserRole(user.id) : null
  const hdrs = await headers()
  const currentPath = hdrs.get('x-pathname') || ''
  
  return (
    <AuthProvider>
      <GoogleMapsProvider>
        <HelpContextProvider initialPathname={currentPath || '/'} initialRole={role}>
          <SafeRatingProvider>
            <NavigationLoadingWrapper>
              {children}
            </NavigationLoadingWrapper>
          </SafeRatingProvider>
        </HelpContextProvider>
      </GoogleMapsProvider>
    </AuthProvider>
  )
}

