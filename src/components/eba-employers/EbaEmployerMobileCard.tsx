"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Star, FileCheck, ChevronDown } from "lucide-react"
import { TrafficLightRatingDisplay } from "@/components/employers/TrafficLightRatingDisplay"
import { useRouter } from "next/navigation"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"
import type { EmployerRow } from "./EbaEmployersMobileView"

type TrafficLightRating = 'red' | 'amber' | 'yellow' | 'green'
type ConfidenceLevel = 'low' | 'medium' | 'high' | 'very_high'

interface Rating {
  final_rating: TrafficLightRating
  overall_confidence: ConfidenceLevel
  rating_date: string
  updated_at: string
}

interface EbaEmployerMobileCardProps {
  employer: EmployerRow
  rating?: Rating
  onViewDetails: () => void
}

export function EbaEmployerMobileCard({ employer, rating, onViewDetails }: EbaEmployerMobileCardProps) {
  const router = useRouter()
  const { startNavigation } = useNavigationLoading()
  const [showProjectSheet, setShowProjectSheet] = useState(false)
  const [showRatingInfo, setShowRatingInfo] = useState(false)

  const handleReviewRating = () => {
    // Navigate to employer details with rating tab
    window.dispatchEvent(new CustomEvent('open-employer-rating', { 
      detail: { employerId: employer.employer_id } 
    }))
    onViewDetails()
  }

  const handleAuditOnProject = (projectId: string) => {
    const url = `/projects/${projectId}?tab=audit-compliance&employer=${employer.employer_id}`
    startNavigation(url)
    setTimeout(() => {
      router.push(url)
      setShowProjectSheet(false)
    }, 50)
  }

  const displayProjects = employer.projects.slice(0, 2)
  const remainingCount = employer.projects.length - 2

  return (
    <Card className="hover:bg-accent/50 transition-colors">
      <CardContent className="p-4 space-y-3">
        {/* Header: Name + Rating */}
        <div 
          className="flex items-start justify-between gap-3 cursor-pointer"
          onClick={onViewDetails}
        >
          <h3 className="font-semibold text-base flex-1 line-clamp-2">
            {employer.employer_name}
          </h3>
          
          <div onClick={(e) => {
            e.stopPropagation()
            if (rating) setShowRatingInfo(true)
          }}>
            {rating ? (
              <TrafficLightRatingDisplay
                rating={rating.final_rating}
                size="sm"
              />
            ) : (
              <Badge variant="outline" className="text-xs whitespace-nowrap">
                No Rating
              </Badge>
            )}
          </div>
        </div>

        {/* Projects Row */}
        {employer.projects.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {displayProjects.map((project) => (
              <Badge
                key={project.id}
                variant="secondary"
                className="text-xs cursor-pointer hover:bg-secondary/80"
                onClick={(e) => {
                  e.stopPropagation()
                  startNavigation(`/projects/${project.id}`)
                  setTimeout(() => window.location.href = `/projects/${project.id}`, 50)
                }}
              >
                {project.name}
              </Badge>
            ))}
            {remainingCount > 0 && (
              <Badge variant="outline" className="text-xs">
                +{remainingCount} more
              </Badge>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            onClick={(e) => {
              e.stopPropagation()
              handleReviewRating()
            }}
          >
            <Star className="h-4 w-4" />
            Review Rating
          </Button>

          {employer.projects.length > 0 && (
            <Sheet open={showProjectSheet} onOpenChange={setShowProjectSheet}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FileCheck className="h-4 w-4" />
                  Audit
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[60vh]">
                <SheetHeader>
                  <SheetTitle>Audit on Project</SheetTitle>
                  <SheetDescription>
                    Select a project to audit {employer.employer_name}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-2 overflow-y-auto max-h-[calc(60vh-120px)]">
                  {employer.projects.map((project) => (
                    <Button
                      key={project.id}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3"
                      onClick={() => handleAuditOnProject(project.id)}
                    >
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-medium">{project.name}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>

        {/* Rating Info Sheet */}
        {rating && (
          <Sheet open={showRatingInfo} onOpenChange={setShowRatingInfo}>
            <SheetContent side="bottom" className="h-[50vh]">
              <SheetHeader>
                <SheetTitle>Rating Information</SheetTitle>
                <SheetDescription>
                  {employer.employer_name}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2">Rating</div>
                    <TrafficLightRatingDisplay
                      rating={rating.final_rating}
                      size="lg"
                      showLabel
                    />
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-muted-foreground mb-2">Confidence</div>
                    <Badge variant="outline" className="capitalize">
                      {rating.overall_confidence?.replace('_', ' ') || 'unknown'}
                    </Badge>
                  </div>
                </div>

                <Button 
                  onClick={() => {
                    setShowRatingInfo(false)
                    handleReviewRating()
                  }}
                  className="w-full"
                >
                  Full Review
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </CardContent>
    </Card>
  )
}








