"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getEbaStatusInfo } from "./ebaHelpers"
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
  worker_placements: { id: string }[];
  company_eba_records?: any[];
  // Enhanced data
  projects?: Array<{
    id: string
    name: string
    roles?: string[]
    trades?: string[]
  }>
  organisers?: Array<{
    id: string
    name: string
    patch_name?: string
  }>
}

type EmployerProject = NonNullable<EmployerRow["projects"]>[number]

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
    
    const rec = emp.company_eba_records?.[0]
    const ebaStatus = rec ? getEbaStatusInfo(rec) : null
    const hasEba = ebaStatus?.variant === 'default'
    
    if (hasEba) {
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
            const rec = emp.company_eba_records?.[0]
            const ebaStatus = rec ? getEbaStatusInfo(rec) : null
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
                    className="cursor-pointer"
                    onClick={(e) => handleEbaBadgeClick(emp, e)}
                  >
                    <CfmeuEbaBadge 
                      hasActiveEba={ebaStatus?.variant === 'default'} 
                      builderName={emp.name}
                      size="sm"
                      showText={true}
                    />
                    {ebaStatus?.variant !== 'default' && (
                      <Badge 
                        variant={ebaStatus?.variant || 'destructive'} 
                        className="text-xs hover:shadow-sm transition-shadow ml-1"
                      >
                        {ebaStatus?.label || 'No EBA'}
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
