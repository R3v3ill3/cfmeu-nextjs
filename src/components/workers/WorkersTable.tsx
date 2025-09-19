"use client"

import { WorkerRecord } from "@/hooks/useWorkersServerSide"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CfmeuEbaBadge } from "@/components/ui/CfmeuEbaBadge"
import { IncolinkBadge, ActiveProjectBadge } from "./WorkerBadges"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getWorkerColorCoding } from "@/utils/workerColorCoding"
import { cn } from "@/lib/utils"
import { Mail, Phone, MapPin, Building } from "lucide-react"

interface WorkersTableProps {
  workers: WorkerRecord[]
  onSelect: (workerId: string) => void
  onViewDetail: (workerId: string) => void
}

const formatUnionStatus = (status: string | null | undefined, hasIncolink: boolean) => {
  if ((!status || status === "unknown") && hasIncolink) return "Incolink"
  switch (status) {
    case "member":
      return "Member"
    case "non_member":
      return "Non-member"
    case "potential":
      return "Potential"
    case "declined":
      return "Declined"
    case "unknown":
      return "Unknown"
    default:
      return status || "Unknown"
  }
}

export function WorkersTable({ workers, onSelect, onViewDetail }: WorkersTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[220px]">Worker</TableHead>
            <TableHead className="min-w-[200px]">Engagement</TableHead>
            <TableHead className="min-w-[200px]">Contact</TableHead>
            <TableHead className="w-[120px] text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workers.map((worker) => {
            const fullName = [worker.first_name, worker.surname].filter(Boolean).join(' ') || 'Unnamed Worker'
            const hasIncolink = Boolean(worker.has_incolink_id) || Boolean(worker.incolink_member_id)
            const statusInfo = getWorkerColorCoding(worker.union_membership_status || null, [], hasIncolink)
            const membershipLabel = formatUnionStatus(worker.union_membership_status, hasIncolink)
            const employers = worker.employer_names?.filter(Boolean) || []
            const jobTitles = worker.job_titles?.filter(Boolean) || []
            const jobSites = worker.job_site_names?.filter(Boolean) || []

            return (
              <TableRow
                key={worker.id}
                onClick={() => onSelect(worker.id)}
                className="cursor-pointer transition hover:bg-muted/60"
              >
                <TableCell>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{fullName}</span>
                      <Badge
                        className={cn(statusInfo.badgeClass, statusInfo.textColor, "border", "border-border/40")}
                        style={{ ...statusInfo.badgeStyle, ...statusInfo.borderStyle }}
                      >
                        {membershipLabel}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CfmeuEbaBadge hasActiveEba={Boolean(worker.has_active_eba)} size="sm" showText />
                      {hasIncolink && <IncolinkBadge />}
                      {worker.has_active_project && <ActiveProjectBadge count={worker.active_project_count} />}
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {employers.length > 0 && (
                      <div className="flex items-start gap-2">
                        <Building className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
                        <div className="space-y-1">
                          <span className="text-foreground font-medium">{employers[0]}</span>
                          {employers.length > 1 && (
                            <span className="text-xs">+ {employers.length - 1} more</span>
                          )}
                        </div>
                      </div>
                    )}
                    {jobTitles.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-foreground">Role</span>
                        <span>{jobTitles.join(', ')}</span>
                      </div>
                    )}
                    {jobSites.length > 0 && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{jobSites.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </TableCell>

                <TableCell>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {worker.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span>{worker.email}</span>
                      </div>
                    )}
                    {worker.mobile_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{worker.mobile_phone}</span>
                      </div>
                    )}
                  </div>
                </TableCell>

                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation()
                      onViewDetail(worker.id)
                    }}
                  >
                    View
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
