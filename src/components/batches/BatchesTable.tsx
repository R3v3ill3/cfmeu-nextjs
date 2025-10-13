'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { FileText, Clock, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Batch {
  id: string
  original_file_name: string
  total_pages: number
  total_projects: number
  projects_completed: number
  status: string
  error_message: string | null
  created_at: string
  processing_started_at: string | null
  processing_completed_at: string | null
}

interface BatchesTableProps {
  batches: Batch[]
}

export function BatchesTable({ batches }: BatchesTableProps) {
  if (batches.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-3">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="font-medium">No batches yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Upload your first batch to get started
              </p>
            </div>
            <Button asChild>
              <Link href="/projects">Go to Projects</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Upload History</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Pages</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((batch) => {
              const progress =
                batch.total_projects > 0
                  ? (batch.projects_completed / batch.total_projects) * 100
                  : 0

              return (
                <TableRow key={batch.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{batch.original_file_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <BatchStatusBadge status={batch.status} errorMessage={batch.error_message} />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 min-w-[150px]">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {batch.projects_completed} / {batch.total_projects}
                        </span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{batch.total_pages}</span>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{format(new Date(batch.created_at), 'MMM d, yyyy')}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(batch.created_at), 'h:mm a')}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/projects/batches/${batch.id}`}>View Details</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
    pending: {
      variant: 'secondary',
      icon: Clock,
      label: 'Pending',
    },
    processing: {
      variant: 'default',
      icon: Loader2,
      label: 'Processing',
    },
    in_progress: {
      variant: 'default',
      icon: Loader2,
      label: 'In Progress',
    },
    completed: {
      variant: 'outline',
      icon: CheckCircle2,
      label: 'Completed',
    },
    partial: {
      variant: 'outline',
      icon: AlertCircle,
      label: 'Partial',
    },
    failed: {
      variant: 'destructive',
      icon: XCircle,
      label: 'Failed',
    },
  }

  const config = variants[status] || variants.pending
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className={`h-3 w-3 ${status === 'processing' || status === 'in_progress' ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  )
}
