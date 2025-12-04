  "use client"

import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"
import { MapPin, Building2 } from "lucide-react"
import type { ProjectDisplayMode } from "./EbaEmployersDesktopView"

type Project = {
  id: string
  name: string
  tier?: string | null
  full_address?: string | null
  builder_name?: string | null
}

interface ProjectDisplayCellProps {
  projects: Project[]
  displayMode: ProjectDisplayMode
}

const tierColors = {
  tier_1: "bg-purple-100 text-purple-800 border-purple-200",
  tier_2: "bg-blue-100 text-blue-800 border-blue-200",
  tier_3: "bg-green-100 text-green-800 border-green-200",
  tier_4: "bg-gray-100 text-gray-800 border-gray-200"
}

const tierLabels = {
  tier_1: "Tier 1",
  tier_2: "Tier 2",
  tier_3: "Tier 3",
  tier_4: "Tier 4"
}

export function ProjectDisplayCell({ projects, displayMode }: ProjectDisplayCellProps) {
  const router = useRouter()
  const { startNavigation } = useNavigationLoading()

  if (projects.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  if (displayMode === 'show') {
    // Simple mode: just show project names as clickable badges
    return (
      <div className="flex flex-wrap gap-2">
        {projects.map((p) => (
          <Badge
            key={p.id}
            variant="secondary"
            className="cursor-pointer whitespace-nowrap hover:bg-secondary/80"
            onClick={() => {
              startNavigation(`/projects/${p.id}`)
              router.push(`/projects/${p.id}`)
            }}
            title={p.name}
          >
            {p.name}
          </Badge>
        ))}
      </div>
    )
  }

  if (displayMode === 'detail') {
    // Detailed mode: show project name, tier, address, and builder
    return (
      <div className="space-y-3">
        {projects.map((p) => (
          <div key={p.id} className="border-l-2 border-muted pl-3 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  startNavigation(`/projects/${p.id}`)
                  router.push(`/projects/${p.id}`)
                }}
                className="font-medium text-sm hover:underline text-primary"
                title={p.name}
              >
                {p.name}
              </button>
              {p.tier && (
                <Badge 
                  variant="outline" 
                  className={`text-xs ${tierColors[p.tier as keyof typeof tierColors] || tierColors.tier_4}`}
                >
                  {tierLabels[p.tier as keyof typeof tierLabels] || p.tier}
                </Badge>
              )}
            </div>
            
            {p.full_address && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-1">{p.full_address}</span>
              </div>
            )}
            
            {p.builder_name && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-1">Builder: {p.builder_name}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  return null
}









