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
import { useActiveFilters } from "@/hooks/useActiveFilters"
import { FilterIndicatorBadge } from "./FilterIndicatorBadge"
import type { ActiveConstructionMetrics } from "@/hooks/useNewDashboardData"
import { useSearchParams } from "next/navigation"
import { useMemo } from "react"

interface ActiveConstructionMetricsProps {
  data: ActiveConstructionMetrics;
  isLoading?: boolean;
}

export function ActiveConstructionMetricsComponent({ data, isLoading }: ActiveConstructionMetricsProps) {
  const { hasActiveFilters, activeFilters } = useActiveFilters()
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

  const tradeSummary = useMemo(() => {
    const trades = [
      { code: 'demolition', label: 'Demolition' },
      { code: 'piling', label: 'Piling' },
      { code: 'concreting', label: 'Concreting' },
      { code: 'formwork', label: 'Formwork' },
      { code: 'scaffold', label: 'Scaffold' },
      { code: 'cranes', label: 'Cranes' },
    ] as const

    return trades.map(({ code, label }) => {
      const total = data.core_trades?.[code] ?? 0
      const eba = data.core_trades_eba?.[code] ?? 0
      const nonEba = Math.max(total - eba, 0)
      const ebaPercent = total > 0 ? Math.round((eba / total) * 100) : 0

      return { code, label, total, eba, nonEba, ebaPercent }
    })
  }, [data.core_trades, data.core_trades_eba])

  const hasTradeData = tradeSummary.some((trade) => trade.total > 0)

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
                <CardTitle className="text-green-800 flex items-center gap-2">
                  Active Construction Projects
                  <FilterIndicatorBadge 
                    hasActiveFilters={hasActiveFilters} 
                    activeFilters={activeFilters}
                    variant="small"
                  />
                </CardTitle>
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

      {/* Core CFMEU Trades (Key Contractors) */}
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Award className="h-5 w-5 text-orange-600" />
            <div>
              <CardTitle>Key Contractor Trades</CardTitle>
              <CardDescription>Total employers vs EBA employers across key trades</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Compact horizontal layout - similar to ProjectMetricsSection */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Left side: Data table */}
            <div className="space-y-3">
              <Table variant="desktop">
                <TableHeader variant="desktop">
                  <TableRow variant="desktop">
                    <TableHead variant="desktop" className="py-2">Trade</TableHead>
                    <TableHead variant="desktop" className="py-2">Employers (total / EBA / non-EBA)</TableHead>
                    <TableHead variant="desktop" className="py-2">EBA %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody variant="desktop">
                  {tradeSummary.map((trade) => (
                    <TableRow key={trade.code} variant="desktop-hover">
                      <TableCell variant="desktop" className="font-medium py-2">{trade.label}</TableCell>
                      <TableCell variant="desktop" className="py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Total</span>
                          <span className="font-semibold">{trade.total}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-green-600">
                          <span>EBA</span>
                          <span className="font-semibold">{trade.eba}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-amber-600">
                          <span>Non-EBA</span>
                          <span className="font-semibold">{trade.nonEba}</span>
                        </div>
                      </TableCell>
                      <TableCell variant="desktop" className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className="h-full bg-green-500"
                              style={{ width: `${trade.ebaPercent}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-10 text-right">{trade.ebaPercent}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Right side: Compact chart */}
            <div className="flex flex-col justify-center">
              {hasTradeData ? (
                <div className="h-48 min-h-[200px] w-full min-w-[280px]">
                  <ChartContainer
                    config={{
                      total: { label: 'Total', color: 'hsl(215 16% 47%)' },
                      eba: { label: 'EBA', color: 'hsl(142 71% 45%)' },
                    }}
                    className="h-full w-full"
                  >
                    <BarChart data={tradeSummary.map(trade => ({
                      trade: trade.label,
                      total: trade.total,
                      eba: trade.eba,
                    }))}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="trade" 
                        tickLine={false} 
                        axisLine={false}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        allowDecimals={false}
                        tick={{ fontSize: 12 }}
                        width={30}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend 
                        content={<ChartLegendContent />}
                        wrapperStyle={{ fontSize: '12px' }}
                      />
                      <Bar dataKey="total" fill="var(--color-total)" radius={[2,2,0,0]} />
                      <Bar dataKey="eba" fill="var(--color-eba)" radius={[2,2,0,0]} />
                    </BarChart>
                  </ChartContainer>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8">No trade metrics available for current filters.</div>
              )}
            </div>
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
