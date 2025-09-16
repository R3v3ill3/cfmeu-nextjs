"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableCaption, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { FolderOpen, CheckCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { DashboardProjectCounts } from "@/hooks/useNewDashboardData"

interface ProjectMetricsSectionProps {
  data: DashboardProjectCounts;
  isLoading?: boolean;
  errors?: string[];
}

export function ProjectMetricsSection({ data, isLoading }: ProjectMetricsSectionProps) {
  const router = useRouter();

  const navigateToProjects = (organising_universe?: string, stage_class?: string) => {
    const params = new URLSearchParams();
    if (organising_universe) params.set('universeFilter', organising_universe);
    if (stage_class) params.set('stageFilter', stage_class);
    
    const url = `/projects${params.toString() ? `?${params.toString()}` : ''}`;
    router.push(url);
  };

  type StageKey = 'construction' | 'pre_construction' | 'future' | 'archived'
  const stages: Array<{ key: StageKey; label: string }> = [
    { key: 'construction', label: 'Construction' },
    { key: 'pre_construction', label: 'Pre-construction' },
    { key: 'future', label: 'Future' },
    { key: 'archived', label: 'Archived' }
  ]

  const getCount = (universe: 'active' | 'potential' | 'excluded', stage: StageKey): number => {
    const key = `${universe}_${stage}` as keyof DashboardProjectCounts
    return (data[key] as number) || 0
  }

  const chartData = stages.map(s => ({
    stage: s.label,
    active: getCount('active', s.key),
    potential: getCount('potential', s.key),
    excluded: getCount('excluded', s.key),
  }))

  const filteredStages = stages.filter((s) => {
    const a = getCount('active', s.key)
    const p = getCount('potential', s.key)
    const e = getCount('excluded', s.key)
    return a + p + e > 0
  })

  const filteredChartData = chartData.filter((d) => (d.active + d.potential + d.excluded) > 0)

  if (isLoading) {
    return (
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <FolderOpen className="h-5 w-5 text-blue-600" />
            <CardTitle>Project Overview</CardTitle>
          </div>
          <CardDescription>Projects by organizing universe and stage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-40 bg-gray-200 rounded" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FolderOpen className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle>Project Overview</CardTitle>
              <CardDescription>Summary by stage and universe. Click any number to drill in.</CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="border-blue-200 text-blue-700">
              <CheckCircle className="h-3 w-3 mr-1" />
              {data.total} Total
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Table variant="desktop">
            <TableHeader variant="desktop">
              <TableRow variant="desktop">
                <TableHead variant="desktop">Stage</TableHead>
                <TableHead variant="desktop">Active</TableHead>
                <TableHead variant="desktop">Potential</TableHead>
                <TableHead variant="desktop">Excluded</TableHead>
                <TableHead variant="desktop">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody variant="desktop">
              {filteredStages.map((s) => {
                const a = getCount('active', s.key)
                const p = getCount('potential', s.key)
                const e = getCount('excluded', s.key)
                const total = a + p + e
                return (
                  <TableRow key={s.key} variant="desktop-hover">
                    <TableCell variant="desktop" className="font-medium">{s.label}</TableCell>
                    <TableCell variant="desktop">
                      <button
                        className="text-blue-700 hover:underline"
                        onClick={() => navigateToProjects('active', s.key)}
                      >
                        {a}
                      </button>
                    </TableCell>
                    <TableCell variant="desktop">
                      <button
                        className="text-blue-700 hover:underline"
                        onClick={() => navigateToProjects('potential', s.key)}
                      >
                        {p}
                      </button>
                    </TableCell>
                    <TableCell variant="desktop">
                      <button
                        className="text-blue-700 hover:underline"
                        onClick={() => navigateToProjects('excluded', s.key)}
                      >
                        {e}
                      </button>
                    </TableCell>
                    <TableCell variant="desktop">
                      <button
                        className="text-gray-900 hover:underline"
                        onClick={() => navigateToProjects(undefined, s.key)}
                      >
                        {total}
                      </button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            {filteredStages.length === 0 && (
              <TableCaption variant="desktop">No data to display yet.</TableCaption>
            )}
          </Table>
        </div>

        <div className="pt-2">
          {filteredChartData.length > 0 ? (
            <ChartContainer
              config={{
                active: { label: "Active", color: "hsl(var(--chart-1, 221 83% 53%))" },
                potential: { label: "Potential", color: "hsl(var(--chart-2, 39 89% 49%))" },
                excluded: { label: "Excluded", color: "hsl(var(--chart-3, 215 16% 47%))" },
              }}
            >
              <BarChart data={filteredChartData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="stage" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="active" fill="var(--color-active)" radius={[4,4,0,0]} />
                <Bar dataKey="potential" fill="var(--color-potential)" radius={[4,4,0,0]} />
                <Bar dataKey="excluded" fill="var(--color-excluded)" radius={[4,4,0,0]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="text-sm text-muted-foreground px-2">No chart data to display.</div>
          )}
        </div>

        <div className="pt-2">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => navigateToProjects()}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            View All Projects
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
