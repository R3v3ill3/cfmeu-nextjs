"use client"
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Plus } from "lucide-react"
import { useEmployersServerSideCompatible } from "@/hooks/useEmployersServerSide"
import { EmployerCard, EmployerCardData } from "./EmployerCard"
import { EmployerDetailModal } from "./EmployerDetailModal"
import { getEbaCategory } from "./ebaHelpers"
import { useQueryClient } from "@tanstack/react-query"
import { refreshSupabaseClient } from "@/integrations/supabase/client"
import { AddEmployerDialog } from "./AddEmployerDialog"

const EMPLOYERS_STATE_KEY = 'employers-page-state-mobile'

const saveEmployersState = (params: URLSearchParams) => {
  try {
    const state = {
      q: params.get('q') || '',
      page: params.get('page') || '1'
    }
    sessionStorage.setItem(EMPLOYERS_STATE_KEY, JSON.stringify(state))
  } catch (e) {}
}

const loadEmployersState = () => {
  try {
    const saved = sessionStorage.getItem(EMPLOYERS_STATE_KEY)
    return saved ? JSON.parse(saved) : null
  } catch (e) {
    return null
  }
}

export function EmployersMobileView() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const q = (sp.get("q") || "").toLowerCase()
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
  const PAGE_SIZE = 10
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isAddEmployerOpen, setIsAddEmployerOpen] = useState(false)

  useEffect(() => {
    saveEmployersState(sp)
  }, [sp])

  useEffect(() => {
    if (sp.toString() === '') {
      const savedState = loadEmployersState()
      if (savedState) {
        const params = new URLSearchParams()
        if (savedState.q) params.set('q', savedState.q)
        if (savedState.page && savedState.page !== '1') params.set('page', savedState.page)
        if (params.toString()) {
          router.replace(`${pathname}?${params.toString()}`)
        }
      }
    }
  }, [])

  const setParam = (key: string, value?: string) => {
    const params = new URLSearchParams(sp.toString())
    if (!value) {
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

  const serverSideResult = useEmployersServerSideCompatible({
    page,
    pageSize: PAGE_SIZE,
    sort: 'name',
    dir: 'asc',
    q: q || undefined,
    enhanced: true, // Enable enhanced data for projects, organisers, incolink
  })

  const { data, totalCount, totalPages, currentPage, isFetching, refetch, error } = serverSideResult as any
  const hasNext = currentPage < totalPages
  const hasPrev = currentPage > 1

  const refreshEmployers = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["employers-server-side"] })
    queryClient.invalidateQueries({ queryKey: ["employers-list"] })
    queryClient.invalidateQueries({ queryKey: ["employers"] })
    refetch()
  }, [queryClient, refetch])

  const handleCardClick = (employerId: string) => {
    setSelectedEmployerId(employerId)
    setIsDetailOpen(true)
  }

  if (isFetching && !data.length) {
    return (
      <div className="p-4 space-y-4">
        <h1 className="text-2xl font-semibold">Employers</h1>
        <Input placeholder="Search employers…" disabled />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-lg h-32 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-4 space-y-4">
        <h1 className="text-2xl font-semibold">Employers</h1>
        <div className="text-sm text-red-600">Failed to load employers. {String(error?.message || '')}</div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => refetch()}>Try again</Button>
          <Button size="sm" variant="outline" onClick={() => { refreshSupabaseClient(); refetch(); }}>Reset connection</Button>
        </div>
      </div>
    )
  }
  
  const cardData: EmployerCardData[] = data.map((emp: any) => ({
    id: emp.id,
    name: emp.name,
    abn: emp.abn,
    employer_type: emp.employer_type,
    phone: emp.phone,
    email: emp.email,
    incolink_id: emp.incolink_id,
    incolink_last_matched: emp.incolink_last_matched,
    enterprise_agreement_status: emp.enterprise_agreement_status,
    eba_status_source: emp.eba_status_source,
    eba_status_updated_at: emp.eba_status_updated_at,
    eba_status_notes: emp.eba_status_notes,
    worker_placements: emp.worker_placements || [],
    ebaCategory: emp.company_eba_records?.[0] ? getEbaCategory(emp.company_eba_records[0]) : { category: 'no_fwc_match', label: 'No FWC Match', variant: 'outline' },
    projects: emp.projects,
    organisers: emp.organisers,
  }))

  return (
    <div className="px-safe py-4 pb-safe-bottom space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Employers</h1>
        <Button size="sm" onClick={() => setIsAddEmployerOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search employers…" 
          value={sp.get("q") || ""} 
          onChange={(e) => setParam("q", e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {((page - 1) * PAGE_SIZE) + 1}-{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} employers
      </div>

      {data.length === 0 && !isFetching ? (
        <p className="text-center text-muted-foreground pt-8">No employers found.</p>
      ) : (
        <div className="space-y-4">
          {cardData.map((emp) => (
            <EmployerCard key={emp.id} employer={emp} onClick={() => handleCardClick(emp.id)} onUpdated={refreshEmployers} />
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

      <EmployerDetailModal
        employerId={selectedEmployerId}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        initialTab="overview"
        onEmployerUpdated={refreshEmployers}
      />

      <AddEmployerDialog
        isOpen={isAddEmployerOpen}
        onClose={() => setIsAddEmployerOpen(false)}
        onEmployerCreated={(employerId) => {
          // Refresh employers list
          refreshEmployers()
          // Optionally open the detail modal for the newly created employer
          setSelectedEmployerId(employerId)
          setIsDetailOpen(true)
        }}
      />
    </div>
  )
}
