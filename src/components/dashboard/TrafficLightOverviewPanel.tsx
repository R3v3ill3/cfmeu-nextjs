"use client"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { BarChart3, Filter, Calendar, FolderOpen, Users } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { PROJECT_TIER_LABELS, ProjectTier } from "@/components/projects/types"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

type EbaStatusFilter = 'all' | 'active' | 'inactive' | 'unknown'
type ProjectStatusFilter = 'all' | 'construction' | 'pre_construction' | 'future' | 'archived'

interface RatingDistribution {
  red: number
  amber: number
  yellow: number
  green: number
}

interface TrafficLightDistributionResponse {
  projects: {
    distribution: RatingDistribution
    percentages: RatingDistribution
    total: number
  }
  employers: {
    distribution: RatingDistribution
    percentages: RatingDistribution
    total: number
  }
}

export function TrafficLightOverviewPanel() {
  const [ebaStatus, setEbaStatus] = useState<EbaStatusFilter>('all')
  const [projectTier, setProjectTier] = useState<ProjectTier | 'all'>('all')
  const [projectStatus, setProjectStatus] = useState<ProjectStatusFilter>('all')
  const [timeFrame, setTimeFrame] = useState<'6_weeks' | '3_months' | '6_months' | '12_months' | 'ever'>('3_months')

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

  const { data, isLoading, error } = useQuery<TrafficLightDistributionResponse>({
    queryKey: ['traffic-light-distribution', ebaStatus, projectTier, projectStatus],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (ebaStatus !== 'all') params.set('ebaStatus', ebaStatus)
      if (projectTier !== 'all') params.set('projectTier', projectTier)
      if (projectStatus !== 'all') params.set('projectStatus', projectStatus)
      
      const response = await fetch(`/api/dashboard/traffic-light-distribution?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch traffic light distribution')
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Prepare chart data for horizontal stacked bars
  const projectsChartData = data?.projects ? [
    { category: 'Projects', red: data.projects.distribution.red, amber: data.projects.distribution.amber, yellow: data.projects.distribution.yellow, green: data.projects.distribution.green }
  ] : []

  const employersChartData = data?.employers ? [
    { category: 'Employers', red: data.employers.distribution.red, amber: data.employers.distribution.amber, yellow: data.employers.distribution.yellow, green: data.employers.distribution.green }
  ] : []

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle>Traffic Light Overview</CardTitle>
              <CardDescription>
                Distribution of projects and employers by 4-point ratings
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6">
        {/* Rating Completion Section - at the top */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-700">Rating Completion</h3>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-600" />
              <span className="text-xs font-medium text-muted-foreground">Time Frame</span>
              <Select value={timeFrame} onValueChange={(value: any) => setTimeFrame(value)}>
                <SelectTrigger className="w-36 h-9 text-xs touch-manipulation">
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
          </div>

          {/* Rating completion cards */}
          {ratingLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
            </div>
          ) : ratingCompletionData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    <span className="text-sm font-medium text-gray-700">Active Employers Rated</span>
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

        {/* Divider */}
        <div className="border-t"></div>

        {/* Traffic Light Distribution Section */}
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-gray-600" />
              <span className="text-xs font-medium text-muted-foreground">Filters:</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">EBA Status</span>
              <Select value={ebaStatus} onValueChange={(value: any) => setEbaStatus(value)}>
                <SelectTrigger className="w-28 sm:w-32 h-9 text-xs touch-manipulation">
                  <SelectValue placeholder="EBA" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">Project Tier</span>
              <Select value={projectTier} onValueChange={(value: any) => setProjectTier(value)}>
                <SelectTrigger className="w-28 sm:w-32 h-9 text-xs touch-manipulation">
                  <SelectValue placeholder="Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  {Object.entries(PROJECT_TIER_LABELS).map(([tier, label]) => (
                    <SelectItem key={tier} value={tier}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">Project Status</span>
              <Select value={projectStatus} onValueChange={(value: any) => setProjectStatus(value)}>
                <SelectTrigger className="w-32 sm:w-36 h-9 text-xs touch-manipulation">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="construction">Construction</SelectItem>
                  <SelectItem value="pre_construction">Pre-construction</SelectItem>
                  <SelectItem value="future">Future</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
          <div className="space-y-4">
            <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-muted-foreground">
            Failed to load traffic light distribution data.
          </div>
        ) : data ? (
          <>
            {/* Projects Distribution */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Projects Distribution</h3>
                <Badge variant="outline" className="text-xs">
                  {data.projects.total} total
                </Badge>
              </div>

              {/* Stacked bar chart for projects */}
              {projectsChartData.length > 0 && (
                <div className="w-full" style={{ height: '250px', minHeight: '250px', minWidth: '280px' }}>
                  <ChartContainer
                    config={{
                      red: { label: "Red", color: "hsl(0, 84%, 60%)" },
                      amber: { label: "Amber", color: "hsl(38, 92%, 50%)" },
                      yellow: { label: "Yellow", color: "hsl(48, 96%, 53%)" },
                      green: { label: "Green", color: "hsl(142, 71%, 45%)" },
                    }}
                    className="w-full h-full"
                  >
                    <BarChart data={projectsChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis 
                        dataKey="category" 
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
                      <Bar dataKey="green" stackId="a" fill="var(--color-green)" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="yellow" stackId="a" fill="var(--color-yellow)" />
                      <Bar dataKey="amber" stackId="a" fill="var(--color-amber)" />
                      <Bar dataKey="red" stackId="a" fill="var(--color-red)" radius={[0, 0, 2, 2]} />
                    </BarChart>
                  </ChartContainer>
                </div>
              )}

              {/* Percentage breakdown for projects */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="border rounded-lg p-2 bg-red-50 border-red-200">
                  <div className="text-xs text-gray-600 mb-1">Red</div>
                  <div className="text-lg font-bold text-red-600">{data.projects.distribution.red}</div>
                  <div className="text-xs text-gray-500">{data.projects.percentages.red.toFixed(1)}%</div>
                </div>
                <div className="border rounded-lg p-2 bg-amber-50 border-amber-200">
                  <div className="text-xs text-gray-600 mb-1">Amber</div>
                  <div className="text-lg font-bold text-amber-600">{data.projects.distribution.amber}</div>
                  <div className="text-xs text-gray-500">{data.projects.percentages.amber.toFixed(1)}%</div>
                </div>
                <div className="border rounded-lg p-2 bg-yellow-50 border-yellow-200">
                  <div className="text-xs text-gray-600 mb-1">Yellow</div>
                  <div className="text-lg font-bold text-yellow-600">{data.projects.distribution.yellow}</div>
                  <div className="text-xs text-gray-500">{data.projects.percentages.yellow.toFixed(1)}%</div>
                </div>
                <div className="border rounded-lg p-2 bg-green-50 border-green-200">
                  <div className="text-xs text-gray-600 mb-1">Green</div>
                  <div className="text-lg font-bold text-green-600">{data.projects.distribution.green}</div>
                  <div className="text-xs text-gray-500">{data.projects.percentages.green.toFixed(1)}%</div>
                </div>
              </div>
            </div>

            {/* Employers Distribution */}
            <div className="space-y-3 border-t pt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Employers Distribution</h3>
                <Badge variant="outline" className="text-xs">
                  {data.employers.total} total
                </Badge>
              </div>

                      {/* Stacked bar chart for employers */}
                      {employersChartData.length > 0 && (
                        <div className="w-full" style={{ height: '250px', minHeight: '250px', minWidth: '280px' }}>
                          <ChartContainer
                            config={{
                              red: { label: "Red", color: "hsl(0, 84%, 60%)" },
                              amber: { label: "Amber", color: "hsl(38, 92%, 50%)" },
                              yellow: { label: "Yellow", color: "hsl(48, 96%, 53%)" },
                              green: { label: "Green", color: "hsl(142, 71%, 45%)" },
                            }}
                            className="w-full h-full"
                          >
                    <BarChart data={employersChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis 
                        dataKey="category" 
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
                      <Bar dataKey="green" stackId="a" fill="var(--color-green)" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="yellow" stackId="a" fill="var(--color-yellow)" />
                      <Bar dataKey="amber" stackId="a" fill="var(--color-amber)" />
                      <Bar dataKey="red" stackId="a" fill="var(--color-red)" radius={[0, 0, 2, 2]} />
                    </BarChart>
                  </ChartContainer>
                </div>
              )}

              {/* Percentage breakdown for employers */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="border rounded-lg p-2 bg-red-50 border-red-200">
                  <div className="text-xs text-gray-600 mb-1">Red</div>
                  <div className="text-lg font-bold text-red-600">{data.employers.distribution.red}</div>
                  <div className="text-xs text-gray-500">{data.employers.percentages.red.toFixed(1)}%</div>
                </div>
                <div className="border rounded-lg p-2 bg-amber-50 border-amber-200">
                  <div className="text-xs text-gray-600 mb-1">Amber</div>
                  <div className="text-lg font-bold text-amber-600">{data.employers.distribution.amber}</div>
                  <div className="text-xs text-gray-500">{data.employers.percentages.amber.toFixed(1)}%</div>
                </div>
                <div className="border rounded-lg p-2 bg-yellow-50 border-yellow-200">
                  <div className="text-xs text-gray-600 mb-1">Yellow</div>
                  <div className="text-lg font-bold text-yellow-600">{data.employers.distribution.yellow}</div>
                  <div className="text-xs text-gray-500">{data.employers.percentages.yellow.toFixed(1)}%</div>
                </div>
                <div className="border rounded-lg p-2 bg-green-50 border-green-200">
                  <div className="text-xs text-gray-600 mb-1">Green</div>
                  <div className="text-lg font-bold text-green-600">{data.employers.distribution.green}</div>
                  <div className="text-xs text-gray-500">{data.employers.percentages.green.toFixed(1)}%</div>
                </div>
              </div>
            </div>
          </>
        ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

