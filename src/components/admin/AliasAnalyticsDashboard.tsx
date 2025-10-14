"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Download, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Clock } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import type {
  AliasMetricsResponse,
  AliasMetricsSummary,
  CanonicalReviewMetrics,
  SourceSystemStats,
  EmployerAliasCoverage,
  ConflictBacklogItem,
} from "@/app/api/admin/alias-metrics/route"

export default function AliasAnalyticsDashboard() {
  const [metrics, setMetrics] = useState<AliasMetricsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    loadMetrics()
  }, [])

  const loadMetrics = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/alias-metrics')
      if (!response.ok) {
        throw new Error('Failed to fetch metrics')
      }
      const data = await response.json()
      setMetrics(data)
    } catch (error: any) {
      console.error('Error loading alias metrics:', error)
      toast.error('Failed to load alias metrics')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = async (exportType: string) => {
    setIsExporting(true)
    try {
      const response = await fetch('/api/admin/alias-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exportType }),
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1] || `alias-${exportType}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Export completed')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export data')
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading || !metrics) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Alias Analytics</h2>
          <p className="text-muted-foreground">Loading metrics...</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16 mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const { summary, canonicalReviews, sourceSystems, coverage, conflictBacklog } = metrics

  const getTrendIndicator = (current: number, previous: number) => {
    if (current > previous) {
      return <TrendingUp className="h-4 w-4 text-green-600" />
    } else if (current < previous) {
      return <TrendingDown className="h-4 w-4 text-red-600" />
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Alias Analytics & Reporting</h2>
          <p className="text-muted-foreground">
            Monitor alias usage, conflicts, and canonical name promotions
          </p>
        </div>
        <Button onClick={loadMetrics} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Aliases</CardTitle>
            {getTrendIndicator(
              summary.aliases_last_7_days || 0,
              (summary.aliases_last_30_days || 0) - (summary.aliases_last_7_days || 0)
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_aliases?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              {summary.authoritative_aliases || 0} authoritative
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              +{summary.aliases_last_7_days || 0} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
            {(canonicalReviews.pending_reviews || 0) > 10 && (
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {canonicalReviews.pending_reviews?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {canonicalReviews.high_priority_reviews || 0} high priority
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {canonicalReviews.previously_deferred || 0} deferred
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promotions (7d)</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {canonicalReviews.promotions_last_7_days?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {canonicalReviews.rejections_last_7_days || 0} rejected
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {canonicalReviews.deferrals_last_7_days || 0} deferred
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Employer Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coverage.coverage_percentage?.toFixed(1) || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {coverage.employers_with_aliases || 0} / {coverage.total_employers || 0} employers
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {coverage.employers_with_authoritative || 0} with authoritative
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Resolution Latency */}
      {canonicalReviews.median_resolution_hours !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Resolution Time
            </CardTitle>
            <CardDescription>
              Median time from alias collection to canonical promotion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {Math.round(canonicalReviews.median_resolution_hours)} hours
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Based on last 30 days of authoritative alias promotions
            </p>
          </CardContent>
        </Card>
      )}

      {/* Source Systems Breakdown */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Aliases by Source System</CardTitle>
            <CardDescription>Breakdown of alias sources and activity</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('sourceSystems')}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source System</TableHead>
                <TableHead className="text-right">Total Aliases</TableHead>
                <TableHead className="text-right">Authoritative</TableHead>
                <TableHead className="text-right">Employers</TableHead>
                <TableHead className="text-right">Avg/Employer</TableHead>
                <TableHead className="text-right">Last 7 Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sourceSystems.map(source => (
                <TableRow key={source.source_system}>
                  <TableCell className="font-medium">
                    <Badge variant="outline">{source.source_system}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{source.total_aliases.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{source.authoritative_count.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{source.employer_count.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{source.avg_aliases_per_employer}</TableCell>
                  <TableCell className="text-right">
                    {source.new_last_7_days > 0 ? (
                      <Badge variant="secondary">+{source.new_last_7_days}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Conflict Backlog */}
      {conflictBacklog.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Conflict Backlog
              </CardTitle>
              <CardDescription>
                Pending canonical name promotions with conflicts requiring review
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('conflictBacklog')}
                disabled={isExporting}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Link href="/admin?tab=canonical-names">
                <Button variant="default" size="sm">
                  Review Queue
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proposed Name</TableHead>
                  <TableHead>Current Name</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Conflicts</TableHead>
                  <TableHead>Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conflictBacklog.slice(0, 10).map(item => (
                  <TableRow key={item.alias_id}>
                    <TableCell className="font-medium">{item.proposed_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.current_canonical_name}
                    </TableCell>
                    <TableCell>
                      {(item.priority || 0) >= 10 && (
                        <Badge variant="destructive">High</Badge>
                      )}
                      {(item.priority || 0) >= 5 && (item.priority || 0) < 10 && (
                        <Badge>Medium</Badge>
                      )}
                      {(item.priority || 0) < 5 && (
                        <Badge variant="outline">Low</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.source_system || 'Unknown'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{item.conflict_count}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.age_bucket}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {conflictBacklog.length > 10 && (
              <div className="mt-4 text-center">
                <Link href="/admin?tab=canonical-names">
                  <Button variant="outline" size="sm">
                    View All {conflictBacklog.length} Conflicts
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {(canonicalReviews.pending_reviews || 0) > 25 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>High Backlog Alert</AlertTitle>
          <AlertDescription>
            There are {canonicalReviews.pending_reviews} pending canonical name reviews. Consider
            prioritizing high-priority items.
          </AlertDescription>
        </Alert>
      )}

      {coverage.employers_with_external_id_no_aliases > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Missing Alias Coverage</AlertTitle>
          <AlertDescription>
            {coverage.employers_with_external_id_no_aliases} employers have external IDs (BCI/Incolink)
            but no aliases recorded. These should be captured during imports.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

