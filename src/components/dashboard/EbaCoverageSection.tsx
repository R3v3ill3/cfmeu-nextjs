"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { MultiSeriesGauge } from "@/components/charts/MultiSeriesGauge"
import { useOrganizingUniverseMetrics } from "@/hooks/useOrganizingUniverseMetrics"
import type { OrganizingUniverseMetrics } from "@/hooks/useOrganizingUniverseMetrics"
import { useOrganizingUniverseMetricsServerSideCompatible } from "@/hooks/useOrganizingUniverseMetricsServerSide"
import { FileText, Building, Users, Shield } from "lucide-react"
import { useSearchParams } from "next/navigation"

export function EbaCoverageSection() {
  const sp = useSearchParams()
  const patchParam = sp.get('patch') || ''
  const patchIds = patchParam.split(',').map(s => s.trim()).filter(Boolean)
  const tier = sp.get('tier') || undefined
  const stage = sp.get('stage') || undefined
  const universe = sp.get('universe') || undefined
  
  // Organizing universe metrics (active construction) for gauges
  const { data: clientOUMetrics } = useOrganizingUniverseMetrics({ universe: universe || 'active', stage: stage || 'construction' })
  const { data: serverOUMetrics } = useOrganizingUniverseMetricsServerSideCompatible({ universe: universe || 'active', stage: stage || 'construction', patchIds })
  const ouMetrics = (serverOUMetrics ?? clientOUMetrics) as OrganizingUniverseMetrics | undefined

  return (
    <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle className="text-lg">EBA Coverage</CardTitle>
              <CardDescription className="text-sm">Enterprise Bargaining Agreement coverage across employers</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="border-blue-200 text-blue-700">
            <Shield className="h-3 w-3 mr-1" />
            Active Sites
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Left: Builders Coverage - COMPACT GAUGES */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900 text-sm mb-2">Builders on Active Construction</h4>
            {ouMetrics ? (
              <MultiSeriesGauge
                series={[
                  { label: "Known builders", value: ouMetrics.knownBuilderCount, max: Math.max(ouMetrics.totalActiveProjects, 1), color: "hsl(142 71% 45%)" },
                  { label: "Builders with EBA", value: ouMetrics.ebaProjectsCount, max: Math.max(ouMetrics.totalActiveProjects, 1), color: "hsl(221 83% 53%)" },
                ]}
                height={140}
              />
            ) : (
              <div className="h-[140px] bg-gray-50 border border-gray-200 rounded animate-pulse" />
            )}
          </div>

          {/* Center: Key Contractor Coverage - COMPACT GAUGES */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900 text-sm mb-2">Key Contractor Coverage</h4>
            {ouMetrics ? (
              <MultiSeriesGauge
                series={[
                  { label: "Known key contractors", value: ouMetrics.mappedKeyContractors, max: Math.max(ouMetrics.totalKeyContractorSlots, 1), color: "hsl(142 71% 45%)" },
                  { label: "Key contractors with EBA", value: ouMetrics.keyContractorsWithEba, max: Math.max(ouMetrics.totalKeyContractorSlots, 1), color: "hsl(221 83% 53%)" },
                ]}
                height={140}
              />
            ) : (
              <div className="h-[140px] bg-gray-50 border border-gray-200 rounded animate-pulse" />
            )}
          </div>

          {/* Right: EBA Builder Projects Detail - COMPACT GAUGE */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900 text-sm mb-2">Key Contractors on EBA Builder Projects</h4>
            {ouMetrics && ouMetrics.totalKeyContractorsOnEbaBuilderProjects > 0 ? (
              <MultiSeriesGauge
                series={[
                  { label: "Known key contractors (EBA builder)", value: ouMetrics.totalKeyContractorsOnEbaBuilderProjects, max: Math.max(ouMetrics.totalKeyContractorsOnEbaBuilderProjects, 1), color: "hsl(142 71% 45%)" },
                  { label: "Key contractors with EBA (EBA builder)", value: ouMetrics.keyContractorsOnEbaBuilderProjects, max: Math.max(ouMetrics.totalKeyContractorsOnEbaBuilderProjects, 1), color: "hsl(221 83% 53%)" },
                ]}
                height={140}
              />
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded p-4 text-center h-[140px] flex items-center justify-center">
                <div className="text-sm text-gray-500">
                  No projects with EBA builders yet
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
