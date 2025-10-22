import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { projectId, notes } = await request.json()

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin or lead_organiser role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'lead_organiser'].includes(profile.role)) {
      return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 403 })
    }

    const { data: result, error: rpcError } = await supabase.rpc('approve_project', {
      p_project_id: projectId,
      p_admin_user_id: user.id,
      p_notes: notes || null,
    })

    if (rpcError) {
      console.error('RPC error approving project:', rpcError)
      return NextResponse.json({ error: 'Failed to approve project' }, { status: 500 })
    }

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 })
    }

    return NextResponse.json({ success: true, projectId: result.projectId })
  } catch (error) {
    console.error('Approve project error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Approval failed' },
      { status: 500 }
    )
  }
}
