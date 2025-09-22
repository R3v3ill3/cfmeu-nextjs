"use client"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { OrganizingUniverseMetricsComponent } from "@/components/dashboard/OrganizingUniverseMetrics"
import { OrganizingUniverseMetrics } from "@/hooks/useOrganizingUniverseMetrics"
import { MapPin, Users } from "lucide-react"

interface PatchOverviewHeaderProps {
  patchName: string
  organiserNames: string[]
  status?: string | null
  type?: string | null
  metrics?: OrganizingUniverseMetrics | null
  isMetricsLoading?: boolean
  totalProjects?: number
  onOpenAddressLookup: () => void
  onOpenWalls: () => void
}

export function PatchOverviewHeader({
  patchName,
  organiserNames,
  status,
  type,
  metrics,
  isMetricsLoading,
  totalProjects,
  onOpenAddressLookup,
  onOpenWalls
}: PatchOverviewHeaderProps) {
  const organiserList = organiserNames.length === 0
    ? "No organisers assigned"
    : organiserNames.join(", ")

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardContent className="p-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{patchName}</h1>
              {status && (
                <Badge variant={status === "active" ? "default" : "secondary"} className="capitalize">
                  {status.replace(/_/g, " ")}
                </Badge>
              )}
              {type && (
                <Badge variant="outline" className="uppercase">
                  {type}
                </Badge>
              )}
              {typeof totalProjects === "number" && (
                <Badge variant="secondary">{totalProjects} active project{totalProjects === 1 ? "" : "s"}</Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{organiserList}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onOpenAddressLookup}>
                <MapPin className="h-4 w-4 mr-1" /> Address lookup
              </Button>
              <Button variant="link" size="sm" onClick={onOpenWalls} className="px-0 text-primary">
                Open Walls
              </Button>
            </div>
          </div>

          <div className="min-w-[280px] max-w-xl w-full lg:w-auto">
            {isMetricsLoading ? (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading metrics…</div>
            ) : metrics ? (
              <OrganizingUniverseMetricsComponent metrics={metrics} variant="compact" />
            ) : (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">Metrics unavailable</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

