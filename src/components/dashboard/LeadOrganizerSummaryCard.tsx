"use client"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { 
  Crown, 
  ChevronDown, 
  ChevronRight, 
  Map, 
  Users, 
  FolderOpen,
  Mail,
  BarChart3
} from "lucide-react"
import { OrganizingUniverseMetricsComponent } from "./OrganizingUniverseMetrics"
import { PatchSummaryCard } from "./PatchSummaryCard"
import { LeadOrganizerSummary } from "@/hooks/useLeadOrganizerSummary"
import { useRouter } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"

interface LeadOrganizerSummaryCardProps {
  leadSummary: LeadOrganizerSummary
  onOpenLead?: (leadId: string) => void
  onOpenPatch?: (patchId: string) => void
  onOpenProjects?: (leadId?: string, patchId?: string) => void
  isLoading?: boolean
  defaultExpanded?: boolean
}

/**
 * Expandable summary card for co-ordinators showing their patch assignments
 * Used by admin dashboard and co-ordinator views
 */
export function LeadOrganizerSummaryCard({ 
  leadSummary, 
  onOpenLead, 
  onOpenPatch, 
  onOpenProjects,
  isLoading = false,
  defaultExpanded = false
}: LeadOrganizerSummaryCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const router = useRouter()
  const isMobile = useIsMobile()
  const isPendingLead = !!leadSummary.isPending
  const rawStatus = leadSummary.status || (isPendingLead ? 'pending' : 'active')
  const statusLabel = rawStatus.replace(/_/g, ' ')
  const formattedStatus = statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)
  const statusDisplay = isPendingLead ? 'Pending' : formattedStatus
  
  if (isLoading) {
    return (
      <Card className="transition-colors hover:bg-accent/40 h-full flex flex-col animate-pulse">
        <CardHeader className="p-4 pb-2">
          <div className="space-y-2">
            <div className="h-5 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 space-y-2 flex-1 flex flex-col">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
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

  const handleLeadClick = () => {
    if (onOpenLead) {
      onOpenLead(leadSummary.leadOrganizerId)
    }
  }

  const handleProjectsClick = () => {
    if (onOpenProjects) {
      onOpenProjects(leadSummary.leadOrganizerId)
    }
  }

  const handlePatchProjectsClick = (patchId: string) => {
    if (onOpenProjects) {
      onOpenProjects(leadSummary.leadOrganizerId, patchId)
    }
  }

  const handlePendingBadgeClick = () => {
    router.push('/admin?tab=invites')
  }

  return (
    <Card className="transition-colors hover:bg-accent/40 h-full flex flex-col">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-medium">
            <div className="space-y-2">
              {/* Mobile-optimized layout */}
              {isMobile ? (
                <div className="space-y-2">
                  {/* Name and expand button row */}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="hover:underline inline-block rounded border border-dashed border-transparent hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 px-1 truncate min-w-0 text-left flex-1"
                      onClick={handleLeadClick}
                    >
                      {leadSummary.leadOrganizerName}
                    </button>
                    
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  
                  {/* Email row */}
                  {leadSummary.email && (
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Mail className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate">{leadSummary.email}</span>
                    </div>
                  )}
                  
                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs border-purple-200 text-purple-700">
                      <Crown className="h-3 w-3 mr-1" />
                      {isPendingLead ? 'Draft Co-ordinator' : 'Co-ordinator'}
                    </Badge>
                    {statusDisplay && (
                      <Badge
                        variant={isPendingLead ? "destructive" : "secondary"}
                        className={`text-xs ${isPendingLead ? "cursor-pointer focus-visible:ring-amber-500" : ""}`}
                        onClick={isPendingLead ? handlePendingBadgeClick : undefined}
                        role={isPendingLead ? "button" : undefined}
                        tabIndex={isPendingLead ? 0 : undefined}
                        onKeyDown={
                          isPendingLead
                            ? (event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault()
                                  handlePendingBadgeClick()
                                }
                            }
                            : undefined
                        }
                      >
                        {statusDisplay}
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                /* Desktop layout - original */
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      className="hover:underline inline-block rounded border border-dashed border-transparent hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 px-1 truncate min-w-0 text-left"
                      onClick={handleLeadClick}
                    >
                      {leadSummary.leadOrganizerName}
                    </button>
                    
                    {leadSummary.email && (
                      <div className="flex items-center mt-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3 mr-1" />
                        <span className="truncate">{leadSummary.email}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
                    <Badge variant="outline" className="text-xs border-purple-200 text-purple-700">
                      <Crown className="h-3 w-3 mr-1" />
                      {isPendingLead ? 'Draft Co-ordinator' : 'Co-ordinator'}
                    </Badge>
                    {statusDisplay && (
                      <Badge
                        variant={isPendingLead ? "destructive" : "secondary"}
                        className={`text-xs ${isPendingLead ? "cursor-pointer focus-visible:ring-amber-500" : ""}`}
                        onClick={isPendingLead ? handlePendingBadgeClick : undefined}
                        role={isPendingLead ? "button" : undefined}
                        tabIndex={isPendingLead ? 0 : undefined}
                        onKeyDown={
                          isPendingLead
                            ? (event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault()
                                  handlePendingBadgeClick()
                                }
                            }
                            : undefined
                        }
                      >
                        {statusDisplay}
                      </Badge>
                    )}
                    
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>
              )}
            </div>
          </CardTitle>

          {/* Summary stats */}
          <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center">
              <Map className="h-3 w-3 mr-1" />
              <span>{leadSummary.patchCount} patch{leadSummary.patchCount !== 1 ? 'es' : ''}</span>
            </div>
            <div className="flex items-center">
              <FolderOpen className="h-3 w-3 mr-1" />
              <span>{leadSummary.totalProjects} project{leadSummary.totalProjects !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {leadSummary.pendingOrganisers?.length > 0 && (
            <div className="mt-2 text-xs text-amber-700 flex items-start">
              <Users className="h-3 w-3 mr-1 mt-0.5" />
              <span>
                Pending organisers: {leadSummary.pendingOrganisers.join(', ')}
              </span>
            </div>
          )}
        </CardHeader>

        <CardContent className="px-4 pb-4 pt-0 space-y-3 flex-1 flex flex-col">
          {/* Aggregated organizing universe metrics */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 flex items-center">
              <BarChart3 className="h-4 w-4 mr-2" />
              Aggregated Metrics
            </h4>
            {isPendingLead && (
              <div className="rounded-md border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Pending co-ordinator. Use the status badge above to manage invitations.
              </div>
            )}
            <OrganizingUniverseMetricsComponent
              metrics={leadSummary.aggregatedMetrics}
              variant="compact"
              onClick={handleProjectsClick}
            />
          </div>

          {/* Expandable patch details */}
          <CollapsibleContent className="space-y-3">
            <div className="border-t pt-3">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <Map className="h-4 w-4 mr-2" />
                Individual Patches
              </h4>
              
              {leadSummary.patches.length > 0 ? (
                <div className="space-y-3">
                  {leadSummary.patches.map((patch) => (
                    <div key={patch.patchId} className="border rounded-lg p-3 bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h5 className="text-sm font-medium text-gray-900">{patch.patchName}</h5>
                          <p className="text-xs text-gray-600 mt-1">
                            {patch.projectCount} active project{patch.projectCount !== 1 ? 's' : ''}
                          </p>
                          {patch.organiserNames.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              <Users className="h-3 w-3 inline mr-1" />
                              {patch.organiserNames.join(', ')}
                            </p>
                          )}
                        </div>
                        
                      <div className="flex space-x-1">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 text-xs"
                          onClick={() => handlePatchProjectsClick(patch.patchId)}
                        >
                          <FolderOpen className="h-3 w-3 mr-1" />
                          Projects
                        </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 text-xs"
                            onClick={() => onOpenPatch?.(patch.patchId)}
                          >
                            <ChevronRight className="h-3 w-3 mr-1" />
                            Patch
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-sm text-gray-500">
                  No patches assigned
                </div>
              )}
            </div>
          </CollapsibleContent>

          {/* Action buttons */}
          <div className="pt-2 mt-auto space-y-2">
            <Button 
              className="w-full" 
              size="sm" 
              variant="outline"
              onClick={handleProjectsClick}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              View All Projects
            </Button>
            {!isExpanded && (
              <CollapsibleTrigger asChild>
                <Button className="w-full" size="sm" variant="ghost">
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Show Patches ({leadSummary.patchCount})
                </Button>
              </CollapsibleTrigger>
            )}
          </div>
        </CardContent>
      </Collapsible>
    </Card>
  )
}

/**
 * Loading skeleton for lead organizer summary cards
 */
export function LeadOrganizerSummaryCardSkeleton() {
  return (
    <Card className="transition-colors h-full flex flex-col animate-pulse">
      <CardHeader className="p-4 pb-2">
        <div className="space-y-2">
          <div className="h-5 bg-gray-200 rounded w-2/3"></div>
          <div className="h-3 bg-gray-200 rounded w-1/3"></div>
          <div className="flex space-x-4">
            <div className="h-3 bg-gray-200 rounded w-20"></div>
            <div className="h-3 bg-gray-200 rounded w-24"></div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-2 flex-1 flex flex-col">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
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
