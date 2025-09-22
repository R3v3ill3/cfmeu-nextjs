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
import { PatchOverviewHeader } from "@/components/patch/PatchOverviewHeader"
import { PatchProjectsTable } from "@/components/patch/PatchProjectsTable"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal"

const DEFAULT_PAGE_SIZE = 25

export default function PatchPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { patches, role, isLoading: loadingPatches } = useAccessiblePatches()
  const [lookupOpen, setLookupOpen] = useState(false)
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null)

  const handleOpenEmployer = useCallback((employerId: string) => {
    setSelectedEmployerId(employerId)
  }, [])

  const patchParam = searchParams.get("patch") || ""
  const patchIdFromQuery = patchParam.split(",").map((value) => value.trim()).filter(Boolean)[0] || null

  const defaultPatchId = useMemo(() => {
    if (patchIdFromQuery) return patchIdFromQuery
    if (patches.length === 1) return patches[0].id
    return null
  }, [patchIdFromQuery, patches])

  const selectedPatchId = defaultPatchId

  const q = searchParams.get("q") || ""
  const tier = (searchParams.get("tier") || "all") as PatchProjectFilters["tier"]
  const universe = (searchParams.get("universe") || "all") as PatchProjectFilters["universe"]
  const stage = (searchParams.get("stage") || "all") as PatchProjectFilters["stage"]
  const eba = (searchParams.get("eba") || "all") as PatchProjectFilters["eba"]
  const sort = (searchParams.get("sort") || "name") as PatchProjectFilters["sort"]
  const dir = (searchParams.get("dir") || "asc") as PatchProjectFilters["dir"]
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1)

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

  useEffect(() => {
    if (!patchParam && selectedPatchId) {
      setParams({ patch: selectedPatchId }, { resetPage: false })
    }
  }, [patchParam, selectedPatchId, setParams])

  const patchOptions = useMemo(
    () => patches.map((patch) => ({ value: patch.id, label: patch.name })),
    [patches]
  )

  const filters: PatchProjectFilters = {
    patchId: selectedPatchId,
    q,
    tier,
    universe,
    stage,
    eba,
    sort,
    dir
  }

  const disablePatchSelect = role === "organiser" || patchOptions.length <= 1

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

    setParams(updated)
  }

  const handleClearFilters = () => {
    const next: Record<string, string | null> = {
      patch: selectedPatchId,
      q: null,
      tier: null,
      universe: null,
      stage: null,
      eba: null,
      sort: "name",
      dir: "asc"
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

  return (
    <RoleGuard allow={["organiser", "lead_organiser", "admin"]}>
      <div className="space-y-6 p-6">
        <PatchProjectsFilterBar
          patchOptions={patchOptions}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onClear={handleClearFilters}
          disablePatchSelect={disablePatchSelect}
        />

        {loadingPatches && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading patches…
            </div>
          </Card>
        )}

        {!loadingPatches && !selectedPatchId && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Select a patch to view its overview.
          </Card>
        )}

        {selectedPatchId && (
          <>
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
            />

            <PatchMap patchId={selectedPatchId} height="420px" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Projects in patch</h2>
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => setParams({ page: String(pagination.page - 1) }, { resetPage: false })}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!projectsQuery.hasNext}
                      onClick={() => setParams({ page: String(pagination.page + 1) }, { resetPage: false })}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>

              {isLoadingProjects ? (
                <Card className="p-6 text-center text-sm text-muted-foreground">
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
