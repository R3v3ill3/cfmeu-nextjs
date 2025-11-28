import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { withRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/materialized-view/refresh
 *
 * Triggers a refresh of the employers_search_optimized materialized view
 */
async function refreshMaterializedViewHandler(request: NextRequest) {
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

    // Check if incremental or full refresh is requested
    const body = await request.json().catch(() => ({}))
    const useIncremental = body.incremental !== false // Default to true

    let refreshResult

    if (useIncremental) {
      // Try incremental refresh first
      const { data, error } = await supabase.rpc('refresh_employers_search_view_incremental')

      if (error) {
        console.warn('Incremental refresh failed, falling back to full refresh:', error)
        // Fallback to full refresh
        const { data: fullData, error: fullError } = await supabase.rpc('refresh_employers_search_view_enhanced')

        if (fullError) {
          throw new Error(`Both incremental and full refresh failed: ${fullError.message}`)
        }

        refreshResult = fullData[0]
      } else {
        refreshResult = data[0]
      }
    } else {
      // Force full refresh
      const { data, error } = await supabase.rpc('refresh_employers_search_view_enhanced')

      if (error) {
        throw new Error(`Full refresh failed: ${error.message}`)
      }

      refreshResult = data[0]
    }

    return NextResponse.json({
      success: refreshResult.success,
      duration_ms: refreshResult.duration_ms,
      rows_refreshed: refreshResult.rows_refreshed,
      changes_processed: refreshResult.changes_processed,
      incremental: refreshResult.incremental,
      last_refresh: refreshResult.last_refresh,
      message: refreshResult.message,
      performance_stats: refreshResult.performance_stats
    })

  } catch (error) {
    console.error('Materialized view refresh error:', error)
    return NextResponse.json(
      {
        error: 'Refresh failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export const POST = withRateLimit(refreshMaterializedViewHandler, {
  maxRequests: 5, // Limit refreshes
  windowSeconds: 60,
  burstAllowance: 2
})