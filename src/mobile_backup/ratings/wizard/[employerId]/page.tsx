"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RatingWizard } from "@/components/mobile/rating-system/RatingWizard"
import { useToast } from "@/hooks/use-toast"
import { useOfflineSync } from "@/hooks/mobile/useOfflineSync"
import { RatingWizardFormData, RatingTrack, RoleType, EmployerRatingData } from "@/types/rating"

// Mock employer data
const mockEmployer: EmployerRatingData = {
  id: "1",
  employer_name: "BuildRight Construction",
  abn: "12345678901",
  project_count: 12,
  primary_trade: "Construction",
  location: "Sydney, NSW",
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
  rating_history: [],
  last_updated: new Date().toISOString(),
}

interface WizardPageProps {
  params: {
    employerId: string
  }
  searchParams: {
    track?: RatingTrack
    role?: RoleType
  }
}

export default function WizardPage({ params, searchParams }: WizardPageProps) {
  const router = useRouter()
  const { toast } = useToast()

  const employerId = params.employerId
  const track = searchParams.track || 'organiser_expertise'
  const role = searchParams.role || 'organiser'

  const { addItem } = useOfflineSync([], {
    storageKey: "rating-submissions",
    autoSync: true,
  })

  const handleBack = React.useCallback(() => {
    router.back()
  }, [router])

  const handleCancel = React.useCallback(() => {
    router.push("/mobile/ratings")
  }, [router])

  const handleSubmit = React.useCallback(async (data: RatingWizardFormData) => {
    try {
      // Save the rating submission
      await addItem({
        id: `rating-${Date.now()}`,
        ...data,
        created_at: new Date().toISOString(),
        status: "pending",
      })

      toast({
        title: "Rating submitted",
        description: "Your assessment has been saved and will be synced when online.",
      })

      // Navigate back to the ratings list
      router.push("/mobile/ratings")
    } catch (error) {
      console.error("Failed to submit rating:", error)
      toast({
        title: "Submission failed",
        description: "Unable to save your rating. Please try again.",
        variant: "destructive",
      })
    }
  }, [addItem, toast, router])

  // In a real app, you would fetch the employer data
  const employer = mockEmployer

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-lg font-semibold">Rate Employer</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Wizard Content */}
      <div className="h-[calc(100vh-73px)]">
        <RatingWizard
          employerId={employerId}
          employerName={employer.employer_name}
          track={track}
          roleContext={role}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          showPreview={true}
          allowSaveDraft={true}
        />
      </div>
    </div>
  )
}