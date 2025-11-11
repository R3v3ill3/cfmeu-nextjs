'use client'

import { useState, useMemo } from 'react'
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
import { useIsMobile } from '@/hooks/use-mobile'

interface PatchScansTableProps {
  scans: PatchScan[]
  isLoading?: boolean
}

export function PatchScansTable({ scans, isLoading }: PatchScansTableProps) {
  const [showAll, setShowAll] = useState(false)
  const isMobile = useIsMobile()

  // Filter scans based on showAll state
  // By default, show only "Needs Review" (completed, review_new_project) and "In Review" (under_review)
  // When showAll is true, also include "confirmed" scans
  const filteredScans = useMemo(() => {
    if (showAll) {
      return scans
    }
    return scans.filter(
      (scan) =>
        scan.status === 'completed' ||
        scan.status === 'review_new_project' ||
        scan.status === 'under_review'
    )
  }, [scans, showAll])

  const needsReviewCount = scans.filter(
    (scan) =>
      scan.status === 'completed' ||
      scan.status === 'review_new_project' ||
      scan.status === 'under_review'
  ).length

  const confirmedCount = scans.filter((scan) => scan.status === 'confirmed').length

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
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg sm:text-xl">Scanned Mapping Sheets</CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              {showAll
                ? `${scans.length} scan${scans.length !== 1 ? 's' : ''} for projects in this patch`
                : `${needsReviewCount} scan${needsReviewCount !== 1 ? 's' : ''} need${needsReviewCount !== 1 ? '' : 's'} review`}
              {confirmedCount > 0 && !showAll && (
                <span className="ml-2 text-muted-foreground">
                  ({confirmedCount} confirmed hidden)
                </span>
              )}
            </CardDescription>
          </div>
          {confirmedCount > 0 && (
            <Button
              variant={showAll ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="w-full sm:w-auto min-h-[44px]"
            >
              {showAll ? 'Show Active Only' : 'Show All'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {filteredScans.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No scans need review</p>
            {confirmedCount > 0 && (
              <p className="text-sm mt-2">
                {confirmedCount} confirmed scan{confirmedCount !== 1 ? 's' : ''} hidden. Click "Show All" to view.
              </p>
            )}
          </div>
        ) : isMobile ? (
          <div className="space-y-3">
            {filteredScans.map((scan) => {
              const needsReview = scan.status === 'completed' || scan.status === 'review_new_project'
              const hasExistingProject = Boolean(scan.project_id || scan.created_project_id)
              const canReviewExisting = (scan.status === 'completed' || scan.status === 'under_review') && hasExistingProject
              const canReviewNewProject = scan.status === 'review_new_project' && !hasExistingProject

              return (
                <Card key={scan.id} className={needsReview ? 'bg-yellow-50 border-yellow-200' : ''}>
                  <CardContent className="p-4 space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-semibold text-sm flex-1 break-words">{scan.file_name}</span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {scan.upload_mode === 'new_project' ? 'New Project' : 'Match Existing'}
                        </Badge>
                        <ScanStatusBadge status={scan.status} errorMessage={scan.error_message} />
                        {scan.page_count && (
                          <span className="text-xs text-muted-foreground">
                            {scan.page_count} page{scan.page_count !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {scan.created_project_id || scan.project_id ? (
                        <div>
                          <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                            <Link href={`/projects/${scan.created_project_id || scan.project_id}`}>
                              View Project
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Link>
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-2 pt-2 border-t">
                      {canReviewExisting && (scan.project_id || scan.created_project_id) && (
                        <Button
                          asChild
                          variant={scan.status === 'completed' ? 'default' : 'outline'}
                          size="sm"
                          className="w-full min-h-[44px] justify-start"
                        >
                          <Link
                            href={`/projects/${scan.project_id || scan.created_project_id}/scan-review/${scan.id}`}
                            prefetch={false}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            {scan.status === 'completed' || scan.status === 'review_new_project' ? 'Review' : 'Continue'}
                          </Link>
                        </Button>
                      )}

                      {canReviewNewProject && (
                        <Button asChild variant="default" size="sm" className="w-full min-h-[44px] justify-start">
                          <Link href={`/projects/new-scan-review/${scan.id}`} prefetch={false}>
                            <FileText className="h-4 w-4 mr-2" />
                            Review
                          </Link>
                        </Button>
                      )}

                      <Button asChild variant="outline" size="sm" className="w-full min-h-[44px] justify-start">
                        <a href={scan.file_url} target="_blank" rel="noopener noreferrer">
                          <Eye className="h-4 w-4 mr-2" />
                          View PDF
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
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
                {filteredScans.map((scan) => {
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
        )}
      </CardContent>
    </Card>
  )
}

