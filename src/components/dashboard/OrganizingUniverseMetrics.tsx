"use client"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, Users, Building, Award, Shield } from "lucide-react"
import { OrganizingUniverseMetrics } from "@/hooks/useOrganizingUniverseMetrics"

interface OrganizingUniverseMetricsProps {
  metrics: OrganizingUniverseMetrics
  variant?: "default" | "compact"
  onClick?: () => void
}

/**
 * Component to display the 5 key organizing universe percentage calculations
 * Matches the project card styling and EBA percentage bars
 */
export function OrganizingUniverseMetricsComponent({ 
  metrics, 
  variant = "default", 
  onClick 
}: OrganizingUniverseMetricsProps) {
  
  const MetricBar = ({ 
    label, 
    percentage, 
    count, 
    total, 
    color = "59,130,246", // Blue default
    icon: Icon 
  }: {
    label: string
    percentage: number
    count: number
    total: number
    color?: string
    icon: any
  }) => {
    const isCompact = variant === "compact"
    
    return (
      <div 
        className={`${
          onClick ? 'cursor-pointer hover:bg-gray-50' : ''
        } transition-colors rounded-lg border border-gray-200 ${
          isCompact ? 'p-2' : 'p-3'
        }`}
        onClick={onClick}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Icon className={`${isCompact ? 'h-3 w-3' : 'h-4 w-4'} text-gray-600`} />
            <span className={`${isCompact ? 'text-xs' : 'text-sm'} font-medium text-gray-700`}>
              {label}
            </span>
          </div>
          <Badge variant="secondary" className={`${isCompact ? 'text-[10px]' : 'text-xs'}`}>
            {percentage}%
          </Badge>
        </div>
        
        <div className="space-y-1">
          <Progress value={percentage} className={`${isCompact ? 'h-1.5' : 'h-2'}`} />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{count} of {total}</span>
            <span>{percentage}%</span>
          </div>
        </div>
      </div>
    )
  }

  const CompactStatBar = ({ 
    label, 
    value, 
    of, 
    color = "59,130,246",
    onClick: onBarClick 
  }: {
    label: string
    value: number
    of: number
    color?: string
    onClick?: () => void
  }) => {
    const percentage = of > 0 ? Math.round((value / of) * 100) : 0
    
    return (
      <div 
        className={`flex items-center justify-between py-1 px-2 rounded border border-gray-200 ${
          onBarClick ? 'cursor-pointer hover:bg-gray-50' : ''
        }`}
        onClick={onBarClick}
      >
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-600 truncate">{label}</div>
          <div 
            className="h-2 rounded-full bg-gray-200 mt-1"
            style={{ 
              background: `linear-gradient(to right, rgba(${color}, 1) ${percentage}%, #e5e7eb ${percentage}%)` 
            }}
          />
        </div>
        <div className="ml-2 text-xs font-medium text-gray-700">
          {value}/{of}
        </div>
      </div>
    )
  }

  if (variant === "compact") {
    return (
      <div className="space-y-2">
        <CompactStatBar
          label="EBA Projects"
          value={metrics.ebaProjectsCount}
          of={metrics.totalActiveProjects}
          color="34,197,94" // Green
          onClick={onClick}
        />
        <CompactStatBar
          label="Known Builders"
          value={metrics.knownBuilderCount}
          of={metrics.totalActiveProjects}
          color="59,130,246" // Blue
          onClick={onClick}
        />
        <CompactStatBar
          label="Key Contractor Coverage"
          value={metrics.mappedKeyContractors}
          of={metrics.totalKeyContractorSlots}
          color="168,85,247" // Purple
          onClick={onClick}
        />
        <CompactStatBar
          label="Key Contractors EBA"
          value={metrics.keyContractorsWithEba}
          of={metrics.totalMappedKeyContractors}
          color="34,197,94" // Green
          onClick={onClick}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <MetricBar
        label="EBA Projects"
        percentage={metrics.ebaProjectsPercentage}
        count={metrics.ebaProjectsCount}
        total={metrics.totalActiveProjects}
        color="34,197,94"
        icon={Award}
      />
      
      <MetricBar
        label="Known Builders"
        percentage={metrics.knownBuilderPercentage}
        count={metrics.knownBuilderCount}
        total={metrics.totalActiveProjects}
        color="59,130,246"
        icon={Building}
      />
      
      <MetricBar
        label="Key Contractor Coverage"
        percentage={metrics.keyContractorCoveragePercentage}
        count={metrics.mappedKeyContractors}
        total={metrics.totalKeyContractorSlots}
        color="168,85,247"
        icon={Users}
      />
      
      {metrics.totalKeyContractorsOnEbaBuilderProjects > 0 && (
        <MetricBar
          label="Key Contractors on EBA Builder Projects"
          percentage={metrics.keyContractorEbaBuilderPercentage}
          count={metrics.keyContractorsOnEbaBuilderProjects}
          total={metrics.totalKeyContractorsOnEbaBuilderProjects}
          color="249,115,22"
          icon={Shield}
        />
      )}
      
      <MetricBar
        label="Key Contractors with EBA"
        percentage={metrics.keyContractorEbaPercentage}
        count={metrics.keyContractorsWithEba}
        total={metrics.totalMappedKeyContractors}
        color="34,197,94"
        icon={TrendingUp}
      />
    </div>
  )
}
