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

  // First try to get batch from batch_uploads table
  let batch = null
  let error = null

  const { data: batchData, error: batchError } = await supabase
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

  if (batchError || !batchData) {
    // If not found in batch_uploads, try to reconstruct from mapping_sheet_scans
    console.log('Batch not found in batch_uploads, attempting to reconstruct from mapping_sheet_scans')

    const { data: scans, error: scansError } = await supabase
      .from('mapping_sheet_scans')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true })

    if (scansError || !scans || scans.length === 0) {
      console.error('Error fetching batch or scans:', batchError || scansError)
      notFound()
    }

    // Reconstruct a minimal batch object from the scans
    batch = {
      id: batchId,
      uploaded_by: null, // Unknown, will need to be determined or left null
      original_file_name: `Batch ${batchId.slice(0, 8)} (Reconstructed)`,
      original_file_url: scans[0]?.file_url || null,
      original_file_size_bytes: 0, // Unknown
      total_pages: scans.reduce((sum, scan) => sum + (scan.page_count || 0), 0),
      total_projects: scans.length,
      projects_completed: scans.filter(scan =>
        scan.status === 'completed' || scan.status === 'confirmed' || scan.status === 'under_review'
      ).length,
      status: determineBatchStatus(scans),
      project_definitions: null,
      error_message: null,
      created_at: scans[0]?.created_at || new Date().toISOString(),
      processing_started_at: scans[0]?.created_at || new Date().toISOString(),
      processing_completed_at: determineProcessingCompleted(scans),
      metadata: { reconstructed: true, source: 'mapping_sheet_scans' },
      scans: scans
    }
  } else {
    batch = batchData
  }

  // Check ownership - for reconstructed batches, allow admin/lead_organiser access
  if (batch.uploaded_by && batch.uploaded_by !== user.id) {
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
  } else if (!batch.uploaded_by) {
    // For reconstructed batches, check if user is admin/lead_organiser
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

function determineBatchStatus(scans: any[]): string {
  const statuses = scans.map(scan => scan.status)

  if (statuses.every(status => status === 'failed')) {
    return 'failed'
  }

  if (statuses.every(status =>
    status === 'completed' || status === 'confirmed' || status === 'under_review' || status === 'rejected'
  )) {
    const completedCount = scans.filter(scan =>
      scan.status === 'completed' || scan.status === 'confirmed'
    ).length

    if (completedCount === scans.length) {
      return 'completed'
    } else if (completedCount > 0) {
      return 'partial'
    }
  }

  if (statuses.some(status => status === 'processing' || status === 'pending')) {
    return 'processing'
  }

  return 'partial'
}

function determineProcessingCompleted(scans: any[]): string | null {
  const allCompleted = scans.every(scan =>
    scan.status === 'completed' ||
    scan.status === 'confirmed' ||
    scan.status === 'under_review' ||
    scan.status === 'rejected' ||
    scan.status === 'failed'
  )

  if (!allCompleted) {
    return null
  }

  // Return the latest updated_at among all scans
  return scans
    .filter(scan => scan.updated_at)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]?.updated_at || null
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