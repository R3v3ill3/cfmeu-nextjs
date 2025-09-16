"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { MultiSeriesGauge } from "@/components/charts/MultiSeriesGauge"
import { useOrganizingUniverseMetrics } from "@/hooks/useOrganizingUniverseMetrics"
import type { OrganizingUniverseMetrics } from "@/hooks/useOrganizingUniverseMetrics"
import { useOrganizingUniverseMetricsServerSideCompatible } from "@/hooks/useOrganizingUniverseMetricsServerSide"
import { 
  Building, 
  Users, 
  FileText, 
  Shield, 
  Award,
  TrendingUp,
  CheckCircle,
  AlertTriangle
} from "lucide-react"
import { ActiveConstructionMetrics } from "@/hooks/useNewDashboardData"
import { useSearchParams } from "next/navigation"
import { useKeyContractorTradeMetrics } from "@/hooks/useKeyContractorTradeMetrics"

interface ActiveConstructionMetricsProps {
  data: ActiveConstructionMetrics;
  isLoading?: boolean;
}

export function ActiveConstructionMetricsComponent({ data, isLoading }: ActiveConstructionMetricsProps) {
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

  const { data: tradeMetrics } = useKeyContractorTradeMetrics({ patchIds, tier, stage, universe })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
          <CardHeader>
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-20 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const MetricCard = ({ 
    icon: Icon, 
    label, 
    value, 
    total, 
    percentage, 
    color = "blue",
    description 
  }: {
    icon: any;
    label: string;
    value: number | string;
    total?: number;
    percentage?: number;
    color?: "blue" | "green" | "orange" | "red" | "purple";
    description?: string;
  }) => {
    const colorClasses = {
      blue: "text-blue-600 bg-blue-50 border-blue-200",
      green: "text-green-600 bg-green-50 border-green-200",
      orange: "text-orange-600 bg-orange-50 border-orange-200",
      red: "text-red-600 bg-red-50 border-red-200",
      purple: "text-purple-600 bg-purple-50 border-purple-200"
    };

    return (
      <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
        <div className="flex items-center space-x-2 mb-2">
          <Icon className="h-4 w-4" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="space-y-1">
          <div className="flex items-baseline space-x-1">
            <span className="text-2xl font-bold">{value}</span>
            {total !== undefined && (
              <span className="text-sm text-gray-600">/ {total}</span>
            )}
          </div>
          {percentage !== undefined && (
            <div className="space-y-1">
              <Progress value={percentage} className="h-2" />
              <span className="text-xs text-gray-600">{percentage}%</span>
            </div>
          )}
          {description && (
            <p className="text-xs text-gray-500">{description}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Building className="h-5 w-5 text-green-600" />
              <div>
                <CardTitle className="text-green-800">Active Construction Projects</CardTitle>
                <CardDescription>
                  Metrics for {data.total_projects} projects in active construction phase
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="border-green-200 text-green-700">
              <TrendingUp className="h-3 w-3 mr-1" />
              Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table variant="desktop">
            <TableHeader variant="desktop">
              <TableRow variant="desktop">
                <TableHead variant="desktop">Metric</TableHead>
                <TableHead variant="desktop">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody variant="desktop">
              <TableRow variant="desktop">
                <TableCell variant="desktop" className="font-medium">Total projects</TableCell>
                <TableCell variant="desktop">{data.total_projects}</TableCell>
              </TableRow>
              <TableRow variant="desktop">
                <TableCell variant="desktop" className="font-medium">Avg workers / project</TableCell>
                <TableCell variant="desktop">{data.avg_assigned_workers}</TableCell>
              </TableRow>
              <TableRow variant="desktop">
                <TableCell variant="desktop" className="font-medium">Avg members / project</TableCell>
                <TableCell variant="desktop">{data.avg_members}</TableCell>
              </TableRow>
            </TableBody>
          </Table>

          {((data.avg_assigned_workers || 0) > 0 || (data.avg_members || 0) > 0) ? (
            <ChartContainer
              config={{
                value: { label: "Value", color: "hsl(var(--chart-1, 221 83% 53%))" },
              }}
            >
              <BarChart data={[
                { metric: "Avg workers", value: data.avg_assigned_workers },
                { metric: "Avg members", value: data.avg_members },
              ]}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="metric" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={[4,4,0,0]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="text-sm text-muted-foreground">No chart data to display.</div>
          )}
        </CardContent>
      </Card>

      {/* EBA Coverage */}
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle>EBA Coverage</CardTitle>
              <CardDescription>Enterprise Bargaining Agreement coverage across employers</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Builders on Active Construction</h4>
              {ouMetrics ? (
                <MultiSeriesGauge
                  series={[
                    { label: "Known builders", value: ouMetrics.knownBuilderCount, max: Math.max(ouMetrics.totalActiveProjects, 1), color: "hsl(142 71% 45%)" },
                    { label: "Builders with EBA", value: ouMetrics.ebaProjectsCount, max: Math.max(ouMetrics.totalActiveProjects, 1), color: "hsl(221 83% 53%)" },
                  ]}
                  height={220}
                />
              ) : (
                <div className="h-[220px] bg-gray-50 border border-gray-200 rounded" />
              )}
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Key Contractor Coverage</h4>
              {ouMetrics ? (
                <MultiSeriesGauge
                  series={[
                    { label: "Known key contractors", value: ouMetrics.mappedKeyContractors, max: Math.max(ouMetrics.totalKeyContractorSlots, 1), color: "hsl(142 71% 45%)" },
                    { label: "Key contractors with EBA", value: ouMetrics.keyContractorsWithEba, max: Math.max(ouMetrics.totalKeyContractorSlots, 1), color: "hsl(221 83% 53%)" },
                  ]}
                  height={220}
                />
              ) : (
                <div className="h-[220px] bg-gray-50 border border-gray-200 rounded" />
              )}
            </div>
          </div>
          {/* Additional: Key contractors on EBA builder projects */}
          <div className="mt-6">
            <h4 className="font-medium text-gray-900 mb-3">Key Contractors on EBA Builder Projects</h4>
            {ouMetrics && ouMetrics.totalKeyContractorsOnEbaBuilderProjects > 0 ? (
              <MultiSeriesGauge
                series={[
                  { label: "Known key contractors (EBA builder)", value: ouMetrics.totalKeyContractorsOnEbaBuilderProjects, max: Math.max(ouMetrics.totalKeyContractorsOnEbaBuilderProjects, 1), color: "hsl(142 71% 45%)" },
                  { label: "Key contractors with EBA (EBA builder)", value: ouMetrics.keyContractorsOnEbaBuilderProjects, max: Math.max(ouMetrics.totalKeyContractorsOnEbaBuilderProjects, 1), color: "hsl(221 83% 53%)" },
                ]}
                height={200}
              />
            ) : (
              <div className="text-sm text-muted-foreground">No projects with EBA builders yet.</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Core CFMEU Trades (Key Contractors) */}
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Award className="h-5 w-5 text-orange-600" />
            <div>
              <CardTitle>Key Contractor Trades</CardTitle>
              <CardDescription>Totals by trade: projects, known employers, EBA employers</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Grouped bar chart per trade */}
            {tradeMetrics && tradeMetrics.trades.length > 0 ? (
              <ChartContainer
                config={{
                  projects: { label: 'Total projects', color: 'hsl(215 16% 47%)' },
                  known: { label: 'Known employers', color: 'hsl(142 71% 45%)' },
                  eba: { label: 'EBA employers', color: 'hsl(221 83% 53%)' },
                }}
              >
                <BarChart data={tradeMetrics.trades.map(t => ({
                  trade: t.label,
                  projects: t.totalProjects,
                  known: t.knownEmployers,
                  eba: t.ebaEmployers,
                }))}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="trade" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="projects" fill="var(--color-projects)" radius={[4,4,0,0]} />
                  <Bar dataKey="known" fill="var(--color-known)" radius={[4,4,0,0]} />
                  <Bar dataKey="eba" fill="var(--color-eba)" radius={[4,4,0,0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="text-sm text-muted-foreground">No trade metrics available for current filters.</div>
            )}

            {/* Summary table */}
            <Table variant="desktop">
              <TableHeader variant="desktop">
                <TableRow variant="desktop">
                  <TableHead variant="desktop">Trade</TableHead>
                  <TableHead variant="desktop">Total projects</TableHead>
                  <TableHead variant="desktop">Known employers</TableHead>
                  <TableHead variant="desktop">EBA employers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody variant="desktop">
                {(tradeMetrics?.trades || []).map(t => (
                  <TableRow key={t.code} variant="desktop">
                    <TableCell variant="desktop" className="font-medium">{t.label}</TableCell>
                    <TableCell variant="desktop">{t.totalProjects}</TableCell>
                    <TableCell variant="desktop">{t.knownEmployers}</TableCell>
                    <TableCell variant="desktop">{t.ebaEmployers}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delegate & Safety Metrics */}
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-purple-600" />
            <div>
              <CardTitle>Delegates & Safety Representatives</CardTitle>
              <CardDescription>Union representation and safety leadership</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={Users}
              label="Site Delegates"
              value={data.projects_with_site_delegates}
              total={data.total_projects}
              percentage={data.total_projects > 0 ? Math.round((data.projects_with_site_delegates / data.total_projects) * 100) : 0}
              color="blue"
              description="Projects with site delegates"
            />
            <MetricCard
              icon={Building}
              label="Company Delegates"
              value={data.projects_with_company_delegates}
              total={data.total_projects}
              percentage={data.total_projects > 0 ? Math.round((data.projects_with_company_delegates / data.total_projects) * 100) : 0}
              color="green"
              description="Employers with company delegates"
            />
            <MetricCard
              icon={Shield}
              label="HSRs"
              value={data.projects_with_hsrs}
              total={data.total_projects}
              percentage={data.total_projects > 0 ? Math.round((data.projects_with_hsrs / data.total_projects) * 100) : 0}
              color="purple"
              description="Projects with HSRs"
            />
            <MetricCard
              icon={Award}
              label="HSR Chair = Delegate"
              value={data.projects_with_hsr_chair_delegate}
              total={data.total_projects}
              percentage={data.total_projects > 0 ? Math.round((data.projects_with_hsr_chair_delegate / data.total_projects) * 100) : 0}
              color="orange"
              description="HSR chairs who are delegates"
            />
          </div>
        </CardContent>
      </Card>

      {/* Health & Safety Committee */}
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <CardTitle>Health & Safety Committees</CardTitle>
              <CardDescription>Projects with "full" H&S committees (HSR count ≥ goal)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MetricCard
              icon={CheckCircle}
              label="Full Committees"
              value={data.projects_with_full_hs_committee}
              total={data.total_projects}
              percentage={data.total_projects > 0 ? Math.round((data.projects_with_full_hs_committee / data.total_projects) * 100) : 0}
              color="green"
              description="Projects meeting H&S committee goals"
            />
            <MetricCard
              icon={FileText}
              label="Financial Audits"
              value={data.financial_audit_activities}
              color="blue"
              description="Financial Standing List audits completed"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
