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

  // Poll for updates if batch is still processing
  useEffect(() => {
    if (batch.status === 'processing' || batch.status === 'in_progress') {
      setIsPolling(true)
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/projects/batch-upload/${batch.id}/status`)
          if (response.ok) {
            const updatedBatch = await response.json()
            setBatch(updatedBatch)

            // Stop polling if completed
            if (
              updatedBatch.status === 'completed' ||
              updatedBatch.status === 'partial' ||
              updatedBatch.status === 'failed'
            ) {
              setIsPolling(false)
              clearInterval(interval)
              toast.success('Batch processing completed')
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
          <CardTitle>Individual Scans</CardTitle>
          <CardDescription>
            Status of each mapping sheet scan from this batch
          </CardDescription>
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
                {batch.scans.map((scan) => (
                  <TableRow key={scan.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{scan.file_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {scan.upload_mode === 'new' ? 'New Project' : 'Match Existing'}
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
                        <Button asChild variant="ghost" size="sm">
                          <a href={scan.file_url} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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
    { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any; label: string }
  > = {
    pending: { variant: 'secondary', icon: Clock, label: 'Pending' },
    processing: { variant: 'default', icon: Loader2, label: 'Processing' },
    completed: { variant: 'outline', icon: CheckCircle2, label: 'Completed' },
    failed: { variant: 'destructive', icon: XCircle, label: 'Failed' },
  }

  const config = variants[status] || variants.pending
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className="gap-1 text-xs">
      <Icon className={`h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  )
}
