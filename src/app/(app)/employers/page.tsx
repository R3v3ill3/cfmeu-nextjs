"use client"
export const dynamic = 'force-dynamic'

import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { EmployerCard } from "@/components/employers/EmployerCard"
import { useState, useMemo } from "react"
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Toggle } from "@/components/ui/toggle"
import { ArrowUp, ArrowDown, LayoutGrid, List as ListIcon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { getEbaCategory } from "@/components/employers/ebaHelpers"
import { EmployerTable } from "@/components/employers/EmployerTable"

export default function EmployersPage() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const q = (sp.get("q") || "").toLowerCase()
  const engaged = (sp.get("engaged") ?? "1") !== "0"
  const eba = sp.get("eba") || "all"
  const type = sp.get("type") || "all"
  const sort = sp.get("sort") || "name"
  const dir = sp.get("dir") || "asc"
  const view = sp.get("view") || "card"

  const setParam = (key: string, value?: string) => {
    const params = new URLSearchParams(sp.toString())
    if (!value || value === "all" || value === "") params.delete(key)
    else params.set(key, value)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  const { data: employers = [], isFetching } = useQuery({
    queryKey: ["employers-list"],
    queryFn: async () => {
      let query = supabase
        .from("employers")
        .select(`
          id,
          name,
          abn,
          employer_type,
          website,
          email,
          phone,
          estimated_worker_count,
          company_eba_records!left(*),
          worker_placements!left(id),
          project_employer_roles!left(id)
        `)
        .order("name", { ascending: true })

      const { data, error } = await query
      if (error) throw error
      return data || []
    }
  })

  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const rows = useMemo(() => {
    let list = (employers as any[]).slice()
    if (q) {
      const s = q
      list = list.filter((emp: any) => {
        const hay = [emp.name, emp.abn, emp.website, emp.email, emp.phone].map((v: any) => String(v || "").toLowerCase())
        return hay.some((h: string) => h.includes(s))
      })
    }
    if (engaged) {
      list = list.filter((emp: any) => {
        const hasEstimatedWorkers = (emp.estimated_worker_count || 0) > 0
        const hasWorkers = Array.isArray(emp.worker_placements) && emp.worker_placements.length > 0
        const hasProjectRoles = Array.isArray(emp.project_employer_roles) && emp.project_employer_roles.length > 0
        const ebaRec = emp.company_eba_records?.[0]
        const cat = ebaRec ? getEbaCategory(ebaRec).category : 'no'
        const hasRecentEba = cat !== 'no'
        return hasEstimatedWorkers || hasWorkers || hasProjectRoles || hasRecentEba
      })
    }
    if (eba !== "all") {
      list = list.filter((emp: any) => {
        const rec = emp.company_eba_records?.[0]
        const cat = rec ? getEbaCategory(rec).category : 'no'
        return cat === eba
      })
    }
    if (type !== "all") {
      list = list.filter((emp: any) => emp.employer_type === type)
    }
    const scoreDate = (x: any) => {
      const r = x.company_eba_records?.[0] || {}
      const dates = [r.fwc_certified_date, r.eba_lodged_fwc, r.date_eba_signed, r.date_vote_occurred, r.date_vote_occured]
        .map((d: any) => (d ? new Date(d).getTime() : 0))
      return Math.max(0, ...dates)
    }
    const cmp = (a: any, b: any) => {
      const s = dir === "asc" ? 1 : -1
      if (sort === "name") return s * String(a.name || "").localeCompare(String(b.name || ""))
      if (sort === "estimated") return s * ((a.estimated_worker_count || 0) - (b.estimated_worker_count || 0))
      if (sort === "eba_recency") return s * (scoreDate(a) - scoreDate(b))
      return 0
    }
    list.sort(cmp)
    return list
  }, [employers, q, engaged, eba, type, sort, dir])

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Employers</h1>
      <div className="sticky top-0 z-30 -mx-6 px-6 py-3 bg-background/40 backdrop-blur supports-[backdrop-filter]:bg-background/30 border-b">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[240px] flex-1">
            <div className="text-xs text-muted-foreground mb-1">Search</div>
            <Input placeholder="Search…" value={sp.get("q") || ""} onChange={(e) => setParam("q", e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Engagement</span>
            <Toggle
              pressed={engaged}
              onPressedChange={(v) => setParam("engaged", v ? "1" : "0")}
              aria-label="Engagement filter"
            >
              {engaged ? "Engaged" : "All"}
            </Toggle>
          </div>
          <div className="w-44">
            <div className="text-xs text-muted-foreground mb-1">EBA Status</div>
            <Select value={eba} onValueChange={(v) => setParam("eba", v)}>
              <SelectTrigger>
                <SelectValue placeholder="EBA" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All EBA</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="lodged">Lodged</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="no">No EBA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-56">
            <div className="text-xs text-muted-foreground mb-1">Contractor type</div>
            <Select value={type} onValueChange={(v) => setParam("type", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="builder">Builder</SelectItem>
                <SelectItem value="principal_contractor">Principal Contractor</SelectItem>
                <SelectItem value="large_contractor">Large Contractor</SelectItem>
                <SelectItem value="small_contractor">Small Contractor</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <div className="text-xs text-muted-foreground mb-1">Sort by</div>
            <Select value={sort} onValueChange={(v) => setParam("sort", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="estimated">Estimated workers</SelectItem>
                <SelectItem value="eba_recency">EBA recency</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Order</span>
            <ToggleGroup type="single" variant="outline" size="sm" value={dir} onValueChange={(v) => v && setParam("dir", v)}>
              <ToggleGroupItem value="asc" aria-label="Ascending"><ArrowUp className="h-4 w-4" /></ToggleGroupItem>
              <ToggleGroupItem value="desc" aria-label="Descending"><ArrowDown className="h-4 w-4" /></ToggleGroupItem>
            </ToggleGroup>
          </div>
          <ToggleGroup type="single" variant="outline" size="sm" value={view} onValueChange={(v) => v && setParam("view", v)}>
            <ToggleGroupItem value="card" aria-label="Card view" className="gap-1"><LayoutGrid className="h-4 w-4" /> Card</ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view" className="gap-1"><ListIcon className="h-4 w-4" /> List</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      {isFetching && <p className="text-sm text-muted-foreground">Loading…</p>}
      {view === 'list' ? (
        <div className="rounded-md border overflow-x-auto">
          <EmployerTable
            rows={rows as any[]}
            onRowClick={(id) => {
              setSelectedEmployerId(id)
              setIsDetailOpen(true)
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(rows as any[]).map((emp: any) => (
            <EmployerCard
              key={emp.id}
              employer={emp}
              onClick={() => {
                setSelectedEmployerId(emp.id)
                setIsDetailOpen(true)
              }}
            />
          ))}
        </div>
      )}

      <EmployerDetailModal
        employerId={selectedEmployerId}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        initialTab="overview"
      />
    </div>
  )
}

