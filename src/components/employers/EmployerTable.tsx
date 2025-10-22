"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getEbaCategory } from "./ebaHelpers"
import { IncolinkBadge } from "@/components/ui/IncolinkBadge"
import { CfmeuEbaBadge } from "@/components/ui/CfmeuEbaBadge"
import { FwcSearchModal } from "./FwcSearchModal"
import { IncolinkActionModal } from "./IncolinkActionModal"
import { ProjectCardModal } from "./ProjectCardModal"
import { Users, MapPin } from "lucide-react"
import { useRouter } from "next/navigation"

type EmployerRow = {
  id: string
  name: string
  abn?: string | null
  employer_type: string
  estimated_worker_count?: number | null
  email?: string | null
  phone?: string | null
  incolink_id?: string | null;
  incolink_last_matched?: string | null;
  enterprise_agreement_status?: boolean | null
  eba_status_source?: string | null
  eba_status_updated_at?: string | null
  eba_status_notes?: string | null
  worker_placements: { id: string }[];
  company_eba_records?: any[];
  // Enhanced data
  projects?: Array<{
    id: string
    name: string
    tier?: string | null
    roles?: string[]
    trades?: string[]
  }>
  organisers?: Array<{
    id: string
    name: string
    patch_name?: string
  }>
  // Aggregated categories
  roles?: Array<{ code: string; name: string; manual: boolean; derived: boolean }>
  trades?: Array<{ code: string; name: string; manual: boolean; derived: boolean }>
}

type EmployerProject = NonNullable<EmployerRow["projects"]>[number]

function RowCategories({ employerId, roles, trades }: { employerId: string; roles?: Array<{ code: string; name: string; manual: boolean; derived: boolean }>; trades?: Array<{ code: string; name: string; manual: boolean; derived: boolean }> }) {
  const shouldFetch = !(Array.isArray(roles) && roles.length > 0) && !(Array.isArray(trades) && trades.length > 0)
  const { data } = useQuery({
    queryKey: ['employer-categories', employerId],
    enabled: shouldFetch,
    queryFn: async () => {
      const res = await fetch(`/api/eba/employers/${employerId}/categories`)
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      return json.data as { roles: Array<{ code: string; name: string; manual: boolean; derived: boolean }>; trades: Array<{ code: string; name: string; manual: boolean; derived: boolean }> }
    }
  })

  const r = (roles && roles.length > 0) ? roles : (data?.roles || [])
  const t = (trades && trades.length > 0) ? trades : (data?.trades || [])

  if ((r.length === 0) && (t.length === 0)) return null

  return (
    <div className="space-y-1 max-w-xs mb-2">
      {r.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">Roles</div>
          <div className="flex flex-wrap gap-1">
            {r.map((item) => (
              <Badge key={item.code} variant={item.manual ? 'default' : 'secondary'} className="text-xs">
                {item.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {t.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">Trades</div>
          <div className="flex flex-wrap gap-1">
            {t.map((item) => (
              <Badge key={item.code} variant={item.manual ? 'default' : 'secondary'} className="text-xs">
                {item.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function EmployerTable({ rows, onRowClick, onEmployerUpdated }: { rows: EmployerRow[]; onRowClick: (id: string) => void; onEmployerUpdated?: () => void }) {
  const [fwcSearchModal, setFwcSearchModal] = useState<{ open: boolean; employerId: string; employerName: string }>({
    open: false,
    employerId: '',
    employerName: ''
  })
  const [incolinkModal, setIncolinkModal] = useState<{ open: boolean; employerId: string; employerName: string; incolinkId?: string | null }>({
    open: false,
    employerId: '',
    employerName: '',
    incolinkId: null
  })
  const [selectedProject, setSelectedProject] = useState<{ project: EmployerProject; organisers?: EmployerRow['organisers'] } | null>(null)
  const router = useRouter()

  const typeLabel = (t: string) => {
    switch (t) {
      case "builder": return "Builder"
      case "principal_contractor": return "Principal Contractor"
      case "large_contractor": return "Large Contractor"
      case "small_contractor": return "Small Contractor"
      case "individual": return "Individual"
      default: return t
    }
  }

  const handleEbaBadgeClick = (emp: EmployerRow, e: React.MouseEvent) => {
    e.stopPropagation()

    // Use canonical boolean status to decide action
    const hasActiveEba = emp.enterprise_agreement_status === true

    if (hasActiveEba) {
      // Open EBA tracker
      router.push('/eba-tracking')
    } else {
      // Open FWC search
      setFwcSearchModal({
        open: true,
        employerId: emp.id,
        employerName: emp.name
      })
    }
  }

  const handleIncolinkBadgeClick = (emp: EmployerRow, e: React.MouseEvent) => {
    e.stopPropagation()
    setIncolinkModal({
      open: true,
      employerId: emp.id,
      employerName: emp.name,
      incolinkId: emp.incolink_id
    })
  }

  const handleProjectClick = (project: EmployerProject, organisers: EmployerRow['organisers'], e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedProject({ project, organisers })
  }

  const formatRoleName = (role: string) => {
    return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const formatTradeName = (trade: string) => {
    return trade.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employer</TableHead>
            <TableHead>Projects & Roles</TableHead>
            <TableHead>Organisers</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="text-right">Workers</TableHead>
            <TableHead>EBA</TableHead>
            <TableHead>Incolink</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((emp) => {
            // Badge 1: Canonical EBA status from boolean
            const hasActiveEba = emp.enterprise_agreement_status === true

            // Badge 2: FWC workflow status from scrape records
            const rec = emp.company_eba_records?.[0]
            const fwcStatus = rec ? getEbaCategory(rec) : { category: 'no_fwc_match', label: 'No FWC Match', variant: 'outline' as const }

            const contactPhone = rec?.contact_phone || emp.phone
            const contactEmail = rec?.contact_email || emp.email

            return (
              <TableRow key={emp.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick(emp.id)}>
                <TableCell>
                  <div className="flex flex-col">
                    <div className="font-medium">{emp.name}</div>
                    {emp.abn && <div className="text-xs text-muted-foreground">ABN: {emp.abn}</div>}
                    <div className="text-xs text-muted-foreground capitalize mt-1">
                      {typeLabel(emp.employer_type)}
                    </div>
                  </div>
                </TableCell>
                
                <TableCell>
                  {/* Employer-level roles/trades (no limit) with fallback fetch */}
                  <RowCategories employerId={emp.id} roles={emp.roles} trades={emp.trades} />
                  {emp.projects && emp.projects.length > 0 ? (
                    <div className="space-y-1 max-w-xs">
                      {emp.projects.slice(0, 2).map((project, index) => (
                        <div key={project.id} className="space-y-1">
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto text-xs text-blue-600 hover:text-blue-800 hover:underline text-left justify-start max-w-full truncate"
                            onClick={(e) => handleProjectClick(project, emp.organisers, e)}
                          >
                            {project.name}
                          </Button>
                          <div className="flex flex-wrap gap-1">
                            {project.roles?.slice(0, 2).map((role, roleIndex) => (
                              <Badge key={roleIndex} variant="default" className="text-xs bg-blue-600 text-white">
                                {formatRoleName(role)}
                              </Badge>
                            ))}
                            {project.trades?.slice(0, 2).map((trade, tradeIndex) => (
                              <Badge key={tradeIndex} variant="outline" className="text-xs border-gray-400 text-gray-700">
                                {formatTradeName(trade)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                      {emp.projects.length > 2 && (
                        <div className="text-xs text-gray-500">
                          +{emp.projects.length - 2} more
                        </div>
                      )}
                    </div>
                      ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                
                <TableCell>
                  {emp.organisers && emp.organisers.length > 0 ? (
                    <div className="space-y-1 max-w-xs">
                      {emp.organisers.slice(0, 2).map((organiser, index) => (
                        <div key={organiser.id} className="flex items-center gap-1 text-xs text-gray-600">
                          <Users className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{organiser.name}</span>
                          {organiser.patch_name && (
                            <>
                              <span>·</span>
                              <div className="flex items-center gap-1 text-gray-500">
                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{organiser.patch_name}</span>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                      {emp.organisers.length > 2 && (
                        <div className="text-xs text-gray-500">
                          +{emp.organisers.length - 2} more
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                
                <TableCell>
                  <div className="flex flex-col text-sm text-muted-foreground">
                    {contactPhone && <span>{contactPhone}</span>}
                    {contactEmail && <span>{contactEmail}</span>}
                  </div>
                </TableCell>
                
                <TableCell className="text-right">{emp.worker_placements?.length ?? emp.estimated_worker_count ?? 0}</TableCell>
                
                <TableCell>
                  <div
                    className="cursor-pointer flex flex-wrap items-center gap-1"
                    onClick={(e) => handleEbaBadgeClick(emp, e)}
                  >
                    {/* Badge 1: Canonical EBA Status - Blue Eureka Flag */}
                    <CfmeuEbaBadge
                      hasActiveEba={hasActiveEba}
                      builderName={emp.name}
                      size="sm"
                      showText={true}
                    />

                    {/* Badge 2: FWC Workflow Status - Always show */}
                    <Badge
                      variant={fwcStatus.variant}
                      className="text-xs hover:shadow-sm transition-shadow"
                    >
                      {fwcStatus.label}
                    </Badge>

                    {/* Source badge - only when canonical status is true */}
                    {hasActiveEba && emp.eba_status_source && (
                      <Badge variant="outline" className="text-xs">
                        {emp.eba_status_source === 'manual'
                          ? 'Manual'
                          : emp.eba_status_source === 'import'
                          ? 'Import'
                          : 'FWC'}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                
                <TableCell>
                  <div className="flex flex-col items-start">
                  <IncolinkBadge 
                    incolinkId={emp.incolink_id}
                    size="sm"
                    clickable
                    onClick={(e) => handleIncolinkBadgeClick(emp, e)}
                  />
                  {emp.incolink_last_matched && (
                    <span className="text-xs text-muted-foreground mt-1">
                      Paid: {new Date(emp.incolink_last_matched).toLocaleDateString()}
                    </span>
                  )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {/* Modals */}
      <FwcSearchModal
        isOpen={fwcSearchModal.open}
        onClose={() => setFwcSearchModal({ ...fwcSearchModal, open: false })}
        employerId={fwcSearchModal.employerId}
        employerName={fwcSearchModal.employerName}
      />

      <IncolinkActionModal
        isOpen={incolinkModal.open}
        onClose={() => setIncolinkModal({ ...incolinkModal, open: false })}
        employerId={incolinkModal.employerId}
        employerName={incolinkModal.employerName}
        currentIncolinkId={incolinkModal.incolinkId}
        onUpdate={onEmployerUpdated}
      />

      {selectedProject && (
        <ProjectCardModal
          isOpen={!!selectedProject}
          onClose={() => setSelectedProject(null)}
          project={selectedProject.project}
          organisers={selectedProject.organisers}
        />
      )}
    </>
  )
}
