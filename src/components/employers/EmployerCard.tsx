"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building, Phone, Mail, Users, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CfmeuEbaBadge, getProjectEbaStatus } from "@/components/ui/CfmeuEbaBadge"
import { IncolinkBadge } from "@/components/ui/IncolinkBadge"
import { FwcSearchModal } from "./FwcSearchModal"
import { IncolinkActionModal } from "./IncolinkActionModal"
import { ProjectCardModal } from "./ProjectCardModal"
import { useRouter } from "next/navigation"

export type EmployerCardData = {
  id: string;
  name: string;
  abn: string | null;
  employer_type: string | null;
  phone: string | null;
  email: string | null;
  incolink_id: string | null;
  incolink_last_matched: string | null;
  worker_placements: { id: string }[];
  ebaCategory: {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  };
  // Enhanced data
  projects?: Array<{
    id: string;
    name: string;
    roles?: string[];
    trades?: string[];
  }>;
  organisers?: Array<{
    id: string;
    name: string;
    patch_name?: string;
  }>;
};

type EmployerProject = NonNullable<EmployerCardData["projects"]>[number];

export function EmployerCard({ employer, onClick }: { employer: EmployerCardData, onClick: () => void }) {
  const [fwcSearchOpen, setFwcSearchOpen] = useState(false)
  const [incolinkModalOpen, setIncolinkModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<EmployerProject | null>(null)
  const router = useRouter()

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleEbaBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const hasEba = employer.ebaCategory.variant === 'default'
    
    if (hasEba) {
      // Open EBA tracker
      router.push('/eba-tracking')
    } else {
      // Open FWC search
      setFwcSearchOpen(true)
    }
  };

  const handleIncolinkBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIncolinkModalOpen(true)
  };

  const handleProjectClick = (project: EmployerProject, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProject(project)
  };

  const formatRoleName = (role: string) => {
    return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const formatTradeName = (trade: string) => {
    return trade.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow duration-200" onClick={onClick}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg mb-2">{employer.name}</CardTitle>
              {employer.abn && (
                <p className="text-sm text-muted-foreground">ABN: {employer.abn}</p>
              )}
            </div>
            <Building className="h-5 w-5 text-gray-400" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Badges Section */}
          <div className="flex flex-wrap items-center gap-2">
            <div 
              className="cursor-pointer" 
              onClick={handleEbaBadgeClick}
            >
              <CfmeuEbaBadge 
                hasActiveEba={employer.ebaCategory.variant === 'default'} 
                builderName={employer.name}
                size="sm"
                showText={true}
              />
              {employer.ebaCategory.variant !== 'default' && (
                <Badge variant={employer.ebaCategory.variant} className="hover:shadow-sm transition-shadow ml-1">
                  {employer.ebaCategory.label}
                </Badge>
              )}
            </div>
            
            <IncolinkBadge 
              incolinkId={employer.incolink_id}
              size="sm"
              clickable
              onClick={handleIncolinkBadgeClick}
            />

            {employer.worker_placements && employer.worker_placements.length > 0 && (
              <Badge variant="secondary">
                <Users className="h-3 w-3 mr-1" />
                {employer.worker_placements.length}
              </Badge>
            )}
            
            {employer.employer_type && (
              <Badge variant="outline" className="capitalize">
                {employer.employer_type.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>

          {employer.incolink_last_matched && (
            <div className="text-xs text-muted-foreground">
              Last Incolink Payment: {new Date(employer.incolink_last_matched).toLocaleDateString()}
            </div>
          )}

          {/* Projects Section */}
          {employer.projects && employer.projects.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Projects</h4>
              <div className="space-y-1">
                {employer.projects.slice(0, 2).map((project, index) => (
                  <div key={project.id} className="space-y-1">
                    <button
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline text-left block"
                      onClick={(e) => handleProjectClick(project, e)}
                    >
                      {project.name}
                    </button>
                    {project.roles && project.roles.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {project.roles.slice(0, 2).map((role, roleIndex) => (
                          <Badge 
                            key={roleIndex} 
                            variant="default" 
                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {formatRoleName(role)}
                          </Badge>
                        ))}
                        {project.roles.length > 2 && (
                          <Badge variant="outline" className="text-xs border-blue-600 text-blue-600">
                            +{project.roles.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                    {project.trades && project.trades.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {project.trades.slice(0, 3).map((trade, tradeIndex) => (
                          <Badge 
                            key={tradeIndex} 
                            variant="outline" 
                            className="text-xs border-gray-400 text-gray-700"
                          >
                            {formatTradeName(trade)}
                          </Badge>
                        ))}
                        {project.trades.length > 3 && (
                          <Badge variant="outline" className="text-xs border-gray-400 text-gray-700">
                            +{project.trades.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {employer.projects.length > 2 && (
                  <div className="text-xs text-gray-500">
                    +{employer.projects.length - 2} more projects
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Organisers Section */}
          {employer.organisers && employer.organisers.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Organisers</h4>
              <div className="space-y-1">
                {employer.organisers.slice(0, 2).map((organiser, index) => (
                  <div key={organiser.id} className="flex items-center gap-1 text-xs text-gray-600">
                    <Users className="h-3 w-3" />
                    <span>{organiser.name}</span>
                    {organiser.patch_name && (
                      <>
                        <span>·</span>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>{organiser.patch_name}</span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {employer.organisers.length > 2 && (
                  <div className="text-xs text-gray-500">
                    +{employer.organisers.length - 2} more organisers
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contact Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            {employer.phone && (
              <Button asChild variant="outline" size="icon" onClick={handleActionClick}>
                <a href={`tel:${employer.phone}`}>
                  <Phone className="h-4 w-4" />
                </a>
              </Button>
            )}
            {employer.email && (
              <Button asChild variant="outline" size="icon" onClick={handleActionClick}>
                <a href={`mailto:${employer.email}`}>
                  <Mail className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <FwcSearchModal
        isOpen={fwcSearchOpen}
        onClose={() => setFwcSearchOpen(false)}
        employerId={employer.id}
        employerName={employer.name}
      />

      <IncolinkActionModal
        isOpen={incolinkModalOpen}
        onClose={() => setIncolinkModalOpen(false)}
        employerId={employer.id}
        employerName={employer.name}
        currentIncolinkId={employer.incolink_id}
      />

      {selectedProject && (
        <ProjectCardModal
          isOpen={!!selectedProject}
          onClose={() => setSelectedProject(null)}
          project={selectedProject}
          organisers={employer.organisers}
        />
      )}
    </>
  )
}
