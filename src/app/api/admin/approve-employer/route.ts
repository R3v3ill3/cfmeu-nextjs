import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { employerId, notes } = await request.json()

    if (!employerId) {
      return NextResponse.json({ error: 'Missing employerId' }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: result, error: rpcError } = await supabase.rpc('approve_employer', {
      p_employer_id: employerId,
      p_admin_user_id: user.id,
      p_notes: notes || null,
    })

    if (rpcError) {
      console.error('RPC error approving employer:', rpcError)
      return NextResponse.json({ error: 'Failed to approve employer' }, { status: 500 })
    }

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 })
    }

    return NextResponse.json({ success: true, employerId: result.employerId })
  } catch (error) {
    console.error('Approve employer error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Approval failed' },
      { status: 500 }
    )
  }
}
