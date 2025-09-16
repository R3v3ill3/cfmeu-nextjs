"use client"
import { Badge } from "@/components/ui/badge"
import { Server, Monitor, Zap, Database } from "lucide-react"
import { useDashboardInfo } from "@/hooks/useDashboardDataServerSideCompatible"

interface DashboardFeatureFlagIndicatorProps {
  showDetails?: boolean
  className?: string
}

/**
 * Component to show which dashboard processing mode is active
 * Helps with development and monitoring
 */
export function DashboardFeatureFlagIndicator({ 
  showDetails = false, 
  className = "" 
}: DashboardFeatureFlagIndicatorProps) {
  const dashboardInfo = useDashboardInfo()

  if (!showDetails && process.env.NODE_ENV === 'production') {
    return null // Hide in production unless showDetails is explicitly true
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Badge 
        variant={dashboardInfo.useServerSide ? "default" : "secondary"}
        className={`text-xs ${
          dashboardInfo.useServerSide 
            ? "bg-green-100 text-green-800 border-green-300" 
            : "bg-blue-100 text-blue-800 border-blue-300"
        }`}
      >
        {dashboardInfo.useServerSide ? (
          <Server className="h-3 w-3 mr-1" />
        ) : (
          <Monitor className="h-3 w-3 mr-1" />
        )}
        {dashboardInfo.version}
      </Badge>

      {showDetails && (
        <>
          {dashboardInfo.useServerSide ? (
            <div className="flex items-center space-x-1 text-xs text-green-700">
              <Zap className="h-3 w-3" />
              <span>Optimized</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 text-xs text-blue-700">
              <Database className="h-3 w-3" />
              <span>Client-side</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Compact version for header display
 */
export function DashboardModeCompact() {
  const dashboardInfo = useDashboardInfo()
  
  return (
    <Badge 
      variant="outline" 
      className={`text-xs ${
        dashboardInfo.useServerSide 
          ? "border-green-200 text-green-700" 
          : "border-blue-200 text-blue-700"
      }`}
    >
      {dashboardInfo.useServerSide ? (
        <Server className="h-3 w-3 mr-1" />
      ) : (
        <Monitor className="h-3 w-3 mr-1" />
      )}
      {dashboardInfo.useServerSide ? "Server" : "Client"}
    </Badge>
  )
}
