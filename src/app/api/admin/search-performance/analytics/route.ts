import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { withRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/search-performance/analytics
 *
 * Returns search performance analytics data for the dashboard
 */
async function getSearchAnalyticsHandler(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const timeRange = searchParams.get('timeRange') || '24h'

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

    const rangeMap: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    }

    const rangeMs = rangeMap[timeRange] ?? rangeMap['24h']
    const cutoffIso = new Date(Date.now() - rangeMs).toISOString()

    const { data: logRows, error: logError } = await supabase
      .from('search_performance_log')
      .select('created_at, query_time_ms, cache_hit, results_count, search_via')
      .gte('created_at', cutoffIso)
      .order('created_at', { ascending: false })
      .limit(5000)

    if (logError) {
      console.error('Search performance log query error:', logError)
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }

    type Bucket = {
      hour: string
      search_via: string
      total_searches: number
      query_time_sum: number
      max_query_time_ms: number
      slow_queries_count: number
      cached_searches: number
      results_sum: number
    }

    const analyticsBuckets = new Map<string, Bucket>()

    ;(logRows || []).forEach(row => {
      const hourDate = new Date(row.created_at as string)
      hourDate.setMinutes(0, 0, 0)
      const hourKey = hourDate.toISOString()
      const via = (row.search_via as string) || 'unknown'
      const bucketKey = `${hourKey}|${via}`

      if (!analyticsBuckets.has(bucketKey)) {
        analyticsBuckets.set(bucketKey, {
          hour: hourKey,
          search_via: via,
          total_searches: 0,
          query_time_sum: 0,
          max_query_time_ms: 0,
          slow_queries_count: 0,
          cached_searches: 0,
          results_sum: 0
        })
      }

      const bucket = analyticsBuckets.get(bucketKey)!
      bucket.total_searches += 1
      bucket.query_time_sum += row.query_time_ms || 0
      bucket.max_query_time_ms = Math.max(bucket.max_query_time_ms, row.query_time_ms || 0)
      if ((row.query_time_ms || 0) > 500) {
        bucket.slow_queries_count += 1
      }
      if (row.cache_hit) {
        bucket.cached_searches += 1
      }
      bucket.results_sum += row.results_count || 0
    })

    const analytics = Array.from(analyticsBuckets.values())
      .map(bucket => ({
        hour: bucket.hour,
        search_via: bucket.search_via,
        total_searches: bucket.total_searches,
        avg_query_time_ms: bucket.total_searches > 0 ? Math.round(bucket.query_time_sum / bucket.total_searches) : 0,
        max_query_time_ms: bucket.max_query_time_ms,
        slow_queries_count: bucket.slow_queries_count,
        cached_searches: bucket.cached_searches,
        avg_results_count: bucket.total_searches > 0 ? Math.round(bucket.results_sum / bucket.total_searches) : 0,
        cache_hit_rate_percent: bucket.total_searches > 0 ? (bucket.cached_searches / bucket.total_searches) * 100 : 0
      }))
      .sort((a, b) => new Date(b.hour).getTime() - new Date(a.hour).getTime())

    // Calculate overall metrics
    const { data: overallMetrics, error: metricsError } = await supabase
      .from('search_performance_log')
      .select(`
        COUNT(*) as total_searches,
        AVG(query_time_ms) as avg_query_time_ms,
        MAX(query_time_ms) as max_query_time_ms,
        COUNT(*) FILTER (WHERE query_time_ms > 500) as slow_queries_count,
        COUNT(*) FILTER (WHERE cache_hit = true) as cached_searches,
        AVG(results_count) as avg_results_count
      `)
      .gte('created_at', cutoffIso)
      .single()

    if (metricsError) {
      console.error('Metrics query error:', metricsError)
      return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 })
    }

    // Calculate cache hit rate
    const totalSearches = overallMetrics?.total_searches || 0
    const cachedSearches = overallMetrics?.cached_searches || 0
    const cacheHitRate = totalSearches > 0 ? (cachedSearches / totalSearches) * 100 : 0

    const result = {
      analytics: analytics || [],
      metrics: {
        total_searches: overallMetrics?.total_searches || 0,
        avg_query_time_ms: Math.round(overallMetrics?.avg_query_time_ms || 0),
        max_query_time_ms: overallMetrics?.max_query_time_ms || 0,
        slow_queries_count: overallMetrics?.slow_queries_count || 0,
        cached_searches: cachedSearches,
        cache_hit_rate_percent: Math.round(cacheHitRate * 100) / 100,
        avg_results_count: Math.round(overallMetrics?.avg_results_count || 0)
      },
      timeRange
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Search analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withRateLimit(getSearchAnalyticsHandler, {
  maxRequests: 20,
  windowSeconds: 60,
  burstAllowance: 5
})