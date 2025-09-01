"use client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getEbaStatusInfo } from "./ebaHelpers"

type EmployerRow = {
  id: string
  name: string
  abn?: string | null
  employer_type: string
  estimated_worker_count?: number | null
  email?: string | null
  phone?: string | null
  company_eba_records?: any[]
}

export function EmployerTable({ rows, onRowClick }: { rows: EmployerRow[]; onRowClick: (id: string) => void }) {
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

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employer</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead className="text-right">Est. Workers</TableHead>
          <TableHead>EBA</TableHead>
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
                </div>
              </TableCell>
              <TableCell>{typeLabel(emp.employer_type)}</TableCell>
              <TableCell>
                <div className="flex flex-col text-sm text-muted-foreground">
                  {contactPhone && <span>{contactPhone}</span>}
                  {contactEmail && <span>{contactEmail}</span>}
                </div>
              </TableCell>
              <TableCell className="text-right">{emp.estimated_worker_count ?? 0}</TableCell>
              <TableCell>
                {ebaStatus ? (
                  <Badge variant={ebaStatus.variant} className="text-xs">{ebaStatus.label}</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">No EBA</span>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}


