"use client"
import { useMemo, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ArrowDownAZ, ArrowUpAZ, FileUp, List, Building2 } from "lucide-react"
import { format } from "date-fns"

export type PatchSiteRow = {
  id: string
  site: string
  project: string
  employers: number
  members: { current: number; goal: number }
  dd: { current: number; goal: number }
  leadersScore: number
  lastVisit?: string
}

type SortKey = "membersGap" | "ddGap" | "leadersScore" | "lastVisit"

export function PatchSitesTable({ rows, onAction }: { rows: PatchSiteRow[]; onAction: (action: string, siteId: string) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>("membersGap")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const sorted = useMemo(() => {
    const clone = [...rows]
    clone.sort((a, b) => {
      const aMembersGap = a.members.goal - a.members.current
      const bMembersGap = b.members.goal - b.members.current
      const aDdGap = a.dd.goal - a.dd.current
      const bDdGap = b.dd.goal - b.dd.current
      const keyVal = (r: PatchSiteRow) => {
        switch (sortKey) {
          case "membersGap": return r.members.goal - r.members.current
          case "ddGap": return r.dd.goal - r.dd.current
          case "leadersScore": return r.leadersScore
          case "lastVisit": return r.lastVisit ? new Date(r.lastVisit).getTime() : 0
        }
      }
      const av = keyVal(a)
      const bv = keyVal(b)
      const diff = av - bv
      return sortDir === "asc" ? diff : -diff
    })
    return clone
  }, [rows, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const SortBtn = ({ label, k }: { label: string; k: SortKey }) => (
    <Button variant="ghost" size="sm" onClick={() => toggleSort(k)} className="px-1">
      {label} {sortKey === k ? (sortDir === "asc" ? <ArrowUpAZ className="h-3 w-3 ml-1" /> : <ArrowDownAZ className="h-3 w-3 ml-1" />) : null}
    </Button>
  )

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Site</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Employers</TableHead>
            <TableHead><SortBtn label="Members vs Goal" k="membersGap" /></TableHead>
            <TableHead><SortBtn label="DD vs Goal" k="ddGap" /></TableHead>
            <TableHead><SortBtn label="Leaders score" k="leadersScore" /></TableHead>
            <TableHead><SortBtn label="Last visit" k="lastVisit" /></TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.site}</TableCell>
              <TableCell>{r.project}</TableCell>
              <TableCell>{r.employers}</TableCell>
              <TableCell>
                <span className="tabular-nums">{r.members.current} / {r.members.goal}</span>
              </TableCell>
              <TableCell>
                <span className="tabular-nums">{r.dd.current} / {r.dd.goal}</span>
              </TableCell>
              <TableCell>{r.leadersScore.toFixed(1)}</TableCell>
              <TableCell>{r.lastVisit ? format(new Date(r.lastVisit), "dd/MM/yyyy") : "—"}</TableCell>
              <TableCell className="text-right space-x-2">
                <Button variant="outline" size="sm" onClick={() => onAction("visit-sheet", r.id)}><FileUp className="h-3 w-3 mr-1" /> Visit sheet</Button>
                <Button variant="outline" size="sm" onClick={() => onAction("worker-list", r.id)}><List className="h-3 w-3 mr-1" /> Worker list</Button>
                <Button variant="outline" size="sm" onClick={() => onAction("employer-compliance", r.id)}><Building2 className="h-3 w-3 mr-1" /> Employer view</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

