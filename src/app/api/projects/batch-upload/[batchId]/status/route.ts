import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params

    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch batch with child scans
    const { data: batch, error: batchError } = await supabase
      .from('batch_uploads')
      .select(`
        *,
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
      `)
      .eq('id', batchId)
      .single()

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    // Verify ownership (users can only see their own batches unless admin)
    if (batch.uploaded_by !== user.id) {
      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const isAdmin = profile?.role === 'admin' || profile?.role === 'lead_organiser'
      if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json(batch)
  } catch (error) {
    console.error('Batch status error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Fetch failed' },
      { status: 500 }
    )
  }
}
