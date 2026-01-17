"use client"
export const dynamic = 'force-dynamic'

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { withTimeout, QUERY_TIMEOUTS } from "@/lib/withTimeout"
import { refreshSupabaseClient } from "@/integrations/supabase/client"
import { EmployerCard } from "@/components/employers/EmployerCard"
import { useState, useMemo, useCallback, useEffect } from "react"
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Toggle } from "@/components/ui/toggle"
import { ArrowUp, ArrowDown, LayoutGrid, List as ListIcon, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { getEbaCategory } from "@/components/employers/ebaHelpers"
import { EmployerTable } from "@/components/employers/EmployerTable"
import { useEmployersServerSideCompatible } from "@/hooks/useEmployersServerSide"
import { AddEmployerDialog } from "@/components/employers/AddEmployerDialog"
import { Plus } from "lucide-react"
import { useDebounce, useLocalStorage, useInterval } from "react-use"
import { RatingFiltersComponent, ActiveRatingFilters } from "@/components/ratings/RatingFilters"
import { RatingFilters } from "@/types/rating"
import { useAccessiblePatches } from "@/hooks/useAccessiblePatches"
import { useAdminPatchContext } from "@/context/AdminPatchContext"
import { TradeTypeFilter } from "@/components/employers/TradeTypeFilter"

export function EmployersDesktopView() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const q = (sp.get("q") || "").toLowerCase()
  const engaged = sp.get("engaged") === "1" // Changed: Show all by default, filter when explicitly set to "1"
  const eba = sp.get("eba") || "all"
  const type = sp.get("type") || "all"
  const categoryType = sp.get("categoryType")
  const categoryCodeParam = sp.get("categoryCode") || ""
  const selectedTradeCodes =
    categoryType === "trade" && categoryCodeParam
      ? categoryCodeParam.split(",").map((c) => c.trim()).filter(Boolean)
      : []
  const sort = sp.get("sort") || "name"
  const dir = sp.get("dir") || "asc"
  const view = sp.get("view") || "card"
  const page = parseInt(sp.get("page") || "1")
  const patchParam = sp.get("patch")
  const isGeographicallyFiltered = !!patchParam

  // Feature flag for server-side processing
  const USE_SERVER_SIDE = process.env.NEXT_PUBLIC_USE_SERVER_SIDE_EMPLOYERS === 'true'

  // Get user's accessible patches for default filtering
  const { patches: accessiblePatches, isLoading: patchesLoading, role } = useAccessiblePatches()
  const adminPatchContext = useAdminPatchContext()

  // Apply default patch filtering when no patch parameter exists
  useEffect(() => {
    // For admins: check if context has patches, if so, apply them to URL if URL doesn't have any
    if (role === 'admin' && adminPatchContext.isInitialized) {
      const existingPatchParam = sp.get('patch')
      
      // If context has patches but URL doesn't, restore from context
      if (!existingPatchParam && adminPatchContext.selectedPatchIds && adminPatchContext.selectedPatchIds.length > 0) {
        const params = new URLSearchParams(sp.toString())
        params.set('patch', adminPatchContext.selectedPatchIds.join(','))
        const newUrl = `${pathname}?${params.toString()}`
        router.replace(newUrl)
      }
      return
    }

    // For non-admins: apply default patch filtering as before
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
  }, [patchesLoading, role, accessiblePatches, sp, router, pathname, adminPatchContext.isInitialized, adminPatchContext.selectedPatchIds])

  // ============================================================================
  // LOCALSTORAGE: Remember user preferences
  // ============================================================================

  // Save last search query (persists across sessions)
  const [savedSearch, setSavedSearch] = useLocalStorage('employer-search-query', '')

  // Save filter preferences (persists across sessions)
  const [savedPreferences, setSavedPreferences] = useLocalStorage('employer-filter-preferences', {
    view: 'card',
    pageSize: 100,
    sort: 'name',
    dir: 'asc'
  })

  // Use saved pageSize if no URL param provided (with fallback)
  const pageSize = parseInt(sp.get("pageSize") || savedPreferences?.pageSize?.toString() || "100")

  const setParam = (key: string, value?: string) => {
    const params = new URLSearchParams(sp.toString())
    if (!value || value === "all" || value === "") params.delete(key)
    else params.set(key, value)

    // Reset to page 1 when filters change (but not when changing page or pageSize)
    if (key !== "page" && key !== "pageSize") {
      params.delete("page")
    }

    // Save filter preferences to localStorage
    if (key === 'view' || key === 'pageSize' || key === 'sort' || key === 'dir') {
      setSavedPreferences(prev => ({
        view: prev?.view || 'card',
        pageSize: prev?.pageSize || 100,
        sort: prev?.sort || 'name',
        dir: prev?.dir || 'asc',
        [key]: key === 'pageSize' ? parseInt(value || '100') : value || prev?.[key as keyof typeof prev]
      }))
    }

    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  const setTradeCodes = (codes: string[]) => {
    const params = new URLSearchParams(sp.toString())
    if (codes.length === 0) {
      params.delete("categoryType")
      params.delete("categoryCode")
    } else {
      params.set("categoryType", "trade")
      params.set("categoryCode", codes.join(","))
    }
    params.delete("page")
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
          incolink_id,
          incolink_last_matched,
          enterprise_agreement_status,
          eba_status_source,
          eba_status_updated_at,
          eba_status_notes,
          company_eba_records!left(*),
          worker_placements!left(id),
          project_assignments!left(id)
        `)
        .order("name", { ascending: true })
        .limit(5000) // Future-proof limit to handle growth
      try {
        const { data, error } = await withTimeout<any>(query, QUERY_TIMEOUTS.COMPLEX, "fetch employers list")
        if (error) throw error
        return data || []
      } catch (err: any) {
        if (err?.code === "ETIMEDOUT") {
          refreshSupabaseClient()
        }
        throw err
      }
    },
    enabled: !USE_SERVER_SIDE // Only run when server-side is disabled
  })

  // SERVER-SIDE DATA FETCHING (New implementation)
  // For admins, don't apply patch filtering (admins should see all employers)
  const serverSideResult = useEmployersServerSideCompatible({
    page,
    pageSize,
    sort: sort as 'name' | 'estimated' | 'eba_recency' | 'project_count',
    dir: dir as 'asc' | 'desc',
    q: q || undefined,
    engaged,
    eba: eba as any,
    type: type as any,
    categoryType: selectedTradeCodes.length > 0 ? "trade" : "all",
    categoryCode: selectedTradeCodes.length > 0 ? selectedTradeCodes.join(",") : undefined,
    patch: (role === 'admin' ? undefined : patchParam) || undefined,
    enhanced: true, // Enable enhanced data for projects, organisers, incolink
    includeAliases: true, // Enable alias search for better employer matching
    aliasMatchMode: 'any', // Match any type of alias
  })

  const { refetch: refetchEmployers } = serverSideResult

  // Conditional data selection based on feature flag
  // NOTE: Must be declared before useMemo hooks that depend on it
  const employersData = (USE_SERVER_SIDE || sort === 'project_count') ? serverSideResult.data : allEmployersData
  const isFetching = USE_SERVER_SIDE ? serverSideResult.isFetching : clientFetching

  const tradeFilterActive = selectedTradeCodes.length > 0
  const employerIdsForTradeFilter = useMemo(() => {
    if (USE_SERVER_SIDE || !tradeFilterActive) return []
    return (employersData as any[]).map((emp) => emp.id).filter(Boolean)
  }, [USE_SERVER_SIDE, tradeFilterActive, employersData])

  const { data: tradeCategoryMap, isFetching: tradeCategoriesLoading } = useQuery({
    queryKey: ["employer-trade-categories", employerIdsForTradeFilter],
    enabled: !USE_SERVER_SIDE && tradeFilterActive && employerIdsForTradeFilter.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_employer_contractor_categories")
        .select("employer_id, category_code")
        .eq("category_type", "trade")
        .eq("is_current", true)
        .in("employer_id", employerIdsForTradeFilter)
      if (error) throw error
      const map = new Map<string, Set<string>>()
      ;(data || []).forEach((row: any) => {
        if (!map.has(row.employer_id)) map.set(row.employer_id, new Set())
        map.get(row.employer_id)!.add(row.category_code)
      })
      return map
    },
  })

  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isAddEmployerOpen, setIsAddEmployerOpen] = useState(false)

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

  const refreshEmployers = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["employers-server-side"] })
    queryClient.invalidateQueries({ queryKey: ["employers-list"] })
    queryClient.invalidateQueries({ queryKey: ["employers"] })
    refetchEmployers()
  }, [queryClient, refetchEmployers])

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
        console.log('🔄 Auto-refreshing employers data...')
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
          if (eba === 'active') return emp.enterprise_agreement_status === true
          if (eba === 'no') return emp.enterprise_agreement_status !== true

          const rec = emp.company_eba_records?.[0]
          if (!rec) return false
          const cat = getEbaCategory(rec).category
          if (eba === 'lodged') return cat === 'lodged'
          if (eba === 'pending') return cat === 'pending'
          return cat === eba
        })
      }
      if (type !== "all") {
        list = list.filter((emp: any) => emp.employer_type === type)
      }
      if (tradeFilterActive && tradeCategoryMap) {
        list = list.filter((emp: any) => {
          const codes = tradeCategoryMap.get(emp.id)
          if (!codes) return false
          return selectedTradeCodes.some((code) => codes.has(code))
        })
      }
      
      // Apply sorting
      const scoreDate = (x: any) => {
        const r = x.company_eba_records?.[0] || {}
        const dates = [r.fwc_certified_date, r.eba_lodged_fwc, r.date_eba_signed, r.date_vote_occurred]
          .map((d: any) => (d ? new Date(d).getTime() : 0))
        return Math.max(0, ...dates)
      }
      const cmp = (a: any, b: any) => {
        const s = dir === "asc" ? 1 : -1
        if (sort === "name") return s * String(a.name || "").localeCompare(String(b.name || ""))
        if (sort === "estimated") return s * ((a.estimated_worker_count || 0) - (b.estimated_worker_count || 0))
        if (sort === "eba_recency") return s * (scoreDate(a) - scoreDate(b))
        // Fallback project_count sort when using client-side dataset
        const pc = (x: any) => x?._mat_view_data?.project_count ?? x.projects?.length ?? x.project_assignments?.length ?? 0
        if (sort === "project_count") return s * (pc(a) - pc(b))
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
  }, [USE_SERVER_SIDE, employersData, serverSideResult, q, engaged, eba, type, sort, dir, page, pageSize, tradeFilterActive, tradeCategoryMap, selectedTradeCodes])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Employers</h1>
          {lastRefreshTime && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  refreshEmployers()
                  setLastRefreshTime(new Date())
                }}
                className="h-7"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <span className="text-xs">
                Updated {new Date().getTime() - lastRefreshTime.getTime() < 60000
                  ? 'just now'
                  : `${Math.floor((new Date().getTime() - lastRefreshTime.getTime()) / 60000)}m ago`}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Optional debug badge */}
          {process.env.NEXT_PUBLIC_SHOW_DEBUG_BADGES === 'true' && (
            <div className="text-xs px-2 py-1 rounded border">
              {USE_SERVER_SIDE ? (
                <span className="text-green-600">🚀 Server-side {serverSideResult.debug?.queryTime ? `(${serverSideResult.debug.queryTime}ms)` : ''}</span>
              ) : (
                <span className="text-blue-600">💻 Client-side</span>
              )}
            </div>
          )}
          <Button onClick={() => setIsAddEmployerOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Employer
          </Button>
        </div>
      </div>
      <div className="sticky top-0 z-30 -mx-6 px-6 py-3 bg-white shadow-sm border-b">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[240px] flex-1">
            <div className="text-xs text-muted-foreground mb-1">Search</div>
            <Input
              placeholder="Search…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
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
          {role !== 'admin' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Geographic</span>
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
              >
                {isGeographicallyFiltered ? "My Patches" : "All Areas"}
              </Toggle>
            </div>
          )}
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
          <div className="w-56">
            <TradeTypeFilter
              selectedCodes={selectedTradeCodes}
              onChange={setTradeCodes}
              label="Trade type"
            />
          </div>
          <div className="w-40">
            <div className="text-xs text-muted-foreground mb-1">Rating</div>
            <Select value={sp.get("rating") || undefined} onValueChange={(v) => setParam("rating", v || undefined)}>
              <SelectTrigger>
                <SelectValue placeholder="All ratings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={undefined}>All ratings</SelectItem>
                <SelectItem value="green">Green</SelectItem>
                <SelectItem value="amber">Amber</SelectItem>
                <SelectItem value="yellow">Yellow</SelectItem>
                <SelectItem value="red">Red</SelectItem>
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
                <SelectItem value="project_count">Number of projects</SelectItem>
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
      {tradeFilterActive && tradeCategoriesLoading && (
        <p className="text-sm text-muted-foreground">Loading trade filter…</p>
      )}

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
            onEmployerUpdated={refreshEmployers}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(filteredRows as any[]).map((emp: any) => (
            <EmployerCard
              key={emp.id}
              employer={{
                ...emp,
                enterprise_agreement_status: emp.enterprise_agreement_status,
                eba_status_source: emp.eba_status_source,
                eba_status_updated_at: emp.eba_status_updated_at,
                eba_status_notes: emp.eba_status_notes,
                ebaCategory: emp.company_eba_records?.[0] ? getEbaCategory(emp.company_eba_records[0]) : { category: 'no_fwc_match', label: 'No FWC Match', variant: 'outline' }
              }}
              onClick={() => {
                setSelectedEmployerId(emp.id)
                setIsDetailOpen(true)
              }}
              onUpdated={refreshEmployers}
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
