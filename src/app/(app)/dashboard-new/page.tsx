import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { NewDashboardPage } from '@/components/dashboard/new/NewDashboardPage'

export const dynamic = 'force-dynamic'

export default async function DashboardNewPage() {
  const supabase = await createServerSupabase()
  
  let user = null as null | { id: string }
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    // Ignore auth errors
  }
  
  if (!user) {
    redirect('/auth')
  }
  
  return <NewDashboardPage />
}

