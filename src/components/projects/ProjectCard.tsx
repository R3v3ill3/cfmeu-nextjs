"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ProjectTierBadge } from "@/components/ui/ProjectTierBadge"
import { FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"

export type ProjectCardData = {
  id: string;
  name: string;
  tier: string | null;
  stage_class: string | null;
  organising_universe: string | null;
  value: number | null;
  builderName: string | null;
  full_address: string | null;
};

export function ProjectCard({ project }: { project: ProjectCardData }) {
  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Link href={`/projects/${project.id}`} className="block">
      <Card className="hover:shadow-lg transition-shadow duration-200">
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
          <div className="flex flex-wrap gap-2 mt-4">
            {project.stage_class && (
              <Badge variant="secondary" className="capitalize">{project.stage_class.replace(/_/g, ' ')}</Badge>
            )}
            {project.organising_universe && (
              <Badge variant="outline">{project.organising_universe}</Badge>
            )}
          </div>
          {project.full_address && (
            <div className="mt-4 pt-4 border-t">
              <Button asChild variant="outline" size="sm" className="w-full" onClick={handleActionClick}>
                <a href={`https://maps.apple.com/?q=${encodeURIComponent(project.full_address)}`} target="_blank" rel="noopener noreferrer">
                  Get Directions
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
