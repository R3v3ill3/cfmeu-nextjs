import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/batch-upload/[batchId]/status
 *
 * Returns the current status of a batch upload
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const { batchId } = params
    console.log('[batch-status] Fetching status for batch:', batchId)

    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log('[batch-status] Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[batch-status] User authenticated:', user.id)

    // Fetch batch record
    const { data: batch, error: batchError } = await supabase
      .from('batch_uploads')
      .select('*')
      .eq('id', batchId)
      .single()

    if (batchError || !batch) {
      console.log('[batch-status] Batch not found:', batchId, batchError)
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    console.log('[batch-status] Batch found, status:', batch.status)

    // Verify user has access (owner or admin)
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = userProfile && ['admin', 'lead_organiser'].includes(userProfile.role)

    if (batch.uploaded_by !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(batch)
  } catch (error) {
    console.error('Batch status fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch status' },
      { status: 500 }
    )
  }
}
