"use client"

import { useSearchParams } from "next/navigation"
import { useNewDashboardData } from "@/hooks/useNewDashboardData"
import { AlertTriangle } from "lucide-react"
import { ComplianceAlertsCard } from "@/components/dashboard/ComplianceAlertsCard"
import { ProjectMetricsSection } from "@/components/dashboard/ProjectMetricsSection"
import { PreConstructionMetricsComponent } from "@/components/dashboard/PreConstructionMetrics"
import { DashboardDebugInfo } from "@/components/dashboard/DashboardDebugInfo"
import { RoleBasedDashboard } from "@/components/dashboard/RoleBasedDashboard"
import { ActiveConstructionMetricsComponent } from "@/components/dashboard/ActiveConstructionMetrics"
import { EbaCoverageSection } from "@/components/dashboard/EbaCoverageSection"
import { FilterIndicatorBadge } from "@/components/dashboard/FilterIndicatorBadge"
import { useActiveFilters } from "@/hooks/useActiveFilters"

export function DesktopDashboardView() {
  const sp = useSearchParams()
  const patchParam = sp.get("patch") || ""
  const patchIds = patchParam.split(",").map(s => s.trim()).filter(Boolean)
  const { data, isLoading } = useNewDashboardData({ patchIds })
  const { hasActiveFilters, activeFilters } = useActiveFilters()

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton for new dashboard */}
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse"></div>
        <div className="h-96 bg-gray-100 rounded-lg animate-pulse"></div>
        <div className="h-48 bg-gray-100 rounded-lg animate-pulse"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Removed decorative header per request */}
      {data?.errors?.length ? (
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <p className="text-sm text-amber-700">Some data failed to load; showing partial results.</p>
        </div>
      ) : null}

      {/* Compliance Alerts */}
      <ComplianceAlertsCard />

      {/* EBA Coverage - Moved to top for visibility */}
      <EbaCoverageSection />

      {/* Project Overview Section */}
      <ProjectMetricsSection
        data={data?.project_counts || {
          active_construction: 0, active_pre_construction: 0, potential_construction: 0,
          potential_pre_construction: 0, potential_future: 0, potential_archived: 0,
          excluded_construction: 0, excluded_pre_construction: 0, excluded_future: 0,
          excluded_archived: 0, total: 0
        }}
        projects={data?.projects}
        isLoading={isLoading}
        errors={data?.errors}
      />

      {/* Organising Universe Summary */}
      <div className="lg:bg-white lg:border lg:border-gray-300 lg:rounded-lg lg:shadow-md">
        <div className="lg:p-6">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-900 lg:text-3xl flex items-center gap-2">
              Organising Universe Summary
              <FilterIndicatorBadge 
                hasActiveFilters={hasActiveFilters} 
                activeFilters={activeFilters}
                variant="small"
              />
            </h2>
            <p className="text-gray-700 mt-1 lg:text-lg">Role-based project organising metrics and patch summaries</p>
          </div>
          <RoleBasedDashboard />
        </div>
      </div>

      {/* Active Pre-Construction Metrics */}
      <div className="hidden">
        <PreConstructionMetricsComponent
          data={data?.active_pre_construction || {
            total_projects: 0, total_builders: 0, eba_builders: 0, eba_builder_percentage: 0,
            total_employers: 0, eba_employers: 0, eba_employer_percentage: 0,
            avg_estimated_workers: 0, avg_assigned_workers: 0, avg_members: 0
          }}
          isLoading={isLoading}
        />
      </div>

      {/* Debug Info (Development Only) */}
      <div className="hidden">
        <DashboardDebugInfo />
      </div>

      {/* Active Construction Metrics (moved to bottom) */}
      <div className="hidden">
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
      </div>
    </div>
  )
}
