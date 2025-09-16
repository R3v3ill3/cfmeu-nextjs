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

interface PreConstructionMetricsProps {
  data: PreConstructionMetrics;
  isLoading?: boolean;
}

export function PreConstructionMetricsComponent({ data, isLoading }: PreConstructionMetricsProps) {
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
              <CardTitle className="text-orange-800">Active Pre-Construction Projects</CardTitle>
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
      <CardContent className="space-y-6">
        {/* Overview Metrics (Table + Chart) */}
        <div className="space-y-4">
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
        </div>

        {/* EBA Coverage */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3">EBA Coverage</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Builder EBA Coverage */}
            <MetricCard
              icon={Building}
              label="Builders with EBA"
              value={data.eba_builders}
              total={data.total_builders}
              percentage={data.eba_builder_percentage}
              color="blue"
              description="Primary contractors and builders"
            />

            {/* All Employer EBA Coverage */}
            <MetricCard
              icon={Users}
              label="Employers with EBA"
              value={data.eba_employers}
              total={data.total_employers}
              percentage={data.eba_employer_percentage}
              color="green"
              description="All linked employers"
            />
          </div>
        </div>

        {/* Planning Phase Notice */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Clock className="h-5 w-5 text-orange-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-orange-800">Pre-Construction Phase</h4>
              <p className="text-sm text-orange-700 mt-1">
                These projects are in planning and preparation stages. Delegate and safety metrics 
                will be more relevant once construction begins.
              </p>
            </div>
          </div>
        </div>

        {/* Estimated vs Assigned Workers */}
        {data.avg_estimated_workers > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Workforce Planning</h4>
            <MetricCard
              icon={Users}
              label="Avg Estimated Workers"
              value={data.avg_estimated_workers}
              color="blue"
              description="Projected workforce per project"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
