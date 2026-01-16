"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { CoordinatorKey, OrganiserKey, StagingData } from "@/components/admin/allocations/staging/AllocationStagingBoard"

interface PatchCoveragePreviewProps {
  stagingData: StagingData | null
  organiserTargets: Record<OrganiserKey, CoordinatorKey | null>
  patchTargets: Record<string, CoordinatorKey | null>
}

const buildCoverageMap = (data: StagingData, organiserTargets: Record<OrganiserKey, CoordinatorKey | null>) => {
  const coverage = new Map<CoordinatorKey, Set<string>>()

  const addPatch = (coordinatorKey: CoordinatorKey | null | undefined, patchId: string) => {
    if (!coordinatorKey) return
    const set = coverage.get(coordinatorKey) || new Set<string>()
    set.add(patchId)
    coverage.set(coordinatorKey, set)
  }

  Object.entries(data.leadPatchAssignments).forEach(([key, patches]) => {
    patches.forEach(patchId => addPatch(key as CoordinatorKey, patchId))
  })

  Object.entries(data.organiserAssignments).forEach(([organiserKey, patchIds]) => {
    const target = organiserTargets[organiserKey as OrganiserKey] || data.organiserCoordinatorMap[organiserKey as OrganiserKey]
    patchIds.forEach(patchId => addPatch(target, patchId))
  })

  return coverage
}

export function PatchCoveragePreview({ stagingData, organiserTargets, patchTargets }: PatchCoveragePreviewProps) {
  const { currentCoverage, proposedCoverage, warnings } = useMemo(() => {
    if (!stagingData) {
      return {
        currentCoverage: new Map<CoordinatorKey, Set<string>>(),
        proposedCoverage: new Map<CoordinatorKey, Set<string>>(),
        warnings: [] as string[]
      }
    }

    const baseCoverage = buildCoverageMap(stagingData, stagingData.organiserCoordinatorMap)
    const proposed = buildCoverageMap(stagingData, organiserTargets)
    const warningList: string[] = []

    Object.entries(patchTargets).forEach(([patchId, targetKey]) => {
      if (!targetKey) return
      baseCoverage.forEach(set => set.delete(patchId))
      proposed.forEach(set => set.delete(patchId))
      const targetSet = proposed.get(targetKey) || new Set<string>()
      targetSet.add(patchId)
      proposed.set(targetKey, targetSet)
      warningList.push("Patch moves override organiser coverage; confirm organiser links match the target coordinator.")
    })

    return { currentCoverage: baseCoverage, proposedCoverage: proposed, warnings: Array.from(new Set(warningList)) }
  }, [organiserTargets, patchTargets, stagingData])

  const rows = useMemo(() => {
    if (!stagingData) return []
    return stagingData.coordinators.map(coordinator => {
      const currentCount = currentCoverage.get(coordinator.key)?.size || 0
      const proposedCount = proposedCoverage.get(coordinator.key)?.size || 0
      return { coordinator, currentCount, proposedCount }
    })
  }, [currentCoverage, proposedCoverage, stagingData])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Patch coverage preview</CardTitle>
        <CardDescription>Compare current and proposed patch coverage for each coordinator.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-md border px-4 py-3">
            <div className="text-xs uppercase text-muted-foreground">Current patch coverage</div>
            <div className="mt-2 space-y-1">
              {rows.map(row => (
                <div key={`current-${row.coordinator.key}`} className="flex items-center justify-between text-sm">
                  <span>{row.coordinator.label}</span>
                  <Badge variant="secondary">{row.currentCount}</Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-md border px-4 py-3">
            <div className="text-xs uppercase text-muted-foreground">Proposed patch coverage</div>
            <div className="mt-2 space-y-1">
              {rows.map(row => (
                <div key={`proposed-${row.coordinator.key}`} className="flex items-center justify-between text-sm">
                  <span>{row.coordinator.label}</span>
                  <Badge variant={row.proposedCount === row.currentCount ? "secondary" : "default"}>
                    {row.proposedCount}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {warnings.map(warning => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default PatchCoveragePreview
