"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  AlertCircle,
  Users,
  BarChart3,
  RefreshCw,
  Plus
} from "lucide-react"
import { RatingDisplay } from "@/components/ratings/RatingDisplay"
import { RatingFiltersComponent } from "@/components/ratings/RatingFilters"
import { QuickRatingIndicator } from "@/components/ratings/RatingDisplay"
import { useRatingStats, useRatingAlerts, useRatingSearch } from "@/hooks/useRatings"
import { useRatingContext } from "@/context/RatingContext"
import { EmployerRatingData, TrafficLightRating } from "@/types/rating"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"

export default function RatingsPage() {
  const router = useRouter()
  const { startNavigation } = useNavigationLoading()
  const {
    state,
    refreshData,
    getRatingColor,
    calculateRatingDistribution
  } = useRatingContext()
  const [searchQuery, setSearchQuery] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch rating statistics
  const {
    data: stats,
    isLoading: isStatsLoading,
    error: statsError,
    refetch: refetchStats
  } = useRatingStats()

  // Fetch rating alerts
  const {
    data: alerts,
    isLoading: isAlertsLoading,
    error: alertsError
  } = useRatingAlerts()

  // Search ratings
  const {
    data: searchResults,
    isLoading: isSearchLoading,
    error: searchError
  } = useRatingSearch({
    query: searchQuery,
    filters: state.filters,
    limit: 10
  })

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refreshData()
      await refetchStats()
    } finally {
      setIsRefreshing(false)
    }
  }

  // Handle employer navigation
  const handleEmployerClick = (employer: EmployerRatingData) => {
    router.push(`/employers/${employer.id}`)
  }

  // Handle new rating - navigate to employers page to select an employer to rate
  // NOTE: Previously navigated to /mobile/ratings/wizard which caused cross-route-group
  // session loss. Now stays within (app) route group by going to employers list.
  const handleNewRating = () => {
    startNavigation("/employers")
    router.push("/employers?action=rate")
  }

  // Handle view all employers
  const handleViewAllEmployers = () => {
    router.push("/employers")
  }

  // Calculate stats
  const ratingDistribution = calculateRatingDistribution()
  const totalEmployers = stats?.total_employers || 0
  const recentActivity = stats?.recent_updates || 0
  const criticalAlerts = alerts?.filter(a => a.type === "error").length || 0

  if (statsError || alertsError) {
    return (
      <div className="px-safe py-4 pb-safe-bottom space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Ratings</h1>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <h3 className="font-semibold">Failed to load ratings</h3>
            </div>
            <p className="text-sm text-red-700 mt-1">
              {statsError?.message || alertsError?.message || "Unknown error occurred"}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="px-safe py-4 pb-safe-bottom space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Employer Ratings</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={handleNewRating}>
            <Plus className="h-4 w-4 mr-1" />
            Rate
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{totalEmployers}</p>
                <p className="text-xs text-muted-foreground">Total Employers</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">{ratingDistribution.green}</p>
                <p className="text-xs text-muted-foreground">Green Rated</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-amber-600">{ratingDistribution.amber + ratingDistribution.yellow}</p>
                <p className="text-xs text-muted-foreground">Needs Review</p>
              </div>
              <BarChart3 className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-600">{ratingDistribution.red}</p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      {alerts && alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Alerts ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.slice(0, 3).map((alert) => (
              <div key={alert.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${
                  alert.type === "error" ? "bg-red-500" :
                  alert.type === "warning" ? "bg-amber-500" : "bg-blue-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">{alert.message}</p>
                </div>
              </div>
            ))}
            {alerts.length > 3 && (
              <Button variant="outline" size="sm" className="w-full">
                View all alerts
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <Tabs defaultValue="search" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="filters">Filters</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </TabsContent>

        <TabsContent value="filters" className="mt-3">
          <RatingFiltersComponent compact onFiltersChange={() => {}} />
        </TabsContent>
      </Tabs>

      {/* Search Results */}
      {(searchQuery || Object.keys(state.filters).length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Search Results
              {searchResults && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({searchResults.employers.length} employers)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isSearchLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-gray-100 rounded-lg h-16 animate-pulse" />
                ))}
              </div>
            ) : searchResults?.employers && searchResults.employers.length > 0 ? (
              searchResults.employers.map((employer) => (
                <div
                  key={employer.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleEmployerClick(employer)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{employer.employer_name}</p>
                    {employer.primary_trade && (
                      <p className="text-xs text-muted-foreground">{employer.primary_trade}</p>
                    )}
                    {employer.location && (
                      <p className="text-xs text-muted-foreground">{employer.location}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <QuickRatingIndicator employerId={employer.id} />
                    {employer.project_count > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {employer.project_count} projects
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground">No employers found matching your criteria</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={handleViewAllEmployers}>
          <Users className="h-4 w-4 mr-2" />
          All Employers
        </Button>
        <Button variant="outline" onClick={handleNewRating}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rating
        </Button>
      </div>

      {/* Recent Activity Summary */}
      {recentActivity > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm">
                {recentActivity} rating{recentActivity !== 1 ? 's' : ''} updated recently
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}