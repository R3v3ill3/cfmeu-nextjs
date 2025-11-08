import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const snapshotType = searchParams.get('type') || 'weekly'
    const limit = parseInt(searchParams.get('limit') || '52', 10)

    const { data: snapshots, error } = await supabase
      .from('dashboard_snapshots')
      .select('snapshot_date, unknown_builders, unidentified_slots, eba_builders, eba_contractors')
      .eq('snapshot_type', snapshotType)
      .order('snapshot_date', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching snapshots:', error)
      return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 })
    }

    return NextResponse.json({ 
      data: snapshots || [] 
    }, { status: 200 })
  } catch (error) {
    console.error('Error in snapshots route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



