"use client"
export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useSearchParams, usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useEmployersServerSideCompatible } from "@/hooks/useEmployersServerSide"
import { EmployerCard, EmployerCardData } from "./EmployerCard"
import { EmployerDetailModal } from "./EmployerDetailModal"
import { getEbaCategory } from "./ebaHelpers"

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
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const q = (sp.get("q") || "").toLowerCase()
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
  const PAGE_SIZE = 10
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

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

  const { data, totalCount, totalPages, currentPage, isFetching } = serverSideResult
  const hasNext = currentPage < totalPages
  const hasPrev = currentPage > 1

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
  
  const cardData: EmployerCardData[] = data.map((emp: any) => ({
    id: emp.id,
    name: emp.name,
    abn: emp.abn,
    employer_type: emp.employer_type,
    phone: emp.phone,
    email: emp.email,
    incolink_id: emp.incolink_id,
    incolink_last_matched: emp.incolink_last_matched,
    worker_placements: emp.worker_placements || [],
    ebaCategory: emp.company_eba_records?.[0] ? getEbaCategory(emp.company_eba_records[0]) : { category: 'no', label: 'No EBA', variant: 'destructive' },
    projects: emp.projects,
    organisers: emp.organisers,
  }))

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Employers</h1>
      </div>

      <Input 
        placeholder="Search employers…" 
        value={sp.get("q") || ""} 
        onChange={(e) => setParam("q", e.target.value)}
      />

      {data.length === 0 && !isFetching ? (
        <p className="text-center text-muted-foreground pt-8">No employers found.</p>
      ) : (
        <div className="space-y-4">
          {cardData.map((emp) => (
            <EmployerCard key={emp.id} employer={emp} onClick={() => handleCardClick(emp.id)} />
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
      />
    </div>
  )
}
