"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ProjectTierBadge } from "@/components/ui/ProjectTierBadge"
import { OrganizingUniverseBadge } from "@/components/ui/OrganizingUniverseBadge"
import { FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"
import { useRouter } from "next/navigation"
import { RatingDisplay } from "@/components/ratings/RatingDisplay"

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
  }>;
};

export function ProjectCard({ project }: { project: ProjectCardData }) {
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
