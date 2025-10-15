import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { projectId, reason } = await request.json()

    if (!projectId || !reason) {
      return NextResponse.json({ error: 'Missing projectId or reason' }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: result, error: rpcError } = await supabase.rpc('reject_project', {
      p_project_id: projectId,
      p_admin_user_id: user.id,
      p_reason: reason,
    })

    if (rpcError) {
      console.error('RPC error rejecting project:', rpcError)
      return NextResponse.json({ error: 'Failed to reject project' }, { status: 500 })
    }

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 })
    }

    return NextResponse.json({ success: true, projectId: result.projectId })
  } catch (error) {
    console.error('Reject project error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Rejection failed' },
      { status: 500 }
    )
  }
}
