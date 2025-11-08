"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreVertical, Eye, Star, FileCheck, Info } from "lucide-react"
import { useRouter } from "next/navigation"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"

type Project = {
  id: string
  name: string
  tier?: string | null
  full_address?: string | null
  builder_name?: string | null
}

interface EbaEmployerActionsProps {
  employerId: string
  employerName: string
  projects: Project[]
  onViewDetails: () => void
}

export function EbaEmployerActions({ 
  employerId, 
  employerName, 
  projects, 
  onViewDetails 
}: EbaEmployerActionsProps) {
  const router = useRouter()
  const { startNavigation } = useNavigationLoading()

  const handleReviewRating = () => {
    // Trigger event to open employer detail modal on Rating tab
    window.dispatchEvent(new CustomEvent('open-employer-rating', { 
      detail: { employerId } 
    }))
  }

  const handleAuditOnProject = (projectId: string) => {
    const url = `/projects/${projectId}?tab=audit-compliance&employer=${employerId}`
    startNavigation(url)
    setTimeout(() => {
      router.push(url)
    }, 50)
  }

  const projectCount = projects.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <MoreVertical className="h-4 w-4" />
          Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={onViewDetails} className="cursor-pointer">
          <Eye className="h-4 w-4 mr-2" />
          View Employer Details
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handleReviewRating} className="cursor-pointer">
          <Star className="h-4 w-4 mr-2" />
          Review Rating
        </DropdownMenuItem>

        {projectCount > 0 && (
          <>
            <DropdownMenuSeparator />
            
            {projectCount === 1 ? (
              <DropdownMenuItem 
                onClick={() => handleAuditOnProject(projects[0].id)}
                className="cursor-pointer"
              >
                <FileCheck className="h-4 w-4 mr-2" />
                Audit on {projects[0].name}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FileCheck className="h-4 w-4 mr-2" />
                  Audit on Project
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-[300px] overflow-y-auto">
                  {projects.map((project) => (
                    <DropdownMenuItem
                      key={project.id}
                      onClick={() => handleAuditOnProject(project.id)}
                      className="cursor-pointer"
                    >
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="font-medium text-sm">{project.name}</span>
                        {project.tier && (
                          <span className="text-xs text-muted-foreground capitalize">
                            {project.tier.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
          </>
        )}

        <DropdownMenuSeparator />
        
        <DropdownMenuItem disabled className="text-xs">
          <Info className="h-3 w-3 mr-2" />
          {projectCount} project{projectCount !== 1 ? 's' : ''}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}






