"use client"
export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useSearchParams, usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { Filter, ChevronDown, ChevronUp, Search, X } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { useWorkersServerSideCompatible, WorkerRecord } from "@/hooks/useWorkersServerSide"
import { supabase } from "@/integrations/supabase/client"
import { PROJECT_TIER_LABELS, ProjectTier } from "@/components/projects/types"
import { WorkerCard } from "./WorkerCard"
import { WorkerDetailModal } from "./WorkerDetailModal"

const WORKERS_STATE_KEY = 'workers-page-state-mobile'

const saveWorkersState = (params: URLSearchParams) => {
  try {
    const state = {
      q: params.get('q') || '',
      page: params.get('page') || '1',
      membership: params.get('membership') || 'all',
      tier: params.get('tier') || 'all',
      employerId: params.get('employerId') || '',
      incolink: params.get('incolink') || 'all'
    }
    sessionStorage.setItem(WORKERS_STATE_KEY, JSON.stringify(state))
  } catch (e) {}
}

const loadWorkersState = () => {
  try {
    const saved = sessionStorage.getItem(WORKERS_STATE_KEY)
    return saved ? JSON.parse(saved) : null
  } catch (e) {
    return null
  }
}

export function WorkersMobileView() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const q = (sp.get("q") || "").toLowerCase()
  const membership = (sp.get("membership") || "all") as 'all' | 'member' | 'non_member'
  const tier = (sp.get("tier") || "all") as 'all' | ProjectTier
  const employerId = sp.get("employerId") || ""
  const incolink = (sp.get("incolink") || "all") as 'all' | 'with' | 'without'
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
  const PAGE_SIZE = 10
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  
  // Count active filters
  const activeFilters = [
    membership !== 'all' ? 'membership' : null,
    tier !== 'all' ? 'tier' : null,
    employerId ? 'employer' : null,
    incolink !== 'all' ? 'incolink' : null,
  ].filter(Boolean).length

  useEffect(() => {
    saveWorkersState(sp)
  }, [sp])

  useEffect(() => {
    if (sp.toString() === '') {
      const savedState = loadWorkersState()
      if (savedState) {
        const params = new URLSearchParams()
        if (savedState.q) params.set('q', savedState.q)
        if (savedState.page && savedState.page !== '1') params.set('page', savedState.page)
        if (savedState.membership && savedState.membership !== 'all') params.set('membership', savedState.membership)
        if (savedState.tier && savedState.tier !== 'all') params.set('tier', savedState.tier)
        if (savedState.employerId) params.set('employerId', savedState.employerId)
        if (savedState.incolink && savedState.incolink !== 'all') params.set('incolink', savedState.incolink)
        if (params.toString()) {
          router.replace(`${pathname}?${params.toString()}`)
        }
      }
    }
  }, [])

  const setParam = (key: string, value?: string) => {
    const params = new URLSearchParams(sp.toString())
    if (!value || value === 'all') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    if (key !== 'page') {
      params.delete('page')
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  const serverSideResult = useWorkersServerSideCompatible({
    page,
    pageSize: PAGE_SIZE,
    sort: 'name',
    dir: 'asc',
    q: q || undefined,
    membership,
    tier: tier !== 'all' ? tier : undefined,
    employerId: employerId || undefined,
    incolink: incolink !== 'all' ? incolink : undefined,
  })

  const { data: employerOptions = [] } = useQuery({
    queryKey: ["workers-filter-employers-mobile"],
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

  const { data, totalCount, totalPages, currentPage, isFetching } = serverSideResult
  const hasNext = currentPage < totalPages
  const hasPrev = currentPage > 1

  const handleCardClick = (workerId: string) => {
    setSelectedWorkerId(workerId)
    setIsDetailOpen(true)
  }

  if (isFetching && !data.length) {
    return (
      <div className="p-4 space-y-4">
        <h1 className="text-2xl font-semibold">Workers</h1>
        <Input placeholder="Search workers…" disabled />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-lg h-28 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="px-safe py-4 pb-safe-bottom space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Workers</h1>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search workers…" 
          value={sp.get("q") || ""} 
          onChange={(e) => setParam("q", e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Mobile filters */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {activeFilters > 0 && (
              <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs">
                {activeFilters}
              </Badge>
            )}
            {filtersOpen ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg mt-2">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Membership</label>
                <Select value={membership} onValueChange={(value) => setParam('membership', value)}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Membership" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All workers</SelectItem>
                    <SelectItem value="member">CFMEU members</SelectItem>
                    <SelectItem value="non_member">Non-members</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tier</label>
                <Select value={tier} onValueChange={(value) => setParam('tier', value)}>
                  <SelectTrigger className="h-8">
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
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Employer</label>
                <Select value={employerId || 'all'} onValueChange={(value) => setParam('employerId', value === 'all' ? undefined : value)}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Employer" />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    <SelectItem value="all">All employers</SelectItem>
                    {employerOptions.map((option: any) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                        {option.tier ? ` • ${PROJECT_TIER_LABELS[option.tier as ProjectTier] ?? option.tier}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Incolink</label>
                <Select value={incolink} onValueChange={(value) => setParam('incolink', value)}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Incolink" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All workers</SelectItem>
                    <SelectItem value="with">With Incolink ID</SelectItem>
                    <SelectItem value="without">Without Incolink ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {activeFilters > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setParam("membership", "all")
                  setParam("tier", "all")
                  setParam("employerId", undefined)
                  setParam("incolink", "all")
                }}
                className="w-full text-muted-foreground"
              >
                <X className="h-4 w-4 mr-2" />
                Clear All Filters
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {((page - 1) * PAGE_SIZE) + 1}-{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} workers
        </span>
        {activeFilters > 0 && (
          <Badge variant="outline" className="text-xs">
            {activeFilters} filter{activeFilters > 1 ? 's' : ''} active
          </Badge>
        )}
      </div>

      {data.length === 0 && !isFetching ? (
        <p className="text-center text-muted-foreground pt-8">No workers found.</p>
      ) : (
        <div className="space-y-4">
          {(data as WorkerRecord[]).map((worker) => (
            <WorkerCard 
              key={worker.id}
              worker={worker}
              onSelect={handleCardClick}
              onViewDetail={handleCardClick}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-4">
        <Button variant="outline" size="sm" disabled={!hasPrev} onClick={() => setParam('page', String(page - 1))}>
          Previous
        </Button>
        <div className="text-sm text-muted-foreground">
          Page {page} of {Math.ceil(totalCount / PAGE_SIZE)}
        </div>
        <Button variant="outline" size="sm" disabled={!hasNext} onClick={() => setParam('page', String(page + 1))}>
          Next
        </Button>
      </div>

      <WorkerDetailModal
        workerId={selectedWorkerId}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false)
          setSelectedWorkerId(null)
        }}
      />
    </div>
  )
}
