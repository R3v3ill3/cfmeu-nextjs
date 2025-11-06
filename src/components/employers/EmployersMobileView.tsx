"use client"
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Toggle } from "@/components/ui/toggle"
import { Search, Plus, RefreshCw, MapPin } from "lucide-react"
import { useEmployersServerSideCompatible } from "@/hooks/useEmployersServerSide"
import { EmployerCard, EmployerCardData } from "./EmployerCard"
import { EmployerDetailModal } from "./EmployerDetailModal"
import { getEbaCategory } from "./ebaHelpers"
import { useQueryClient } from "@tanstack/react-query"
import { refreshSupabaseClient } from "@/integrations/supabase/client"
import { AddEmployerDialog } from "./AddEmployerDialog"
import { useDebounce, useLocalStorage, useInterval } from "react-use"
import { useAccessiblePatches } from "@/hooks/useAccessiblePatches"

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
  const patchParam = sp.get("patch")
  const isGeographicallyFiltered = !!patchParam

  // Get user's accessible patches for geographic filtering
  const { patches: accessiblePatches, isLoading: patchesLoading, role } = useAccessiblePatches()

  // Apply default patch filtering when no patch parameter exists
  useEffect(() => {
    // Skip if still loading patches or if user is admin (admin sees all)
    if (patchesLoading || role === 'admin') {
      return
    }

    const existingPatchParam = sp.get('patch')

    // Only apply default filtering if no patch parameter is already set
    if (!existingPatchParam && accessiblePatches.length > 0) {
      const defaultPatchIds = accessiblePatches.map(p => p.id)
      const params = new URLSearchParams(sp.toString())

      // Set default patch filter
      params.set('patch', defaultPatchIds.join(','))

      // Update URL without triggering navigation reload
      const newUrl = `${pathname}?${params.toString()}`
      router.replace(newUrl)
    }
  }, [patchesLoading, role, accessiblePatches, sp, router, pathname])

  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isAddEmployerOpen, setIsAddEmployerOpen] = useState(false)

  // ============================================================================
  // LOCALSTORAGE: Remember user's last search
  // ============================================================================
  const [savedSearch, setSavedSearch] = useLocalStorage('employer-search-query-mobile', '')

  // Debounced search: local state for immediate UI updates
  // Initialize from URL first, then localStorage fallback
  const [searchInput, setSearchInput] = useState(sp.get("q") || savedSearch || "")

  // Debounce search input - only update URL (triggers API call) after 300ms of no typing
  useDebounce(
    () => {
      const currentQuery = sp.get("q") || ""
      if (searchInput !== currentQuery) {
        setParam("q", searchInput)
      }
      // Also save to localStorage (but don't save empty searches)
      if (searchInput) {
        setSavedSearch(searchInput)
      }
    },
    300,
    [searchInput]
  )

  // Sync URL changes back to local state (e.g., browser back/forward, direct URL changes)
  useEffect(() => {
    const urlQuery = sp.get("q") || ""
    if (urlQuery !== searchInput) {
      setSearchInput(urlQuery)
    }
  }, [sp.get("q")])

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
    patch: patchParam || undefined,
    enhanced: true, // Enable enhanced data for projects, organisers, incolink
    includeAliases: true, // Enable alias search for better employer matching
    aliasMatchMode: 'any', // Match any type of alias
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

  // ============================================================================
  // AUTO-REFRESH: Refresh data every 5 minutes (only when tab is visible)
  // ============================================================================

  const [isPageVisible, setIsPageVisible] = useState(true)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)

  // Track page visibility
  useEffect(() => {
    const handleVisibility = () => {
      const visible = document.visibilityState === 'visible'
      setIsPageVisible(visible)

      // Refresh immediately when user returns to tab
      if (visible && lastRefreshTime) {
        const timeSinceRefresh = Date.now() - lastRefreshTime.getTime()
        // If more than 5 minutes since last refresh, refresh now
        if (timeSinceRefresh > 5 * 60 * 1000) {
          refreshEmployers()
          setLastRefreshTime(new Date())
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [lastRefreshTime, refreshEmployers])

  // Auto-refresh every 5 minutes (only when page is visible)
  useInterval(
    () => {
      if (isPageVisible) {
        console.log('🔄 Auto-refreshing employers data (mobile)...')
        refreshEmployers()
        setLastRefreshTime(new Date())
      }
    },
    isPageVisible ? 5 * 60 * 1000 : null  // 5 minutes, or null to pause
  )

  // Track initial load
  useEffect(() => {
    setLastRefreshTime(new Date())
  }, [])

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
        <div className="flex items-center gap-2">
          {lastRefreshTime && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                refreshEmployers()
                setLastRefreshTime(new Date())
              }}
              className="h-8 px-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          )}
          <Button size="sm" onClick={() => setIsAddEmployerOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {lastRefreshTime && (
        <div className="text-xs text-muted-foreground text-center">
          Updated {new Date().getTime() - lastRefreshTime.getTime() < 60000
            ? 'just now'
            : `${Math.floor((new Date().getTime() - lastRefreshTime.getTime()) / 60000)}m ago`}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search employers…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Geographic filter toggle for non-admin users */}
      {role !== 'admin' && (
        <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Geographic Filter</span>
          </div>
          <Toggle
            pressed={isGeographicallyFiltered}
            onPressedChange={(v) => {
              if (v) {
                // Apply geographic filter using user's accessible patches
                const defaultPatchIds = accessiblePatches.map(p => p.id)
                setParam("patch", defaultPatchIds.join(','))
              } else {
                // Remove geographic filter
                setParam("patch")
              }
            }}
            aria-label="Geographic filter"
            size="sm"
          >
            {isGeographicallyFiltered ? "My Patches" : "All Areas"}
          </Toggle>
        </div>
      )}

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
