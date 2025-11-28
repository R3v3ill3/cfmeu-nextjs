"use client"

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, TrendingUp, Clock, Database, Zap, Users } from 'lucide-react'

interface SearchMetrics {
  total_searches: number
  avg_query_time_ms: number
  max_query_time_ms: number
  slow_queries_count: number
  cached_searches: number
  cache_hit_rate_percent: number
  avg_results_count: number
}

interface RefreshStats {
  success: boolean
  duration_ms: number
  rows_refreshed: bigint
  changes_processed: number
  incremental: boolean
  last_refresh: string
  message: string
}

interface MaterializedViewStatus {
  view_name: string
  last_refresh: string
  staleness: string
  total_size: string
  table_size: string
  indexes_size: string
  row_count: number
  source_row_count: number
  health_status: string
}

export default function SearchPerformanceDashboard() {
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h')

  // Fetch search performance analytics
  const { data: searchMetrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['search-performance-analytics', timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/admin/search-performance/analytics?timeRange=${timeRange}`)
      if (!response.ok) throw new Error('Failed to fetch search metrics')
      return response.json()
    },
    refetchInterval: 60000 // Refresh every minute
  })

  // Fetch materialized view status
  const { data: viewStatus, isLoading: loadingView } = useQuery({
    queryKey: ['materialized-view-status'],
    queryFn: async () => {
      const response = await fetch('/api/admin/materialized-view/status')
      if (!response.ok) throw new Error('Failed to fetch view status')
      return response.json()
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  // Manual refresh trigger
  const refreshMaterializedView = async () => {
    try {
      const response = await fetch('/api/admin/materialized-view/refresh', {
        method: 'POST'
      })
      if (!response.ok) throw new Error('Failed to refresh view')
      return response.json()
    } catch (error) {
      console.error('Refresh failed:', error)
      throw error
    }
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatStaleness = (staleness: string) => {
    // Parse the INTERVAL string and format nicely
    const match = staleness.match(/(\d+).*?(\d+):(\d+):(\d+)/)
    if (match) {
      const [, days, hours, minutes, seconds] = match
      return `${days}d ${hours}h ${minutes}m`
    }
    return staleness
  }

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'OK': return 'bg-green-500'
      case 'WARNING - Approaching stale': return 'bg-yellow-500'
      case 'STALE - Refresh needed': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Search Performance Dashboard</h1>
          <p className="text-muted-foreground">Monitor and optimize search performance metrics</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Refresh Dashboard
          </Button>
          <Button
            size="sm"
            onClick={() => refreshMaterializedView()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Refresh Materialized View
          </Button>
        </div>
      </div>

      {/* Search Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Searches</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {searchMetrics?.metrics?.total_searches?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Last {timeRange}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Query Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(searchMetrics?.metrics?.avg_query_time_ms || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Target: <200ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {searchMetrics?.metrics?.cache_hit_rate_percent?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {searchMetrics?.metrics?.cached_searches || 0} cached searches
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Slow Queries</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {searchMetrics?.metrics?.slow_queries_count || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              >500ms queries
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Materialized View Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Materialized View Status
            </CardTitle>
            <CardDescription>
              Real-time status of the employers_search_optimized materialized view
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingView ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            ) : viewStatus ? (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Health Status</span>
                  <Badge className={getHealthStatusColor(viewStatus.health_status)}>
                    {viewStatus.health_status}
                  </Badge>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Last Refresh</span>
                  <span className="text-sm">
                    {new Date(viewStatus.last_refresh).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Staleness</span>
                  <span className="text-sm">
                    {formatStaleness(viewStatus.staleness)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Row Count</span>
                  <span className="text-sm">
                    {viewStatus.row_count?.toLocaleString()} / {viewStatus.source_row_count?.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Size</span>
                  <span className="text-sm">{viewStatus.total_size}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Index Size</span>
                  <span className="text-sm">{viewStatus.indexes_size}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Unable to load view status</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Search Performance Trends
            </CardTitle>
            <CardDescription>
              Hourly search performance breakdown
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMetrics ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {Array.isArray(searchMetrics?.analytics) && searchMetrics.analytics.length > 0 ? (
                  searchMetrics.analytics.slice(0, 6).map((metric: any, index: number) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span>{new Date(metric.hour).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span>{metric.total_searches} searches</span>
                        <span>{formatDuration(metric.avg_query_time_ms)}</span>
                        <Badge variant={metric.cache_hit_rate_percent > 70 ? 'default' : 'secondary'}>
                          {metric.cache_hit_rate_percent.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No recent search data available</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Recommendations</CardTitle>
          <CardDescription>
            Automated suggestions based on current metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {searchMetrics?.metrics?.avg_query_time_ms > 300 && (
              <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800">High Query Times Detected</h4>
                  <p className="text-sm text-yellow-700">
                    Average query time is {formatDuration(searchMetrics.metrics.avg_query_time_ms)}. Consider:
                    materialized view refresh, index optimization, or query analysis.
                  </p>
                </div>
              </div>
            )}

            {searchMetrics?.metrics?.cache_hit_rate_percent < 50 && (
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-800">Low Cache Hit Rate</h4>
                  <p className="text-sm text-blue-700">
                    Cache hit rate is {searchMetrics.metrics.cache_hit_rate_percent.toFixed(1)}%. Consider:
                    increasing cache TTL or implementing more aggressive caching strategies.
                  </p>
                </div>
              </div>
            )}

            {searchMetrics?.metrics?.slow_queries_count > 10 && (
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <TrendingUp className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-800">Many Slow Queries</h4>
                  <p className="text-sm text-red-700">
                    {searchMetrics.metrics.slow_queries_count} slow queries detected. Consider:
                    query optimization, additional indexing, or materialized view tuning.
                  </p>
                </div>
              </div>
            )}

            {viewStatus?.health_status === 'STALE - Refresh needed' && (
              <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <Database className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-orange-800">Materialized View is Stale</h4>
                  <p className="text-sm text-orange-700">
                    Materialized view needs refreshing. Click "Refresh Materialized View" button above.
                  </p>
                </div>
              </div>
            )}

            {(!searchMetrics?.metrics?.avg_query_time_ms || searchMetrics.metrics.avg_query_time_ms <= 200) &&
             (!searchMetrics?.metrics?.cache_hit_rate_percent || searchMetrics.metrics.cache_hit_rate_percent >= 70) &&
             (!searchMetrics?.metrics?.slow_queries_count || searchMetrics.metrics.slow_queries_count <= 5) &&
             viewStatus?.health_status === 'OK' && (
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-800">Excellent Performance</h4>
                  <p className="text-sm text-green-700">
                    All search performance metrics are within optimal ranges. Keep monitoring for changes.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}