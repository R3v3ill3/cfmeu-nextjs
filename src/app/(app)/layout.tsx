import { AuthProvider } from '@/hooks/useAuth'
import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Layout from '@/components/Layout'
import DesktopLayout from '@/components/DesktopLayout'
import { headers } from 'next/headers'
import { isMobileOrTablet } from '@/lib/device'
import { NavigationLoadingProvider, NavigationLoadingOverlay } from '@/hooks/useNavigationLoading'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
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
  const hdrs = await headers()
  const userAgent = hdrs.get('user-agent') || undefined
  const isMobile = isMobileOrTablet(userAgent)
  return (
    <AuthProvider>
      <NavigationLoadingProvider>
        {isMobile ? <Layout>{children}</Layout> : <DesktopLayout>{children}</DesktopLayout>}
        <NavigationLoadingOverlay />
      </NavigationLoadingProvider>
    </AuthProvider>
  )
}

