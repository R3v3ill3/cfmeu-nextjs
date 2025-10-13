'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { Check, X, Eye } from 'lucide-react'
import { ProjectReviewDialog } from './ProjectReviewDialog'

interface PendingProject {
  id: string
  name: string
  value: number | null
  proposed_start_date: string | null
  created_at: string
  main_job_site?: {
    full_address: string | null
  } | null
  scan?: {
    id: string
    file_name: string
    uploader?: {
      email: string
      full_name: string | null
    } | null
  }[]
}

interface PendingProjectsTableProps {
  projects: PendingProject[]
  onApprove: (projectId: string, notes?: string) => Promise<void>
  onReject: (projectId: string, reason: string) => Promise<void>
  onRefresh: () => void
}

export function PendingProjectsTable({
  projects,
  onApprove,
  onReject,
  onRefresh,
}: PendingProjectsTableProps) {
  const [selectedProject, setSelectedProject] = useState<PendingProject | null>(null)
  const [isReviewOpen, setIsReviewOpen] = useState(false)

  const handleReview = (project: PendingProject) => {
    setSelectedProject(project)
    setIsReviewOpen(true)
  }

  const handleApproveFromDialog = async (notes?: string) => {
    if (selectedProject) {
      await onApprove(selectedProject.id, notes)
      setIsReviewOpen(false)
      setSelectedProject(null)
    }
  }

  const handleRejectFromDialog = async (reason: string) => {
    if (selectedProject) {
      await onReject(selectedProject.id, reason)
      setIsReviewOpen(false)
      setSelectedProject(null)
    }
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No pending projects
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project Name</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Submitted By</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow key={project.id}>
              <TableCell className="font-medium">{project.name}</TableCell>
              <TableCell>
                {project.main_job_site?.full_address || 'No address'}
              </TableCell>
              <TableCell>
                {project.value
                  ? `$${project.value.toLocaleString()}`
                  : 'N/A'}
              </TableCell>
              <TableCell>
                {project.scan?.[0]?.uploader?.full_name ||
                  project.scan?.[0]?.uploader?.email ||
                  'Unknown'}
              </TableCell>
              <TableCell>
                {format(new Date(project.created_at), 'MMM d, yyyy')}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReview(project)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Review
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedProject && (
        <ProjectReviewDialog
          open={isReviewOpen}
          onOpenChange={setIsReviewOpen}
          project={selectedProject}
          onApprove={handleApproveFromDialog}
          onReject={handleRejectFromDialog}
        />
      )}
    </>
  )
}
