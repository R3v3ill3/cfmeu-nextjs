"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts"
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  LineChartIcon,
  PieChartIcon,
  Filter,
  Download,
  Eye,
  Activity,
  Target,
  Zap
} from "lucide-react"
import { RatingTrend, TrendDataPoint, RatingTrack, RoleType, TrafficLightRating } from "@/types/rating"
import { TrafficLightDisplay } from "./TrafficLightDisplay"
import { useHapticFeedback } from "../shared/HapticFeedback"

interface RatingHistoryProps {
  employerId: string
  employerName: string
  trendData: RatingTrend[]
  loading?: boolean
  className?: string
  onExportData?: () => void
  onViewDetails?: (dataPoint: TrendDataPoint) => void
}

// Color mapping for traffic light ratings
const ratingColors = {
  red: '#ef4444',
  amber: '#f59e0b',
  yellow: '#eab308',
  green: '#22c55e',
}

// Color mapping for confidence levels
const confidenceColors = {
  low: '#9ca3af',
  medium: '#6b7280',
  high: '#374151',
  very_high: '#111827',
}

// Chart tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium mb-2">
          {new Date(label).toLocaleDateString()}
        </p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: ratingColors[data.rating as TrafficLightRating] }}
            />
            <span className="text-xs capitalize">{data.rating} Rating</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Score:</span>
            <span className="font-medium">{data.score.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Confidence:</span>
            <span className="font-medium capitalize">{data.confidence}</span>
          </div>
          {data.sample_size && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Sample:</span>
              <span className="font-medium">{data.sample_size}</span>
            </div>
          )}
        </div>
      </div>
    )
  }
  return null
}

// Trend statistics component
function TrendStatistics({ data }: { data: TrendDataPoint[] }) {
  const getRatingValue = (rating: TrafficLightRating): number => {
    const values = { red: 1, amber: 2, yellow: 3, green: 4 }
    return values[rating]
  }

  const trend = useMemo(() => {
    if (data.length < 2) return { direction: 'stable', change: 0 }
    const current = getRatingValue(data[data.length - 1].rating)
    const previous = getRatingValue(data[data.length - 2].rating)
    const change = current - previous

    let direction: 'up' | 'down' | 'stable' = 'stable'
    if (change > 0) direction = 'up'
    else if (change < 0) direction = 'down'

    return { direction, change }
  }, [data])

  const averageScore = useMemo(() => {
    if (data.length === 0) return 0
    return data.reduce((sum, point) => sum + point.score, 0) / data.length
  }, [data])

  const ratingDistribution = useMemo(() => {
    const distribution = { red: 0, amber: 0, yellow: 0, green: 0 }
    data.forEach(point => {
      distribution[point.rating as TrafficLightRating]++
    })
    return distribution
  }, [data])

  const mostRecentRating = data[data.length - 1]

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="p-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {trend.direction === 'up' && <TrendingUp className="h-4 w-4 text-green-600" />}
            {trend.direction === 'down' && <TrendingDown className="h-4 w-4 text-red-600" />}
            {trend.direction === 'stable' && <Activity className="h-4 w-4 text-blue-600" />}
            <span className="text-xs font-medium">Trend</span>
          </div>
          <p className={cn(
            "text-lg font-bold",
            trend.direction === 'up' && "text-green-600",
            trend.direction === 'down' && "text-red-600",
            trend.direction === 'stable' && "text-blue-600"
          )}>
            {trend.direction === 'up' && '↑'}
            {trend.direction === 'down' && '↓'}
            {trend.direction === 'stable' && '→'}
          </p>
        </div>
      </Card>

      <Card className="p-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium">Average</span>
          </div>
          <p className="text-lg font-bold text-foreground">
            {averageScore.toFixed(1)}%
          </p>
        </div>
      </Card>

      <Card className="p-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium">Current</span>
          </div>
          {mostRecentRating && (
            <TrafficLightDisplay
              rating={mostRecentRating.rating}
              confidence={mostRecentRating.confidence}
              size="sm"
              showConfidence={false}
            />
          )}
        </div>
      </Card>

      <Card className="p-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium">Data Points</span>
          </div>
          <p className="text-lg font-bold text-foreground">
            {data.length}
          </p>
        </div>
      </Card>
    </div>
  )
}

// Rating distribution pie chart
function RatingDistribution({ data }: { data: TrendDataPoint[] }) {
  const distribution = useMemo(() => {
    const counts = { red: 0, amber: 0, yellow: 0, green: 0 }
    data.forEach(point => {
      counts[point.rating as TrafficLightRating]++
    })
    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([rating, count]) => ({
        name: rating.charAt(0).toUpperCase() + rating.slice(1),
        value: count,
        percentage: (count / data.length) * 100,
        color: ratingColors[rating as TrafficLightRating],
      }))
  }, [data])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Rating Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={distribution}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {distribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${value} (${distribution.find(d => d.name === name)?.percentage.toFixed(1)}%)`,
                  name
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          {distribution.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <div className="text-xs">
                <span className="font-medium">{item.name}:</span>
                <span className="text-muted-foreground ml-1">
                  {item.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Timeline component
function TimelineView({ data, onViewDetails }: {
  data: TrendDataPoint[]
  onViewDetails?: (dataPoint: TrendDataPoint) => void
}) {
  const { selection } = useHapticFeedback()

  const handleClick = useCallback((dataPoint: TrendDataPoint) => {
    selection()
    onViewDetails?.(dataPoint)
  }, [selection, onViewDetails])

  return (
    <div className="space-y-3">
      {data.map((dataPoint, index) => (
        <Card
          key={index}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleClick(dataPoint)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full",
                      dataPoint.rating === 'green' && "bg-green-500",
                      dataPoint.rating === 'yellow' && "bg-yellow-500",
                      dataPoint.rating === 'amber' && "bg-amber-500",
                      dataPoint.rating === 'red' && "bg-red-500"
                    )}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium capitalize">
                    {dataPoint.rating} Rating
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(dataPoint.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{dataPoint.score.toFixed(1)}%</p>
                <Badge variant="outline" className="text-xs">
                  {dataPoint.confidence}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function RatingHistory({
  employerId,
  employerName,
  trendData,
  loading = false,
  className,
  onExportData,
  onViewDetails,
}: RatingHistoryProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all')
  const [selectedTrack, setSelectedTrack] = useState<string>('all')
  const [activeView, setActiveView] = useState<'overview' | 'timeline' | 'distribution'>('overview')
  const { trigger, success } = useHapticFeedback()

  // Filter and process data
  const processedData = useMemo(() => {
    if (!trendData.length) return []

    let filtered = trendData

    // Filter by track
    if (selectedTrack !== 'all') {
      filtered = filtered.filter(trend => trend.track === selectedTrack)
    }

    // Filter by period
    if (selectedPeriod !== 'all') {
      const now = new Date()
      let cutoffDate: Date

      switch (selectedPeriod) {
        case '3months':
          cutoffDate = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000))
          break
        case '6months':
          cutoffDate = new Date(now.getTime() - (180 * 24 * 60 * 60 * 1000))
          break
        case '1year':
          cutoffDate = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000))
          break
        default:
          cutoffDate = new Date(0)
      }

      filtered = filtered.map(trend => ({
        ...trend,
        data_points: trend.data_points.filter(point =>
          new Date(point.date) >= cutoffDate
        ),
      })).filter(trend => trend.data_points.length > 0)
    }

    // Combine all data points from filtered trends
    return filtered.flatMap(trend => trend.data_points)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [trendData, selectedPeriod, selectedTrack])

  const handleExport = useCallback(() => {
    trigger()
    onExportData?.()
    success()
  }, [trigger, onExportData, success])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    )
  }

  if (!processedData.length) {
    return (
      <Card className="p-8 text-center">
        <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-medium text-foreground mb-1">No History Data</h3>
        <p className="text-sm text-muted-foreground">
          No rating history available for {employerName}.
        </p>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Rating History</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="h-8 text-xs"
            >
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Historical rating trends and performance for {employerName}
          </p>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Time Period</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="3months">Last 3 Months</SelectItem>
                  <SelectItem value="6months">Last 6 Months</SelectItem>
                  <SelectItem value="1year">Last Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Rating Track</label>
              <Select value={selectedTrack} onValueChange={setSelectedTrack}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tracks</SelectItem>
                  <SelectItem value="project_data">Project Data</SelectItem>
                  <SelectItem value="organiser_expertise">Organiser Expertise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <TrendStatistics data={processedData} />

      {/* View selector */}
      <Tabs value={activeView} onValueChange={(value) => setActiveView(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <LineChartIcon className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="distribution" className="flex items-center gap-2">
            <PieChartIcon className="h-4 w-4" />
            Distribution
          </TabsTrigger>
        </TabsList>

        {/* Overview - Line chart */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Rating Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={processedData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline view */}
        <TabsContent value="timeline" className="mt-4">
          <TimelineView data={processedData} onViewDetails={onViewDetails} />
        </TabsContent>

        {/* Distribution view */}
        <TabsContent value="distribution" className="mt-4">
          <RatingDistribution data={processedData} />
        </TabsContent>
      </Tabs>

      {/* Recent activity summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {processedData.slice(-3).reverse().map((dataPoint, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      dataPoint.rating === 'green' && "bg-green-500",
                      dataPoint.rating === 'yellow' && "bg-yellow-500",
                      dataPoint.rating === 'amber' && "bg-amber-500",
                      dataPoint.rating === 'red' && "bg-red-500"
                    )}
                  />
                  <span className="text-xs">
                    {new Date(dataPoint.date).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium capitalize">
                    {dataPoint.rating}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {dataPoint.score.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}