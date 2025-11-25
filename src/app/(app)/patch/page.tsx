"use client"
export const dynamic = "force-dynamic"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import RoleGuard from "@/components/guards/RoleGuard"
import { PatchMap } from "@/components/patch/PatchMap"
import AddressLookupDialog from "@/components/AddressLookupDialog"
import { useAccessiblePatches } from "@/hooks/useAccessiblePatches"
import { usePatchInfo } from "@/hooks/usePatchInfo"
import { useAuth } from "@/hooks/useAuth"
import { useOrganizingUniverseMetrics } from "@/hooks/useOrganizingUniverseMetrics"
import { usePatchProjects } from "@/hooks/usePatchProjects"
import { PatchProjectsFilterBar, PatchProjectFilters } from "@/components/patch/PatchProjectsFilterBar"
import { usePatchOrganiserLabels } from "@/hooks/usePatchOrganiserLabels"
import { PatchOverviewHeader } from "@/components/patch/PatchOverviewHeader"
import { PatchProjectsTable } from "@/components/patch/PatchProjectsTable"
import { PatchScansTable } from "@/components/patch/PatchScansTable"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal"
import { useIsMobile } from "@/hooks/use-mobile"
import { usePatchScans } from "@/hooks/usePatchScans"
import { useAdminPatchContext } from "@/context/AdminPatchContext"
import { GoogleAddress, AddressValidationError } from "@/components/projects/GoogleAddressInput"
import { useAddressSearch } from "@/hooks/useAddressSearch"

const DEFAULT_PAGE_SIZE = 25

export default function PatchPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { patches, role, isLoading: loadingPatches } = useAccessiblePatches()
  const [lookupOpen, setLookupOpen] = useState(false)
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null)
  const isMobile = useIsMobile()
  const adminPatchContext = useAdminPatchContext()

  const handleOpenEmployer = useCallback((employerId: string) => {
    setSelectedEmployerId(employerId)
  }, [])

  const patchParam = searchParams.get("patch") || ""
  const patchIdFromQuery = patchParam.split(",").map((value) => value.trim()).filter(Boolean)[0] || null

  const defaultPatchId = useMemo(() => {
    if (patchIdFromQuery) return patchIdFromQuery
    // For admins, check context for persisted selection
    if (role === 'admin' && adminPatchContext.selectedPatchIds && adminPatchContext.selectedPatchIds.length > 0) {
      return adminPatchContext.selectedPatchIds[0]
    }
    // For admins without context selection, don't auto-select - allow showing all patches
    if (role === 'admin') return null
    // Auto-select first patch if available (for organisers, this will be their primary patch)
    if (patches.length > 0) return patches[0].id
    return null
  }, [patchIdFromQuery, patches, role, adminPatchContext.selectedPatchIds])

  const selectedPatchId = defaultPatchId

  const q = searchParams.get("q") || ""
  const tier = (searchParams.get("tier") || "all") as PatchProjectFilters["tier"]
  const universe = (searchParams.get("universe") || "all") as PatchProjectFilters["universe"]
  const stage = (searchParams.get("stage") || "all") as PatchProjectFilters["stage"]
  const eba = (searchParams.get("eba") || "all") as PatchProjectFilters["eba"]
  const sort = (searchParams.get("sort") || "name") as PatchProjectFilters["sort"]
  const dir = (searchParams.get("dir") || "asc") as PatchProjectFilters["dir"]
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1)
  const searchMode = (searchParams.get("searchMode") || "name") as "name" | "address" | "closest"
  const addressLat = searchParams.get("addressLat") ? parseFloat(searchParams.get("addressLat")!) : null
  const addressLng = searchParams.get("addressLng") ? parseFloat(searchParams.get("addressLng")!) : null
  const addressQuery = searchParams.get("addressQuery") || ""

  const setParams = useCallback(
    (changes: Record<string, string | null | undefined>, { resetPage = true } = {}) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(changes).forEach(([key, value]) => {
        if (!value || value === "all" || value === "") {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      })
      if (resetPage) {
        params.delete("page")
      }
      const next = params.toString()
      router.replace(next ? `${pathname}?${next}` : pathname)
    },
    [pathname, router, searchParams]
  )

  // Auto-select patch when appropriate
  useEffect(() => {
    // For admins: check if context has patches, if so, apply them to URL if URL doesn't have any
    if (role === 'admin' && adminPatchContext.isInitialized) {
      const currentPatchParam = searchParams.get("patch")
      
      // If context has patches but URL doesn't, restore from context
      if (!currentPatchParam && adminPatchContext.selectedPatchIds && adminPatchContext.selectedPatchIds.length > 0) {
        setParams({ patch: adminPatchContext.selectedPatchIds[0] }, { resetPage: false })
      }
      return
    }

    // For non-admins: auto-select patch as before
    if (loadingPatches || role === 'admin') return
    
    const currentPatchParam = searchParams.get("patch")
    if (!currentPatchParam && patches.length > 0) {
      setParams({ patch: patches[0].id }, { resetPage: false })
    }
  }, [loadingPatches, role, patches, searchParams, setParams, adminPatchContext.isInitialized, adminPatchContext.selectedPatchIds])

  // Get organiser names for all patches
  const patchIds = useMemo(() => patches.map(p => p.id), [patches])
  const { byPatchId: organiserNamesByPatch } = usePatchOrganiserLabels(patchIds)

  const patchOptions = useMemo(
    () => patches.map((patch) => {
      const organiserNames = organiserNamesByPatch[patch.id] || []
      const organiserText = organiserNames.length > 0 ? ` (${organiserNames.join(", ")})` : ""
      return { 
        value: patch.id, 
        label: `${patch.name}${organiserText}` 
      }
    }),
    [patches, organiserNamesByPatch]
  )

  const filters: PatchProjectFilters = {
    patchId: selectedPatchId,
    q,
    tier,
    universe,
    stage,
    eba,
    sort,
    dir,
    searchMode: (searchMode === "address" || searchMode === "closest") ? searchMode : undefined
  }

  // Address search query (for finding nearby projects)
  const addressSearchQuery = useAddressSearch({
    lat: addressLat,
    lng: addressLng,
    address: addressQuery,
    enabled: (searchMode === "address" || searchMode === "closest") && addressLat !== null && addressLng !== null,
    maxResults: 20,
    maxDistanceKm: 100
  })

  const disablePatchSelect = patchOptions.length <= 1

  const { data: patchInfo } = usePatchInfo(selectedPatchId ?? undefined)

  const metricsQuery = useOrganizingUniverseMetrics({
    patchIds: selectedPatchId ? [selectedPatchId] : [],
    tier: tier !== "all" ? tier : undefined,
    stage: stage !== "all" ? stage : undefined,
    universe: universe !== "all" ? universe : undefined,
    eba: eba !== "all" ? eba : undefined,
    userId: user?.id,
    userRole: role || undefined
  })

  const projectsQuery = usePatchProjects({
    patchId: selectedPatchId,
    q,
    tier,
    universe,
    stage,
    eba,
    sort,
    dir,
    page,
    pageSize: DEFAULT_PAGE_SIZE
  })

  const handleFiltersChange = (changes: Partial<PatchProjectFilters>) => {
    const updated: Record<string, string | null> = {}

    if (changes.patchId !== undefined) {
      updated.patch = changes.patchId
    }
    if (changes.q !== undefined) updated.q = changes.q
    if (changes.tier !== undefined) updated.tier = changes.tier
    if (changes.universe !== undefined) updated.universe = changes.universe
    if (changes.stage !== undefined) updated.stage = changes.stage
    if (changes.eba !== undefined) updated.eba = changes.eba
    if (changes.sort !== undefined) updated.sort = changes.sort
    if (changes.dir !== undefined) updated.dir = changes.dir
    if (changes.searchMode !== undefined) {
      if (changes.searchMode === "address") {
        updated.searchMode = "address"
      } else if (changes.searchMode === "closest") {
        updated.searchMode = "closest"
        // For closest mode, we expect lat/lng to be provided
        if (changes.addressLat && changes.addressLng) {
          updated.addressLat = changes.addressLat
          updated.addressLng = changes.addressLng
        }
        if (changes.addressQuery) {
          updated.addressQuery = changes.addressQuery
        }
      } else {
        updated.searchMode = null
        // Clear address params when switching to name mode
        updated.addressLat = null
        updated.addressLng = null
        updated.addressQuery = null
      }
    }

    setParams(updated)
  }

  // Handle address selection from GoogleAddressInput
  const handleAddressSelect = useCallback((address: GoogleAddress, error?: AddressValidationError | null) => {
    if (address.lat && address.lng) {
      setParams({
        searchMode: "address",
        addressLat: address.lat.toString(),
        addressLng: address.lng.toString(),
        addressQuery: address.formatted,
        q: null // Clear name search when using address search
      })
    } else {
      // User is typing a new address, clear previous search results
      setParams({
        addressLat: null,
        addressLng: null,
        addressQuery: null,
        searchMode: searchMode === "address" ? "address" : null
      })
    }
  }, [setParams, searchMode])

  const handleClearFilters = () => {
    const next: Record<string, string | null> = {
      patch: selectedPatchId,
      q: null,
      tier: null,
      universe: null,
      stage: null,
      eba: null,
      sort: "name",
      dir: "asc",
      searchMode: null,
      addressLat: null,
      addressLng: null,
      addressQuery: null
    }
    setParams(next)
  }

  const handleProjectAction = (
    action: "visit-sheet" | "worker-list" | "employer-compliance",
    _projectId: string,
    jobSiteId?: string | null
  ) => {
    if (!jobSiteId) return
    switch (action) {
      case "visit-sheet":
        window.open(`/site-visits/new?siteId=${jobSiteId}`, "_blank")
        break
      case "worker-list":
        window.location.href = `/workers?siteId=${jobSiteId}`
        break
      case "employer-compliance":
        window.location.href = `/employers?siteId=${jobSiteId}&view=compliance`
        break
    }
  }

  const goToWalls = () => {
    if (selectedPatchId) {
      router.push(`/patch/walls?patch=${selectedPatchId}`)
    } else {
      router.push("/patch/walls")
    }
  }

  const pagination = projectsQuery.pagination
  const projects = projectsQuery.projects || []
  const summaries = projectsQuery.summaries || {}
  const isLoadingProjects = projectsQuery.isLoading || projectsQuery.isFetching

  const scansQuery = usePatchScans(selectedPatchId)
  const scans = scansQuery.data || []
  const isLoadingScans = scansQuery.isLoading || scansQuery.isFetching

  return (
    <RoleGuard allow={["organiser", "lead_organiser", "admin"]}>
      <div className={`space-y-4 sm:space-y-6 ${isMobile ? 'px-safe py-4 pb-safe-bottom' : 'p-6'}`}>
        {selectedPatchId && (
          <PatchOverviewHeader
            patchName={patchInfo?.name || "Patch"}
            organiserNames={patchInfo?.organiserNames || []}
            status={patchInfo?.status}
            type={patchInfo?.type}
            metrics={metricsQuery.data || undefined}
            isMetricsLoading={metricsQuery.isLoading}
            totalProjects={metricsQuery.data?.totalActiveProjects}
            onOpenAddressLookup={() => setLookupOpen(true)}
            onOpenWalls={goToWalls}
            hideActions={true}
          />
        )}

        <PatchProjectsFilterBar
          patchOptions={patchOptions}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onClear={handleClearFilters}
          disablePatchSelect={disablePatchSelect}
          onAddressSelect={handleAddressSelect}
        />

        {loadingPatches && (
          <Card className="p-4 sm:p-6 text-center text-sm text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading patches…
            </div>
          </Card>
        )}

        {!loadingPatches && !selectedPatchId && (
          <Card className="p-4 sm:p-6 text-center text-sm text-muted-foreground">
            Select a patch to view its overview.
          </Card>
        )}

        {selectedPatchId && (
          <>

            <PatchMap patchId={selectedPatchId} height={isMobile ? "300px" : "420px"} />

            {/* Scanned Mapping Sheets Section */}
            <PatchScansTable scans={scans} isLoading={isLoadingScans} />

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-lg sm:text-xl font-semibold">Projects in patch</h2>
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm text-muted-foreground">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => setParams({ page: String(pagination.page - 1) }, { resetPage: false })}
                      className="min-h-[44px]"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!projectsQuery.hasNext}
                      onClick={() => setParams({ page: String(pagination.page + 1) }, { resetPage: false })}
                      className="min-h-[44px]"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>

              {isLoadingProjects ? (
                <Card className="p-4 sm:p-6 text-center text-sm text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading projects…
                  </div>
                </Card>
              ) : (
                <PatchProjectsTable
                  projects={projects}
                  summaries={summaries}
                  onAction={handleProjectAction}
                  onOpenEmployer={handleOpenEmployer}
                />
              )}
            </div>
          </>
        )}
      </div>
      <AddressLookupDialog open={lookupOpen} onOpenChange={setLookupOpen} />
      <EmployerDetailModal
        employerId={selectedEmployerId}
        isOpen={!!selectedEmployerId}
        onClose={() => setSelectedEmployerId(null)}
      />
    </RoleGuard>
  )
}
