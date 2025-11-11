'use client'

import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  FileText,
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
import { ScanStatusBadge } from '@/components/batches/ScanStatusBadge'
import type { PatchScan } from '@/hooks/usePatchScans'

interface PatchScansTableProps {
  scans: PatchScan[]
  isLoading?: boolean
}

export function PatchScansTable({ scans, isLoading }: PatchScansTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scanned Mapping Sheets</CardTitle>
          <CardDescription>Loading scans...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Loading scans...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (scans.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scanned Mapping Sheets</CardTitle>
          <CardDescription>
            Mapping sheet scans for projects in this patch
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No scans found for projects in this patch</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scanned Mapping Sheets</CardTitle>
        <CardDescription>
          {scans.length} scan{scans.length !== 1 ? 's' : ''} for projects in this patch
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
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
              {scans.map((scan) => {
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
                      <span className="text-sm text-muted-foreground">{scan.page_count || '-'}</span>
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
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

