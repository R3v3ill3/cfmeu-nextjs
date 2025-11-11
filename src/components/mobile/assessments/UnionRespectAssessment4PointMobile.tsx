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
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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
  Star,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import { MobileRatingSelector4Point, MobileRatingSelector4PointCompact } from "@/components/ui/MobileRatingSelector4Point"
import { useHapticFeedback } from "@/components/mobile/shared/HapticFeedback"
import { toast } from "sonner"

interface UnionRespectAssessment4PointMobileProps {
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
  mobileExamples: string[] // Shorter examples for mobile
}

const unionRespectCriteria: CriteriaItem[] = [
  {
    id: 'right_of_entry',
    label: 'Right of Entry',
    description: 'Union access to workplace',
    icon: Shield,
    examples: [
      'Allows union representatives access to site',
      'Respects legal right of entry provisions',
      'Provides appropriate access for workplace inspections'
    ],
    mobileExamples: [
      'Site access allowed',
      'Legal rights respected',
      'Inspection access provided'
    ]
  },
  {
    id: 'delegate_accommodation',
    label: 'Delegate Relations',
    description: 'How employer treats union delegates',
    icon: Users,
    examples: [
      'Recognizes union delegates as workplace representatives',
      'Provides appropriate facilities for delegate duties',
      'Allows delegates time for union activities'
    ],
    mobileExamples: [
      'Delegates recognized',
      'Facilities provided',
      'Time for union duties'
    ]
  },
  {
    id: 'access_to_information',
    label: 'Information Access',
    description: 'Access to workplace information',
    icon: FileText,
    examples: [
      'Provides requested workplace information promptly',
      'Shares relevant workplace changes with union',
      'Maintains transparency in workplace matters'
    ],
    mobileExamples: [
      'Info provided promptly',
      'Changes communicated',
      'Transparency maintained'
    ]
  },
  {
    id: 'access_to_inductions',
    label: 'New Starter Access',
    description: 'Union access to new workers',
    icon: GraduationCap,
    examples: [
      'Allows union representation at new starter inductions',
      'Provides access to new workers for union introduction',
      'Includes union information in induction materials'
    ],
    mobileExamples: [
      'Induction access allowed',
      'New worker access',
      'Union info included'
    ]
  },
  {
    id: 'eba_status',
    label: 'EBA Status',
    description: 'Enterprise Bargaining Agreement status',
    icon: Star,
    examples: [
      'Current and certified EBA in place',
      'EBA covers all relevant employees',
      'Regular EBA review and renewal process'
    ],
    mobileExamples: [
      'Current EBA active',
      'All employees covered',
      'Regular reviews conducted'
    ]
  }
]

const confidenceLevels = [
  { value: 'very_high', label: 'Very High', shortLabel: 'V.High' },
  { value: 'high', label: 'High', shortLabel: 'High' },
  { value: 'medium', label: 'Medium', shortLabel: 'Med' },
  { value: 'low', label: 'Low', shortLabel: 'Low' }
]

const assessmentMethods = [
  { value: 'site_visit', label: 'Site Visit' },
  { value: 'phone_call', label: 'Phone Call' },
  { value: 'union_meeting', label: 'Union Meeting' },
  { value: 'worker_interview', label: 'Worker Interview' },
  { value: 'document_review', label: 'Document Review' },
  { value: 'other', label: 'Other' }
]

export function UnionRespectAssessment4PointMobile({
  employerId,
  employerName,
  projectId,
  onSave,
  onViewHistory,
  readonly = false,
  className = ""
}: UnionRespectAssessment4PointMobileProps) {
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
    follow_up_required: false,
    follow_up_date: ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedCriteria, setExpandedCriteria] = useState<string[]>([])
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

  const toggleCriteriaExpanded = (criterionId: string) => {
    setExpandedCriteria(prev =>
      prev.includes(criterionId)
        ? prev.filter(id => id !== criterionId)
        : [...prev, criterionId]
    )
    hapticFeedback?.('light')
  }

  const handleSave = useCallback(async () => {
    if (completedCriteria < Object.keys(formData.criteria).length) {
      toast.error("Please complete all criteria before saving")
      hapticFeedback?.('notificationError')
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
      }

      hapticFeedback?.('notificationSuccess')
      toast.success("Assessment saved successfully")
    } catch (error) {
      console.error('Error saving assessment:', error)
      hapticFeedback?.('notificationError')
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
      default: return 'Rate'
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header Card */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Union Respect Assessment
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {employerName}
              </p>
            </div>
            <Badge variant="outline" className="text-sm px-2 py-1">
              {getRatingLabel(overallRating)} ({overallRating}/4)
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progress</span>
              <span>{Math.round(completionPercentage)}%</span>
            </div>
            <Progress value={completionPercentage} className="h-2" />
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Rate each area: 1=Good, 4=Terrible. Tap criteria for examples.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Criteria Assessment */}
      <div className="space-y-3">
        {unionRespectCriteria.map((criterion) => {
          const Icon = criterion.icon
          const currentRating = formData.criteria[criterion.id as keyof typeof formData.criteria]
          const isExpanded = expandedCriteria.includes(criterion.id)

          return (
            <Card key={criterion.id} className="border">
              <Collapsible open={isExpanded} onOpenChange={() => toggleCriteriaExpanded(criterion.id)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleCriteriaExpanded(criterion.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="text-left">
                          <Label className="text-base font-medium">{criterion.label}</Label>
                          <p className="text-xs text-muted-foreground">{criterion.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getRatingColor(currentRating)}>
                          {currentRating > 0 ? getRatingLabel(currentRating) : 'Not Rated'}
                        </Badge>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="space-y-3 pt-0">
                    {/* Examples */}
                    <div className="bg-muted/50 rounded p-3">
                      <p className="text-sm font-medium mb-2">Examples:</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {criterion.mobileExamples.map((example, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-primary">•</span>
                            {example}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Mobile Rating Selector */}
                    <div>
                      <Label className="text-sm font-medium">Rating:</Label>
                      <div className="mt-2 px-2 py-1 -mx-2 -my-1">
                        <MobileRatingSelector4PointCompact
                          value={currentRating}
                          onChange={(value) => handleCriteriaChange(criterion.id, value)}
                          disabled={readonly}
                        />
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )
        })}
      </div>

      {/* Assessment Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Assessment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Confidence and Method */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm">Confidence</Label>
              <Select
                value={formData.confidence_level}
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, confidence_level: value }))}
                disabled={readonly}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {confidenceLevels.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Method</Label>
              <Select
                value={formData.assessment_method}
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, assessment_method: value }))}
                disabled={readonly}
              >
                <SelectTrigger className="text-sm">
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
            <Label className="text-sm">Notes</Label>
            <Textarea
              placeholder="Add any specific examples or concerns..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="text-sm"
              disabled={readonly}
            />
          </div>

          {/* Follow-up */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-transparent hover:border-gray-300 focus:border-blue-500 min-h-[56px] cursor-pointer transition-colors">
              <Checkbox
                id="follow_up_required"
                checked={formData.follow_up_required}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, follow_up_required: checked }))}
                disabled={readonly}
              />
              <Label htmlFor="follow_up_required" className="flex-1 text-sm font-normal cursor-pointer select-none">
                Follow-up Required
              </Label>
            </div>

            {formData.follow_up_required && (
              <div className="space-y-2">
                <Label className="text-sm">Follow-up Date</Label>
                <Input
                  type="date"
                  value={formData.follow_up_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, follow_up_date: e.target.value }))}
                  className="text-sm"
                  disabled={readonly}
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {!readonly && (
            <div className="flex justify-end gap-3 pt-2">
              {onViewHistory && (
                <Button variant="outline" size="sm" onClick={onViewHistory}>
                  History
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={isSubmitting || completedCriteria < Object.keys(formData.criteria).length}
                className="min-w-24"
                size="sm"
              >
                {isSubmitting ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save
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