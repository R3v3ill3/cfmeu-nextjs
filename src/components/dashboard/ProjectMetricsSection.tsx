"use client"
import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableCaption, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { FolderOpen, CheckCircle, BarChart3, TrendingUp } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DashboardProject, DashboardProjectCounts } from "@/hooks/useNewDashboardData"
import { PROJECT_TIER_LABELS, ProjectTier } from "@/components/projects/types"
import { FilterIndicatorBadge } from "./FilterIndicatorBadge"
import { useActiveFilters } from "@/hooks/useActiveFilters"
import { useIsMobile } from "@/hooks/use-mobile"
import { Progress } from "@/components/ui/progress"

interface ProjectMetricsSectionProps {
  data: DashboardProjectCounts;
  projects?: DashboardProject[];
  isLoading?: boolean;
  errors?: string[];
}

export function ProjectMetricsSection({ data, projects, isLoading }: ProjectMetricsSectionProps) {
  const isMobile = useIsMobile()
  const router = useRouter();
  const sp = useSearchParams();
  const { hasActiveFilters, activeFilters } = useActiveFilters();

  const tierFromParams = useMemo(() => {
    const value = sp.get('tier');
    return (value === 'tier_1' || value === 'tier_2' || value === 'tier_3') ? (value as ProjectTier) : undefined;
  }, [sp]);

  const [tierFilter, setTierFilter] = useState<ProjectTier | 'all'>(tierFromParams ?? 'all');

  const navigateToProjects = (organising_universe?: string, stage_class?: string) => {
    const params = new URLSearchParams();
    if (organising_universe) params.set('universeFilter', organising_universe);
    if (stage_class) params.set('stageFilter', stage_class);
    if (tierFilter !== 'all') params.set('tier', tierFilter);
    
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

  const computedCounts = useMemo<DashboardProjectCounts | null>(() => {
    if (!projects || projects.length === 0) return null

    const filtered = tierFilter === 'all'
      ? projects
      : projects.filter((project) => project.tier === tierFilter)

    const initial: DashboardProjectCounts = {
      active_construction: 0,
      active_pre_construction: 0,
      potential_construction: 0,
      potential_pre_construction: 0,
      potential_future: 0,
      potential_archived: 0,
      excluded_construction: 0,
      excluded_pre_construction: 0,
      excluded_future: 0,
      excluded_archived: 0,
      total: 0,
    }

    filtered.forEach((project) => {
      const universe = (project.organising_universe ?? 'excluded') as 'active' | 'potential' | 'excluded'
      const stage = (project.stage_class ?? 'archived') as StageKey
      const key = `${universe}_${stage}` as keyof DashboardProjectCounts
      initial[key] = (initial[key] || 0) + 1
      initial.total += 1
    })

    return initial
  }, [projects, tierFilter])

  const displayCounts = computedCounts ?? data

  const getCount = (universe: 'active' | 'potential' | 'excluded', stage: StageKey): number => {
    const key = `${universe}_${stage}` as keyof DashboardProjectCounts
    return (displayCounts[key] as number) || 0
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
      <Card>
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
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center space-x-2">
            <FolderOpen className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle className="flex items-center gap-2">
                Project Overview
                <FilterIndicatorBadge 
                  hasActiveFilters={hasActiveFilters} 
                  activeFilters={activeFilters}
                  variant="small"
                />
              </CardTitle>
              <CardDescription>Summary by stage and universe. Click any number to drill in.</CardDescription>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tier</span>
              <Select value={tierFilter} onValueChange={(value) => setTierFilter(value as ProjectTier | 'all')}>
                <SelectTrigger className="w-36 h-8">
                  <SelectValue placeholder="All tiers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tiers</SelectItem>
                  {Object.entries(PROJECT_TIER_LABELS).map(([tier, label]) => (
                    <SelectItem key={tier} value={tier}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="border-blue-200 text-blue-700">
                <CheckCircle className="h-3 w-3 mr-1" />
                {displayCounts.total} Total
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isMobile ? (
          /* Mobile-optimized layout */
          <div className="space-y-4">
            {/* Mobile-friendly stage cards */}
            <div className="space-y-3">
              {filteredStages.map((s) => {
                const a = getCount('active', s.key)
                const p = getCount('potential', s.key)
                const e = getCount('excluded', s.key)
                const total = a + p + e
                
                return (
                  <div key={s.key} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">{s.label}</h4>
                      <Badge variant="outline" className="text-xs">
                        {total} total
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      {/* Active projects bar */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm bg-blue-500"></div>
                          <span className="text-sm text-gray-600">Active</span>
                        </div>
                        <button
                          className="text-sm font-medium text-blue-700 hover:underline"
                          onClick={() => navigateToProjects('active', s.key)}
                        >
                          {a}
                        </button>
                      </div>
                      <Progress value={total > 0 ? (a / total) * 100 : 0} className="h-2" />
                      
                      {/* Potential projects bar */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm bg-orange-500"></div>
                          <span className="text-sm text-gray-600">Potential</span>
                        </div>
                        <button
                          className="text-sm font-medium text-blue-700 hover:underline"
                          onClick={() => navigateToProjects('potential', s.key)}
                        >
                          {p}
                        </button>
                      </div>
                      <Progress value={total > 0 ? (p / total) * 100 : 0} className="h-2" />
                      
                      {/* Excluded projects bar */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm bg-gray-500"></div>
                          <span className="text-sm text-gray-600">Excluded</span>
                        </div>
                        <button
                          className="text-sm font-medium text-blue-700 hover:underline"
                          onClick={() => navigateToProjects('excluded', s.key)}
                        >
                          {e}
                        </button>
                      </div>
                      <Progress value={total > 0 ? (e / total) * 100 : 0} className="h-2" />
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="w-full mt-3 text-xs"
                      onClick={() => navigateToProjects(undefined, s.key)}
                    >
                      <BarChart3 className="h-3 w-3 mr-1" />
                      View All {s.label} Projects
                    </Button>
                  </div>
                )
              })}
            </div>
            
            {filteredStages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No data to display yet.
              </div>
            )}
            
            <Button 
              variant="outline" 
              size="sm"
              className="w-full"
              onClick={() => navigateToProjects()}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              View All Projects
            </Button>
          </div>
        ) : (
          /* Desktop layout - original */
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left side: Data table */}
            <div className="space-y-3 min-w-0 flex flex-col">
              <div className="overflow-x-auto flex-1">
                <div className="inline-block min-w-full align-middle">
                  <Table variant="desktop" className="w-full min-w-[500px]">
                  <TableHeader variant="desktop">
                    <TableRow variant="desktop">
                      <TableHead variant="desktop" className="py-2 min-w-[100px]">Stage</TableHead>
                      <TableHead variant="desktop" className="py-2 text-center min-w-[80px]">Active</TableHead>
                      <TableHead variant="desktop" className="py-2 text-center min-w-[80px]">Potential</TableHead>
                      <TableHead variant="desktop" className="py-2 text-center min-w-[80px]">Excluded</TableHead>
                      <TableHead variant="desktop" className="py-2 text-center min-w-[80px]">Total</TableHead>
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
                          <TableCell variant="desktop" className="font-medium py-2">{s.label}</TableCell>
                          <TableCell variant="desktop" className="py-2 text-center">
                            <button
                              className="text-blue-700 hover:underline"
                              onClick={() => navigateToProjects('active', s.key)}
                            >
                              {a}
                            </button>
                          </TableCell>
                          <TableCell variant="desktop" className="py-2 text-center">
                            <button
                              className="text-blue-700 hover:underline"
                              onClick={() => navigateToProjects('potential', s.key)}
                            >
                              {p}
                            </button>
                          </TableCell>
                          <TableCell variant="desktop" className="py-2 text-center">
                            <button
                              className="text-blue-700 hover:underline"
                              onClick={() => navigateToProjects('excluded', s.key)}
                            >
                              {e}
                            </button>
                          </TableCell>
                          <TableCell variant="desktop" className="py-2 text-center font-medium">
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
              </div>
              
              <Button 
                variant="outline" 
                size="sm"
                className="w-full"
                onClick={() => navigateToProjects()}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                View All Projects
              </Button>
            </div>

            {/* Right side: Bar chart visualization */}
            <div className="flex flex-col justify-center space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Project Distribution by Stage</h3>
              {filteredChartData.length > 0 ? (
                <div className="w-full" style={{ height: '300px', minHeight: '300px' }}>
                  <ChartContainer
                    config={{
                      active: { label: "Active", color: "hsl(221, 83%, 53%)" },
                      potential: { label: "Potential", color: "hsl(25, 95%, 53%)" },
                      excluded: { label: "Excluded", color: "hsl(215, 16%, 47%)" },
                    }}
                    className="h-full w-full"
                  >
                    <BarChart data={filteredChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis 
                        dataKey="stage" 
                        tickLine={false} 
                        axisLine={false}
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis 
                        allowDecimals={false}
                        tick={{ fontSize: 12 }}
                        width={40}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend 
                        content={<ChartLegendContent />}
                        wrapperStyle={{ fontSize: '12px', marginTop: '16px' }}
                      />
                      <Bar dataKey="active" fill="var(--color-active)" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="potential" fill="var(--color-potential)" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="excluded" fill="var(--color-excluded)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No chart data available.
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}