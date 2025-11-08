"use client"

import { useSearchParams } from "next/navigation"
import { CoverageLadders } from "./CoverageLadders"
import { KeyContractorStackedBars } from "./KeyContractorStackedBars"
import { EbaBuilderSubset } from "./EbaBuilderSubset"
import { PatchScorecards } from "./PatchScorecards"
import { ContractorTypeHeatmap } from "./ContractorTypeHeatmap"
import { WaffleTiles } from "./WaffleTiles"
import { CoverageAssuranceScatter } from "./CoverageAssuranceScatter"
import { ProgressOverTime } from "./ProgressOverTime"
import { TrafficLightOverviewPanel } from "../TrafficLightOverviewPanel"
import { useOrganizingUniverseMetricsServerSideCompatible } from "@/hooks/useOrganizingUniverseMetricsServerSide"
import { useEffect, useMemo } from "react"

export function NewDashboardPage() {
  const sp = useSearchParams()
  const patchParam = sp.get("patch") || ""
  const patchIds = useMemo(() => {
    return patchParam.split(",").map(s => s.trim()).filter(Boolean)
  }, [patchParam])
  
  const stage = sp.get('stage') || undefined
  const universe = sp.get('universe') || undefined
  const normalizedStage = stage && stage !== 'all' ? stage : 'construction'
  const normalizedUniverse = universe && universe !== 'all' ? universe : 'active'

  // Get all projects metrics for comparison
  const { data: allProjectsMetrics } = useOrganizingUniverseMetricsServerSideCompatible({ 
    universe: normalizedUniverse, 
    stage: normalizedStage, 
    patchIds 
  })

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.info("[dashboard-new] NewDashboardPage rendered", {
        stage: normalizedStage,
        universe: normalizedUniverse,
        patchParam,
      })
    }
  }, [normalizedStage, normalizedUniverse, patchParam])

  return (
    <div
      data-testid="dashboard-new-root"
      className="space-y-4 px-4 py-4 pb-safe-bottom sm:space-y-6 sm:px-6 sm:py-6 lg:px-6 lg:py-6"
    >
      {/* Hero KPI Strip - Placeholder for now */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">Known Builders</div>
          <div className="text-2xl font-semibold">
            {allProjectsMetrics?.knownBuilderCount || 0} / {allProjectsMetrics?.totalActiveProjects || 0}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {allProjectsMetrics?.knownBuilderPercentage || 0}%
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">EBA Builders</div>
          <div className="text-2xl font-semibold">
            {allProjectsMetrics?.ebaProjectsCount || 0} / {allProjectsMetrics?.totalActiveProjects || 0}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {allProjectsMetrics?.ebaProjectsPercentage || 0}%
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">Contractors Identified</div>
          <div className="text-2xl font-semibold">
            {allProjectsMetrics?.mappedKeyContractors || 0} / {allProjectsMetrics?.totalKeyContractorSlots || 0}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {allProjectsMetrics?.keyContractorCoveragePercentage || 0}%
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">Contractors EBA</div>
          <div className="text-2xl font-semibold">
            {allProjectsMetrics?.keyContractorsWithEba || 0} / {allProjectsMetrics?.mappedKeyContractors || 0}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {allProjectsMetrics?.keyContractorEbaPercentage || 0}%
          </div>
        </div>
      </div>

      {/* Coverage Ladders */}
      <CoverageLadders patchIds={patchIds} />

      {/* Key Contractor Stacked Bars */}
      <KeyContractorStackedBars patchIds={patchIds} />

      {/* EBA-Builder Subset Comparison */}
      <EbaBuilderSubset 
        patchIds={patchIds} 
        allProjectsMetrics={allProjectsMetrics}
      />

      {/* Traffic Light Overview */}
      <TrafficLightOverviewPanel
        patchIds={patchIds}
        stage={normalizedStage}
        universe={normalizedUniverse}
      />

      {/* Patch/Coordinator Scorecards */}
      <PatchScorecards patchIds={patchIds} />

      {/* Contractor-Type Heatmap */}
      <ContractorTypeHeatmap patchIds={patchIds} />

      {/* Waffle Tiles */}
      <WaffleTiles patchIds={patchIds} />

      {/* Coverage vs Assurance Scatter */}
      <CoverageAssuranceScatter patchIds={patchIds} />

      {/* Progress Over Time */}
      <ProgressOverTime patchIds={patchIds} />
    </div>
  )
}

