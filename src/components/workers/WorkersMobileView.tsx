"use client"
export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useSearchParams, usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useWorkersServerSideCompatible } from "@/hooks/useWorkersServerSide"
import { WorkerCard, WorkerCardData } from "./WorkerCard"
import { WorkerDetailModal } from "./WorkerDetailModal"

const WORKERS_STATE_KEY = 'workers-page-state-mobile'

const saveWorkersState = (params: URLSearchParams) => {
  try {
    const state = {
      q: params.get('q') || '',
      page: params.get('page') || '1'
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

  const serverSideResult = useWorkersServerSideCompatible({
    page,
    pageSize: PAGE_SIZE,
    sort: 'name',
    dir: 'asc',
    q: q || undefined,
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

  const cardData: WorkerCardData[] = data.map((w: any) => ({
    id: w.id,
    first_name: w.first_name,
    surname: w.surname,
    member_number: w.member_number,
    union_membership_status: w.union_membership_status,
    mobile_phone: w.mobile_phone,
    email: w.email,
  }))

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

      {data.length === 0 && !isFetching ? (
        <p className="text-center text-muted-foreground pt-8">No workers found.</p>
      ) : (
        <div className="space-y-4">
          {cardData.map((worker) => (
            <WorkerCard key={worker.id} worker={worker} onClick={() => handleCardClick(worker.id)} />
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
        onClose={() => setIsDetailOpen(false)}
      />
    </div>
  )
}
