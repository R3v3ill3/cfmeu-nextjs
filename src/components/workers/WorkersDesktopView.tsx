"use client"
export const dynamic = 'force-dynamic'

import { useState, useMemo } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { LayoutGrid, List as ListIcon, ArrowUp, ArrowDown, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { useWorkersServerSideCompatible, WorkerRecord } from "@/hooks/useWorkersServerSide"
import { supabase } from "@/integrations/supabase/client"
import { PROJECT_TIER_LABELS, ProjectTier } from "@/components/projects/types"
import { WorkersTable } from "@/components/workers/WorkersTable"
import { WorkerCard } from "@/components/workers/WorkerCard"
import { WorkerDetailModal } from "@/components/workers/WorkerDetailModal"

const MEMBERSHIP_OPTIONS = [
  { value: "all", label: "All" },
  { value: "member", label: "CFMEU Members" },
  { value: "non_member", label: "Non-members" },
]

const SORT_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "member_number", label: "Member #" },
  { value: "placements", label: "Placement Count" },
]

export function WorkersDesktopView() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const q = sp.get("q") || ""
  const membership = (sp.get("membership") || "all") as 'all' | 'member' | 'non_member'
  const tier = (sp.get("tier") || "all") as 'all' | ProjectTier
  const employerId = sp.get("employerId") || ""
  const incolink = (sp.get("incolink") || "all") as 'all' | 'with' | 'without'
  const sort = (sp.get("sort") || "name") as 'name' | 'member_number' | 'placements'
  const dir = (sp.get("dir") || "asc") as 'asc' | 'desc'
  const view = (sp.get("view") || "card") as 'card' | 'list'
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1)
  const pageSize = Math.min(Math.max(parseInt(sp.get("pageSize") || "24", 10) || 24, 10), 100)

  const setParam = (key: string, value?: string) => {
    const params = new URLSearchParams(sp.toString())
    if (!value || value === "" || value === "all") {
      params.delete(key)
    } else {
      params.set(key, value)
    }

    if (key !== "page" && key !== "pageSize") {
      params.delete("page")
    }

    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  const { data: workers, isFetching, refetch, totalPages, totalCount, currentPage } = useWorkersServerSideCompatible({
    page,
    pageSize,
    sort,
    dir,
    q: q ? q.toLowerCase() : undefined,
    membership,
    tier: tier !== 'all' ? tier : undefined,
    employerId: employerId || undefined,
    incolink: incolink !== 'all' ? incolink : undefined,
  })

  const { data: employerOptions = [] } = useQuery({
    queryKey: ["workers-filter-employers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employers')
        .select('id, name, tier')
        .order('name')
        .limit(1000)
      if (error) throw error
      return data || []
    }
  })

  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const safeTotalPages = Math.max(totalPages || 1, 1)
  const safeCurrentPage = Math.min(Math.max(currentPage || page, 1), safeTotalPages)
  const displayTotalCount = totalCount ?? workers.length

  const isInitialLoading = isFetching && workers.length === 0

  const handleSelectWorker = (workerId: string) => {
    setSelectedWorkerId(workerId)
    setIsDetailOpen(true)
  }

  const handleViewDetail = (workerId: string) => {
    setSelectedWorkerId(workerId)
    setIsDetailOpen(true)
  }

  const handlePageChange = (direction: 'prev' | 'next') => {
    const nextPage = direction === 'prev' ? safeCurrentPage - 1 : safeCurrentPage + 1
    if (nextPage < 1 || nextPage > safeTotalPages) return
    setParam('page', String(nextPage))
  }

  const headerDescription = useMemo(() => {
    if (displayTotalCount === 0) return 'Union workforce directory'
    const startIndex = (safeCurrentPage - 1) * pageSize + 1
    const endIndex = Math.min(safeCurrentPage * pageSize, displayTotalCount)
    return `Showing ${startIndex}-${endIndex} of ${displayTotalCount}`
  }, [displayTotalCount, safeCurrentPage, pageSize])

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Workers</h1>
          <p className="text-sm text-muted-foreground mt-1">{headerDescription}</p>
        </div>
      </div>

      <div className="sticky top-0 z-30 -mx-6 px-6 py-3 bg-white shadow-sm border-b space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(event) => setParam('q', event.target.value)}
              placeholder="Search workers by name, email, or phone"
              className="pl-9"
            />
          </div>

          <Select value={membership} onValueChange={(value) => setParam('membership', value)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Membership" />
            </SelectTrigger>
            <SelectContent>
              {MEMBERSHIP_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={tier} onValueChange={(value) => setParam('tier', value)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              {Object.entries(PROJECT_TIER_LABELS).map(([tierValue, label]) => (
                <SelectItem key={tierValue} value={tierValue}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={employerId || 'all'} onValueChange={(value) => setParam('employerId', value === 'all' ? undefined : value)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Employer" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">All employers</SelectItem>
              {employerOptions.map((option: any) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                  {option.tier ? ` • ${PROJECT_TIER_LABELS[option.tier as ProjectTier] ?? option.tier}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={incolink} onValueChange={(value) => setParam('incolink', value)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Incolink" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All workers</SelectItem>
              <SelectItem value="with">With Incolink</SelectItem>
              <SelectItem value="without">No Incolink</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(value) => setParam('sort', value)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={dir}
            onValueChange={(value) => value && setParam('dir', value)}
            className="hidden sm:inline-flex"
          >
            <ToggleGroupItem value="asc" aria-label="Ascending" className="gap-1">
              <ArrowUp className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="desc" aria-label="Descending" className="gap-1">
              <ArrowDown className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>

          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view}
            onValueChange={(value) => value && setParam('view', value)}
          >
            <ToggleGroupItem value="card" aria-label="Card view" className="gap-1">
              <LayoutGrid className="h-4 w-4" /> Card
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view" className="gap-1">
              <ListIcon className="h-4 w-4" /> List
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {isInitialLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : workers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <p className="text-lg font-medium text-muted-foreground">No workers found</p>
          <p className="text-sm text-muted-foreground">Adjust your filters or try a different search.</p>
        </div>
      ) : view === 'list' ? (
        <WorkersTable
          workers={workers as WorkerRecord[]}
          onSelect={handleSelectWorker}
          onViewDetail={handleViewDetail}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {workers.map((worker: WorkerRecord) => (
            <WorkerCard
              key={worker.id}
              worker={worker}
              onSelect={handleSelectWorker}
              onViewDetail={handleViewDetail}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Page {safeCurrentPage} of {safeTotalPages}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange('prev')}
            disabled={safeCurrentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange('next')}
            disabled={safeCurrentPage >= safeTotalPages || workers.length === 0}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <WorkerDetailModal
        workerId={selectedWorkerId}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false)
          setSelectedWorkerId(null)
        }}
        onUpdate={() => refetch()}
      />
    </div>
  )
}
