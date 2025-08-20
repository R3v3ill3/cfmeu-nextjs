import { AuthProvider } from '@/hooks/useAuth'
import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Layout from '@/components/Layout'
import DesktopLayout from '@/components/DesktopLayout'
import { headers } from 'next/headers'
import { isMobileOrTablet } from '@/lib/device'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth')
  }
  const hdrs = await headers()
  const userAgent = hdrs.get('user-agent') || undefined
  const isMobile = isMobileOrTablet(userAgent)
  return (
    <AuthProvider>
      {isMobile ? <Layout>{children}</Layout> : <DesktopLayout>{children}</DesktopLayout>}
    </AuthProvider>
  )
}

