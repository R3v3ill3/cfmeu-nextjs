"use client"

import { useSearchParams } from "next/navigation"
import { useNewDashboardData } from "@/hooks/useNewDashboardData"
import { AlertTriangle } from "lucide-react"
import { ComplianceAlertsCard } from "@/components/dashboard/ComplianceAlertsCard"
import { ProjectMetricsSection } from "@/components/dashboard/ProjectMetricsSection"
import { PreConstructionMetricsComponent } from "@/components/dashboard/PreConstructionMetrics"
import { RoleBasedDashboard } from "@/components/dashboard/RoleBasedDashboard"
import { ActiveConstructionMetricsComponent } from "@/components/dashboard/ActiveConstructionMetrics"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export function MobileDashboardView() {
  const sp = useSearchParams()
  const patchParam = sp.get("patch") || ""
  const patchIds = patchParam.split(",").map(s => s.trim()).filter(Boolean)
  const { data, isLoading } = useNewDashboardData({ patchIds })

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-24 bg-gray-100 rounded-lg animate-pulse"></div>
        <div className="h-48 bg-gray-100 rounded-lg animate-pulse"></div>
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {/* Removed decorative header per request */}
      {data?.errors?.length ? (
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <p className="text-sm text-amber-700">Partial data shown.</p>
        </div>
      ) : null}

      {/* Compliance Alerts */}
      <ComplianceAlertsCard />

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
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold">Organising Universe</CardTitle>
          <p className="text-muted-foreground text-sm">Role-based project organising metrics</p>
        </CardHeader>
        <CardContent>
          <RoleBasedDashboard />
        </CardContent>
      </Card>

      {/* Pre-Construction Metrics */}
      <PreConstructionMetricsComponent 
        data={data?.active_pre_construction || {
          total_projects: 0, total_builders: 0, eba_builders: 0, eba_builder_percentage: 0,
          total_employers: 0, eba_employers: 0, eba_employer_percentage: 0,
          avg_estimated_workers: 0, avg_assigned_workers: 0, avg_members: 0
        }} 
        isLoading={isLoading} 
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
    </div>
  )
}
