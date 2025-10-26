"use client"

import { useState, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building, Phone, Mail, Users, MapPin, Tag, MoreVertical, Star, AlertCircle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CfmeuEbaBadge, getProjectEbaStatus } from "@/components/ui/CfmeuEbaBadge"
import { IncolinkBadge } from "@/components/ui/IncolinkBadge"
import { MobileCard, MobileCardWithSkeleton } from "@/components/ui/MobileCard"
import { SwipeActions } from "@/components/ui/SwipeActions"
import { SkeletonLoader } from "@/components/ui/SkeletonLoader"
import { mobileTokens, device } from "@/styles/mobile-design-tokens"
import { FwcSearchModal } from "./FwcSearchModal"
import { IncolinkActionModal } from "./IncolinkActionModal"
import { ProjectCardModal } from "./ProjectCardModal"
import { useRouter } from "next/navigation"
import { RatingDisplay } from "@/components/ratings/RatingDisplay"

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

export function EmployerCard({
  employer,
  onClick,
  onUpdated,
  variant = 'default' // 'default' or 'mobile'
}: {
  employer: EmployerCardData,
  onClick: () => void,
  onUpdated?: () => void
  variant?: 'default' | 'mobile'
}) {
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

  // Fetch employer aliases
  const { data: aliasesData } = useQuery({
    queryKey: ['employer-aliases', employer.id],
    queryFn: async () => {
      const res = await fetch(`/api/employers/${employer.id}/aliases`)
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      return json.data || []
    },
    enabled: !!employer.id,
    retry: (failureCount, error) => {
      // Only retry once and not for 4xx errors
      if (failureCount >= 1) return false
      if (error instanceof Error && error.message.includes('404')) return false
      if (error instanceof Error && error.message.includes('401')) return false
      if (error instanceof Error && error.message.includes('403')) return false
      return true
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 5000),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  const roles = (employer.roles && employer.roles.length > 0) ? employer.roles : (fallbackCats?.roles || [])
  const trades = (employer.trades && employer.trades.length > 0) ? employer.trades : (fallbackCats?.trades || [])

  // Mobile-optimized variant
  if (variant === 'mobile') {
    return <MobileEmployerCard employer={employer} onClick={onClick} onUpdated={onUpdated} />
  }

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow duration-200 cursor-pointer touch-manipulation max-lg:min-h-[44px] max-lg:p-1" onClick={onClick}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg mb-2">{employer.name}</CardTitle>
              {employer.abn && (
                <p className="text-sm text-muted-foreground">ABN: {employer.abn}</p>
              )}
              {/* Aliases Section */}
              {aliasesData && aliasesData.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Tag className="h-3 w-3" />
                    <span>Aliases:</span>
                  </div>
                  {aliasesData.slice(0, 3).map((alias: any) => (
                    <Badge key={alias.id} variant="outline" className="text-xs">
                      {alias.alias}
                    </Badge>
                  ))}
                  {aliasesData.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{aliasesData.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <Building className="h-5 w-5 text-gray-400" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Badges Section */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Rating Display */}
            <div className="flex items-center gap-1">
              <RatingDisplay
                employerId={employer.id}
                employerName={employer.name}
                variant="compact"
                className="touch-manipulation"
              />
            </div>

            {/* Badge 1: Canonical EBA Status - Blue Eureka Flag */}
            <div
              className="cursor-pointer flex items-center gap-1 touch-manipulation min-h-[44px] max-lg:min-h-[44px] max-lg:py-2"
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
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline text-left block min-h-[44px] max-lg:min-h-[44px] max-lg:py-2 touch-manipulation"
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

// Mobile-optimized employer card component
function MobileEmployerCard({
  employer,
  onClick,
  onUpdated
}: {
  employer: EmployerCardData,
  onClick: () => void,
  onUpdated?: () => void
}) {
  const [fwcSearchOpen, setFwcSearchOpen] = useState(false)
  const [incolinkModalOpen, setIncolinkModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<EmployerProject | null>(null)
  const router = useRouter()

  // Quick actions for swipe gestures
  const swipeActions = {
    left: [
      {
        icon: <Phone className="w-5 h-5" />,
        label: 'Call',
        color: 'success' as const,
        onPress: () => {
          if (employer.phone) {
            window.location.href = `tel:${employer.phone}`
          }
        },
      },
    ],
    right: [
      {
        icon: <Mail className="w-5 h-5" />,
        label: 'Email',
        color: 'primary' as const,
        onPress: () => {
          if (employer.email) {
            window.location.href = `mailto:${employer.email}`
          }
        },
      },
    ],
  }

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

  // Fetch employer aliases
  const { data: aliasesData, isLoading: isLoadingAliases } = useQuery({
    queryKey: ['employer-aliases', employer.id],
    queryFn: async () => {
      const res = await fetch(`/api/employers/${employer.id}/aliases`)
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      return json.data || []
    },
    enabled: !!employer.id,
    retry: (failureCount, error) => {
      if (failureCount >= 1) return false
      if (error instanceof Error && error.message.includes('404')) return false
      if (error instanceof Error && error.message.includes('401')) return false
      if (error instanceof Error && error.message.includes('403')) return false
      return true
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 5000),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  return (
    <>
      <MobileCard
        clickable
        onPress={onClick}
        swipeActions={employer.phone || employer.email ? swipeActions : undefined}
        className="border-l-4 border-l-blue-500"
        size="md"
      >
        {/* Header with status indicators */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-base truncate pr-2">
              {employer.name}
            </h3>
            {employer.abn && (
              <p className="text-xs text-gray-500 mt-1">ABN: {employer.abn}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* EBA Status Indicator */}
            <div className="w-2 h-2 rounded-full" style={{
              backgroundColor: employer.enterprise_agreement_status ? '#10b981' : '#6b7280'
            }} />
            <Building className="w-5 h-5 text-gray-400" />
          </div>
        </div>

        {/* Mobile-optimized badges and ratings */}
        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
          <RatingDisplay
            employerId={employer.id}
            employerName={employer.name}
            variant="compact"
            className="flex-shrink-0"
          />

          <CfmeuEbaBadge
            hasActiveEba={employer.enterprise_agreement_status === true}
            builderName={employer.name}
            size="sm"
            showText={false}
            className="flex-shrink-0"
          />

          {employer.worker_placements && employer.worker_placements.length > 0 && (
            <Badge variant="secondary" className="flex-shrink-0 text-xs">
              <Users className="h-3 w-3 mr-1" />
              {employer.worker_placements.length}
            </Badge>
          )}
        </div>

        {/* Aliases (simplified for mobile) */}
        {isLoadingAliases ? (
          <div className="flex gap-1 mb-3">
            <SkeletonLoader variant="rectangular" height="24px" width="60px" className="rounded-full" />
            <SkeletonLoader variant="rectangular" height="24px" width="80px" className="rounded-full" />
          </div>
        ) : aliasesData && aliasesData.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {aliasesData.slice(0, 2).map((alias: any) => (
              <Badge key={alias.id} variant="outline" className="text-xs">
                {alias.alias}
              </Badge>
            ))}
            {aliasesData.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{aliasesData.length - 2}
              </Badge>
            )}
          </div>
        )}

        {/* Projects (mobile-optimized) */}
        {employer.projects && employer.projects.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-gray-700">Projects</h4>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {employer.projects.slice(0, 3).map((project) => (
                <button
                  key={project.id}
                  className="flex-shrink-0 px-3 py-2 bg-gray-50 rounded-lg text-xs text-left min-w-[120px] border border-gray-200 hover:bg-gray-100 transition-colors"
                  onClick={(e) => handleProjectClick(project, e)}
                >
                  <div className="font-medium text-gray-900 truncate">
                    {project.name}
                  </div>
                  {project.tier && (
                    <div className="text-gray-500 mt-1">
                      {project.tier}
                    </div>
                  )}
                </button>
              ))}
              {employer.projects.length > 3 && (
                <div className="flex-shrink-0 px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-500 min-w-[60px] border border-gray-200 flex items-center justify-center">
                  +{employer.projects.length - 3}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Organisers (mobile-optimized) */}
        {employer.organisers && employer.organisers.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Users className="w-3 h-3" />
              <span>
                {employer.organisers.length} {employer.organisers.length === 1 ? 'Organiser' : 'Organisers'}
              </span>
              {employer.organisers.length > 0 && (
                <>
                  <span>•</span>
                  <span>{employer.organisers[0].name}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Quick actions footer */}
        {(employer.phone || employer.email) && (
          <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
            {employer.phone && (
              <Button asChild variant="outline" size="sm" className="h-8 px-3 text-xs">
                <a href={`tel:${employer.phone}`}>
                  <Phone className="h-3 w-3 mr-1" />
                  Call
                </a>
              </Button>
            )}
            {employer.email && (
              <Button asChild variant="outline" size="sm" className="h-8 px-3 text-xs">
                <a href={`mailto:${employer.email}`}>
                  <Mail className="h-3 w-3 mr-1" />
                  Email
                </a>
              </Button>
            )}
          </div>
        )}
      </MobileCard>

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
