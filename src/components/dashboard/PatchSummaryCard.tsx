"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Map, Users, FolderOpen, ChevronRight } from "lucide-react"
import { OrganizingUniverseMetricsComponent } from "./OrganizingUniverseMetrics"
import { PatchSummaryData } from "@/hooks/usePatchSummaryData"

interface PatchSummaryCardProps {
  patchSummary: PatchSummaryData
  onOpenPatch?: (patchId: string) => void
  onOpenProjects?: (patchId: string) => void
  isLoading?: boolean
}

/**
 * Summary card for individual patches, matching project card formatting
 * Used by organiser dashboard to show their assigned patch summaries
 */
export function PatchSummaryCard({ 
  patchSummary, 
  onOpenPatch, 
  onOpenProjects,
  isLoading = false 
}: PatchSummaryCardProps) {
  
  if (isLoading) {
    return (
      <Card className="transition-colors hover:bg-accent/40 h-full flex flex-col animate-pulse">
        <CardHeader className="p-4 pb-2">
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 space-y-2 flex-1 flex flex-col">
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="pt-2 mt-auto">
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const handlePatchClick = () => {
    if (onOpenPatch) {
      onOpenPatch(patchSummary.patchId)
    }
  }

  const handleProjectsClick = () => {
    if (onOpenProjects) {
      onOpenProjects(patchSummary.patchId)
    }
  }

  return (
    <Card className="transition-colors hover:bg-accent/40 h-full flex flex-col">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base font-medium">
          <div className="space-y-2">
            {/* Patch name and info */}
            <div className="flex items-start justify-between">
              <button
                type="button"
                className="hover:underline inline-block rounded border border-dashed border-transparent hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 px-1 truncate min-w-0 flex-1 text-left"
                onClick={handlePatchClick}
              >
                {patchSummary.patchName}
              </button>
              
              <Badge variant="outline" className="ml-2 text-xs border-blue-200 text-blue-700">
                <Map className="h-3 w-3 mr-1" />
                Patch
              </Badge>
            </div>
          </div>
        </CardTitle>

        {/* Organiser info */}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center">
            <Users className="h-3 w-3 mr-1" />
            <span>
              Organiser{patchSummary.organiserNames.length !== 1 ? 's' : ''}: {' '}
              {patchSummary.organiserNames.length > 0 
                ? patchSummary.organiserNames.join(', ')
                : 'Unassigned'
              }
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0 space-y-2 flex-1 flex flex-col">
        {/* Organizing universe metrics */}
        <div className="space-y-2">
          <OrganizingUniverseMetricsComponent
            metrics={patchSummary.organizingMetrics}
            variant="compact"
            onClick={() => handleProjectsClick()}
          />
        </div>
        
        {/* Project count display */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Active Projects:</span>
          <Badge variant="outline" className="text-xs border-gray-800 text-black bg-white">
            {patchSummary.projectCount} {patchSummary.projectCount === 1 ? 'project' : 'projects'}
          </Badge>
        </div>

        {/* Last updated */}
        <div className="pt-1 text-xs text-muted-foreground">
          <span>Updated: {new Date(patchSummary.lastUpdated).toLocaleDateString()}</span>
        </div>

        {/* Action buttons */}
        <div className="pt-2 mt-auto space-y-2">
          <Button 
            className="w-full" 
            size="sm" 
            variant="outline"
            onClick={handleProjectsClick}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            View Projects
          </Button>
          <Button 
            className="w-full" 
            size="sm"
            onClick={handlePatchClick}
          >
            <ChevronRight className="h-4 w-4 mr-2" />
            Open Patch Details
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Loading skeleton for patch summary cards
 */
export function PatchSummaryCardSkeleton() {
  return (
    <Card className="transition-colors h-full flex flex-col animate-pulse">
      <CardHeader className="p-4 pb-2">
        <div className="space-y-2">
          <div className="h-5 bg-gray-200 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-2 flex-1 flex flex-col">
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded"></div>
          ))}
        </div>
        <div className="pt-2 mt-auto space-y-2">
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
        </div>
      </CardContent>
    </Card>
  )
}
