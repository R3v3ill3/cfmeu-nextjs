"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { 
  Building, 
  Users, 
  FileText, 
  Clock,
  TrendingUp
} from "lucide-react"
import { PreConstructionMetrics } from "@/hooks/useNewDashboardData"
import { FilterIndicatorBadge } from "./FilterIndicatorBadge"
import { useActiveFilters } from "@/hooks/useActiveFilters"

interface PreConstructionMetricsProps {
  data: PreConstructionMetrics;
  isLoading?: boolean;
}

export function PreConstructionMetricsComponent({ data, isLoading }: PreConstructionMetricsProps) {
  const { hasActiveFilters, activeFilters } = useActiveFilters()
  if (isLoading) {
    return (
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader>
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
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
    <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-orange-600" />
            <div>
              <CardTitle className="text-orange-800 flex items-center gap-2">
                Active Pre-Construction Projects
                <FilterIndicatorBadge 
                  hasActiveFilters={hasActiveFilters} 
                  activeFilters={activeFilters}
                  variant="small"
                />
              </CardTitle>
              <CardDescription>
                Metrics for {data.total_projects} projects in pre-construction phase
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="border-orange-200 text-orange-700">
            <Clock className="h-3 w-3 mr-1" />
            Planning
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Compact layout with metrics and chart side by side */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Left: Quick stats */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2">
              <div className="bg-orange-50 border border-orange-200 rounded p-3">
                <div className="text-2xl font-bold text-orange-800">{data.total_projects}</div>
                <div className="text-xs text-orange-600">Total Projects</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <div className="text-xl font-bold text-blue-800">{data.avg_assigned_workers}</div>
                <div className="text-xs text-blue-600">Avg Workers/Project</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded p-3">
                <div className="text-xl font-bold text-green-800">{data.avg_members}</div>
                <div className="text-xs text-green-600">Avg Members/Project</div>
              </div>
            </div>
          </div>

          {/* Center: EBA Coverage */}
          <div>
            <h4 className="font-medium text-gray-900 mb-2 text-sm">EBA Coverage</h4>
            <div className="space-y-2">
              {/* Builder EBA Coverage - Compact */}
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-1">
                    <Building className="h-3 w-3 text-blue-600" />
                    <span className="text-xs font-medium text-blue-800">Builders</span>
                  </div>
                  <span className="text-sm font-bold text-blue-800">
                    {data.eba_builders}/{data.total_builders}
                  </span>
                </div>
                <Progress value={data.eba_builder_percentage} className="h-1.5" />
                <span className="text-xs text-blue-600">{data.eba_builder_percentage}% with EBA</span>
              </div>

              {/* All Employer EBA Coverage - Compact */}
              <div className="bg-green-50 border border-green-200 rounded p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-1">
                    <Users className="h-3 w-3 text-green-600" />
                    <span className="text-xs font-medium text-green-800">All Employers</span>
                  </div>
                  <span className="text-sm font-bold text-green-800">
                    {data.eba_employers}/{data.total_employers}
                  </span>
                </div>
                <Progress value={data.eba_employer_percentage} className="h-1.5" />
                <span className="text-xs text-green-600">{data.eba_employer_percentage}% with EBA</span>
              </div>
            </div>
          </div>

          {/* Right: Compact chart or additional info */}
          <div className="flex flex-col justify-center">
            {((data.avg_assigned_workers || 0) > 0 || (data.avg_members || 0) > 0) ? (
              <div className="h-32">
                <ChartContainer
                  config={{
                    value: { label: "Value", color: "hsl(var(--chart-1, 221 83% 53%))" },
                  }}
                  className="h-full"
                >
                  <BarChart data={[
                    { metric: "Workers", value: data.avg_assigned_workers },
                    { metric: "Members", value: data.avg_members },
                  ]}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="metric" 
                      tickLine={false} 
                      axisLine={false}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis 
                      allowDecimals={false}
                      tick={{ fontSize: 10 }}
                      width={25}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="var(--color-value)" radius={[2,2,0,0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-4">No chart data available</div>
            )}
            
            {data.avg_estimated_workers > 0 && (
              <div className="mt-2 bg-gray-50 border border-gray-200 rounded p-2">
                <div className="text-sm font-bold text-gray-800">{data.avg_estimated_workers}</div>
                <div className="text-xs text-gray-600">Projected Workers</div>
              </div>
            )}
          </div>
        </div>

        {/* Compact planning phase notice */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-orange-600" />
            <div>
              <span className="text-sm font-medium text-orange-800">Pre-Construction Phase</span>
              <span className="text-xs text-orange-700 ml-2">
                Planning stages - delegate metrics available post-construction
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
