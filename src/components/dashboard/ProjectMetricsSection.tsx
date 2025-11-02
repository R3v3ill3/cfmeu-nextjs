"use client"
import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableCaption, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { FolderOpen, CheckCircle, BarChart3, TrendingUp, Calendar, Users } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DashboardProject, DashboardProjectCounts } from "@/hooks/useNewDashboardData"
import { PROJECT_TIER_LABELS, ProjectTier } from "@/components/projects/types"
import { FilterIndicatorBadge } from "./FilterIndicatorBadge"
import { useActiveFilters } from "@/hooks/useActiveFilters"
import { useIsMobile } from "@/hooks/use-mobile"
import { Progress } from "@/components/ui/progress"
import { useQuery } from "@tanstack/react-query"

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
  const [timeFrame, setTimeFrame] = useState<'6_weeks' | '3_months' | '6_months' | '12_months' | 'ever'>('3_months');

  // Fetch rating completion data
  const { data: ratingCompletionData, isLoading: ratingLoading } = useQuery({
    queryKey: ['rating-completion', timeFrame],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/rating-completion?timeFrame=${timeFrame}`)
      if (!response.ok) throw new Error('Failed to fetch rating completion data')
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

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
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Left side: Data table */}
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <Table variant="desktop">
                  <TableHeader variant="desktop">
                    <TableRow variant="desktop">
                      <TableHead variant="desktop" className="py-2">Stage</TableHead>
                      <TableHead variant="desktop" className="py-2">Active</TableHead>
                      <TableHead variant="desktop" className="py-2">Potential</TableHead>
                      <TableHead variant="desktop" className="py-2">Excluded</TableHead>
                      <TableHead variant="desktop" className="py-2">Total</TableHead>
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
                          <TableCell variant="desktop" className="py-2">
                            <button
                              className="text-blue-700 hover:underline"
                              onClick={() => navigateToProjects('active', s.key)}
                            >
                              {a}
                            </button>
                          </TableCell>
                          <TableCell variant="desktop" className="py-2">
                            <button
                              className="text-blue-700 hover:underline"
                              onClick={() => navigateToProjects('potential', s.key)}
                            >
                              {p}
                            </button>
                          </TableCell>
                          <TableCell variant="desktop" className="py-2">
                            <button
                              className="text-blue-700 hover:underline"
                              onClick={() => navigateToProjects('excluded', s.key)}
                            >
                              {e}
                            </button>
                          </TableCell>
                          <TableCell variant="desktop" className="py-2">
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

            {/* Right side: Rating completion visualizations */}
            <div className="flex flex-col justify-center space-y-4">
              {/* Time frame selector */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-600" />
                <span className="text-xs font-medium text-muted-foreground">Time Frame</span>
                <Select value={timeFrame} onValueChange={(value: any) => setTimeFrame(value)}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6_weeks">6 Weeks</SelectItem>
                    <SelectItem value="3_months">3 Months</SelectItem>
                    <SelectItem value="6_months">6 Months</SelectItem>
                    <SelectItem value="12_months">12 Months</SelectItem>
                    <SelectItem value="ever">Ever</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Rating completion cards */}
              {ratingLoading ? (
                <div className="space-y-3">
                  <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ) : ratingCompletionData ? (
                <div className="space-y-3">
                  {/* Projects rated card */}
                  <div className="border rounded-lg p-3 bg-blue-50 border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-700">Projects Rated</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {ratingCompletionData.projectsRatedPercentage.toFixed(1)}%
                      </Badge>
                    </div>
                    <Progress 
                      value={ratingCompletionData.projectsRatedPercentage} 
                      className="h-2 mb-1" 
                    />
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>
                        {ratingCompletionData.projectsRatedCount} of {ratingCompletionData.totalProjects}
                      </span>
                      <span>{ratingCompletionData.projectsRatedPercentage.toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* Employers rated card */}
                  <div className="border rounded-lg p-3 bg-green-50 border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-gray-700">Employers Rated</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {ratingCompletionData.employersRatedPercentage.toFixed(1)}%
                      </Badge>
                    </div>
                    <Progress 
                      value={ratingCompletionData.employersRatedPercentage} 
                      className="h-2 mb-1" 
                    />
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>
                        {ratingCompletionData.employersRatedCount} of {ratingCompletionData.totalEmployers}
                      </span>
                      <span>{ratingCompletionData.employersRatedPercentage.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No rating data available.
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}