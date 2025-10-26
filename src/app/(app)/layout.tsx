import { AuthProvider } from '@/hooks/useAuth'
import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Layout from '@/components/Layout'
import DesktopLayout from '@/components/DesktopLayout'
import { headers } from 'next/headers'
import { isMobileOrTablet } from '@/lib/device'
import { NavigationLoadingWrapper } from '@/components/NavigationLoadingWrapper'
import { HelpContextProvider } from '@/context/HelpContext'
import { RatingProvider } from '@/context/RatingContext'
import { AppRole } from '@/constants/roles'

async function getUserRole(userId: string): Promise<AppRole | null> {
  const supabase = await createServerSupabase()
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  if (!data) return null
  return (data.role as AppRole) ?? null
}

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: ReactNode }) {
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
  const userAgent = hdrs.get('user-agent') || undefined
  const isMobile = isMobileOrTablet(userAgent)
  const currentPath = hdrs.get('x-pathname') || ''
  return (
    <AuthProvider>
      <HelpContextProvider initialPathname={currentPath || '/'} initialRole={role}>
        <RatingProvider>
          <NavigationLoadingWrapper>
            {isMobile ? <Layout>{children}</Layout> : <DesktopLayout>{children}</DesktopLayout>}
          </NavigationLoadingWrapper>
        </RatingProvider>
      </HelpContextProvider>
    </AuthProvider>
  )
}

