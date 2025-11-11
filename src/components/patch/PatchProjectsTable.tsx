"use client"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CfmeuEbaBadge, getProjectEbaStatus } from "@/components/ui/CfmeuEbaBadge"
import { OrganizingUniverseBadge } from "@/components/ui/OrganizingUniverseBadge"
import { Building2, FileUp, List, ExternalLink } from "lucide-react"
import { ProjectSummary, ProjectRecord } from "@/hooks/useProjectsServerSide"
import { useIsMobile } from "@/hooks/use-mobile"

export interface PatchProjectsTableProps {
  projects: ProjectRecord[]
  summaries: Record<string, ProjectSummary>
  onAction: (action: "visit-sheet" | "worker-list" | "employer-compliance", projectId: string, jobSiteId?: string | null) => void
  onOpenEmployer?: (employerId: string) => void
}

const formatBuilderInfo = (project: ProjectRecord) => {
  const contractors = (project.project_assignments || []).filter(
    (assignment) => assignment.assignment_type === "contractor_role"
  )
  if (contractors.length === 0) return null

  const primary = contractors.find((assignment) => assignment.contractor_role_types?.code === "builder")
    || contractors.find((assignment) => assignment.contractor_role_types?.code === "head_contractor")
    || contractors[0]

  if (!primary) return null

  const employerName = primary.employers?.name || primary.employer_id
  const employerId = primary.employer_id ? String(primary.employer_id) : null

  if (!employerName) return null

  return {
    id: employerId,
    name: String(employerName)
  }
}

export function PatchProjectsTable({ projects, summaries, onAction, onOpenEmployer }: PatchProjectsTableProps) {
  const isMobile = useIsMobile()

  if (projects.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">No projects found for this patch.</div>
    )
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {projects.map((project) => {
          const summary = summaries[project.id]
          const builder = formatBuilderInfo(project)
          const ebaStatus = getProjectEbaStatus(project)
          const organisingUniverse = project.organising_universe as string | null
          const lastVisit: string | null = null

          return (
            <Card key={project.id}>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-2">
                  <Link href={`/projects/${project.id}`} className="font-semibold text-base text-primary hover:underline flex items-center gap-1.5">
                    {project.name}
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                  {summary?.delegate_name && (
                    <div className="text-xs text-muted-foreground">Delegate: {summary.delegate_name}</div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">EBA Status:</span>
                    <CfmeuEbaBadge hasActiveEba={ebaStatus.hasActiveEba} builderName={(builder?.name || ebaStatus.builderName) || undefined} size="sm" />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Builder:</span>
                    {builder ? (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {builder.id && onOpenEmployer ? (
                          <button
                            type="button"
                            className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
                            onClick={() => onOpenEmployer(builder.id!)}
                          >
                            {builder.name}
                          </button>
                        ) : (
                          <span>{builder.name}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Unknown</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Universe:</span>
                    {organisingUniverse ? (
                      <OrganizingUniverseBadge
                        projectId={project.id}
                        currentStatus={organisingUniverse as any}
                        size="sm"
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>

                  {lastVisit && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Last Visit:</span>
                      <span className="text-sm">{new Date(lastVisit).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!project.main_job_site_id}
                    onClick={() => onAction("visit-sheet", project.id, project.main_job_site_id)}
                    className="w-full min-h-[44px] justify-start"
                  >
                    <FileUp className="h-4 w-4 mr-2" /> Visit sheet
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!project.main_job_site_id}
                    onClick={() => onAction("worker-list", project.id, project.main_job_site_id)}
                    className="w-full min-h-[44px] justify-start"
                  >
                    <List className="h-4 w-4 mr-2" /> Worker list
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!project.main_job_site_id}
                    onClick={() => onAction("employer-compliance", project.id, project.main_job_site_id)}
                    className="w-full min-h-[44px] justify-start"
                  >
                    <Building2 className="h-4 w-4 mr-2" /> Employer view
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>EBA Status</TableHead>
            <TableHead>Builder / Main Contractor</TableHead>
            <TableHead>Organising Universe</TableHead>
            <TableHead>Last Site Visit</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => {
            const summary = summaries[project.id]
            const builder = formatBuilderInfo(project)
            const ebaStatus = getProjectEbaStatus(project)
            const organisingUniverse = project.organising_universe as string | null
            const lastVisit: string | null = null

            return (
              <TableRow key={project.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <Link href={`/projects/${project.id}`} className="font-medium text-primary hover:underline flex items-center gap-1">
                      {project.name}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    {summary?.delegate_name && (
                      <span className="text-xs text-muted-foreground">Delegate: {summary.delegate_name}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <CfmeuEbaBadge hasActiveEba={ebaStatus.hasActiveEba} builderName={(builder?.name || ebaStatus.builderName) || undefined} size="sm" />
                </TableCell>
                <TableCell>
                  {builder ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {builder.id && onOpenEmployer ? (
                        <button
                          type="button"
                          className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
                          onClick={() => onOpenEmployer(builder.id!)}
                        >
                          {builder.name}
                        </button>
                      ) : (
                        <span>{builder.name}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Unknown</span>
                  )}
                </TableCell>
                <TableCell>
                  {organisingUniverse ? (
                    <OrganizingUniverseBadge
                      projectId={project.id}
                      currentStatus={organisingUniverse as any}
                      size="sm"
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {lastVisit ? new Date(lastVisit).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!project.main_job_site_id}
                    onClick={() => onAction("visit-sheet", project.id, project.main_job_site_id)}
                  >
                    <FileUp className="h-3 w-3 mr-1" /> Visit sheet
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!project.main_job_site_id}
                    onClick={() => onAction("worker-list", project.id, project.main_job_site_id)}
                  >
                    <List className="h-3 w-3 mr-1" /> Worker list
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!project.main_job_site_id}
                    onClick={() => onAction("employer-compliance", project.id, project.main_job_site_id)}
                  >
                    <Building2 className="h-3 w-3 mr-1" /> Employer view
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
