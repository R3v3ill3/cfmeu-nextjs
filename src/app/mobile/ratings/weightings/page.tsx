"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'

export const dynamic = 'force-dynamic'
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WeightingManagerMobile } from "@/components/mobile/rating-system/WeightingManagerMobile"
import { useToast } from "@/hooks/use-toast"
import { WeightingConfig, RatingTrack, RoleType } from "@/types/rating"

// Mock templates and current weighting
const mockTemplates: WeightingConfig[] = [
  {
    id: "template-1",
    name: "Compliance Focused",
    description: "Heavy emphasis on compliance and safety metrics",
    track: "project_data",
    role_context: "organiser",
    factors: [
      { id: "compliance", name: "Compliance Score", weight: 40, min_value: 0, max_value: 100, required: true },
      { id: "safety", name: "Safety Record", weight: 30, min_value: 0, max_value: 10, required: true },
      { id: "participation", name: "Worker Participation", weight: 20, min_value: 0, max_value: 100, required: true },
      { id: "disputes", name: "Dispute Management", weight: 10, min_value: 0, max_value: 10, required: true },
    ],
    is_default: false,
    created_by: "system",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "template-2",
    name: "Relations Priority",
    description: "Focus on relationship quality and cooperation",
    track: "organiser_expertise",
    role_context: "organiser",
    factors: [
      { id: "relationship", name: "Relationship Quality", weight: 35, min_value: 0, max_value: 10, required: true },
      { id: "cooperation", name: "Cooperation Level", weight: 35, min_value: 0, max_value: 10, required: true },
      { id: "communication", name: "Communication", weight: 20, min_value: 0, max_value: 10, required: true },
      { id: "problem_solving", name: "Problem Solving", weight: 10, min_value: 0, max_value: 10, required: true },
    ],
    is_default: true,
    created_by: "admin",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

const mockCurrentWeighting: WeightingConfig = {
  id: "current-1",
  name: "Current Configuration",
  description: "Active weighting configuration for organiser role",
  track: "organiser_expertise",
  role_context: "organiser",
  factors: [
    { id: "relationship", name: "Relationship Quality", weight: 25, min_value: 0, max_value: 10, required: true },
    { id: "communication", name: "Communication", weight: 25, min_value: 0, max_value: 10, required: true },
    { id: "cooperation", name: "Cooperation Level", weight: 25, min_value: 0, max_value: 10, required: true },
    { id: "problem_solving", name: "Problem Solving", weight: 25, min_value: 0, max_value: 10, required: true },
  ],
  is_default: false,
  created_by: "current-user",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

interface WeightingsPageProps {
  searchParams: {
    track?: RatingTrack
    role?: RoleType
  }
}

export default function WeightingsPage({ searchParams }: WeightingsPageProps) {
  const router = useRouter()
  const { toast } = useToast()

  const track = searchParams.track || 'organiser_expertise'
  const role = searchParams.role || 'organiser'

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleSaveWeighting = useCallback(async (config: WeightingConfig) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      toast({
        title: "Weighting saved",
        description: "Your weighting configuration has been saved successfully.",
      })
    } catch (error) {
      console.error("Failed to save weighting:", error)
      toast({
        title: "Save failed",
        description: "Unable to save weighting configuration. Please try again.",
        variant: "destructive",
      })
    }
  }, [toast])

  const handlePreviewWeighting = useCallback((config: WeightingConfig) => {
    toast({
      title: "Preview mode",
      description: "This would show how the weighting affects ratings.",
    })
  }, [toast])

  const handleDuplicateTemplate = useCallback((template: WeightingConfig) => {
    toast({
      title: "Template duplicated",
      description: `A copy of "${template.name}" has been created.`,
    })
  }, [toast])

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
              <h1 className="text-lg font-semibold">Weighting Configuration</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Weighting Manager Content */}
      <div className="h-[calc(100vh-73px)]">
        <WeightingManagerMobile
          track={track}
          roleContext={role}
          currentWeighting={mockCurrentWeighting}
          availableTemplates={mockTemplates.filter(t => t.track === track && t.role_context === role)}
          onSaveWeighting={handleSaveWeighting}
          onPreviewWeighting={handlePreviewWeighting}
          onDuplicateTemplate={handleDuplicateTemplate}
        />
      </div>
    </div>
  )
}