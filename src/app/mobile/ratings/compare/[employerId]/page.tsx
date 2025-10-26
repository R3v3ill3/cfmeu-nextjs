"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RatingComparison } from "@/components/mobile/rating-system/RatingComparison"
import { useToast } from "@/hooks/use-toast"
import { RatingComparison as RatingComparisonType, RoleType } from "@/types/rating"

// Mock comparison data
const mockComparison: RatingComparisonType = {
  employer_id: "1",
  employer_name: "BuildRight Construction",
  role_context: "organiser",
  project_data_rating: {
    id: "proj-1",
    employer_id: "1",
    rating: "green",
    confidence: "high",
    track: "project_data",
    role_context: "organiser",
    calculated_at: new Date().toISOString(),
    calculated_by: "system",
    compliance_score: 85,
    participation_rate: 78,
    dispute_count: 1,
    safety_incidents: 0,
    eba_compliance: 92,
  },
  organiser_expertise_rating: {
    id: "exp-1",
    employer_id: "1",
    rating: "green",
    confidence: "very_high",
    track: "organiser_expertise",
    role_context: "organiser",
    calculated_at: new Date().toISOString(),
    calculated_by: "john.doe",
    relationship_quality: 9,
    communication_effectiveness: 8,
    cooperation_level: 9,
    problem_solving: 8,
    historical_performance: 9,
  },
  discrepancy: {
    exists: false,
    severity: "none",
    explanation: "Both project data and organiser expertise ratings are aligned, indicating consistency between objective metrics and subjective assessment.",
  },
  last_updated: new Date().toISOString(),
}

interface ComparePageProps {
  params: {
    employerId: string
  }
  searchParams: {
    role?: RoleType
  }
}

export default function ComparePage({ params, searchParams }: ComparePageProps) {
  const router = useRouter()
  const { toast } = useToast()

  const employerId = params.employerId
  const role = searchParams.role || 'organiser'

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleResolveDiscrepancy = useCallback(() => {
    toast({
      title: "Investigation started",
      description: "A task has been created to investigate this rating discrepancy.",
    })
  }, [toast])

  const handleAddComment = useCallback(() => {
    toast({
      title: "Comment added",
      description: "Your comment has been saved to the rating record.",
    })
  }, [toast])

  const handleViewDetails = useCallback((track: string) => {
    router.push(`/mobile/ratings/breakdown/${employerId}?track=${track}`)
  }, [router, employerId])

  const handleSwitchRole = useCallback((currentRole: RoleType) => {
    const newRole = currentRole === 'organiser' ? 'trade' : 'organiser'
    router.push(`/mobile/ratings/compare/${employerId}?role=${newRole}`)
  }, [router, employerId])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-semibold">Rating Comparison</h1>
          </div>
        </div>
      </div>

      {/* Comparison Content */}
      <div className="p-4">
        <RatingComparison
          comparison={mockComparison}
          showHistoricalContext={true}
          showActions={true}
          onResolveDiscrepancy={handleResolveDiscrepancy}
          onAddComment={handleAddComment}
          onViewDetails={handleViewDetails}
          onSwitchRole={handleSwitchRole}
        />
      </div>
    </div>
  )
}