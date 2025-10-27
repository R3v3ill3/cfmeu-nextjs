"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Star,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  BarChart3,
  Shield,
  Users,
  FileText,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Info,
  Target,
  Activity
} from "lucide-react"
import { toast } from "sonner"

interface EmployerRatingDisplay4PointProps {
  employerId: string
  employerName: string
  projectId?: string
  showHistory?: boolean
  allowRefresh?: boolean
  className?: string
}

interface RatingData {
  id: string
  overall_rating: number
  overall_rating_label: string
  eba_status_rating: number
  compliance_rating: number
  union_respect_rating: number
  safety_rating: number
  subcontractor_rating: number
  overall_confidence_level: string
  rating_basis: string
  rating_date: string
  next_review_date: string
  previous_rating?: number
  previous_rating_label?: string
  rating_change_reason?: string
  calculation_details?: any
}

const ratingColors = {
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  yellow: 'bg-yellow-500',
  green: 'bg-green-500'
}

const ratingBgColors = {
  red: 'bg-red-50 border-red-200',
  amber: 'bg-amber-50 border-amber-200',
  yellow: 'bg-yellow-50 border-yellow-200',
  green: 'bg-green-50 border-green-200'
}

const ratingTextColors = {
  red: 'text-red-700',
  amber: 'text-amber-700',
  yellow: 'text-yellow-700',
  green: 'text-green-700'
}

const getRatingLabel = (rating: number) => {
  switch (rating) {
    case 1: return 'Red'
    case 2: return 'Amber'
    case 3: return 'Yellow'
    case 4: return 'Green'
    default: return 'Unknown'
  }
}

const getRatingDescription = (rating: number) => {
  switch (rating) {
    case 1: return 'Critical Issues - Immediate Action Required'
    case 2: return 'Significant Concerns - Attention Needed'
    case 3: return 'Adequate Performance - Room for Improvement'
    case 4: return 'Excellent Performance - Union Partner'
    default: return 'Rating Not Available'
  }
}

const getComponentIcon = (component: string) => {
  switch (component) {
    case 'eba_status': return Shield
    case 'compliance': return FileText
    case 'union_respect': return Users
    case 'safety': return Activity
    case 'subcontractor': return BarChart3
    default: return Target
  }
}

const getComponentLabel = (component: string) => {
  switch (component) {
    case 'eba_status': return 'EBA Status'
    case 'compliance': return 'CBUS/INCOLINK Compliance'
    case 'union_respect': return 'Union Respect'
    case 'safety': return 'Safety Performance'
    case 'subcontractor': return 'Subcontractor Usage'
    default: return component
  }
}

export function EmployerRatingDisplay4Point({
  employerId,
  employerName,
  projectId,
  showHistory = true,
  allowRefresh = true,
  className = ""
}: EmployerRatingDisplay4PointProps) {
  const [rating, setRating] = useState<RatingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const fetchRating = async () => {
    try {
      const url = projectId
        ? `/api/ratings/calculate-4-point-employer-rating?employer_id=${employerId}&project_id=${projectId}`
        : `/api/ratings/calculate-4-point-employer-rating?employer_id=${employerId}`

      // First try to get current rating
      const currentResponse = await fetch(url)
      if (currentResponse.ok) {
        const currentData = await currentResponse.json()
        if (currentData.success && currentData.data) {
          setRating(currentData.data)
          setLoading(false)
          return
        }
      }

      // If no current rating, try to calculate one
      if (allowRefresh) {
        setRefreshing(true)
        const calculateResponse = await fetch('/api/ratings/calculate-4-point-employer-rating', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employer_id: employerId,
            project_id: projectId,
            calculation_method: 'automatic_calculation',
            trigger_type: 'manual_recalculation'
          })
        })

        if (calculateResponse.ok) {
          const calculateData = await calculateResponse.json()
          if (calculateData.success && calculateData.data) {
            setRating(calculateData.data)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching rating:', error)
      toast.error('Failed to load employer rating')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchRating()
  }, [employerId, projectId])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchRating()
    toast.success('Rating refreshed successfully')
  }

  const getDaysUntilReview = () => {
    if (!rating?.next_review_date) return null
    const today = new Date()
    const reviewDate = new Date(rating.next_review_date)
    const diffTime = reviewDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getRatingChange = () => {
    if (!rating?.previous_rating || !rating?.overall_rating) return null
    return rating.overall_rating - rating.previous_rating
  }

  if (loading) {
    return (
      <Card className={`${className}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading rating...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!rating) {
    return (
      <Card className={`${className}`}>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <h3 className="font-medium">No Rating Available</h3>
            <p className="text-sm text-muted-foreground mb-4">
              No rating has been calculated for this employer.
            </p>
            {allowRefresh && (
              <Button onClick={handleRefresh} disabled={refreshing}>
                {refreshing && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                Calculate Rating
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const ratingChange = getRatingChange()
  const daysUntilReview = getDaysUntilReview()
  const colorKey = rating.overall_rating_label.toLowerCase() as keyof typeof ratingColors

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Rating Card */}
      <Card className={`${ratingBgColors[colorKey]} border-2`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full ${ratingColors[colorKey]}`} />
                {employerName} - CFMEU 4-Point Rating
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {getRatingDescription(rating.overall_rating)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {ratingChange !== null && (
                <Badge variant={ratingChange > 0 ? 'default' : ratingChange < 0 ? 'destructive' : 'secondary'}>
                  {ratingChange > 0 && <TrendingUp className="h-3 w-3 mr-1" />}
                  {ratingChange < 0 && <TrendingDown className="h-3 w-3 mr-1" />}
                  {ratingChange > 0 ? '+' : ''}{ratingChange}
                </Badge>
              )}
              {allowRefresh && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  {refreshing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Overall Rating */}
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${ratingColors[colorKey]} text-white mb-3`}>
                <span className="text-2xl font-bold">{rating.overall_rating}</span>
              </div>
              <div className={`text-lg font-semibold ${ratingTextColors[colorKey]}`}>
                {getRatingLabel(rating.overall_rating)} Rating
              </div>
              <div className="text-sm text-muted-foreground">
                Confidence: {rating.overall_confidence_level}
              </div>
            </div>

            {/* Rating Details */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                <span>Rated: {new Date(rating.rating_date).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4" />
                <span>Basis: {rating.rating_basis}</span>
              </div>
              {daysUntilReview !== null && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  <span className={daysUntilReview <= 30 ? 'text-amber-600 font-medium' : ''}>
                    Review: {daysUntilReview > 0 ? `in ${daysUntilReview} days` : 'overdue'}
                  </span>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>EBA Status:</span>
                <Badge variant="outline">{getRatingLabel(rating.eba_status_rating)}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Compliance:</span>
                <Badge variant="outline">{getRatingLabel(rating.compliance_rating)}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Union Respect:</span>
                <Badge variant="outline">{getRatingLabel(rating.union_respect_rating)}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Rating Breakdown */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="components">Component Breakdown</TabsTrigger>
          <TabsTrigger value="details">Calculation Details</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rating Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ratingChange !== null && ratingChange !== 0 && (
                <Alert>
                  <TrendingUp className={`h-4 w-4 ${ratingChange > 0 ? 'text-green-600' : 'text-red-600'}`} />
                  <AlertDescription>
                    Rating has {ratingChange > 0 ? 'improved' : 'declined'} by {Math.abs(ratingChange)} point{Math.abs(ratingChange) > 1 ? 's' : ''}
                    {rating.rating_change_reason && `: ${rating.rating_change_reason}`}
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium">Component Ratings</h4>
                  {[
                    { key: 'eba_status', value: rating.eba_status_rating },
                    { key: 'compliance', value: rating.compliance_rating },
                    { key: 'union_respect', value: rating.union_respect_rating },
                    { key: 'safety', value: rating.safety_rating },
                    { key: 'subcontractor', value: rating.subcontractor_rating }
                  ].map(({ key, value }) => {
                    const Icon = getComponentIcon(key)
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span className="text-sm">{getComponentLabel(key)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={(value / 4) * 100} className="w-16 h-2" />
                          <span className="text-sm font-medium w-4">{value}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Rating Assessment</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Assessment Basis:</span>
                      <span className="font-medium">{rating.rating_basis}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Confidence Level:</span>
                      <span className="font-medium">{rating.overall_confidence_level}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Updated:</span>
                      <span className="font-medium">{new Date(rating.rating_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="components" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Component Rating Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { key: 'eba_status', value: rating.eba_status_rating, weight: 0.30 },
                  { key: 'compliance', value: rating.compliance_rating, weight: 0.25 },
                  { key: 'union_respect', value: rating.union_respect_rating, weight: 0.25 },
                  { key: 'safety', value: rating.safety_rating, weight: 0.15 },
                  { key: 'subcontractor', value: rating.subcontractor_rating, weight: 0.05 }
                ].map(({ key, value, weight }) => {
                  const Icon = getComponentIcon(key)
                  const componentColorKey = getRatingLabel(value).toLowerCase() as keyof typeof ratingColors
                  return (
                    <div key={key} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5" />
                          <span className="font-medium">{getComponentLabel(key)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={ratingTextColors[componentColorKey]}>
                            {getRatingLabel(value)} ({value}/4)
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {Math.round(weight * 100)}% weight
                          </span>
                        </div>
                      </div>
                      <Progress value={(value / 4) * 100} className="h-2" />
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Calculation Details</CardTitle>
            </CardHeader>
            <CardContent>
              {rating.calculation_details ? (
                <div className="space-y-4">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      This rating was calculated using a weighted average of all assessment components,
                      with EBA status serving as a critical baseline factor.
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Rating Factors</h4>
                      <div className="space-y-2 text-sm">
                        {Object.entries(rating.calculation_details).map(([key, value]: [string, any]) => (
                          <div key={key} className="flex justify-between">
                            <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                            <span className="font-medium">
                              {typeof value === 'object' ? value.rating || value.weight : value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Metadata</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Rating ID:</span>
                          <span className="font-mono text-xs">{rating.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Calculation Method:</span>
                          <span>Automatic</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Next Review:</span>
                          <span>{new Date(rating.next_review_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Detailed calculation information not available.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}