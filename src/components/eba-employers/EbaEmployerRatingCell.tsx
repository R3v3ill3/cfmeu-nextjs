"use client"

import { useState } from "react"
import { TrafficLightRatingDisplay } from "@/components/employers/TrafficLightRatingDisplay"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertCircle, Calendar, TrendingUp, AlertTriangle } from "lucide-react"
import { format } from "date-fns"

type TrafficLightRating = 'red' | 'amber' | 'yellow' | 'green'
type ConfidenceLevel = 'low' | 'medium' | 'high' | 'very_high'

interface Rating {
  final_rating: TrafficLightRating
  overall_confidence: ConfidenceLevel
  rating_date: string
  project_based_rating?: TrafficLightRating | null
  expertise_based_rating?: TrafficLightRating | null
  eba_status?: TrafficLightRating | null
  projects_included?: number
  expertise_assessments_included?: number
  rating_discrepancy?: boolean
  rating_status?: string
  review_required?: boolean
  updated_at: string
}

interface EbaEmployerRatingCellProps {
  employerId: string
  employerName: string
  rating?: Rating
}

export function EbaEmployerRatingCell({ employerId, employerName, rating }: EbaEmployerRatingCellProps) {
  const [showDetail, setShowDetail] = useState(false)

  if (!rating) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex items-center gap-1.5 cursor-help">
              <Badge variant="outline" className="text-xs text-muted-foreground">
                No Rating
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">No rating available for this employer</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  const confidenceLabel = rating.overall_confidence?.replace('_', ' ') || 'unknown'
  const isStale = rating.rating_date && new Date(rating.rating_date) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const needsReview = rating.review_required || rating.rating_discrepancy

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className="inline-flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setShowDetail(true)}
            >
              <TrafficLightRatingDisplay
                rating={rating.final_rating}
                size="sm"
              />
              {needsReview && (
                <AlertCircle className="h-3 w-3 text-amber-500" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-1 text-xs">
              <div className="font-medium capitalize">{rating.final_rating} Rating</div>
              <div>Confidence: <span className="capitalize">{confidenceLabel}</span></div>
              {rating.rating_date && (
                <div>Date: {format(new Date(rating.rating_date), 'dd MMM yyyy')}</div>
              )}
              {isStale && (
                <div className="text-amber-500">⚠ Rating may be outdated</div>
              )}
              <div className="pt-1 text-muted-foreground italic">Click for details</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rating Details: {employerName}</DialogTitle>
            <DialogDescription>
              Comprehensive rating breakdown and component analysis
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Final Rating */}
            <div className="flex items-center justify-between pb-4 border-b">
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Final Rating</div>
                <TrafficLightRatingDisplay
                  rating={rating.final_rating}
                  size="lg"
                  showLabel
                />
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-muted-foreground mb-1">Confidence</div>
                <Badge variant="outline" className="capitalize">
                  {confidenceLabel}
                </Badge>
              </div>
            </div>

            {/* Component Ratings */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Rating Components
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {rating.project_based_rating && (
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Project-Based</div>
                    <TrafficLightRatingDisplay
                      rating={rating.project_based_rating}
                      size="sm"
                    />
                    {rating.projects_included !== undefined && (
                      <div className="text-xs text-muted-foreground">
                        {rating.projects_included} project{rating.projects_included !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                )}

                {rating.expertise_based_rating && (
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Organiser Expertise</div>
                    <TrafficLightRatingDisplay
                      rating={rating.expertise_based_rating}
                      size="sm"
                    />
                    {rating.expertise_assessments_included !== undefined && (
                      <div className="text-xs text-muted-foreground">
                        {rating.expertise_assessments_included} assessment{rating.expertise_assessments_included !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                )}

                {rating.eba_status && (
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">EBA Status</div>
                    <TrafficLightRatingDisplay
                      rating={rating.eba_status}
                      size="sm"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Alerts & Status */}
            {(needsReview || isStale) && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Alerts
                </h3>
                <div className="space-y-2">
                  {rating.rating_discrepancy && (
                    <div className="flex items-start gap-2 text-sm p-2 bg-amber-50 dark:bg-amber-950 rounded border border-amber-200 dark:border-amber-800">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-amber-900 dark:text-amber-100">Rating Discrepancy</div>
                        <div className="text-xs text-amber-700 dark:text-amber-300">
                          Component ratings show significant differences
                        </div>
                      </div>
                    </div>
                  )}
                  {rating.review_required && (
                    <div className="flex items-start gap-2 text-sm p-2 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
                      <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-blue-900 dark:text-blue-100">Review Required</div>
                        <div className="text-xs text-blue-700 dark:text-blue-300">
                          This rating has been flagged for manual review
                        </div>
                      </div>
                    </div>
                  )}
                  {isStale && (
                    <div className="flex items-start gap-2 text-sm p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800">
                      <Calendar className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">Outdated Rating</div>
                        <div className="text-xs text-gray-700 dark:text-gray-300">
                          Rating is older than 90 days
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="pt-4 border-t">
              <div className="grid grid-cols-2 gap-3 text-xs">
                {rating.rating_date && (
                  <div>
                    <div className="font-medium text-muted-foreground mb-1">Rating Date</div>
                    <div>{format(new Date(rating.rating_date), 'dd MMM yyyy')}</div>
                  </div>
                )}
                {rating.updated_at && (
                  <div>
                    <div className="font-medium text-muted-foreground mb-1">Last Updated</div>
                    <div>{format(new Date(rating.updated_at), 'dd MMM yyyy HH:mm')}</div>
                  </div>
                )}
                {rating.rating_status && (
                  <div>
                    <div className="font-medium text-muted-foreground mb-1">Status</div>
                    <Badge variant="outline" className="capitalize text-xs">
                      {rating.rating_status.replace('_', ' ')}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-4 border-t">
              <Button 
                onClick={() => {
                  setShowDetail(false)
                  // Open employer detail modal on Rating tab
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('open-employer-rating', { 
                      detail: { employerId } 
                    }))
                  }, 100)
                }}
                className="w-full"
              >
                Open Full Rating Review
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}


