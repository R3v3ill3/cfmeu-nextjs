"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ProjectTierBadge } from "@/components/ui/ProjectTierBadge"
import { OrganizingUniverseBadge } from "@/components/ui/OrganizingUniverseBadge"
import { MobileCard } from "@/components/ui/MobileCard"
import { FolderOpen, MapPin, Users, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"
import { useRouter } from "next/navigation"
import { RatingDisplay } from "@/components/ratings/RatingDisplay"
import { ProjectKeyContractorMetrics } from "./ProjectKeyContractorMetrics"
import { useProjectKeyContractorMetrics } from "@/hooks/useProjectKeyContractorMetrics"
import { useProjectAuditTarget } from "@/hooks/useProjectAuditTarget"
import { useMemo } from "react"

export type ProjectCardData = {
  id: string;
  name: string;
  tier: string | null;
  stage_class: string | null;
  organising_universe: string | null;
  value: number | null;
  builderName: string | null;
  builderId?: string | null;
  full_address: string | null;
  // Enhanced data for ratings
  employers?: Array<{
    id: string;
    name: string;
    assignment_type: string;
    enterprise_agreement_status?: boolean | null;
  }>;
  // Optional project assignments for target calculation
  project_assignments?: Array<{
    assignment_type: string;
    employer_id: string;
    contractor_role_types?: { code: string } | null;
    employers?: { 
      enterprise_agreement_status?: boolean | null
    } | null
  }>;
};

export function ProjectCard({
  project,
  variant = 'default' // 'default' or 'mobile'
}: {
  project: ProjectCardData,
  variant?: 'default' | 'mobile'
}) {
  const { startNavigation } = useNavigationLoading()
  const router = useRouter()
  
  const handleDirectionsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    window.open(`https://maps.apple.com/?q=${encodeURIComponent(project.full_address || '')}`, '_blank');
  };

  const handleCardClick = () => {
    startNavigation(`/projects/${project.id}`)
    // Use setTimeout to ensure loading overlay shows before navigation
    setTimeout(() => {
      router.push(`/projects/${project.id}`)
    }, 50)
  };

  // Mobile-optimized variant
  if (variant === 'mobile') {
    return <MobileProjectCard project={project} />
  }

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 cursor-pointer touch-manipulation max-lg:min-h-[44px] max-lg:p-1" onClick={handleCardClick}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-2">{project.name}</CardTitle>
            {project.builderName && (
              <p className="text-sm text-muted-foreground">{project.builderName}</p>
            )}
          </div>
          <FolderOpen className="h-5 w-5 text-gray-400" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <ProjectTierBadge tier={project.tier} />
          {project.value && (
            <span className="text-sm font-semibold">
              ${(project.value / 1000000).toFixed(1)}M
            </span>
          )}
        </div>

        {/* Builder Rating Section */}
        {(project.builderId || (project.employers && project.employers.length > 0)) && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Builder Rating:</span>
              {project.builderId && project.builderName ? (
                <RatingDisplay
                  employerId={project.builderId}
                  employerName={project.builderName}
                  variant="compact"
                  showDetails={false}
                />
              ) : project.employers && project.employers.length > 0 ? (
                <div className="space-y-1">
                  {project.employers
                    .filter(emp => emp.assignment_type === 'contractor_role')
                    .slice(0, 1)
                    .map(employer => (
                      <RatingDisplay
                        key={employer.id}
                        employerId={employer.id}
                        employerName={employer.name}
                        variant="compact"
                        showDetails={false}
                      />
                    ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">No builder</span>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          {project.stage_class && (
            <Badge variant="secondary" className="capitalize">{project.stage_class.replace(/_/g, ' ')}</Badge>
          )}
          {project.organising_universe && (
            <OrganizingUniverseBadge
              projectId={project.id}
              currentStatus={project.organising_universe as any}
              size="sm"
            />
          )}
        </div>
        {project.full_address && (
          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" size="sm" className="w-full min-h-[44px] max-lg:min-h-[44px] max-lg:py-3 max-lg:text-base" onClick={handleDirectionsClick}>
              Get Directions
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Mobile-optimized project card component
function MobileProjectCard({ project }: { project: ProjectCardData }) {
  const { startNavigation } = useNavigationLoading()
  const router = useRouter()
  
  // Fetch key contractor metrics
  const { data: keyContractorMetrics, isLoading: metricsLoading } = useProjectKeyContractorMetrics(project.id)
  
  // Check if builder has EBA
  const builderHasEba = useMemo(() => {
    if (!project.project_assignments) return false
    const builder = project.project_assignments.find((a) => 
      a.assignment_type === 'contractor_role' && 
      a.contractor_role_types?.code === 'builder'
    )
    return builder?.employers?.enterprise_agreement_status === true
  }, [project.project_assignments])

  // Calculate target rates based on conditions
  const identificationTarget = useMemo(() => {
    return project.organising_universe === 'active' ? 100 : null
  }, [project.organising_universe])

  const ebaTarget = useMemo(() => {
    return project.organising_universe === 'active' && builderHasEba ? 100 : null
  }, [project.organising_universe, builderHasEba])

  // Get user-defined audit target
  const { auditTarget: auditsTarget } = useProjectAuditTarget()

  const handleCardClick = () => {
    startNavigation(`/projects/${project.id}`)
    setTimeout(() => {
      router.push(`/projects/${project.id}`)
    }, 50)
  };

  const handleDirectionsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    window.open(`https://maps.apple.com/?q=${encodeURIComponent(project.full_address || '')}`, '_blank');
  };

  // Swipe actions for mobile
  const swipeActions = project.full_address ? {
    right: [
      {
        icon: <MapPin className="w-5 h-5" />,
        label: 'Directions',
        color: 'primary' as const,
        onPress: handleDirectionsClick,
      },
    ],
  } : undefined

  return (
    <MobileCard
      clickable
      onPress={handleCardClick}
      swipeActions={swipeActions}
      className="border-l-4 border-l-green-500"
      size="md"
    >
      {/* Header with project info */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-base truncate pr-2">
            {project.name}
          </h3>
          {project.builderName && (
            <p className="text-xs text-gray-500 mt-1">{project.builderName}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <FolderOpen className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      {/* Key metrics */}
      <div className="flex items-center justify-between mb-3">
        <ProjectTierBadge tier={project.tier} />
        {project.value && (
          <span className="text-sm font-semibold text-gray-900">
            ${(project.value / 1000000).toFixed(1)}M
          </span>
        )}
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2 mb-3 overflow-x-auto pb-1">
        {project.stage_class && (
          <Badge variant="secondary" className="flex-shrink-0 capitalize text-xs">
            {project.stage_class.replace(/_/g, ' ')}
          </Badge>
        )}
        {project.organising_universe && (
          <OrganizingUniverseBadge
            projectId={project.id}
            currentStatus={project.organising_universe as any}
            size="sm"
            className="flex-shrink-0"
          />
        )}
      </div>

      {/* Key Contractor Metrics */}
      {metricsLoading ? (
        <div className="space-y-2 mb-3">
          <div className="h-10 bg-gray-100 rounded animate-pulse" />
          <div className="h-10 bg-gray-100 rounded animate-pulse" />
        </div>
      ) : keyContractorMetrics ? (
        <div className="mb-3 space-y-2">
          <ProjectKeyContractorMetrics
            identifiedCount={keyContractorMetrics.identifiedCount}
            totalSlots={keyContractorMetrics.totalSlots}
            identificationTarget={identificationTarget}
            ebaCount={keyContractorMetrics.ebaCount}
            ebaTarget={ebaTarget}
            auditsCount={keyContractorMetrics.auditsCount}
            auditsTarget={auditsTarget}
            trafficLightRatings={keyContractorMetrics.trafficLightRatings}
            onIdentificationClick={() => { 
              startNavigation(`/projects/${project.id}?tab=mappingsheets`)
              setTimeout(() => router.push(`/projects/${project.id}?tab=mappingsheets`), 50)
            }}
            onEbaClick={() => { 
              startNavigation(`/projects/${project.id}?tab=eba-search`)
              setTimeout(() => router.push(`/projects/${project.id}?tab=eba-search`), 50)
            }}
            onAuditsClick={() => { 
              startNavigation(`/projects/${project.id}?tab=compliance`)
              setTimeout(() => router.push(`/projects/${project.id}?tab=compliance`), 50)
            }}
            onTrafficLightClick={() => { 
              startNavigation(`/projects/${project.id}?tab=compliance`)
              setTimeout(() => router.push(`/projects/${project.id}?tab=compliance`), 50)
            }}
          />
        </div>
      ) : null}

      {/* Builder rating */}
      {(project.builderId || (project.employers && project.employers.length > 0)) && (
        <div className="flex items-center justify-between mb-3 p-2 bg-gray-50 rounded-lg">
          <span className="text-xs text-gray-600">Builder Rating:</span>
          {project.builderId && project.builderName ? (
            <RatingDisplay
              employerId={project.builderId}
              employerName={project.builderName}
              variant="compact"
              showDetails={false}
            />
          ) : project.employers && project.employers.length > 0 ? (
            <div className="space-y-1">
              {project.employers
                .filter(emp => emp.assignment_type === 'contractor_role')
                .slice(0, 1)
                .map(employer => (
                  <RatingDisplay
                    key={employer.id}
                    employerId={employer.id}
                    employerName={employer.name}
                    variant="compact"
                    showDetails={false}
                  />
                ))}
            </div>
          ) : (
            <span className="text-xs text-gray-500">No builder</span>
          )}
        </div>
      )}

      {/* Location and actions */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        {project.full_address && (
          <div className="flex items-center gap-1 text-xs text-gray-600 flex-1 min-w-0">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{project.full_address}</span>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs flex-shrink-0"
          onClick={handleDirectionsClick}
        >
          <MapPin className="h-3 w-3 mr-1" />
          Get Directions
        </Button>
      </div>

      {/* Employers count if available */}
      {project.employers && project.employers.length > 0 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-gray-600">
          <Users className="w-3 h-3" />
          <span>{project.employers.length} {project.employers.length === 1 ? 'Employer' : 'Employers'}</span>
        </div>
      )}
    </MobileCard>
  )
}
