"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Users,
  FileText,
  MessageSquare,
  GraduationCap,
  Shield,
  Info,
  Save,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  Star
} from "lucide-react"
import { useHapticFeedback } from "@/components/mobile/shared/HapticFeedback"
import { toast } from "sonner"

interface UnionRespectAssessment4PointProps {
  employerId: string
  employerName: string
  projectId?: string
  onSave?: (data: any) => Promise<void>
  onViewHistory?: () => void
  readonly?: boolean
  className?: string
}

interface CriteriaItem {
  id: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  examples: string[]
}

const unionRespectCriteria: CriteriaItem[] = [
  {
    id: 'right_of_entry',
    label: 'Right of Entry',
    description: 'How well does the employer respect union right of entry to workplaces?',
    icon: Shield,
    examples: [
      'Allows union representatives access to site',
      'Respects legal right of entry provisions',
      'Provides appropriate access for workplace inspections'
    ]
  },
  {
    id: 'delegate_accommodation',
    label: 'Delegate Accommodation & Recognition',
    description: 'How well does the employer accommodate and recognize union delegates?',
    icon: Users,
    examples: [
      'Recognizes union delegates as workplace representatives',
      'Provides appropriate facilities for delegate duties',
      'Allows delegates time for union activities'
    ]
  },
  {
    id: 'access_to_information',
    label: 'Access to Information',
    description: 'How well does the employer provide access to workplace information?',
    icon: FileText,
    examples: [
      'Provides requested workplace information promptly',
      'Shares relevant workplace changes with union',
      'Maintains transparency in workplace matters'
    ]
  },
  {
    id: 'access_to_inductions',
    label: 'Access to Inductions/New Starters',
    description: 'How well does the employer allow union access to new worker inductions?',
    icon: GraduationCap,
    examples: [
      'Allows union representation at new starter inductions',
      'Provides access to new workers for union introduction',
      'Includes union information in induction materials'
    ]
  },
  {
    id: 'eba_status',
    label: 'EBA Status',
    description: 'Assessment of the employer\'s Enterprise Bargaining Agreement status and compliance',
    icon: Star,
    examples: [
      'Current and certified EBA in place',
      'EBA covers all relevant employees',
      'Regular EBA review and renewal process'
    ]
  }
]

const confidenceLevels = [
  { value: 'very_high', label: 'Very High', description: 'Extremely confident in assessment accuracy' },
  { value: 'high', label: 'High', description: 'Confident with minor uncertainties' },
  { value: 'medium', label: 'Medium', description: 'Moderately confident with some gaps' },
  { value: 'low', label: 'Low', description: 'Limited confidence due to insufficient information' }
]

const assessmentMethods = [
  { value: 'site_visit', label: 'Site Visit' },
  { value: 'phone_call', label: 'Phone Call' },
  { value: 'union_meeting', label: 'Union Meeting' },
  { value: 'worker_interview', label: 'Worker Interview' },
  { value: 'document_review', label: 'Document Review' },
  { value: 'other', label: 'Other' }
]

export function UnionRespectAssessment4Point({
  employerId,
  employerName,
  projectId,
  onSave,
  onViewHistory,
  readonly = false,
  className = ""
}: UnionRespectAssessment4PointProps) {
  const [formData, setFormData] = useState({
    criteria: {
      right_of_entry: 3,
      delegate_accommodation: 3,
      access_to_information: 3,
      access_to_inductions: 3,
      eba_status: 3
    },
    confidence_level: 'medium' as const,
    assessment_method: 'site_visit' as const,
    notes: '',
    evidence_urls: [] as string[],
    follow_up_required: false,
    follow_up_date: ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showExamples, setShowExamples] = useState<string | null>(null)
  const { hapticFeedback } = useHapticFeedback()

  // Calculate overall rating
  const overallRating = Math.round(
    Object.values(formData.criteria).reduce((sum, val) => sum + val, 0) / Object.keys(formData.criteria).length
  )

  // Calculate completion percentage
  const completedCriteria = Object.values(formData.criteria).filter(val => val > 0).length
  const completionPercentage = (completedCriteria / Object.keys(formData.criteria).length) * 100

  const handleCriteriaChange = (criterionId: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      criteria: {
        ...prev.criteria,
        [criterionId]: value
      }
    }))
    hapticFeedback?.('selectionChanged')
  }

  const handleSave = useCallback(async () => {
    if (completedCriteria < Object.keys(formData.criteria).length) {
      toast.error("Please complete all criteria before saving")
      return
    }

    setIsSubmitting(true)
    hapticFeedback?.('impactMedium')

    try {
      const assessmentData = {
        employer_id: employerId,
        project_id: projectId,
        criteria: formData.criteria,
        confidence_level: formData.confidence_level,
        assessment_method: formData.assessment_method,
        notes: formData.notes || undefined,
        evidence_urls: formData.evidence_urls,
        follow_up_required: formData.follow_up_required,
        follow_up_date: formData.follow_up_date || undefined
      }

      if (onSave) {
        await onSave(assessmentData)
      } else {
        // Default API call
        const response = await fetch('/api/assessments/union-respect-4-point', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(assessmentData)
        })

        if (!response.ok) {
          throw new Error('Failed to save assessment')
        }

        const result = await response.json()
        toast.success("Union Respect Assessment saved successfully")
      }
    } catch (error) {
      console.error('Error saving assessment:', error)
      toast.error("Failed to save assessment")
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, employerId, projectId, onSave, completedCriteria, hapticFeedback])

  const getRatingColor = (rating: number) => {
    switch (rating) {
      case 1: return 'text-red-600 bg-red-50 border-red-200'
      case 2: return 'text-amber-600 bg-amber-50 border-amber-200'
      case 3: return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 4: return 'text-green-600 bg-green-50 border-green-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getRatingLabel = (rating: number) => {
    switch (rating) {
      case 1: return 'Terrible'
      case 2: return 'Poor'
      case 3: return 'Fair'
      case 4: return 'Good'
      default: return 'Not Rated'
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Union Respect Assessment (4-Point Scale)
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {employerName} - Rate each criterion: 1=Good, 2=Fair, 3=Poor, 4=Terrible
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-lg px-3 py-1">
                {getRatingLabel(overallRating)} ({overallRating}/4)
              </Badge>
              {onViewHistory && (
                <Button variant="outline" size="sm" onClick={onViewHistory}>
                  History
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Assessment Progress</span>
              <span>{Math.round(completionPercentage)}%</span>
            </div>
            <Progress value={completionPercentage} className="h-2" />
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              This assessment evaluates the employer's relationship with the union across 5 key areas.
              Each rating uses a 4-point scale where 1=Good and 4=Terrible.
            </AlertDescription>
          </Alert>

          {/* Criteria Assessment */}
          <div className="space-y-4">
            {unionRespectCriteria.map((criterion) => {
              const Icon = criterion.icon
              const currentRating = formData.criteria[criterion.id as keyof typeof formData.criteria]
              const isShowingExamples = showExamples === criterion.id

              return (
                <div key={criterion.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <Icon className="h-5 w-5 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <Label className="text-base font-medium">{criterion.label}</Label>
                        <p className="text-sm text-muted-foreground mt-1">{criterion.description}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowExamples(isShowingExamples ? null : criterion.id)}
                    >
                      {isShowingExamples ? 'Hide' : 'Examples'}
                    </Button>
                  </div>

                  {isShowingExamples && (
                    <div className="bg-muted/50 rounded p-3 space-y-1">
                      <p className="text-sm font-medium">Examples:</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {criterion.examples.map((example, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-primary">•</span>
                            {example}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 4-Point Rating Selector */}
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => handleCriteriaChange(criterion.id, rating)}
                        disabled={readonly}
                        className={`
                          p-3 rounded-lg border-2 text-center transition-all
                          ${currentRating === rating
                            ? `${getRatingColor(rating)} border-primary`
                            : 'border-gray-200 hover:border-gray-300'
                          }
                          ${readonly ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}
                        `}
                      >
                        <div className="text-lg font-semibold">{rating}</div>
                        <div className="text-xs">{getRatingLabel(rating)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <Separator />

          {/* Assessment Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Confidence Level</Label>
              <Select
                value={formData.confidence_level}
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, confidence_level: value }))}
                disabled={readonly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {confidenceLevels.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      <div>
                        <div className="font-medium">{level.label}</div>
                        <div className="text-sm text-muted-foreground">{level.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Assessment Method</Label>
              <Select
                value={formData.assessment_method}
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, assessment_method: value }))}
                disabled={readonly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assessmentMethods.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Additional Notes</Label>
            <Textarea
              placeholder="Add any specific examples, concerns, or context..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={4}
              disabled={readonly}
            />
          </div>

          {/* Follow-up Options */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="follow_up_required"
                checked={formData.follow_up_required}
                onChange={(e) => setFormData(prev => ({ ...prev, follow_up_required: e.target.checked }))}
                disabled={readonly}
                className="rounded"
              />
              <Label htmlFor="follow_up_required">Follow-up Required</Label>
            </div>

            {formData.follow_up_required && (
              <div className="space-y-2">
                <Label>Follow-up Date</Label>
                <Input
                  type="date"
                  value={formData.follow_up_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, follow_up_date: e.target.value }))}
                  disabled={readonly}
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {!readonly && (
            <div className="flex justify-end gap-3 pt-4">
              <Button
                onClick={handleSave}
                disabled={isSubmitting || completedCriteria < Object.keys(formData.criteria).length}
                className="min-w-32"
              >
                {isSubmitting ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Assessment
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}