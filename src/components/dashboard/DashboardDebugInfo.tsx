"use client"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { 
  ChevronDown, 
  ChevronRight, 
  Database, 
  Activity, 
  AlertTriangle,
  CheckCircle
} from "lucide-react"
import { useOrganizingUniverseMetrics } from "@/hooks/useOrganizingUniverseMetrics"
import { useNewDashboardData } from "@/hooks/useNewDashboardData"
import { useAuth } from "@/hooks/useAuth"

/**
 * Debug component to help troubleshoot dashboard data loading issues
 * Shows in development mode only
 */
export function DashboardDebugInfo() {
  const [isExpanded, setIsExpanded] = useState(false)
  const { user } = useAuth()
  
  // Test the main dashboard data hook
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useNewDashboardData()
  
  // Test the organizing universe metrics
  const { data: organizingMetrics, isLoading: metricsLoading, error: metricsError } = useOrganizingUniverseMetrics()
  
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <Card className="border-orange-200 bg-orange-50">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-orange-800 flex items-center">
              <Database className="h-4 w-4 mr-2" />
              Dashboard Debug Info (Dev Mode)
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs">
                User: {user?.id?.slice(0, 8) || 'Not logged in'}
              </Badge>
              
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Main Dashboard Data Status */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                <Activity className="h-4 w-4 mr-2" />
                Main Dashboard Data
              </h4>
              
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="flex items-center space-x-2">
                    {dashboardLoading ? (
                      <Badge variant="secondary">Loading...</Badge>
                    ) : dashboardError ? (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Error
                      </Badge>
                    ) : (
                      <Badge variant="default">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Loaded
                      </Badge>
                    )}
                    <span>Total Projects</span>
                  </div>
                  <div className="mt-1 text-lg font-bold text-gray-900">
                    {dashboardData?.project_counts?.total || 0}
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center space-x-2">
                    <span>Active Construction</span>
                  </div>
                  <div className="mt-1 text-lg font-bold text-gray-900">
                    {dashboardData?.project_counts?.active_construction || 0}
                  </div>
                </div>
              </div>

              {dashboardError && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                  Error: {dashboardError.message}
                </div>
              )}

              {dashboardData?.errors && dashboardData.errors.length > 0 && (
                <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                  Warnings: {dashboardData.errors.join(', ')}
                </div>
              )}
            </div>

            {/* Organizing Universe Metrics Status */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                <Database className="h-4 w-4 mr-2" />
                Organizing Universe Metrics
              </h4>
              
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="flex items-center space-x-2">
                    {metricsLoading ? (
                      <Badge variant="secondary">Loading...</Badge>
                    ) : metricsError ? (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Error
                      </Badge>
                    ) : (
                      <Badge variant="default">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Loaded
                      </Badge>
                    )}
                    <span>EBA Projects</span>
                  </div>
                  <div className="mt-1 text-lg font-bold text-gray-900">
                    {organizingMetrics?.ebaProjectsPercentage || 0}%
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center space-x-2">
                    <span>Known Builders</span>
                  </div>
                  <div className="mt-1 text-lg font-bold text-gray-900">
                    {organizingMetrics?.knownBuilderPercentage || 0}%
                  </div>
                </div>
              </div>

              {metricsError && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                  Metrics Error: {metricsError.message}
                </div>
              )}

              {organizingMetrics && (
                <div className="text-xs bg-gray-50 p-2 rounded font-mono">
                  <div>Total Active Projects: {organizingMetrics.totalActiveProjects}</div>
                  <div>EBA Projects: {organizingMetrics.ebaProjectsCount}</div>
                  <div>Known Builders: {organizingMetrics.knownBuilderCount}</div>
                  <div>Key Contractor Slots: {organizingMetrics.totalKeyContractorSlots}</div>
                  <div>Mapped Key Contractors: {organizingMetrics.mappedKeyContractors}</div>
                </div>
              )}
            </div>

            {/* Worker Status */}
            {dashboardData?.debug?.via && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                  <Activity className="h-4 w-4 mr-2" />
                  Worker Status
                </h4>
                <div className="text-xs bg-gray-50 p-2 rounded">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold">Data Source:</span>
                    {dashboardData.debug.via === 'worker' ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        🟢 Worker
                      </Badge>
                    ) : dashboardData.debug.via === 'worker_fallback' ? (
                      <Badge variant="default" className="bg-yellow-100 text-yellow-800">
                        🟡 Worker Fallback
                      </Badge>
                    ) : (
                      <Badge variant="default" className="bg-blue-100 text-blue-800">
                        🔵 Direct Query
                      </Badge>
                    )}
                  </div>
                  {dashboardData.debug.queryTime !== undefined && (
                    <div className="mt-1">
                      <span className="font-semibold">Query Time:</span> {dashboardData.debug.queryTime}ms
                    </div>
                  )}
                  <div className="mt-1">
                    <span className="font-semibold">Worker URL:</span> {process.env.NEXT_PUBLIC_DASHBOARD_WORKER_URL || 'Not configured'}
                  </div>
                  <div className="mt-1">
                    <span className="font-semibold">Worker Enabled:</span> {process.env.NEXT_PUBLIC_USE_WORKER_DASHBOARD === 'true' ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
            )}

            {/* Environment Info */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700">Environment Info</h4>
              <div className="text-xs bg-gray-50 p-2 rounded font-mono">
                <div>Server-side Dashboard: {process.env.NEXT_PUBLIC_USE_SERVER_SIDE_DASHBOARD || 'false'}</div>
                <div>Server-side Employers: {process.env.NEXT_PUBLIC_USE_SERVER_SIDE_EMPLOYERS || 'false'}</div>
                <div>Environment: {process.env.NODE_ENV || 'unknown'}</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex space-x-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Reload Dashboard
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  console.clear()
                  console.log('🔄 Console cleared - dashboard debug logs will appear here')
                }}
              >
                Clear Console
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
