import { Suspense } from 'react'
import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BatchesManagement } from '@/components/admin/BatchesManagement'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = {
  title: 'Batch Uploads | CFMEU',
  description: 'View and manage batch upload history',
}

// Force dynamic rendering to avoid build-time React import issues
export const dynamic = 'force-dynamic'

async function BatchesContent() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/auth/sign-in')
  }

  // Check if user has admin access or should see only their batches
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'lead_organiser'

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Batch Uploads</h1>
        <p className="text-muted-foreground mt-2">
          {isAdmin
            ? 'View and manage all batch upload history'
            : 'View your batch upload history'
          }
        </p>
      </div>

      <BatchesManagement />
    </div>
  )
}

function BatchesLoading() {
  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-96 mt-2" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export default function BatchesPage() {
  return (
    <Suspense fallback={<BatchesLoading />}>
      <BatchesContent />
    </Suspense>
  )
}