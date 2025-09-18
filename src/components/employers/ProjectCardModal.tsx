"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Building, ExternalLink, Users, MapPin } from "lucide-react"
import { useRouter } from "next/navigation"
import { ProjectTierBadge } from "@/components/ui/ProjectTierBadge"
import { CfmeuEbaBadge, getProjectEbaStatus } from "@/components/ui/CfmeuEbaBadge"
import { getOrganisingUniverseBadgeVariant } from "@/utils/organisingUniverse"

interface ProjectCardModalProps {
  isOpen: boolean
  onClose: () => void
  project: {
    id: string
    name: string
    roles?: string[]
    trades?: string[]
  }
  organisers?: Array<{
    id: string
    name: string
    patch_name?: string
  }>
}

export function ProjectCardModal({ 
  isOpen, 
  onClose, 
  project, 
  organisers = [] 
}: ProjectCardModalProps) {
  const router = useRouter()

  const handleViewProject = () => {
    onClose()
    router.push(`/projects/${project.id}`)
  }

  const formatRoleName = (role: string) => {
    return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const formatTradeName = (trade: string) => {
    return trade.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-blue-500" />
            Project Overview
          </DialogTitle>
          <DialogDescription>
            Details for <strong>{project.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Project Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">{project.name}</h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Project ID: {project.id}
                </Badge>
              </div>
            </div>
            <Button onClick={handleViewProject} className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              View Full Project
            </Button>
          </div>

          {/* Roles Section */}
          {project.roles && project.roles.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700 uppercase tracking-wide">
                Contractor Roles
              </h4>
              <div className="flex flex-wrap gap-2">
                {project.roles.map((role, index) => (
                  <Badge key={index} variant="default" className="text-xs bg-blue-600 text-white">
                    {formatRoleName(role)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Trades Section */}
          {project.trades && project.trades.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700 uppercase tracking-wide">
                Trade Work
              </h4>
              <div className="flex flex-wrap gap-2">
                {project.trades.map((trade, index) => (
                  <Badge key={index} variant="outline" className="text-xs border-gray-400 text-gray-700">
                    {formatTradeName(trade)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Organisers Section */}
          {organisers.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700 uppercase tracking-wide">
                Assigned Organisers
              </h4>
              <div className="space-y-2">
                {organisers.map((organiser, index) => (
                  <div 
                    key={index} 
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                  >
                    <Users className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">{organiser.name}</span>
                    {organiser.patch_name && (
                      <>
                        <span className="text-gray-400">·</span>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <MapPin className="h-3 w-3" />
                          {organiser.patch_name}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No additional data message */}
          {(!project.roles || project.roles.length === 0) && 
           (!project.trades || project.trades.length === 0) && 
           organisers.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <Building className="h-12 w-12 mx-auto text-gray-300 mb-2" />
              <p className="text-sm">
                No detailed role or organiser information available.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Click "View Full Project" to see complete project details.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={handleViewProject}>
              View Full Project
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
