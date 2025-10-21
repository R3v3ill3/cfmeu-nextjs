"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { usePatchVisitCoverage, useLeadOrganiserVisitSummary } from "@/hooks/useProjectVisitStats"
import { Calendar, TrendingUp, Users } from "lucide-react"

interface VisitCoverageCardProps {
  patchId?: string
  leadOrganiserId?: string
  variant?: "patch" | "lead"
}

export function VisitCoverageCard({ 
  patchId, 
  leadOrganiserId, 
  variant = "patch" 
}: VisitCoverageCardProps) {
  const { data: patchData, isLoading: patchLoading } = usePatchVisitCoverage(
    variant === "patch" ? patchId : null
  )
  const { data: leadData, isLoading: leadLoading } = useLeadOrganiserVisitSummary(
    variant === "lead" ? leadOrganiserId : null
  )

  const isLoading = variant === "patch" ? patchLoading : leadLoading
  const data = variant === "patch" ? patchData : leadData

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Visit Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Visit Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">No data available</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Site Visit Coverage
        </CardTitle>
        <CardDescription>
          {variant === "patch" 
            ? `${(data as any).patch_name} - ${(data as any).total_projects} projects`
            : `${(data as any).total_projects_in_scope} projects in scope`
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Coverage stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold">
              {Math.round((data as any).pct_visited_3m || 0)}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">Last 3 Months</div>
            <Badge 
              variant={getVariantForPercentage((data as any).pct_visited_3m)} 
              className="mt-2"
            >
              {(data as any).projects_visited_3m} projects
            </Badge>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold">
              {Math.round((data as any).pct_visited_6m || 0)}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">Last 6 Months</div>
            <Badge 
              variant={getVariantForPercentage((data as any).pct_visited_6m)} 
              className="mt-2"
            >
              {(data as any).projects_visited_6m} projects
            </Badge>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold">
              {Math.round((data as any).pct_visited_12m || 0)}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">Last 12 Months</div>
            <Badge 
              variant={getVariantForPercentage((data as any).pct_visited_12m)} 
              className="mt-2"
            >
              {(data as any).projects_visited_12m} projects
            </Badge>
          </div>
        </div>

        {/* Additional stats for lead organiser view */}
        {variant === "lead" && (
          <div className="pt-4 border-t space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Visits this month</span>
              </div>
              <Badge variant="outline">{(data as any).visits_this_month}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Team organisers</span>
              </div>
              <Badge variant="outline">{(data as any).team_organisers_count}</Badge>
            </div>
          </div>
        )}

        {/* Never visited warning */}
        {variant === "patch" && (data as any).projects_never_visited > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950 rounded-md">
              <span className="text-sm font-medium">Projects never visited</span>
              <Badge variant="destructive">{(data as any).projects_never_visited}</Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getVariantForPercentage(pct: number): "default" | "secondary" | "destructive" {
  if (pct >= 70) return "default" // Good coverage
  if (pct >= 40) return "secondary" // Moderate coverage
  return "destructive" // Poor coverage
}

