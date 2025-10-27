"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Save, Eye, AlertCircle, CheckCircle, Users } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/useAuth"
import {
  SubcontractorAssessmentData,
  RatingCriterion,
  ConfidenceLevel,
  AssessmentMethod
} from "@/types/assessment"

interface SubcontractorAssessmentFormProps {
  employerId: string
  employerName: string
  projectId?: string
  initialData?: Partial<SubcontractorAssessmentData>
  onSave?: (data: SubcontractorAssessmentData) => void
  onCancel?: () => void
  className?: string
}

// 4-point rating scale definitions
const RATING_SCALE = {
  1: { label: "Good", description: "Exceeds expectations", color: "bg-green-500" },
  2: { label: "Fair", description: "Meets expectations", color: "bg-yellow-500" },
  3: { label: "Poor", description: "Below expectations", color: "bg-orange-500" },
  4: { label: "Terrible", description: "Major concerns", color: "bg-red-500" }
}

const SUBCONTRACTOR_CRITERIA: RatingCriterion[] = [
  {
    id: "subcontractor_usage",
    name: "Subcontractor Usage",
    description: "Extent and quality of subcontractor employment on projects",
    weight: 1.2 // Higher weight as this is the main factor
  },
  {
    id: "payment_terms",
    name: "Payment Terms",
    description: "Payment speed and terms offered to subcontractors",
    weight: 0.8
  },
  {
    id: "treatment_of_subbies",
    name: "Treatment of Subcontractors",
    description: "Overall relationship and treatment of subcontractor partners",
    weight: 1.0
  }
]

const CONFIDENCE_LEVELS: ConfidenceLevel[] = ["very_high", "high", "medium", "low"]

const ASSESSMENT_METHODS: AssessmentMethod[] = [
  "site_visit",
  "phone_call",
  "subcontractor_meeting",
  "worker_interview",
  "document_review",
  "other"
]

export function SubcontractorAssessmentForm4Point({
  employerId,
  employerName,
  projectId,
  initialData,
  onSave,
  onCancel,
  className
}: SubcontractorAssessmentFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [formData, setFormData] = useState<SubcontractorAssessmentData>({
    employer_id: employerId,
    project_id: projectId || null,
    criteria: {
      subcontractor_usage: 3,
      payment_terms: 3,
      treatment_of_subbies: 3
    },
    confidence_level: "medium",
    assessment_method: "site_visit",
    notes: "",
    evidence_urls: [],
    follow_up_required: false,
    follow_up_date: null,
    ...initialData
  })

  // Calculate weighted overall rating
  const overallRating = Math.round(
    (formData.criteria.subcontractor_usage * 1.2 +
     formData.criteria.payment_terms * 0.8 +
     formData.criteria.treatment_of_subbies * 1.0) /
    (1.2 + 0.8 + 1.0)
  )

  const handleRatingChange = (criterionId: string, rating: number) => {
    setFormData(prev => ({
      ...prev,
      criteria: {
        ...prev.criteria,
        [criterionId]: rating
      }
    }))
  }

  const handleSubmit = async (saveAsDraft = false) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to submit assessments.",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/assessments/subcontractor-4-point-new", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || "Failed to save assessment")
      }

      toast({
        title: "Assessment saved",
        description: saveAsDraft
          ? "Draft saved successfully"
          : "Subcontractor assessment submitted successfully",
      })

      if (onSave) {
        onSave(result.data)
      } else {
        router.back()
      }
    } catch (error) {
      console.error("Error saving assessment:", error)
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const RatingButton = ({
    criterionId,
    rating,
    selected
  }: {
    criterionId: string,
    rating: number,
    selected: boolean
  }) => {
    const scale = RATING_SCALE[rating as keyof typeof RATING_SCALE]

    return (
      <Button
        type="button"
        variant={selected ? "default" : "outline"}
        className={cn(
          "flex-1 h-auto py-3 px-2 flex flex-col items-center gap-1",
          selected && scale.color,
          !selected && "hover:bg-muted/50"
        )}
        onClick={() => handleRatingChange(criterionId, rating)}
      >
        <div className={cn(
          "w-3 h-3 rounded-full",
          selected ? "bg-current" : "bg-muted-foreground"
        )} />
        <span className="text-xs font-medium">{rating}</span>
        <span className="text-xs">{scale.label}</span>
      </Button>
    )
  }

  if (showPreview) {
    return (
      <div className={cn("space-y-6", className)}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Subcontractor Assessment Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Employer: {employerName}</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Overall Subcontractor Rating:</span>
                <Badge className={RATING_SCALE[overallRating as keyof typeof RATING_SCALE].color}>
                  {overallRating} - {RATING_SCALE[overallRating as keyof typeof RATING_SCALE].label}
                </Badge>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-3">Subcontractor Assessment Criteria</h4>
              <div className="space-y-3">
                {SUBCONTRACTOR_CRITERIA.map(criterion => {
                  const rating = formData.criteria[criterion.id as keyof typeof formData.criteria]
                  const scale = RATING_SCALE[rating as keyof typeof RATING_SCALE]

                  return (
                    <div key={criterion.id} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{criterion.name}</p>
                          {criterion.weight !== 1.0 && (
                            <Badge variant="outline" className="text-xs">
                              Weight: {criterion.weight}x
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{criterion.description}</p>
                      </div>
                      <Badge className={scale.color}>
                        {rating} - {scale.label}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Confidence Level</Label>
                <p className="font-medium capitalize">{formData.confidence_level.replace("_", " ")}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Assessment Method</Label>
                <p className="font-medium capitalize">{formData.assessment_method.replace("_", " ")}</p>
              </div>
            </div>

            {formData.notes && (
              <>
                <Separator />
                <div>
                  <Label className="text-sm text-muted-foreground">Notes</Label>
                  <p className="mt-1 text-sm">{formData.notes}</p>
                </div>
              </>
            )}

            {formData.follow_up_required && formData.follow_up_date && (
              <>
                <Separator />
                <div>
                  <Label className="text-sm text-muted-foreground">Follow Up Required</Label>
                  <p className="mt-1 text-sm">
                    By: {format(new Date(formData.follow_up_date), "PPP")}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setShowPreview(false)}
            className="flex-1"
          >
            Back to Edit
          </Button>
          <Button
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? "Submitting..." : "Submit Assessment"}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Subcontractor Assessment - 4 Point Scale
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Assessing: {employerName}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Rating Criteria */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Subcontractor Assessment Criteria</Label>
            <p className="text-sm text-muted-foreground">
              Rate each criterion on a 4-point scale (1=Good, 4=Terrible)
            </p>

            {SUBCONTRACTOR_CRITERIA.map(criterion => {
              const currentRating = formData.criteria[criterion.id as keyof typeof formData.criteria]

              return (
                <div key={criterion.id} className="space-y-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Label className="font-medium">{criterion.name}</Label>
                      {criterion.weight !== 1.0 && (
                        <Badge variant="outline" className="text-xs">
                          Weight: {criterion.weight}x
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{criterion.description}</p>
                  </div>

                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(rating => (
                      <RatingButton
                        key={rating}
                        criterionId={criterion.id}
                        rating={rating}
                        selected={currentRating === rating}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Current Overall Rating Display */}
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm text-muted-foreground">Current Overall Subcontractor Rating</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={RATING_SCALE[overallRating as keyof typeof RATING_SCALE].color}>
                    {overallRating} - {RATING_SCALE[overallRating as keyof typeof RATING_SCALE].label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    (Weighted average)
                  </span>
                </div>
              </div>
              {overallRating <= 2 && (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              {overallRating >= 3 && (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
            </div>
          </div>

          {/* Assessment Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="confidence_level">Confidence Level</Label>
              <Select
                value={formData.confidence_level}
                onValueChange={(value: ConfidenceLevel) =>
                  setFormData(prev => ({ ...prev, confidence_level: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONFIDENCE_LEVELS.map(level => (
                    <SelectItem key={level} value={level}>
                      {level.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assessment_method">Assessment Method</Label>
              <Select
                value={formData.assessment_method}
                onValueChange={(value: AssessmentMethod) =>
                  setFormData(prev => ({ ...prev, assessment_method: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSESSMENT_METHODS.map(method => (
                    <SelectItem key={method} value={method}>
                      {method.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Subcontractor Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add notes about subcontractor relationships, payment practices, or concerns..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Follow Up */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch
                id="follow_up_required"
                checked={formData.follow_up_required}
                onCheckedChange={(checked) =>
                  setFormData(prev => ({ ...prev, follow_up_required: checked }))
                }
              />
              <Label htmlFor="follow_up_required">Subcontractor follow up required</Label>
            </div>

            {formData.follow_up_required && (
              <div className="space-y-2">
                <Label>Follow up date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.follow_up_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.follow_up_date ? (
                        format(new Date(formData.follow_up_date), "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.follow_up_date ? new Date(formData.follow_up_date) : undefined}
                      onSelect={(date) =>
                        setFormData(prev => ({
                          ...prev,
                          follow_up_date: date ? date.toISOString() : null
                        }))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        )}

        <div className="flex gap-2 flex-1">
          <Button
            variant="outline"
            onClick={() => setShowPreview(true)}
            disabled={isSubmitting}
            className="flex-1"
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>

          <Button
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
            className="flex-1"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? "Submitting..." : "Submit Assessment"}
          </Button>
        </div>
      </div>
    </div>
  )
}