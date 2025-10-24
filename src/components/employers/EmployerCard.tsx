"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
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
  enterprise_agreement_status?: boolean | null;
  eba_status_source?: string | null;
  eba_status_updated_at?: string | null;
  eba_status_notes?: string | null;
  worker_placements: { id: string }[];
  ebaCategory: {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  };
  // Enhanced data
  projects?: Array<{
    id: string;
    name: string;
    tier?: string | null;
    roles?: string[];
    trades?: string[];
  }>;
  organisers?: Array<{
    id: string;
    name: string;
    patch_name?: string;
  }>;
  // Aggregated contractor categories (optional)
  roles?: Array<{ code: string; name: string; manual: boolean; derived: boolean }>;
  trades?: Array<{ code: string; name: string; manual: boolean; derived: boolean }>;
};

type EmployerProject = NonNullable<EmployerCardData["projects"]>[number];

export function EmployerCard({ employer, onClick, onUpdated }: { employer: EmployerCardData, onClick: () => void, onUpdated?: () => void }) {
  const [fwcSearchOpen, setFwcSearchOpen] = useState(false)
  const [incolinkModalOpen, setIncolinkModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<EmployerProject | null>(null)
  const router = useRouter()

  // Badge 1: Canonical EBA status from boolean
  const hasActiveEba = employer.enterprise_agreement_status === true

  // Badge 2: FWC workflow status from scrape records
  const fwcStatus = employer.ebaCategory

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleEbaBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // If has canonical EBA status, go to tracker
    // Otherwise open FWC search to find/link certification
    if (hasActiveEba) {
      router.push('/eba-tracking')
    } else {
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

  // Fallback: fetch aggregated categories if not provided by server
  const shouldFetchCategories = !(Array.isArray(employer.roles) || Array.isArray(employer.trades))
  const { data: fallbackCats } = useQuery({
    queryKey: ['employer-categories', employer.id],
    enabled: shouldFetchCategories,
    queryFn: async () => {
      const res = await fetch(`/api/eba/employers/${employer.id}/categories`)
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      return json.data as { roles: Array<{ code: string; name: string; manual: boolean; derived: boolean }>; trades: Array<{ code: string; name: string; manual: boolean; derived: boolean }> }
    }
  })

  const roles = (employer.roles && employer.roles.length > 0) ? employer.roles : (fallbackCats?.roles || [])
  const trades = (employer.trades && employer.trades.length > 0) ? employer.trades : (fallbackCats?.trades || [])

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
            {/* Badge 1: Canonical EBA Status - Blue Eureka Flag */}
            <div
              className="cursor-pointer flex items-center gap-1"
              onClick={handleEbaBadgeClick}
            >
              <CfmeuEbaBadge
                hasActiveEba={hasActiveEba}
                builderName={employer.name}
                size="sm"
                showText={true}
              />

              {/* Badge 2: FWC Workflow Status - Always show to indicate scrape status */}
              <Badge
                variant={fwcStatus?.variant ?? 'outline'}
                className="hover:shadow-sm transition-shadow text-xs"
              >
                {fwcStatus?.label ?? 'No FWC Match'}
              </Badge>

              {/* Source badge - only show when canonical status is true */}
              {hasActiveEba && employer.eba_status_source && (
                <Badge variant="outline" className="text-xs">
                  {employer.eba_status_source === 'manual'
                    ? 'Manual'
                    : employer.eba_status_source === 'import'
                    ? 'Import'
                    : 'FWC'}
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
          </div>

          {employer.incolink_last_matched && (
            <div className="text-xs text-muted-foreground">
              Last Incolink Payment: {new Date(employer.incolink_last_matched).toLocaleDateString()}
            </div>
          )}

          {/* Roles and Trades (Employer-level aggregated categories) */}
          {(Array.isArray(employer.roles) && employer.roles.length > 0) && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Roles</div>
              <div className="flex flex-wrap gap-1">
                {employer.roles.map((r) => (
                  <Badge key={r.code} variant={r.manual ? 'default' : 'secondary'} className="text-xs">
                    {r.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {(Array.isArray(employer.trades) && employer.trades.length > 0) && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Trades</div>
              <div className="flex flex-wrap gap-1">
                {employer.trades.map((t) => (
                  <Badge key={t.code} variant={t.manual ? 'default' : 'secondary'} className="text-xs">
                    {t.name}
                  </Badge>
                ))}
              </div>
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
                        {[...new Set(project.roles)].slice(0, 2).map((role) => (
                          <Badge
                            key={role}
                            variant="default"
                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {formatRoleName(role)}
                          </Badge>
                        ))}
                        {[...new Set(project.roles)].length > 2 && (
                          <Badge variant="outline" className="text-xs border-blue-600 text-blue-600">
                            +{[...new Set(project.roles)].length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                    {project.trades && project.trades.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {[...new Set(project.trades)].slice(0, 3).map((trade) => (
                          <Badge
                            key={trade}
                            variant="outline"
                            className="text-xs border-gray-400 text-gray-700"
                          >
                            {formatTradeName(trade)}
                          </Badge>
                        ))}
                        {[...new Set(project.trades)].length > 3 && (
                          <Badge variant="outline" className="text-xs border-gray-400 text-gray-700">
                            +{[...new Set(project.trades)].length - 3}
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
        onUpdate={onUpdated}
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
