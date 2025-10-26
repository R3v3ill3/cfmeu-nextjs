"use client"

import {  useState, useEffect, useCallback, useMemo, useRef  } from 'react'
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  Search,
  Filter,
  Plus,
  TrendingUp,
  TrendingDown,
  Activity,
  Star,
  AlertTriangle,
  CheckCircle,
  Target,
  Users,
  Building2,
  BarChart3,
  Settings,
  RefreshCw,
  Bell,
  ChevronRight,
  Eye,
  Edit,
  MoreVertical
} from "lucide-react"
import { EmployerRatingData, RatingTrack, RoleType, TrafficLightRating } from "@/types/rating"
import { TrafficLightDisplay, TrafficLightIndicator } from "./TrafficLightDisplay"
import { EmployerRatingList } from "./EmployerRatingCard"
import { PullToRefresh } from "../shared/PullToRefresh"
import { useHapticFeedback } from "../shared/HapticFeedback"
import { SafeRatingComponent } from "@/components/ratings/SafeRatingProvider"
import { DefaultRatingError } from "@/components/ratings/RatingErrorBoundary"

interface RatingDashboardProps {
  employers: EmployerRatingData[]
  userRole: RoleType
  loading?: boolean
  refreshing?: boolean
  stats?: {
    totalEmployers: number
    greenCount: number
    amberCount: number
    redCount: number
    recentActivity: number
  }
  alerts?: Array<{
    id: string
    type: 'info' | 'warning' | 'error'
    title: string
    message: string
    employerId?: string
    timestamp: string
  }>
  onRefresh?: () => Promise<void>
  onSearch?: (query: string) => void
  onFilter?: (filters: any) => void
  onRateEmployer?: (employer: EmployerRatingData) => void
  onViewEmployer?: (employer: EmployerRatingData) => void
  onEditEmployer?: (employer: EmployerRatingData) => void
  onViewAllEmployers?: () => void
  onViewAlerts?: () => void
  onSettings?: () => void
  className?: string
}

// Quick stats cards
function QuickStats({ stats, loading }: {
  stats?: RatingDashboardProps['stats']
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="p-3">
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-6 bg-muted rounded w-1/2" />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="p-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total Employers</span>
          </div>
          <p className="text-xl font-bold text-foreground">{stats?.totalEmployers || 0}</p>
        </div>
      </Card>

      <Card className="p-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground">Green</span>
          </div>
          <p className="text-xl font-bold text-green-600">{stats?.greenCount || 0}</p>
        </div>
      </Card>

      <Card className="p-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-xs text-muted-foreground">Needs Attention</span>
          </div>
          <p className="text-xl font-bold text-amber-600">{stats?.amberCount || 0}</p>
        </div>
      </Card>

      <Card className="p-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-xs text-muted-foreground">Critical</span>
          </div>
          <p className="text-xl font-bold text-red-600">{stats?.redCount || 0}</p>
        </div>
      </Card>
    </div>
  )
}

// Quick actions grid
function QuickActions({
  onRateEmployer,
  onSettings,
  onViewAllEmployers,
}: {
  onRateEmployer?: () => void
  onSettings?: () => void
  onViewAllEmployers?: () => void
}) {
  const { selection } = useHapticFeedback()

  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        variant="outline"
        className="h-16 flex-col gap-2"
        onClick={() => {
          selection()
          onRateEmployer?.()
        }}
      >
        <Star className="h-5 w-5" />
        <span className="text-xs">Rate Employer</span>
      </Button>

      <Button
        variant="outline"
        className="h-16 flex-col gap-2"
        onClick={() => {
          selection()
          onViewAllEmployers?.()
        }}
      >
        <Users className="h-5 w-5" />
        <span className="text-xs">All Employers</span>
      </Button>

      <Button
        variant="outline"
        className="h-16 flex-col gap-2"
        onClick={() => {
          selection()
          onSettings?.()
        }}
      >
        <Settings className="h-5 w-5" />
        <span className="text-xs">Settings</span>
      </Button>

      <Button
        variant="outline"
        className="h-16 flex-col gap-2"
        onClick={() => {
          selection()
          // Handle view trends or analytics
        }}
      >
        <BarChart3 className="h-5 w-5" />
        <span className="text-xs">Analytics</span>
      </Button>
    </div>
  )
}

// Recent alerts component
function RecentAlerts({
  alerts = [],
  onViewAlerts,
}: {
  alerts?: RatingDashboardProps['alerts']
  onViewAlerts?: () => void
}) {
  const { selection } = useHapticFeedback()

  if (!alerts.length) {
    return (
      <Card>
        <CardContent className="p-4 text-center">
          <CheckCircle className="h-8 w-8 mx-auto text-green-600 mb-2" />
          <p className="text-sm text-muted-foreground">No new alerts</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Recent Alerts</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => {
              selection()
              onViewAlerts?.()
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.slice(0, 3).map((alert) => (
          <div key={alert.id} className="flex items-start gap-3 p-2 bg-muted rounded-lg">
            <div className={cn(
              "w-2 h-2 rounded-full mt-1.5",
              alert.type === 'error' && "bg-red-500",
              alert.type === 'warning' && "bg-amber-500",
              alert.type === 'info' && "bg-blue-500"
            )} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{alert.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {alert.message}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(alert.timestamp).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
        {alerts.length > 3 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              selection()
              onViewAlerts?.()
            }}
          >
            View All Alerts ({alerts.length})
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// Recent employers with ratings
function RecentEmployers({
  employers,
  onRateEmployer,
  onViewEmployer,
  onEditEmployer,
}: {
  employers: EmployerRatingData[]
  onRateEmployer?: (employer: EmployerRatingData) => void
  onViewEmployer?: (employer: EmployerRatingData) => void
  onEditEmployer?: (employer: EmployerRatingData) => void
}) {
  const recentEmployers = employers
    .sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime())
    .slice(0, 5)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {recentEmployers.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {recentEmployers.map((employer) => (
          <div key={employer.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <span className="text-xs font-medium">
                  {employer.employer_name.substring(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{employer.employer_name}</p>
                <p className="text-xs text-muted-foreground">
                  {employer.primary_trade || 'No trade specified'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {employer.project_data_rating && (
                <TrafficLightIndicator
                  rating={employer.project_data_rating.rating}
                  confidence={employer.project_data_rating.confidence}
                />
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => onRateEmployer?.(employer)}
              >
                <Edit className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// Search and filter bar
function SearchAndFilter({
  searchQuery,
  onSearchChange,
  onFilter,
}: {
  searchQuery: string
  onSearchChange: (query: string) => void
  onFilter?: () => void
}) {
  const { trigger } = useHapticFeedback()

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search employers..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 h-10"
        />
      </div>
      <Button
        variant="outline"
        size="icon"
        className="h-10 w-10"
        onClick={() => {
          trigger()
          onFilter?.()
        }}
      >
        <Filter className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function RatingDashboard({
  employers,
  userRole,
  loading = false,
  refreshing = false,
  stats,
  alerts,
  onRefresh,
  onSearch,
  onFilter,
  onRateEmployer,
  onViewEmployer,
  onEditEmployer,
  onViewAllEmployers,
  onViewAlerts,
  onSettings,
  className,
}: RatingDashboardProps) {
  return (
    <SafeRatingComponent
      fallback={<DefaultRatingError />}
      componentName="RatingDashboard"
    >
      <RatingDashboardContent
        employers={employers}
        userRole={userRole}
        loading={loading}
        refreshing={refreshing}
        stats={stats}
        alerts={alerts}
        onRefresh={onRefresh}
        onSearch={onSearch}
        onFilter={onFilter}
        onRateEmployer={onRateEmployer}
        onViewEmployer={onViewEmployer}
        onEditEmployer={onEditEmployer}
        onViewAllEmployers={onViewAllEmployers}
        onViewAlerts={onViewAlerts}
        onSettings={onSettings}
        className={className}
      />
    </SafeRatingComponent>
  )
}

function RatingDashboardContent({
  employers,
  userRole,
  loading = false,
  refreshing = false,
  stats,
  alerts,
  onRefresh,
  onSearch,
  onFilter,
  onRateEmployer,
  onViewEmployer,
  onEditEmployer,
  onViewAllEmployers,
  onViewAlerts,
  onSettings,
  className,
}: RatingDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("overview")
  const { selection, success } = useHapticFeedback()

  // Handle search with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onSearch?.(searchQuery)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, onSearch])

  const handleRefresh = useCallback(async () => {
    try {
      await onRefresh?.()
      success()
    } catch (error) {
      console.error('Refresh failed:', error)
    }
  }, [onRefresh, success])

  // Filter employers based on search query
  const filteredEmployers = useMemo(() => {
    if (!searchQuery) return employers

    return employers.filter(employer =>
      employer.employer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employer.primary_trade?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employer.location?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [employers, searchQuery])

  // Get employers needing attention (amber/red ratings)
  const employersNeedingAttention = useMemo(() => {
    return filteredEmployers.filter(employer => {
      const rating = employer.project_data_rating?.rating
      return rating === 'red' || rating === 'amber'
    })
  }, [filteredEmployers])

  return (
    <PullToRefresh
      onRefresh={handleRefresh}
      refreshing={refreshing}
      className={cn("min-h-screen bg-background", className)}
    >
      <div className="space-y-4 p-4">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">Employer Ratings</h1>
              <p className="text-sm text-muted-foreground">
                Monitor and assess employer performance
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  selection()
                  onViewAlerts?.()
                }}
              >
                <Bell className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              </Button>
            </div>
          </div>

          <Badge variant="secondary" className="w-fit capitalize">
            {userRole} Role
          </Badge>
        </div>

        {/* Search and Filter */}
        <SearchAndFilter
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilter={() => {
            selection()
            onFilter?.()
          }}
        />

        {/* Main content tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="attention">Needs Action</TabsTrigger>
            <TabsTrigger value="recent">Recent</TabsTrigger>
          </TabsList>

          {/* Overview tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <QuickStats stats={stats} loading={loading} />
            <QuickActions
              onRateEmployer={() => onRateEmployer?.(employers[0])}
              onSettings={onSettings}
              onViewAllEmployers={onViewAllEmployers}
            />
            <RecentAlerts alerts={alerts} onViewAlerts={onViewAlerts} />
            <RecentEmployers
              employers={employers}
              onRateEmployer={onRateEmployer}
              onViewEmployer={onViewEmployer}
              onEditEmployer={onEditEmployer}
            />
          </TabsContent>

          {/* Needs Attention tab */}
          <TabsContent value="attention" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-base">Employers Needing Attention</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">
                  These employers have red or amber ratings and may require intervention.
                </p>
              </CardHeader>
            </Card>

            {employersNeedingAttention.length > 0 ? (
              <EmployerRatingList
                employers={employersNeedingAttention}
                loading={loading}
                onEmployerClick={onViewEmployer}
                onEmployerRate={onRateEmployer}
                onEmployerEdit={onEditEmployer}
              />
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-3" />
                  <h3 className="font-medium text-foreground mb-1">All Clear!</h3>
                  <p className="text-sm text-muted-foreground">
                    No employers currently need attention.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Recent tab */}
          <TabsContent value="recent" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-base">Recent Activity</CardTitle>
                </div>
              </CardHeader>
            </Card>

            <EmployerRatingList
              employers={filteredEmployers.slice(0, 10)}
              loading={loading}
              onEmployerClick={onViewEmployer}
              onEmployerRate={onRateEmployer}
              onEmployerEdit={onEditEmployer}
            />

            {filteredEmployers.length > 10 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  selection()
                  onViewAllEmployers?.()
                }}
              >
                View All Employers ({filteredEmployers.length})
              </Button>
            )}
          </TabsContent>
        </Tabs>

        {/* Quick action floating button */}
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg"
            onClick={() => {
              selection()
              onRateEmployer?.(employers[0])
            }}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </PullToRefresh>
  )
}