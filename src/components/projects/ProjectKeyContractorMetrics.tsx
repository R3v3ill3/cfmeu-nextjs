"use client"

import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { TrafficLightStackedBar } from "./TrafficLightStackedBar"

interface ProjectKeyContractorMetricProps {
  label: string
  numerator: number
  denominator: number
  targetPercentage?: number | null
  indicatorClassName?: string
  onClick?: () => void
}

function ProjectKeyContractorMetric({
  label,
  numerator,
  denominator,
  targetPercentage,
  indicatorClassName,
  onClick
}: ProjectKeyContractorMetricProps) {
  const currentPct = denominator > 0 ? Math.round((numerator / denominator) * 100) : 0
  const targetPct = targetPercentage ?? null

  const Component = onClick ? 'button' : 'div'
  const props = onClick ? { onClick, type: 'button' as const } : {}

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <Badge variant={targetPct !== null && currentPct >= targetPct ? "default" : "secondary"} className="text-xs">
          {currentPct}%
        </Badge>
      </div>
      
      {/* Progress bar with optional target marker */}
      <Component
        {...props}
        className={cn(
          "relative w-full",
          onClick && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        )}
      >
        <Progress 
          value={currentPct} 
          className="h-4 sm:h-5 rounded-md border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-slate-800"
          indicatorClassName={cn("bg-primary", indicatorClassName)}
        />
        {/* Target band indicator - only show if target is defined */}
        {targetPct !== null && targetPct > 0 && (
          <div 
            className="absolute inset-y-0 border-l-2 border-dashed border-blue-500 opacity-60 pointer-events-none"
            style={{ left: `${targetPct}%` }}
            title={`Target: ${targetPct}%`}
          />
        )}
      </Component>

      <div className="flex justify-between text-xs text-gray-600">
        <span>{numerator} / {denominator}</span>
        {targetPct !== null ? (
          <span>Target: {targetPct}%</span>
        ) : (
          <span className="text-gray-400">No target</span>
        )}
      </div>
    </div>
  )
}

interface ProjectKeyContractorMetricsProps {
  // Key contractor identification
  identifiedCount: number
  totalSlots: number
  identificationTarget?: number | null
  
  // Key contractor EBA
  ebaCount: number
  ebaTarget?: number | null
  
  // Key contractors with audits
  auditsCount: number
  auditsTarget?: number | null // User-defined, always a number (default 75)
  
  // Traffic light ratings
  trafficLightRatings: {
    red: number
    amber: number
    yellow: number
    green: number
  }
  
  // Click handlers
  onIdentificationClick?: () => void
  onEbaClick?: () => void
  onAuditsClick?: () => void
  onTrafficLightClick?: () => void
}

export function ProjectKeyContractorMetrics({
  identifiedCount,
  totalSlots,
  identificationTarget,
  ebaCount,
  ebaTarget,
  auditsCount,
  auditsTarget,
  trafficLightRatings,
  onIdentificationClick,
  onEbaClick,
  onAuditsClick,
  onTrafficLightClick
}: ProjectKeyContractorMetricsProps) {
  const totalRated = trafficLightRatings.red + trafficLightRatings.amber + trafficLightRatings.yellow + trafficLightRatings.green

  return (
    <div className="space-y-3">
      <ProjectKeyContractorMetric
        label="Key Contractor Identification"
        numerator={identifiedCount}
        denominator={totalSlots}
        targetPercentage={identificationTarget}
        indicatorClassName="bg-indigo-500"
        onClick={onIdentificationClick}
      />
      
      <ProjectKeyContractorMetric
        label="Key Contractor EBA Rate"
        numerator={ebaCount}
        denominator={identifiedCount || 1}
        targetPercentage={ebaTarget}
        indicatorClassName="bg-green-600"
        onClick={onEbaClick}
      />
      
      <ProjectKeyContractorMetric
        label="Key Contractors with Audits"
        numerator={auditsCount}
        denominator={identifiedCount || 1}
        targetPercentage={auditsTarget ?? undefined}
        indicatorClassName="bg-blue-600"
        onClick={onAuditsClick}
      />
      
      <TrafficLightStackedBar
        red={trafficLightRatings.red}
        amber={trafficLightRatings.amber}
        yellow={trafficLightRatings.yellow}
        green={trafficLightRatings.green}
        total={totalRated}
        onClick={onTrafficLightClick}
      />
    </div>
  )
}

