"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, Phone, MapPin, Building, User } from "lucide-react"
import { CfmeuEbaBadge } from "@/components/ui/CfmeuEbaBadge"
import { IncolinkBadge, ActiveProjectBadge } from "./WorkerBadges"
import { Badge } from "@/components/ui/badge"
import { getWorkerColorCoding } from "@/utils/workerColorCoding"
import { cn } from "@/lib/utils"
import type { WorkerRecord } from "@/hooks/useWorkersServerSide"

type WorkerCardModel = Partial<WorkerRecord> & {
  id: string
  first_name?: string | null
  surname?: string | null
  union_membership_status?: string | null
}

interface WorkerCardProps {
  worker: WorkerCardModel
  onSelect?: (workerId: string) => void
  onViewDetail?: (workerId: string) => void
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

export function WorkerCard({ worker, onSelect, onViewDetail }: WorkerCardProps) {
  const fullName = [worker.first_name, worker.surname].filter(Boolean).join(" ") || "Unnamed Worker"
  const hasIncolink = Boolean(worker.has_incolink_id) || Boolean(worker.incolink_member_id)
  const statusInfo = getWorkerColorCoding(worker.union_membership_status || null, [], hasIncolink)
  const membershipLabel = formatUnionStatus(worker.union_membership_status ?? null, hasIncolink)

  const handleSelect = () => {
    onSelect?.(worker.id)
  }

  const handleView = (event: React.MouseEvent) => {
    event.stopPropagation()
    onViewDetail?.(worker.id)
  }

  const employers = Array.isArray(worker.employer_names) ? worker.employer_names.filter(Boolean) : []
  const jobTitles = Array.isArray(worker.job_titles) ? worker.job_titles.filter(Boolean) : []
  const jobSites = Array.isArray(worker.job_site_names) ? worker.job_site_names.filter(Boolean) : []

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleSelect()
        }
      }}
      className="h-full cursor-pointer border border-border/60 shadow-sm transition hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">
                {fullName}
              </h3>
            </div>
            <Badge
              className={cn(statusInfo.badgeClass, statusInfo.textColor, "border", "border-border/40")}
              style={{ ...statusInfo.badgeStyle, ...statusInfo.borderStyle }}
            >
              {membershipLabel}
            </Badge>
          </div>
          <User className="h-5 w-5 text-muted-foreground" />
        </div>

            <div className="flex flex-wrap items-center gap-2">
              <CfmeuEbaBadge
                hasActiveEba={Boolean(worker.has_active_eba)}
                size="sm"
                showText
              />
              {hasIncolink && <IncolinkBadge />}
              {worker.has_active_project && (
                <ActiveProjectBadge count={worker.active_project_count} />
              )}
            </div>

        <div className="grid gap-3 text-sm text-muted-foreground">
          {employers.length > 0 && (
            <div className="flex items-start gap-2">
              <Building className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
              <div className="space-y-1">
                <p className="text-foreground font-medium">{employers[0]}</p>
                {employers.length > 1 && (
                  <p className="text-xs">+ {employers.length - 1} more employer{employers.length - 1 === 1 ? '' : 's'}</p>
                )}
              </div>
            </div>
          )}

          {jobTitles.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-xs font-medium uppercase tracking-wide text-foreground">Role</span>
              <span>{jobTitles.join(', ')}</span>
            </div>
          )}

          {jobSites.length > 0 && (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
              <span>{jobSites.join(', ')}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {worker.email && (
            <div className="flex items-center gap-1">
              <Mail className="h-4 w-4" />
              <span>{worker.email}</span>
            </div>
          )}
          {worker.mobile_phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-4 w-4" />
              <span>{worker.mobile_phone}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleView}>
            View details
          </Button>
        </div>
      </div>
    </Card>
  )
}
