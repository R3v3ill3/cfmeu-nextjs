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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'
import { Check, X, Eye, Search, Download, ChevronDown, ChevronRight } from 'lucide-react'
import { EnhancedProjectReviewDialog } from './EnhancedProjectReviewDialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

interface PendingProject {
  id: string
  name: string
  value: number | null
  proposed_start_date: string | null
  created_at: string
  stage_class?: string | null
  project_stage?: string | null
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
  project_assignments?: Array<{
    assignment_type: string
    employer?: {
      name: string
    } | null
  }>
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
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [isReviewOpen, setIsReviewOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterBy, setFilterBy] = useState<'all' | 'high_value' | 'recent'>('all')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const handleReview = (projectId: string) => {
    setSelectedProjectId(projectId)
    setIsReviewOpen(true)
  }

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  const handleQuickApprove = async (projectId: string) => {
    if (!window.confirm('Are you sure you want to approve this project without detailed review?')) {
      return
    }
    await onApprove(projectId)
    onRefresh()
  }

  const handleQuickReject = async (projectId: string) => {
    const reason = prompt('Enter rejection reason:')
    if (!reason) return
    await onReject(projectId, reason)
    onRefresh()
  }

  const handleExport = () => {
    const csv = [
      ['Project Name', 'Value', 'Address', 'Stage', 'Employers', 'Submitted', 'Submitted By'],
      ...filteredProjects.map((p) => [
        p.name,
        p.value?.toString() || '',
        p.main_job_site?.full_address || '',
        p.stage_class || '',
        p.project_assignments?.length.toString() || '0',
        format(new Date(p.created_at), 'yyyy-MM-dd'),
        p.scan?.[0]?.uploader?.full_name || p.scan?.[0]?.uploader?.email || '',
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pending-projects-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Filter and search
  const filteredProjects = projects.filter((project) => {
    // Search filter
    const matchesSearch = searchQuery
      ? project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.main_job_site?.full_address
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase())
      : true

    // Additional filters
    let matchesFilter = true
    if (filterBy === 'high_value') {
      matchesFilter = (project.value || 0) >= 1000000
    } else if (filterBy === 'recent') {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      matchesFilter = new Date(project.created_at) >= weekAgo
    }

    return matchesSearch && matchesFilter
  })

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No pending projects
      </div>
    )
  }

  const getEmployerCount = (project: PendingProject) => {
    return project.project_assignments?.length || 0
  }

  const getBuilderName = (project: PendingProject) => {
    const builder = project.project_assignments?.find((a) => a.assignment_type === 'builder')
    return builder?.employer?.name || 'Unknown'
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects by name or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterBy} onValueChange={(v: any) => setFilterBy(v)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            <SelectItem value="high_value">High Value ($1M+)</SelectItem>
            <SelectItem value="recent">Recent (Last 7 days)</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredProjects.length} of {projects.length} projects
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Project Name</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Employers</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredProjects.map((project) => (
            <Collapsible
              key={project.id}
              open={expandedRows.has(project.id)}
              onOpenChange={() => toggleRow(project.id)}
              asChild
            >
              <>
                <TableRow className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm">
                        {expandedRows.has(project.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="space-y-1">
                      <div>{project.name}</div>
                      {project.value && project.value >= 1000000 && (
                        <Badge variant="secondary" className="text-xs">
                          High Value
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {project.value
                      ? `$${project.value.toLocaleString()}`
                      : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {project.stage_class ? (
                      <Badge variant="outline">{project.stage_class}</Badge>
                    ) : (
                      'N/A'
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{getEmployerCount(project)}</Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(project.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleReview(project.id)
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Review
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleQuickReject(project.id)
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleQuickApprove(project.id)
                        }}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                <CollapsibleContent asChild>
                  <TableRow>
                    <TableCell colSpan={7} className="bg-muted/30">
                      <div className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-semibold">Address:</span>{' '}
                            {project.main_job_site?.full_address || 'No address'}
                          </div>
                          <div>
                            <span className="font-semibold">Builder:</span>{' '}
                            {getBuilderName(project)}
                          </div>
                          <div>
                            <span className="font-semibold">Submitted by:</span>{' '}
                            {project.scan?.[0]?.uploader?.full_name ||
                              project.scan?.[0]?.uploader?.email ||
                              'Unknown'}
                          </div>
                          {project.proposed_start_date && (
                            <div>
                              <span className="font-semibold">Proposed start:</span>{' '}
                              {format(new Date(project.proposed_start_date), 'MMM d, yyyy')}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                </CollapsibleContent>
              </>
            </Collapsible>
          ))}
        </TableBody>
      </Table>

      <EnhancedProjectReviewDialog
        open={isReviewOpen}
        onOpenChange={setIsReviewOpen}
        projectId={selectedProjectId}
        onApprove={onApprove}
        onReject={onReject}
        onRefresh={onRefresh}
      />
    </div>
  )
}
