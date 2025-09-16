"use client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ProjectTierBadge } from "@/components/ui/ProjectTierBadge"
import { CfmeuEbaBadge, getProjectEbaStatus } from "@/components/ui/CfmeuEbaBadge"
import Link from "next/link"
import { useMemo } from "react"
import { getOrganisingUniverseBadgeVariant } from "@/utils/organisingUniverse"

type ProjectRow = {
  id: string
  name: string
  main_job_site_id: string | null
  value: number | null
  tier: string | null
  organising_universe?: string | null
  stage_class?: string | null
  project_assignments?: Array<{
    assignment_type: string
    employer_id: string
    contractor_role_types?: { code: string } | null
    employers?: { 
      name: string | null
      enterprise_agreement_status?: boolean | null
    } | null
  }>
}

type ProjectSummary = {
  project_id: string
  total_workers: number
  total_members: number
  engaged_employer_count: number
  eba_active_employer_count: number
  estimated_total: number
  delegate_name: string | null
  first_patch_name: string | null
  organiser_names: string | null
}

export function ProjectTable({ 
  rows, 
  summaries, 
  subsetStats = {},
  onRowClick, 
  onOpenEmployer 
}: { 
  rows: ProjectRow[]
  summaries: Record<string, ProjectSummary>
  subsetStats?: Record<string, any>
  onRowClick: (id: string) => void
  onOpenEmployer: (id: string) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Project</TableHead>
          <TableHead>Primary Contractor</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead>Classifications</TableHead>
          <TableHead>Patch</TableHead>
          <TableHead>Organiser</TableHead>
          <TableHead className="text-right">Employers</TableHead>
          <TableHead className="text-right">Workers</TableHead>
          <TableHead className="text-right">Members</TableHead>
          <TableHead>Delegate</TableHead>
          <TableHead className="text-right">EBA Coverage</TableHead>
          <TableHead className="text-right">Key EBA</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((project) => {
          const summary = summaries[project.id]
          
          const contractors = (project.project_assignments || []).filter((a) => a.assignment_type === 'contractor_role')
          const builderNames = contractors.map((a) => ({ id: a.employer_id, name: a.employers?.name || a.employer_id }))

          const hc = (project.project_assignments || []).find((a) => a.assignment_type === 'contractor_role')
          const head = hc ? { id: hc.employer_id, name: hc.employers?.name || hc.employer_id } : null

          const primary = builderNames[0] || head
          const totalWorkers = summary?.total_workers || 0
          const totalMembers = summary?.total_members || 0
          const ebaActive = summary?.eba_active_employer_count || 0
          const engaged = summary?.engaged_employer_count || 0
          const delegateName = summary?.delegate_name || null
          const patchName = summary?.first_patch_name || '—'
          const organiserNames = summary?.organiser_names || '—'
          
          const ebaPercentage = engaged > 0 ? Math.round((ebaActive / engaged) * 100) : 0

          return (
            <TableRow key={project.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick(project.id)}>
              <TableCell>
                <div className="flex flex-col">
                  <Link 
                    href={`/projects/${project.id}`} 
                    className="font-medium hover:underline text-primary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {project.name}
                  </Link>
                  {project.value && (
                    <div className="text-xs text-muted-foreground">
                      ${project.value.toLocaleString()}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {primary ? (
                  <button 
                    type="button" 
                    className="text-primary hover:underline text-left" 
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenEmployer(primary.id)
                    }}
                  >
                    {primary.name}
                  </button>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {project.tier ? (
                  <ProjectTierBadge tier={project.tier as any} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {(() => {
                    const ebaStatus = getProjectEbaStatus(project)
                    return (
                      <CfmeuEbaBadge 
                        hasActiveEba={ebaStatus.hasActiveEba} 
                        builderName={ebaStatus.builderName}
                        size="sm"
                        showText={false}
                      />
                    )
                  })()}
                  {project.stage_class && (
                    <Badge variant="secondary" className="text-[10px] capitalize">{String(project.stage_class).replace('_',' ')}</Badge>
                  )}
                  {project.organising_universe && (
                    <Badge variant={getOrganisingUniverseBadgeVariant(project.organising_universe as any)} className="text-[10px] capitalize">{String(project.organising_universe)}</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm">{patchName}</span>
              </TableCell>
              <TableCell>
                <span className="text-sm truncate" title={organiserNames}>
                  {organiserNames.length > 20 ? `${organiserNames.substring(0, 20)}...` : organiserNames}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <Badge variant="outline" className="text-xs border-gray-800 text-black bg-white">
                  {engaged}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {totalWorkers > 0 ? (
                  <Badge variant="secondary" className="text-xs">{totalWorkers}</Badge>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {totalMembers > 0 ? (
                  <Badge variant="default" className="text-xs bg-red-600 hover:bg-red-700">{totalMembers}</Badge>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
              <TableCell>
                <span className="text-sm">
                  {delegateName || <span className="text-muted-foreground">—</span>}
                </span>
              </TableCell>
              <TableCell className="text-right">
                {engaged > 0 ? (
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs text-muted-foreground">{ebaActive}/{engaged}</span>
                    <Badge 
                      variant={ebaPercentage > 50 ? "default" : "destructive"} 
                      className="text-xs"
                    >
                      {ebaPercentage}%
                    </Badge>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {(() => {
                  const projectSubsetStats = subsetStats[project.id]
                  if (!projectSubsetStats || projectSubsetStats.known_employer_count === 0) {
                    return <span className="text-muted-foreground">—</span>
                  }
                  
                  const { known_employer_count, eba_active_count, eba_percentage } = projectSubsetStats
                  return (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-muted-foreground">{eba_active_count}/{known_employer_count}</span>
                      <Badge 
                        variant={eba_percentage > 50 ? "default" : "destructive"} 
                        className="text-xs"
                      >
                        {eba_percentage}%
                      </Badge>
                    </div>
                  )
                })()}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
