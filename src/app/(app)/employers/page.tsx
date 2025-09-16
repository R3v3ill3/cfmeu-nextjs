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
import { ArrowUp, ArrowDown, LayoutGrid, List as ListIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { getEbaCategory } from "@/components/employers/ebaHelpers"
import { EmployerTable } from "@/components/employers/EmployerTable"
import { useEmployersServerSideCompatible } from "@/hooks/useEmployersServerSide"

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
  const page = parseInt(sp.get("page") || "1")
  const pageSize = parseInt(sp.get("pageSize") || "100")

  // Feature flag for server-side processing
  const USE_SERVER_SIDE = process.env.NEXT_PUBLIC_USE_SERVER_SIDE_EMPLOYERS === 'true'

  const setParam = (key: string, value?: string) => {
    const params = new URLSearchParams(sp.toString())
    if (!value || value === "all" || value === "") params.delete(key)
    else params.set(key, value)
    
    // Reset to page 1 when filters change (but not when changing page or pageSize)
    if (key !== "page" && key !== "pageSize") {
      params.delete("page")
    }
    
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  // CLIENT-SIDE DATA FETCHING (Original implementation)
  const { data: allEmployersData = [], isFetching: clientFetching } = useQuery({
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
          project_assignments!left(id)
        `)
        .order("name", { ascending: true })
        .limit(5000) // Future-proof limit to handle growth

      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    enabled: !USE_SERVER_SIDE // Only run when server-side is disabled
  })

  // SERVER-SIDE DATA FETCHING (New implementation)
  const serverSideResult = useEmployersServerSideCompatible({
    page,
    pageSize,
    sort: sort as 'name' | 'estimated' | 'eba_recency',
    dir: dir as 'asc' | 'desc',
    q: q || undefined,
    engaged,
    eba: eba as any,
    type: type as any,
  })

  // Conditional data selection based on feature flag
  const employersData = USE_SERVER_SIDE ? serverSideResult.data : allEmployersData
  const isFetching = USE_SERVER_SIDE ? serverSideResult.isFetching : clientFetching

  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const { filteredRows, totalCount, totalPages, currentPage } = useMemo(() => {
    if (USE_SERVER_SIDE) {
      // SERVER-SIDE: Data is already filtered, sorted, and paginated
      return {
        filteredRows: employersData || [],
        totalCount: serverSideResult.totalCount || 0,
        totalPages: serverSideResult.totalPages || 0,
        currentPage: serverSideResult.currentPage || 1
      }
    } else {
      // CLIENT-SIDE: Apply original filtering, sorting, and pagination logic
      let list = (employersData as any[]).slice()
      
      // Apply filters
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
          const hasProjectRoles = Array.isArray(emp.project_assignments) && emp.project_assignments.length > 0
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
      
      // Apply sorting
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
      
      // Calculate pagination
      const totalCount = list.length
      const totalPages = Math.ceil(totalCount / pageSize)
      const currentPage = Math.min(page, Math.max(1, totalPages)) // Ensure page is within bounds
      const startIndex = (currentPage - 1) * pageSize
      const endIndex = startIndex + pageSize
      const paginatedList = list.slice(startIndex, endIndex)
      
      return {
        filteredRows: paginatedList,
        totalCount,
        totalPages,
        currentPage
      }
    }
  }, [USE_SERVER_SIDE, employersData, serverSideResult, q, engaged, eba, type, sort, dir, page, pageSize])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Employers</h1>
        {/* Development indicator for which implementation is active */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs px-2 py-1 rounded border">
            {USE_SERVER_SIDE ? (
              <span className="text-green-600">🚀 Server-side {serverSideResult.debug?.queryTime ? `(${serverSideResult.debug.queryTime}ms)` : ''}</span>
            ) : (
              <span className="text-blue-600">💻 Client-side</span>
            )}
          </div>
        )}
      </div>
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
      
      {/* Results summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {filteredRows.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} employers
        </span>
        <div className="flex items-center gap-2">
          <span>Page size:</span>
          <Select value={pageSize.toString()} onValueChange={(v) => setParam("pageSize", v)}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {view === 'list' ? (
        <div className="rounded-md border overflow-x-auto">
          <EmployerTable
            rows={filteredRows as any[]}
            onRowClick={(id) => {
              setSelectedEmployerId(id)
              setIsDetailOpen(true)
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(filteredRows as any[]).map((emp: any) => (
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
      
      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setParam("page", (currentPage - 1).toString())}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setParam("page", (currentPage + 1).toString())}
              disabled={currentPage >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Page {currentPage} of {totalPages}
            </span>
          </div>
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

