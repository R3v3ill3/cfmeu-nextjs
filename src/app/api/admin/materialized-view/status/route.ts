import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { withRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/materialized-view/status
 *
 * Returns the current status of the employers_search_optimized materialized view
 */
async function getMaterializedViewStatusHandler(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get materialized view status
    const { data: statusData, error: statusError } = await supabase
      .from('employers_search_view_status')
      .select('*')
      .single()

    if (statusError) {
      console.error('View status query error:', statusError)
      return NextResponse.json({ error: 'Failed to fetch view status' }, { status: 500 })
    }

    // Get additional performance stats
    const { data: perfData, error: perfError } = await supabase
      .rpc('get_materialized_view_performance_stats')

    if (perfError) {
      console.warn('Performance stats query error:', perfError)
    }

    return NextResponse.json({
      ...statusData,
      performance_stats: perfData || null
    })

  } catch (error) {
    console.error('Materialized view status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withRateLimit(getMaterializedViewStatusHandler, {
  maxRequests: 30,
  windowSeconds: 60,
  burstAllowance: 10
})