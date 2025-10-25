'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Download,
  Eye,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'

interface Scan {
  id: string
  file_name: string
  file_url: string
  status: string
  upload_mode: string
  project_id: string | null
  created_project_id: string | null
  page_count: number
  confidence_scores: any
  error_message: string | null
  created_at: string
  updated_at: string
}

interface Batch {
  id: string
  uploaded_by: string
  original_file_name: string
  original_file_url: string
  original_file_size_bytes: number
  total_pages: number
  total_projects: number
  projects_completed: number
  status: string
  project_definitions: any[]
  error_message: string | null
  created_at: string
  processing_started_at: string | null
  processing_completed_at: string | null
  metadata: any
  scans: Scan[]
}

interface BatchDetailViewProps {
  batch: Batch
}

export function BatchDetailView({ batch: initialBatch }: BatchDetailViewProps) {
  const [batch, setBatch] = useState<Batch>(initialBatch)
  const [isPolling, setIsPolling] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  // Poll for updates if batch is still processing
  useEffect(() => {
    if (batch.status === 'processing' || batch.status === 'in_progress') {
      setIsPolling(true)
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/projects/batch-upload/${batch.id}/status`)
          if (response.ok) {
            const updatedBatch = await response.json()
            // Note: The status endpoint only returns batch data, not scans
            // Scan status updates will be visible after page refresh or when navigating back from review
            setBatch((prevBatch) => ({
              ...prevBatch,
              ...updatedBatch,
              scans: prevBatch.scans, // Keep existing scans since status endpoint doesn't include them
            }))

            // Stop polling if completed
            if (
              updatedBatch.status === 'completed' ||
              updatedBatch.status === 'partial' ||
              updatedBatch.status === 'failed'
            ) {
              setIsPolling(false)
              clearInterval(interval)
              toast.success('Batch processing completed - refresh page to see scan details')
            }
          }
        } catch (error) {
          console.error('Error polling batch status:', error)
        }
      }, 3000) // Poll every 3 seconds

      return () => clearInterval(interval)
    }
  }, [batch.id, batch.status])

  const progress =
    batch.total_projects > 0 ? (batch.projects_completed / batch.total_projects) * 100 : 0

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const formatDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return 'N/A'
    const duration = new Date(end).getTime() - new Date(start).getTime()
    const seconds = Math.floor(duration / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const handleRetryFailed = async () => {
    setIsRetrying(true)
    try {
      const response = await fetch('/api/projects/batch-upload/retry-failed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: batch.id }),
      })

      if (!response.ok) {
        throw new Error('Failed to retry scans')
      }

      const result = await response.json()
      toast.success(`Retrying ${result.retriedCount} failed scan${result.retriedCount !== 1 ? 's' : ''}`)

      // Refresh page after a short delay to show updated statuses
      setTimeout(() => window.location.reload(), 2000)
    } catch (error) {
      console.error('Retry failed:', error)
      toast.error('Failed to retry scans. Please try again.')
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/projects/batches">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Batches
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Batch Upload Details</h1>
          <p className="text-muted-foreground">{batch.original_file_name}</p>
        </div>
        <div className="flex items-center gap-2">
          {isPolling && (
            <Badge variant="default" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Auto-updating
            </Badge>
          )}
          <BatchStatusBadge status={batch.status} errorMessage={batch.error_message} />
        </div>
      </div>

      {/* Review Alert */}
      {batch.scans && batch.scans.length > 0 && (() => {
        const scansNeedingReview = batch.scans.filter(s =>
          s.status === 'completed' || s.status === 'review_new_project'
        )
        return scansNeedingReview.length > 0 && (
          <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900">
                {scansNeedingReview.length} Scan{scansNeedingReview.length > 1 ? 's' : ''} Need Review
              </h3>
              <p className="text-sm text-yellow-800 mt-1">
                These scans have been processed and are ready for review. Please review each scan to match contractors to existing employers and confirm the extracted data before it's imported.
              </p>
            </div>
          </div>
        )
      })()}

      {/* Failed Scans Alert */}
      {batch.scans && batch.scans.length > 0 && (() => {
        const failedScans = batch.scans.filter(s => s.status === 'failed')
        return failedScans.length > 0 && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">
                {failedScans.length} Scan{failedScans.length > 1 ? 's' : ''} Failed
              </h3>
              <p className="text-sm text-red-800 mt-1">
                These scans encountered errors during processing. Check error messages below or retry processing.
              </p>
              <div className="mt-3">
                <Button
                  onClick={handleRetryFailed}
                  disabled={isRetrying}
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  {isRetrying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry Failed Scans
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Batch Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Overview</CardTitle>
          <CardDescription>Summary of the batch upload</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Pages</p>
              <p className="text-2xl font-bold">{batch.total_pages}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Projects</p>
              <p className="text-2xl font-bold">{batch.total_projects}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold">{batch.projects_completed}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">File Size</p>
              <p className="text-2xl font-bold">
                {formatFileSize(batch.original_file_size_bytes)}
              </p>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Processing Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Created</p>
              <p className="text-sm font-medium">
                {format(new Date(batch.created_at), 'MMM d, yyyy h:mm a')}
              </p>
            </div>
            {batch.processing_started_at && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Processing Started</p>
                <p className="text-sm font-medium">
                  {format(new Date(batch.processing_started_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            )}
            {batch.processing_completed_at && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Completed</p>
                <p className="text-sm font-medium">
                  {format(new Date(batch.processing_completed_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            )}
          </div>

          {batch.processing_started_at && batch.processing_completed_at && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Processing Duration</p>
              <p className="text-sm font-medium">
                {formatDuration(batch.processing_started_at, batch.processing_completed_at)}
              </p>
            </div>
          )}

          {batch.error_message && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Error</p>
                <p className="text-sm mt-1">{batch.error_message}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t">
            <Button asChild variant="outline" size="sm">
              <a href={batch.original_file_url} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-2" />
                Download Original PDF
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={batch.original_file_url} target="_blank" rel="noopener noreferrer">
                <Eye className="h-4 w-4 mr-2" />
                View Original PDF
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scans Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Individual Scans</CardTitle>
              <CardDescription>
                Status of each mapping sheet scan from this batch
              </CardDescription>
            </div>
            {batch.scans && batch.scans.length > 0 && (() => {
              const scansNeedingReview = batch.scans.filter(s =>
                s.status === 'completed' || s.status === 'review_new_project'
              ).length
              const scansInReview = batch.scans.filter(s => s.status === 'under_review').length
              const scansConfirmed = batch.scans.filter(s => s.status === 'confirmed').length

              return scansNeedingReview > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {scansNeedingReview} Needs Review
                  </Badge>
                  {scansInReview > 0 && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                      <Clock className="h-3 w-3 mr-1" />
                      {scansInReview} In Review
                    </Badge>
                  )}
                  {scansConfirmed > 0 && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {scansConfirmed} Confirmed
                    </Badge>
                  )}
                </div>
              )
            })()}
          </div>
        </CardHeader>
        <CardContent>
          {batch.scans && batch.scans.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pages</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batch.scans.map((scan) => {
                  const needsReview = scan.status === 'completed' || scan.status === 'review_new_project'
                  const hasExistingProject = Boolean(scan.project_id || scan.created_project_id)
                  const canReviewExisting = (scan.status === 'completed' || scan.status === 'under_review') && hasExistingProject
                  const canReviewNewProject = scan.status === 'review_new_project' && !hasExistingProject
                  return (
                  <TableRow
                    key={scan.id}
                    className={needsReview ? 'bg-yellow-50 hover:bg-yellow-100' : ''}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{scan.file_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {scan.upload_mode === 'new_project' ? 'New Project' : 'Match Existing'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ScanStatusBadge status={scan.status} errorMessage={scan.error_message} />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{scan.page_count}</span>
                    </TableCell>
                    <TableCell>
                      {scan.created_project_id ? (
                        <Button asChild variant="link" size="sm" className="h-auto p-0">
                          <Link href={`/projects/${scan.created_project_id}`}>
                            View Project
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      ) : scan.project_id ? (
                        <Button asChild variant="link" size="sm" className="h-auto p-0">
                          <Link href={`/projects/${scan.project_id}`}>
                            View Project
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {/* Review button for scans tied to an existing project */}
                        {canReviewExisting && (scan.project_id || scan.created_project_id) && (
                          <Button
                            asChild
                            variant={scan.status === 'completed' ? 'default' : 'outline'}
                            size="sm"
                          >
                            <Link
                              href={`/projects/${scan.project_id || scan.created_project_id}/scan-review/${scan.id}`}
                              prefetch={false}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              {scan.status === 'completed' || scan.status === 'review_new_project' ? 'Review' : 'Continue'}
                            </Link>
                          </Button>
                        )}

                        {/* Review button for new-project scans awaiting triage */}
                        {canReviewNewProject && (
                          <Button asChild variant="default" size="sm">
                            <Link href={`/projects/new-scan-review/${scan.id}`} prefetch={false}>
                              <FileText className="h-3 w-3 mr-1" />
                              Review
                            </Link>
                          </Button>
                        )}

                        {/* View PDF button */}
                        <Button asChild variant="ghost" size="sm">
                          <a href={scan.file_url} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No scans found for this batch</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function BatchStatusBadge({
  status,
  errorMessage,
}: {
  status: string
  errorMessage: string | null
}) {
  const variants: Record<
    string,
    { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any; label: string }
  > = {
    pending: { variant: 'secondary', icon: Clock, label: 'Pending' },
    processing: { variant: 'default', icon: Loader2, label: 'Processing' },
    in_progress: { variant: 'default', icon: Loader2, label: 'In Progress' },
    completed: { variant: 'outline', icon: CheckCircle2, label: 'Completed' },
    partial: { variant: 'outline', icon: AlertCircle, label: 'Partial' },
    failed: { variant: 'destructive', icon: XCircle, label: 'Failed' },
  }

  const config = variants[status] || variants.pending
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className="gap-1.5">
      <Icon
        className={`h-3.5 w-3.5 ${status === 'processing' || status === 'in_progress' ? 'animate-spin' : ''}`}
      />
      {config.label}
    </Badge>
  )
}

function ScanStatusBadge({
  status,
  errorMessage,
}: {
  status: string
  errorMessage: string | null
}) {
  const variants: Record<
    string,
    { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any; label: string; color?: string }
  > = {
    pending: { variant: 'secondary', icon: Clock, label: 'Pending' },
    processing: { variant: 'default', icon: Loader2, label: 'Processing' },
    completed: { variant: 'outline', icon: AlertCircle, label: 'Needs Review', color: 'text-yellow-600 border-yellow-300 bg-yellow-50' },
    under_review: { variant: 'default', icon: Clock, label: 'In Review', color: 'bg-blue-100 text-blue-700 border-blue-300' },
    confirmed: { variant: 'outline', icon: CheckCircle2, label: 'Confirmed', color: 'text-green-600 border-green-300 bg-green-50' },
    rejected: { variant: 'outline', icon: XCircle, label: 'Rejected', color: 'text-gray-500 border-gray-300' },
    review_new_project: { variant: 'outline', icon: AlertCircle, label: 'Needs Review', color: 'text-yellow-600 border-yellow-300 bg-yellow-50' },
    failed: { variant: 'destructive', icon: XCircle, label: 'Failed' },
  }

  const config = variants[status] || variants.pending
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className={`gap-1 text-xs ${config.color || ''}`}>
      <Icon className={`h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  )
}
