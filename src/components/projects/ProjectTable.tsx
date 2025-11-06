"use client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ProjectTierBadge } from "@/components/ui/ProjectTierBadge"
import { CfmeuEbaBadge, getProjectEbaStatus } from "@/components/ui/CfmeuEbaBadge"
import { LastVisitBadge } from "@/components/projects/LastVisitBadge"
import { MappingStatusBadge } from "@/components/projects/MappingStatusBadge"
import { AuditStatusBadge } from "@/components/projects/AuditStatusBadge"
import Link from "next/link"
import { useMemo } from "react"
import { OrganizingUniverseBadge } from "@/components/ui/OrganizingUniverseBadge"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"
import { usePatchOrganiserLabels } from "@/hooks/usePatchOrganiserLabels"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useRouter } from "next/navigation"

// Helper component to get organiser names for a project
function ProjectOrganiserNames({ projectId }: { projectId: string }) {
  // Get patch IDs for this project (same logic as individual project page)
  const { data: patchIds = [] } = useQuery({
    queryKey: ["project-patch-ids", projectId],
    enabled: !!projectId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Get job sites for project
      const { data: sites } = await supabase
        .from("job_sites")
        .select("id")
        .eq("project_id", projectId)
      
      const siteIds = (sites || []).map(s => s.id).filter(Boolean)
      if (siteIds.length === 0) return []
      
      // Get patches for those job sites
      const { data: patchSites } = await supabase
        .from("patch_job_sites")
        .select("patch_id")
        .in("job_site_id", siteIds)
      
      return Array.from(new Set((patchSites || []).map(ps => ps.patch_id).filter(Boolean)))
    }
  })
  
  const { mergedList: organiserNames = [] } = usePatchOrganiserLabels(patchIds)
  
  return <span>{organiserNames.length > 0 ? organiserNames.join(', ') : '—'}</span>
}

type ProjectRow = {
  id: string
  name: string
  main_job_site_id: string | null
  value: number | null
  tier: string | null
  organising_universe?: string | null
  stage_class?: string | null
  created_at?: string
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
  const { startNavigation } = useNavigationLoading()
  const router = useRouter()
  
  return (
    <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[140px] sm:min-w-[160px]">Project</TableHead>
            <TableHead className="min-w-[120px] sm:min-w-[140px]">Primary Contractor</TableHead>
            <TableHead className="min-w-[60px]">Tier</TableHead>
            <TableHead className="min-w-[100px] sm:min-w-[120px]">Classifications</TableHead>
            <TableHead className="min-w-[80px]">Patch</TableHead>
            <TableHead className="min-w-[100px] sm:min-w-[120px]">Organiser</TableHead>
            <TableHead className="text-right min-w-[70px]">Employers</TableHead>
            <TableHead className="text-right min-w-[70px]">Workers</TableHead>
            <TableHead className="text-right min-w-[70px]">Members</TableHead>
            <TableHead className="min-w-[80px]">Delegate</TableHead>
            <TableHead className="text-right min-w-[90px]">EBA Coverage</TableHead>
            <TableHead className="text-right min-w-[90px]">Key EBA</TableHead>
            <TableHead className="min-w-[80px]">Mapping</TableHead>
            <TableHead className="min-w-[60px]">Audit</TableHead>
            <TableHead className="min-w-[80px]">Last Visit</TableHead>
          </TableRow>
        </TableHeader>
      <TableBody>
        {rows.map((project) => {
          const summary = summaries[project.id]
          const isNew = !!(project as any)?.created_at && (function() {
            try {
              const since = (typeof window !== 'undefined') ? (new URLSearchParams(window.location.search).get('since') || '') : ''
              if (!since) return false
              return new Date((project as any).created_at!) > new Date(since)
            } catch { return false }
          })()
          
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
          // organiserNames will be handled by ProjectOrganiserNames component
          
          const ebaPercentage = engaged > 0 ? Math.round((ebaActive / engaged) * 100) : 0

          return (
            <TableRow key={project.id} className={`cursor-pointer hover:bg-muted/50 ${isNew ? 'bg-yellow-50' : ''} active:bg-muted/70`} onClick={() => onRowClick(project.id)}>
              <TableCell className="p-2 sm:p-3">
                <div className="flex flex-col">
                  <Link
                    href={`/projects/${project.id}`}
                    className="font-medium hover:underline text-primary text-sm sm:text-base"
                    onClick={(e) => {
                      e.stopPropagation()
                      startNavigation(`/projects/${project.id}`)
                    }}
                  >
                    {project.name} {isNew && <Badge variant="default" className="ml-2 text-[10px] bg-amber-500 hover:bg-amber-600">New</Badge>}
                  </Link>
                  {project.value && (
                    <div className="text-xs text-muted-foreground">
                      ${project.value.toLocaleString()}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="p-2 sm:p-3">
                {primary ? (
                  <button
                    type="button"
                    className="text-primary hover:underline text-left text-sm sm:text-base min-h-[44px] py-1 px-1 rounded -mx-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenEmployer(primary.id)
                    }}
                  >
                    {primary.name}
                  </button>
                ) : (
                  <span className="text-muted-foreground text-sm sm:text-base">—</span>
                )}
              </TableCell>
              <TableCell className="p-2 sm:p-3">
                {project.tier ? (
                  <ProjectTierBadge tier={project.tier as any} />
                ) : (
                  <span className="text-muted-foreground text-sm sm:text-base">—</span>
                )}
              </TableCell>
              <TableCell className="p-2 sm:p-3">
                <div className="flex flex-wrap items-center gap-1 sm:gap-2">
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
                    <OrganizingUniverseBadge
                      projectId={project.id}
                      currentStatus={project.organising_universe as any}
                      size="sm"
                    />
                  )}
                </div>
              </TableCell>
              <TableCell className="p-2 sm:p-3">
                <span className="text-sm sm:text-base">{patchName}</span>
              </TableCell>
              <TableCell className="p-2 sm:p-3">
                <div className="text-sm sm:text-base truncate">
                  <ProjectOrganiserNames projectId={project.id} />
                </div>
              </TableCell>
              <TableCell className="text-right p-2 sm:p-3">
                <Badge variant="outline" className="text-xs border-gray-800 text-black bg-white">
                  {engaged}
                </Badge>
              </TableCell>
              <TableCell className="text-right p-2 sm:p-3">
                {totalWorkers > 0 ? (
                  <Badge variant="secondary" className="text-xs">{totalWorkers}</Badge>
                ) : (
                  <span className="text-muted-foreground text-sm sm:text-base">0</span>
                )}
              </TableCell>
              <TableCell className="text-right p-2 sm:p-3">
                {totalMembers > 0 ? (
                  <Badge variant="default" className="text-xs bg-red-600 hover:bg-red-700">{totalMembers}</Badge>
                ) : (
                  <span className="text-muted-foreground text-sm sm:text-base">0</span>
                )}
              </TableCell>
              <TableCell className="p-2 sm:p-3">
                <span className="text-sm sm:text-base">
                  {delegateName || <span className="text-muted-foreground">—</span>}
                </span>
              </TableCell>
              <TableCell className="text-right p-2 sm:p-3">
                {engaged > 0 ? (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-1 sm:gap-2">
                    <span className="text-xs text-muted-foreground">{ebaActive}/{engaged}</span>
                    <Badge
                      variant={ebaPercentage > 50 ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {ebaPercentage}%
                    </Badge>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm sm:text-base">—</span>
                )}
              </TableCell>
              <TableCell className="text-right p-2 sm:p-3">
                {(() => {
                  const projectSubsetStats = subsetStats[project.id]
                  if (!projectSubsetStats || projectSubsetStats.known_employer_count === 0) {
                    return <span className="text-muted-foreground text-sm sm:text-base">—</span>
                  }

                  const { known_employer_count, eba_active_count, eba_percentage } = projectSubsetStats
                  return (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-1 sm:gap-2">
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
              <TableCell className="p-2 sm:p-3">
                <MappingStatusBadge
                  projectId={project.id}
                  mappingStatus={(project as any).mapping_status}
                  variant="compact"
                />
              </TableCell>
              <TableCell className="p-2 sm:p-3">
                <AuditStatusBadge
                  projectId={project.id}
                  hasComplianceChecks={(project as any).has_compliance_checks}
                  lastComplianceCheckDate={(project as any).last_compliance_check_date}
                  variant="compact"
                />
              </TableCell>
              <TableCell className="p-2 sm:p-3">
                <LastVisitBadge projectId={project.id} variant="compact" />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
    </div>
  )
}
