"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { useAllLeadOrganizerSummaries } from "@/hooks/useLeadOrganizerSummary"
import { FilterIndicatorBadge } from "@/components/dashboard/FilterIndicatorBadge"
import { useActiveFilters } from "@/hooks/useActiveFilters"
import { Crown, TrendingUp, TrendingDown, CheckCircle, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface PatchScorecardsProps {
  patchIds?: string[]
}

interface BulletMetricProps {
  label: string
  numerator: number      // Raw count (e.g., 5 known builders)
  denominator: number    // Total count (e.g., 10 total projects)
  targetPercentage: number // Target as percentage (e.g., 100 for 100% target)
  lastWeekNumerator?: number
  showTrend?: boolean
  indicatorClassName?: string
}

// Bullet chart component for a single metric
function BulletMetric({
  label,
  numerator,
  denominator,
  targetPercentage,
  lastWeekNumerator,
  showTrend = false,
  indicatorClassName,
}: BulletMetricProps) {
  // Calculate percentages for display and progress bar with comprehensive zero checks
  const currentPct = denominator > 0 ? Math.round((numerator / denominator) * 100) : 0
  const targetPct = targetPercentage || 0

  // Calculate trend using raw numbers with additional zero checks
  const trend = lastWeekNumerator !== undefined && lastWeekNumerator >= 0
    ? numerator - lastWeekNumerator
    : 0
  const trendPct = lastWeekNumerator !== undefined && lastWeekNumerator > 0 && lastWeekNumerator !== Infinity
    ? Math.round(((numerator - lastWeekNumerator) / lastWeekNumerator) * 100)
    : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <div className="flex items-center gap-2">
          {showTrend && lastWeekNumerator !== undefined && (
            <div className="flex items-center gap-1 text-xs">
              {trend > 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : trend < 0 ? (
                <TrendingDown className="h-3 w-3 text-red-600" />
              ) : null}
              <span className={trend > 0 ? "text-green-600" : trend < 0 ? "text-red-600" : "text-gray-600"}>
                {trendPct > 0 ? '+' : ''}{trendPct}%
              </span>
            </div>
          )}
          <Badge variant={currentPct >= targetPct ? "default" : "secondary"} className="text-xs">
            {currentPct}%
          </Badge>
        </div>
      </div>
      
      {/* Progress bar with target marker */}
      <div className="relative">
        <Progress 
          value={currentPct} 
          className="h-4 sm:h-5 rounded-md border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-slate-800"
          indicatorClassName={cn("bg-primary", indicatorClassName)}
        />
        {/* Target band indicator */}
        <div 
          className="absolute inset-y-0 border-l-2 border-dashed border-blue-500 opacity-60"
          style={{ left: `${targetPct}%` }}
          title={`Target: ${targetPct}%`}
        />
        {/* Last week value tick (thin line) */}
        {showTrend && lastWeekNumerator !== undefined && lastWeekNumerator >= 0 && denominator > 0 && (
          <div
            className="absolute inset-y-0 border-l border-gray-400 opacity-80"
            style={{ left: `${Math.round((lastWeekNumerator / denominator) * 100)}%` }}
            title={`Last week: ${Math.round((lastWeekNumerator / denominator) * 100)}%`}
          />
        )}
      </div>

      <div className="flex justify-between text-xs text-gray-600">
        <span>{numerator} / {denominator}</span>
        <span>Target: {targetPercentage}%</span>
      </div>
    </div>
  )
}

export function PatchScorecards({ patchIds: _patchIds = [] }: PatchScorecardsProps) {
  const { hasActiveFilters, activeFilters } = useActiveFilters()
  const { data: allLeadSummaries, isLoading, error } = useAllLeadOrganizerSummaries()

  const metricIndicatorClasses = {
    knownBuilders: "bg-blue-600",
    ebaBuilders: "bg-emerald-500",
    contractorId: "bg-indigo-500",
    contractorEba: "bg-green-600",
  }

  if (isLoading) {
    return (
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-600" />
            Patch/Coordinator Scorecards
            <FilterIndicatorBadge
              hasActiveFilters={hasActiveFilters}
              activeFilters={activeFilters}
              variant="small"
            />
          </CardTitle>
          <CardDescription>Loading coordinator data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-50 border border-gray-200 rounded animate-pulse" />
          <div className="text-center text-xs text-gray-500 mt-2">
            Fetching lead organizer summaries and metrics
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    console.error('PatchScorecards error:', error)
    return (
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-600" />
            Patch/Coordinator Scorecards
            <FilterIndicatorBadge 
              hasActiveFilters={hasActiveFilters} 
              activeFilters={activeFilters}
              variant="small"
            />
          </CardTitle>
          <CardDescription className="text-red-600">
            Error loading coordinator data: {error instanceof Error ? error.message : 'Unknown error'}
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    )
  }

  if (!allLeadSummaries || allLeadSummaries.length === 0) {
    console.log('PatchScorecards: No lead summaries found', { allLeadSummaries })
    return (
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-600" />
            Patch/Coordinator Scorecards
            <FilterIndicatorBadge 
              hasActiveFilters={hasActiveFilters} 
              activeFilters={activeFilters}
              variant="small"
            />
          </CardTitle>
          <CardDescription>
            No lead organizers/coordinators found. Lead organizers need to be assigned patches to appear here.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    )
  }

  return (
    <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-yellow-600" />
          <CardTitle className="text-lg flex items-center gap-2">
            Patch/Coordinator Scorecards
            <FilterIndicatorBadge 
              hasActiveFilters={hasActiveFilters} 
              activeFilters={activeFilters}
              variant="small"
            />
          </CardTitle>
        </div>
        <CardDescription className="text-sm">
          Four metrics per coordinator: Known builders %, EBA builders %, Contractor ID %, Contractor EBA %
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {allLeadSummaries.map((lead) => {
          const metrics = lead.aggregatedMetrics
          const totalProjects = metrics.totalActiveProjects || 0
          const knownBuilders = metrics.knownBuilderCount || 0
          const ebaBuilders = metrics.ebaProjectsCount || 0
          const totalSlots = metrics.totalKeyContractorSlots || 0
          const identified = metrics.mappedKeyContractors || 0
          const eba = metrics.keyContractorsWithEba || 0

          // Calculate percentages with comprehensive zero and valid number checks
          const knownBuilderPct = totalProjects > 0 && totalProjects !== Infinity ? Math.round((knownBuilders / totalProjects) * 100) : 0
          const ebaBuilderPct = knownBuilders > 0 && knownBuilders !== Infinity ? Math.round((ebaBuilders / knownBuilders) * 100) : 0
          const contractorIdPct = totalSlots > 0 && totalSlots !== Infinity ? Math.round((identified / totalSlots) * 100) : 0
          const contractorEbaPct = identified > 0 && identified !== Infinity ? Math.round((eba / identified) * 100) : 0

          // Targets (staged by project scale)
          const knownBuilderTarget = 100 // 100% target
          const ebaBuilderTarget = 70 // 65-75% target range, use 70% as midpoint
          const contractorIdTarget = totalProjects > 10 ? 80 : totalProjects > 5 ? 70 : 60 // Staged by scale
          const contractorEbaTarget = 75 // Staged target

          // TODO: Get historical data for trends (last week values)
          // For now, we'll omit trend indicators
          const lastWeekKnown = undefined
          const lastWeekEba = undefined
          const lastWeekId = undefined
          const lastWeekEbaContractor = undefined

          // Calculate audit completion and green ratings (placeholder - would need actual audit data)
          const auditsComplete = 0 // TODO: Calculate from actual audit data
          const greenRatings = 0 // TODO: Calculate from rating data
          const totalAudits = 0 // TODO: Get total required audits

          return (
            <div key={lead.leadOrganizerId} className="border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">{lead.leadOrganizerName}</h4>
                  <p className="text-xs text-gray-600">{lead.patchCount} patches, {totalProjects} projects</p>
                </div>
                <Badge variant="outline" className="border-yellow-200 text-yellow-700">
                  <Crown className="h-3 w-3 mr-1" />
                  Coordinator
                </Badge>
              </div>

              {/* Bullet charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <BulletMetric
                  label="Known Builders"
                  numerator={knownBuilders}
                  denominator={totalProjects}
                  targetPercentage={knownBuilderTarget}
                  lastWeekNumerator={lastWeekKnown}
                  showTrend={lastWeekKnown !== undefined}
                  indicatorClassName={metricIndicatorClasses.knownBuilders}
                />
                <BulletMetric
                  label="EBA Builders"
                  numerator={ebaBuilders}
                  denominator={knownBuilders}
                  targetPercentage={ebaBuilderTarget}
                  lastWeekNumerator={lastWeekEba}
                  showTrend={lastWeekEba !== undefined}
                  indicatorClassName={metricIndicatorClasses.ebaBuilders}
                />
                <BulletMetric
                  label="Contractor Identification"
                  numerator={identified}
                  denominator={totalSlots}
                  targetPercentage={contractorIdTarget}
                  lastWeekNumerator={lastWeekId}
                  showTrend={lastWeekId !== undefined}
                  indicatorClassName={metricIndicatorClasses.contractorId}
                />
                <BulletMetric
                  label="Contractor EBA Rate"
                  numerator={eba}
                  denominator={identified}
                  targetPercentage={contractorEbaTarget}
                  lastWeekNumerator={lastWeekEbaContractor}
                  showTrend={lastWeekEbaContractor !== undefined}
                  indicatorClassName={metricIndicatorClasses.contractorEba}
                />
              </div>

              {/* Mini chips for audits and ratings */}
              <div className="flex gap-2 pt-2 border-t">
                <Badge variant="outline" className="text-xs">
                  {auditsComplete > 0 ? (
                    <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 mr-1 text-amber-600" />
                  )}
                  Audits: {auditsComplete} / {totalAudits || 'N/A'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <span className="text-green-600 mr-1">●</span>
                  Green: {greenRatings}%
                </Badge>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
