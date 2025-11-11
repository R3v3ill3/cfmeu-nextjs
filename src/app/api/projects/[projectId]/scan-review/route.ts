import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params
    const supabase = await createServerSupabase()

    // Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use RPC function that bypasses RLS to avoid stack depth recursion
    const { data, error } = await supabase
      .rpc('get_project_for_scan_review', { p_project_id: projectId })

    if (error) {
      console.error('[scan-review-api] RPC error:', error)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 500 }
      )
    }

    if (!data || data.error) {
      const status = data?.error === 'Unauthorized' ? 401 : 
                     data?.error === 'Forbidden' ? 403 : 
                     data?.error === 'Project not found' ? 404 : 500
      return NextResponse.json(
        { error: data?.error || 'Project not found' },
        { status }
      )
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[scan-review-api] Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

