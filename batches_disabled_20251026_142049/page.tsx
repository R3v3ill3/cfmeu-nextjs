import { Suspense } from 'react'
import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BatchesTable } from '@/components/batches/BatchesTable'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = {
  title: 'My Batches | CFMEU',
  description: 'View your batch upload history',
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

  // Fetch batches for current user
  const { data: batches, error } = await supabase
    .from('batch_uploads')
    .select(
      `
      id,
      original_file_name,
      total_pages,
      total_projects,
      projects_completed,
      status,
      error_message,
      created_at,
      processing_started_at,
      processing_completed_at
    `
    )
    .eq('uploaded_by', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching batches:', error)
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Error Loading Batches</CardTitle>
            <CardDescription>Failed to load your batch uploads</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Batches</h1>
        <p className="text-muted-foreground mt-2">View and manage your batch upload history</p>
      </div>

      <BatchesTable batches={batches || []} />
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
