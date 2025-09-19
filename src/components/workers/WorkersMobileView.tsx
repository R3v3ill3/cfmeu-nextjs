"use client"
export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useSearchParams, usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
        .limit(200)
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
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Workers</h1>
      </div>

      <Input 
        placeholder="Search workers…" 
        value={sp.get("q") || ""} 
        onChange={(e) => setParam("q", e.target.value)}
      />

      <Select value={membership} onValueChange={(value) => setParam('membership', value)}>
        <SelectTrigger>
          <SelectValue placeholder="Membership" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All workers</SelectItem>
          <SelectItem value="member">CFMEU members</SelectItem>
          <SelectItem value="non_member">Non-members</SelectItem>
        </SelectContent>
      </Select>

      <Select value={tier} onValueChange={(value) => setParam('tier', value)}>
        <SelectTrigger>
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
        <SelectTrigger>
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
        <SelectTrigger>
          <SelectValue placeholder="Incolink" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All workers</SelectItem>
          <SelectItem value="with">With Incolink</SelectItem>
          <SelectItem value="without">No Incolink</SelectItem>
        </SelectContent>
      </Select>

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
