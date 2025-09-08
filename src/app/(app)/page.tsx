"use client"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Activity, AlertTriangle, CheckCircle } from "lucide-react"
import { useNewDashboardData } from "@/hooks/useNewDashboardData"
import { ProjectMetricsSection } from "@/components/dashboard/ProjectMetricsSection"
import { ActiveConstructionMetricsComponent } from "@/components/dashboard/ActiveConstructionMetrics"
import { PreConstructionMetricsComponent } from "@/components/dashboard/PreConstructionMetrics"

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  const { data, isLoading } = useNewDashboardData()

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Desktop-optimized header */}
        <div className="lg:bg-white lg:border lg:border-gray-300 lg:rounded-lg lg:p-6 lg:shadow-md">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 lg:text-4xl">Dashboard</h1>
              <p className="text-gray-700 mt-2 lg:text-lg">Union organising platform overview and analytics</p>
            </div>
            <div className="mt-4 lg:mt-0">
              <Badge variant="outline" className="text-sm px-3 py-1">
                <Activity className="h-3 w-3 mr-1" />
                Live Data
              </Badge>
            </div>
          </div>
        </div>

        {/* Loading skeleton for new dashboard */}
        <div className="space-y-6">
          <div className="h-64 bg-gray-100 rounded-lg animate-pulse"></div>
          <div className="h-96 bg-gray-100 rounded-lg animate-pulse"></div>
          <div className="h-48 bg-gray-100 rounded-lg animate-pulse"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Desktop-optimized header with enhanced visual hierarchy */}
      <div className="lg:bg-white lg:border lg:border-gray-300 lg:rounded-lg lg:p-6 lg:shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 lg:text-4xl">Dashboard</h1>
            <p className="text-gray-700 mt-2 lg:text-lg">Union organising platform overview and analytics</p>
            {data?.errors?.length ? (
              <div className="flex items-center gap-2 mt-3">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <p className="text-sm text-amber-700">Some data failed to load; showing partial results.</p>
              </div>
            ) : null}
          </div>
          <div className="mt-4 lg:mt-0 flex flex-wrap gap-2">
            <Badge variant="outline" className="text-sm px-3 py-1 border-green-200 text-green-700">
              <CheckCircle className="h-3 w-3 mr-1" />
              Live Data
            </Badge>
            <Badge variant="outline" className="text-sm px-3 py-1 border-blue-200 text-blue-700">
              <Activity className="h-3 w-3 mr-1" />
              Real-time Updates
            </Badge>
          </div>
        </div>
      </div>

      {/* Project Overview Section */}
      <ProjectMetricsSection 
        data={data?.project_counts || {
          active_construction: 0, active_pre_construction: 0, potential_construction: 0,
          potential_pre_construction: 0, potential_future: 0, potential_archived: 0,
          excluded_construction: 0, excluded_pre_construction: 0, excluded_future: 0,
          excluded_archived: 0, total: 0
        }} 
        isLoading={isLoading} 
        errors={data?.errors}
      />

      {/* Active Construction Metrics */}
      <ActiveConstructionMetricsComponent 
        data={data?.active_construction || {
          total_projects: 0, total_builders: 0, eba_builders: 0, eba_builder_percentage: 0,
          total_employers: 0, eba_employers: 0, eba_employer_percentage: 0,
          core_trades: { demolition: 0, piling: 0, concreting: 0, formwork: 0, scaffold: 0, cranes: 0 },
          projects_with_site_delegates: 0, projects_with_company_delegates: 0, projects_with_hsrs: 0,
          projects_with_hsr_chair_delegate: 0, projects_with_full_hs_committee: 0,
          avg_estimated_workers: 0, avg_assigned_workers: 0, avg_members: 0, financial_audit_activities: 0
        }} 
        isLoading={isLoading} 
      />

      {/* Active Pre-Construction Metrics */}
      <PreConstructionMetricsComponent 
        data={data?.active_pre_construction || {
          total_projects: 0, total_builders: 0, eba_builders: 0, eba_builder_percentage: 0,
          total_employers: 0, eba_employers: 0, eba_employer_percentage: 0,
          avg_estimated_workers: 0, avg_assigned_workers: 0, avg_members: 0
        }} 
        isLoading={isLoading} 
      />
    </div>
  )
}

