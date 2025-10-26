import { Suspense } from 'react'
import { createServerSupabase } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { BatchDetailView } from '@/components/batches/BatchDetailView'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface PageProps {
  params: Promise<{ batchId: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { batchId } = await params
  return {
    title: `Batch ${batchId.slice(0, 8)} | CFMEU`,
    description: 'View batch upload details',
  }
}

// Force dynamic rendering to avoid build-time React import issues
export const dynamic = 'force-dynamic'

async function BatchDetailContent({ batchId }: { batchId: string }) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/auth/sign-in')
  }

  // Fetch batch with scans
  const { data: batch, error } = await supabase
    .from('batch_uploads')
    .select(
      `
      id,
      uploaded_by,
      original_file_name,
      original_file_url,
      original_file_size_bytes,
      total_pages,
      total_projects,
      projects_completed,
      status,
      project_definitions,
      error_message,
      created_at,
      processing_started_at,
      processing_completed_at,
      metadata,
      scans:mapping_sheet_scans(
        id,
        file_name,
        file_url,
        status,
        upload_mode,
        project_id,
        created_project_id,
        page_count,
        confidence_scores,
        error_message,
        created_at,
        updated_at
      )
    `
    )
    .eq('id', batchId)
    .single()

  if (error || !batch) {
    console.error('Error fetching batch:', error)
    notFound()
  }

  // Check ownership
  if (batch.uploaded_by !== user.id) {
    // Check if admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin' || profile?.role === 'lead_organiser'
    if (!isAdmin) {
      redirect('/projects/batches')
    }
  }

  return (
    <div className="container mx-auto py-8">
      <BatchDetailView batch={batch} />
    </div>
  )
}

function BatchDetailLoading() {
  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96 mt-2" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export default async function BatchDetailPage({ params }: PageProps) {
  const { batchId } = await params

  return (
    <Suspense fallback={<BatchDetailLoading />}>
      <BatchDetailContent batchId={batchId} />
    </Suspense>
  )
}
