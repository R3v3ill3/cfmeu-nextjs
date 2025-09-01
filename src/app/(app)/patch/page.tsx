"use client"
export const dynamic = 'force-dynamic'

import RoleGuard from "@/components/guards/RoleGuard"
import { PatchKPICards, PatchSitesTable, PatchMap } from "@/components/patch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { usePatchDashboard } from "@/hooks/usePatchDashboard"
import AddressLookupDialog from "@/components/AddressLookupDialog"
import { Button } from "@/components/ui/button"

export default function PatchPage() {
  const sp = useSearchParams()
  const [lookupOpen, setLookupOpen] = useState(false)
  const patchParam = sp.get("patch") || ""
  const patchIds = patchParam.split(",").map(s => s.trim()).filter(Boolean)
  const status = sp.get("status") || undefined
  const q = sp.get("q")?.toLowerCase() || ""

  // For now, this dashboard still expects a single patch; feed first if present
  const { data } = usePatchDashboard(patchIds[0])
  const kpis = data?.kpis || { members: { current: 0, goal: 0 }, dd: { current: 0, goal: 0 }, leaders: { current: 0, goal: 0 }, openAudits: 0 }
  const rows = useMemo(() => {
    const base = data?.rows || []
    let filtered = base
    if (q) filtered = filtered.filter(r => r.site.toLowerCase().includes(q) || r.project.toLowerCase().includes(q))
    if (status === "stale") {
      const cutoff = Date.now() - 1000*60*60*24*7
      filtered = filtered.filter(r => !r.lastVisit || new Date(r.lastVisit).getTime() < cutoff)
    }
    return filtered
  }, [data, q, status])

  const handleRowAction = (action: string, siteId: string) => {
    // For now, just route to relevant stub pages or download endpoints
    switch (action) {
      case "visit-sheet":
        window.open(`/site-visits/new?siteId=${siteId}`, "_blank")
        break
      case "worker-list":
        window.location.href = `/workers?siteId=${siteId}`
        break
      case "employer-compliance":
        window.location.href = `/employers?siteId=${siteId}&view=compliance`
        break
    }
  }

  return (
    <RoleGuard allow={["organiser", "lead_organiser", "admin"]}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Patch dashboard</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setLookupOpen(true)}>Address Lookup</Button>
            <Link href="/patch/walls" className="text-primary hover:underline">Open Walls</Link>
          </div>
        </div>
        <PatchKPICards data={{
          members: { label: "Members", ...kpis.members },
          dd: { label: "Direct Debit", ...kpis.dd },
          leaders: { label: "Delegates/HSR", ...kpis.leaders },
          openAudits: kpis.openAudits,
        }} />
        
        {/* Show patch map if a specific patch is selected */}
        {patchIds.length === 1 && (
          <PatchMap patchId={patchIds[0]} height="400px" />
        )}
        
        <Card>
          <CardHeader>
            <CardTitle>Sites in patch</CardTitle>
          </CardHeader>
          <CardContent>
            <PatchSitesTable rows={rows as any} onAction={handleRowAction} />
          </CardContent>
        </Card>
      </div>
      <AddressLookupDialog open={lookupOpen} onOpenChange={setLookupOpen} />
    </RoleGuard>
  )
}

