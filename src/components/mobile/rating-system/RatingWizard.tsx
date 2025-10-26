"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  CheckCircle,
  AlertCircle,
  Info,
  ChevronLeft,
  ChevronRight,
  Save,
  Eye,
  Star,
  MessageSquare
} from "lucide-react"
import { MobileForm, MobileFormStep } from "../shared/MobileForm"
import { TrafficLightDisplay } from "./TrafficLightDisplay"
import { useHapticFeedback } from "../shared/HapticFeedback"
import {
  RatingWizardFormData,
  RatingTrack,
  RoleType,
  TrafficLightRating,
  ConfidenceLevel,
  RatingCalculationResult
} from "@/types/rating"

interface RatingWizardProps {
  employerId: string
  employerName: string
  track: RatingTrack
  roleContext: RoleType
  onSubmit: (data: RatingWizardFormData) => Promise<void>
  onCancel: () => void
  initialData?: Partial<RatingWizardFormData>
  showPreview?: boolean
  allowSaveDraft?: boolean
  className?: string
}

// Form field types
interface FormField {
  id: string
  name: string
  label: string
  description?: string
  type: 'slider' | 'radio' | 'switch' | 'textarea' | 'number'
  required?: boolean
  min?: number
  max?: number
  step?: number
  options?: Array<{ value: string; label: string; description?: string }>
  placeholder?: string
}

// Rating factor configurations for different tracks and roles
const getRatingFactors = (track: RatingTrack, roleContext: RoleType): FormField[] => {
  const commonFields: FormField[] = [
    {
      id: 'relationship_quality',
      name: 'relationship_quality',
      label: 'Relationship Quality',
      description: 'How would you rate your overall relationship with this employer?',
      type: 'slider',
      required: true,
      min: 0,
      max: 10,
      step: 1,
    },
    {
      id: 'communication_effectiveness',
      name: 'communication_effectiveness',
      label: 'Communication Effectiveness',
      description: 'How effective is communication with this employer?',
      type: 'slider',
      required: true,
      min: 0,
      max: 10,
      step: 1,
    },
    {
      id: 'cooperation_level',
      name: 'cooperation_level',
      label: 'Cooperation Level',
      description: 'How cooperative is this employer in working with CFMEU?',
      type: 'slider',
      required: true,
      min: 0,
      max: 10,
      step: 1,
    },
    {
      id: 'problem_solving',
      name: 'problem_solving',
      label: 'Problem Solving',
      description: 'How well does this employer handle problems and issues?',
      type: 'slider',
      required: true,
      min: 0,
      max: 10,
      step: 1,
    },
  ]

  const projectDataFields: FormField[] = [
    {
      id: 'compliance_score',
      name: 'compliance_score',
      label: 'Compliance Score',
      description: 'Overall compliance with CFMEU standards and agreements',
      type: 'slider',
      required: true,
      min: 0,
      max: 100,
      step: 5,
    },
    {
      id: 'participation_rate',
      name: 'participation_rate',
      label: 'Worker Participation',
      description: 'Rate of worker participation in union activities',
      type: 'slider',
      required: true,
      min: 0,
      max: 100,
      step: 5,
    },
    {
      id: 'dispute_count',
      name: 'dispute_count',
      label: 'Discount Count',
      description: 'Number of disputes in the last 12 months',
      type: 'radio',
      required: true,
      options: [
        { value: '0', label: 'None' },
        { value: '1-2', label: '1-2 disputes' },
        { value: '3-5', label: '3-5 disputes' },
        { value: '6+', label: '6+ disputes' },
      ],
    },
    {
      id: 'safety_incidents',
      name: 'safety_incidents',
      label: 'Safety Incidents',
      description: 'Number of significant safety incidents',
      type: 'radio',
      required: true,
      options: [
        { value: '0', label: 'None' },
        { value: '1', label: '1 incident' },
        { value: '2-3', label: '2-3 incidents' },
        { value: '4+', label: '4+ incidents' },
      ],
    },
  ]

  const roleSpecificFields: Record<RoleType, FormField[]> = {
    trade: [
      {
        id: 'trade_quality',
        name: 'trade_quality',
        label: 'Trade Quality',
        description: 'Quality of work and trade skills',
        type: 'slider',
        required: true,
        min: 0,
        max: 10,
        step: 1,
      },
    ],
    builder: [
      {
        id: 'project_management',
        name: 'project_management',
        label: 'Project Management',
        description: 'Quality of project management and coordination',
        type: 'slider',
        required: true,
        min: 0,
        max: 10,
        step: 1,
      },
    ],
    admin: [
      {
        id: 'administrative_compliance',
        name: 'administrative_compliance',
        label: 'Administrative Compliance',
        description: 'Compliance with administrative requirements',
        type: 'slider',
        required: true,
        min: 0,
        max: 10,
        step: 1,
      },
    ],
    organiser: commonFields,
  }

  if (track === 'project_data') {
    return [...projectDataFields, ...(roleSpecificFields[roleContext] || [])]
  }

  return [...commonFields, ...(roleSpecificFields[roleContext] || [])]
}

// Confidence factor fields
const confidenceFactors: FormField[] = [
  {
    id: 'direct_experience',
    name: 'direct_experience',
    label: 'Direct Experience',
    description: 'I have recent, direct experience with this employer',
    type: 'switch',
    required: false,
  },
  {
    id: 'multiple_sources',
    name: 'multiple_sources',
    label: 'Multiple Sources',
    description: 'My assessment is based on multiple sources of information',
    type: 'switch',
    required: false,
  },
  {
    id: 'recent_interaction',
    name: 'recent_interaction',
    label: 'Recent Interaction',
    description: 'I have interacted with this employer in the last 3 months',
    type: 'switch',
    required: false,
  },
  {
    id: 'knowledge_depth',
    name: 'knowledge_depth',
    label: 'Knowledge Depth',
    description: 'I have deep knowledge of this employer\'s operations',
    type: 'slider',
    required: false,
    min: 0,
    max: 10,
    step: 1,
  },
]

// Form field components
function SliderField({ field, value, onChange, error }: {
  field: FormField
  value: number
  onChange: (value: number) => void
  error?: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label className="text-sm font-medium">{field.label}</Label>
        <Badge variant="outline" className="text-xs">
          {value}
        </Badge>
      </div>
      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
      <Slider
        value={[value]}
        onValueChange={([newValue]) => onChange(newValue)}
        min={field.min}
        max={field.max}
        step={field.step}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{field.min}</span>
        <span>{field.max}</span>
      </div>
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  )
}

function RadioField({ field, value, onChange, error }: {
  field: FormField
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{field.label}</Label>
      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
      <RadioGroup value={value} onValueChange={onChange}>
        {field.options?.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <RadioGroupItem value={option.value} id={option.value} />
            <Label htmlFor={option.value} className="text-sm">
              {option.label}
            </Label>
            {option.description && (
              <p className="text-xs text-muted-foreground">{option.description}</p>
            )}
          </div>
        ))}
      </RadioGroup>
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  )
}

function SwitchField({ field, value, onChange, error }: {
  field: FormField
  value: boolean
  onChange: (value: boolean) => void
  error?: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">{field.label}</Label>
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
        </div>
        <Switch
          checked={value}
          onCheckedChange={onChange}
        />
      </div>
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  )
}

function TextAreaField({ field, value, onChange, error }: {
  field: FormField
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{field.label}</Label>
      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={4}
        className="resize-none"
      />
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  )
}

// Field renderer component
function FieldRenderer({ field, value, onChange, error }: {
  field: FormField
  value: any
  onChange: (value: any) => void
  error?: string
}) {
  switch (field.type) {
    case 'slider':
      return <SliderField field={field} value={value || 0} onChange={onChange} error={error} />
    case 'radio':
      return <RadioField field={field} value={value || ''} onChange={onChange} error={error} />
    case 'switch':
      return <SwitchField field={field} value={value || false} onChange={onChange} error={error} />
    case 'textarea':
      return <TextAreaField field={field} value={value || ''} onChange={onChange} error={error} />
    default:
      return null
  }
}

export function RatingWizard({
  employerId,
  employerName,
  track,
  roleContext,
  onSubmit,
  onCancel,
  initialData,
  showPreview = true,
  allowSaveDraft = true,
  className,
}: RatingWizardProps) {
  const { trigger, success, error } = useHapticFeedback()
  const [savedDraft, setSavedDraft] = React.useState(false)

  const ratingFactors = React.useMemo(
    () => getRatingFactors(track, roleContext),
    [track, roleContext]
  )

  // Step 1: Introduction
  const IntroStep: React.ComponentType<any> = React.useCallback(({ data, onChange }) => {
    return (
      <div className="space-y-4">
        <div className="text-center py-6">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Star className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Rate {employerName}</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {track === 'project_data'
              ? 'Assess this employer based on project compliance and performance data.'
              : 'Rate this employer based on your expertise and experience as an organiser.'
            }
          </p>
          <div className="flex justify-center gap-2">
            <Badge variant="outline">{track.replace('_', ' ')}</Badge>
            <Badge variant="outline">{roleContext}</Badge>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <h3 className="font-medium text-sm">What you'll be rating:</h3>
          <div className="space-y-2">
            {ratingFactors.slice(0, 4).map((factor) => (
              <div key={factor.id} className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>{factor.label}</span>
              </div>
            ))}
            {ratingFactors.length > 4 && (
              <p className="text-xs text-muted-foreground">
                ...and {ratingFactors.length - 4} more factors
              </p>
            )}
          </div>
        </div>

        <Separator />

        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">This should take 5-10 minutes</p>
              <p className="text-xs text-blue-700 mt-1">
                Your assessment helps improve workplace conditions and union representation.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }, [employerName, track, roleContext, ratingFactors])

  // Step 2: Rating factors
  const RatingStep: React.ComponentType<any> = React.useCallback(({ data, onChange, error }) => {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="font-medium">Rate Each Factor</h3>
          <p className="text-sm text-muted-foreground">
            Please assess each factor based on your knowledge and experience.
          </p>
        </div>

        {ratingFactors.map((factor) => (
          <Card key={factor.id} className="border-l-4 border-l-blue-200">
            <CardContent className="p-4">
              <FieldRenderer
                field={factor}
                value={data[factor.id]}
                onChange={(value) => onChange({ ...data, [factor.id]: value })}
                error={error}
              />
            </CardContent>
          </Card>
        ))}

        <div className="bg-amber-50 p-3 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
            <p className="text-xs text-amber-800">
              Be as accurate and honest as possible. This data helps improve workplace conditions.
            </p>
          </div>
        </div>
      </div>
    )
  }, [ratingFactors])

  // Step 3: Confidence factors
  const ConfidenceStep: React.ComponentType<any> = React.useCallback(({ data, onChange }) => {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="font-medium">Confidence in Assessment</h3>
          <p className="text-sm text-muted-foreground">
            Help us understand how confident you are in this rating.
          </p>
        </div>

        {confidenceFactors.map((factor) => (
          <Card key={factor.id} className="border-l-4 border-l-green-200">
            <CardContent className="p-4">
              <FieldRenderer
                field={factor}
                value={data[factor.id]}
                onChange={(value) => onChange({ ...data, [factor.id]: value })}
              />
            </CardContent>
          </Card>
        ))}

        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5" />
            <p className="text-xs text-blue-800">
              Higher confidence levels give your rating more weight in the overall assessment.
            </p>
          </div>
        </div>
      </div>
    )
  }, [])

  // Step 4: Additional notes
  const NotesStep: React.ComponentType<any> = React.useCallback(({ data, onChange }) => {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="font-medium">Additional Notes (Optional)</h3>
          <p className="text-sm text-muted-foreground">
            Provide any additional context or comments that might be helpful.
          </p>
        </div>

        <Card>
          <CardContent className="p-4">
            <FieldRenderer
              field={{
                id: 'notes',
                name: 'notes',
                label: 'Notes',
                description: 'Any additional information about this employer',
                type: 'textarea',
                placeholder: 'Share any relevant experiences, observations, or concerns...',
              }}
              value={data.notes}
              onChange={(value) => onChange({ ...data, notes: value })}
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="border-l-4 border-l-amber-200">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium">Concerns</span>
              </div>
              <FieldRenderer
                field={{
                  id: 'concerns',
                  name: 'concerns',
                  label: '',
                  type: 'textarea',
                  placeholder: 'Any concerns about this employer...',
                }}
                value={data.concerns}
                onChange={(value) => onChange({ ...data, concerns: value })}
              />
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-200">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Positive Points</span>
              </div>
              <FieldRenderer
                field={{
                  id: 'positives',
                  name: 'positives',
                  label: '',
                  type: 'textarea',
                  placeholder: 'Any positive aspects to highlight...',
                }}
                value={data.positives}
                onChange={(value) => onChange({ ...data, positives: value })}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }, [])

  // Step 5: Preview and submit
  const PreviewStep: React.ComponentType<any> = React.useCallback(({ data, onChange }) => {
    // This would typically calculate the rating based on the responses
    const mockRating: TrafficLightRating = 'green' // This would be calculated
    const mockConfidence: ConfidenceLevel = 'high' // This would be calculated

    return (
      <div className="space-y-6">
        <div className="text-center py-4">
          <h3 className="font-medium mb-4">Review Your Assessment</h3>
          <div className="flex justify-center mb-4">
            <TrafficLightDisplay
              rating={mockRating}
              confidence={mockConfidence}
              size="lg"
              showLabel={true}
              showConfidence={true}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Based on your responses, this employer receives a {mockRating} rating
            with {mockConfidence} confidence.
          </p>
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="font-medium text-sm">Summary of Responses:</h4>
          <div className="space-y-2">
            {ratingFactors.slice(0, 3).map((factor) => (
              <div key={factor.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{factor.label}</span>
                <span className="font-medium">{data[factor.id] || 'Not rated'}</span>
              </div>
            ))}
          </div>
        </div>

        {data.notes && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Your Notes:</h4>
              <p className="text-sm text-muted-foreground italic">
                "{data.notes}"
              </p>
            </div>
          </>
        )}

        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-800">Ready to submit</p>
              <p className="text-xs text-green-700 mt-1">
                Your assessment will contribute to the employer's overall rating.
              </p>
            </div>
          </div>
        </div>

        {allowSaveDraft && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                // Save draft logic here
                setSavedDraft(true)
                trigger()
              }}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
          </div>
        )}

        {savedDraft && (
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <p className="text-sm text-blue-800">Draft saved successfully</p>
          </div>
        )}
      </div>
    )
  }, [ratingFactors, allowSaveDraft, trigger, savedDraft])

  // Form steps
  const steps: MobileFormStep[] = [
    {
      id: 'intro',
      title: 'Introduction',
      component: IntroStep,
    },
    {
      id: 'rating',
      title: 'Rating Factors',
      component: RatingStep,
      validation: (data) => {
        const requiredFields = ratingFactors.filter(f => f.required)
        for (const field of requiredFields) {
          if (!data[field.id] && data[field.id] !== 0) {
            return `Please complete: ${field.label}`
          }
        }
        return true
      },
    },
    {
      id: 'confidence',
      title: 'Confidence Level',
      component: ConfidenceStep,
      skip: false,
    },
    {
      id: 'notes',
      title: 'Additional Notes',
      component: NotesStep,
      skip: false,
    },
    {
      id: 'preview',
      title: 'Review & Submit',
      component: PreviewStep,
    },
  ]

  const handleSubmit = async (data: any) => {
    try {
      const formData: RatingWizardFormData = {
        employer_id: employerId,
        track,
        role_context: roleContext,
        responses: data,
        confidence_factors: {
          direct_experience: data.direct_experience || false,
          multiple_sources: data.multiple_sources || false,
          recent_interaction: data.recent_interaction || false,
          knowledge_depth: data.knowledge_depth || 0,
        },
        notes: data.notes,
      }

      await onSubmit(formData)
      success()
    } catch (err) {
      error()
      throw err
    }
  }

  return (
    <div className={cn("h-full", className)}>
      <MobileForm
        steps={steps}
        onSubmit={handleSubmit}
        showProgress={true}
        allowSkip={true}
        saveOnStepChange={true}
      />
    </div>
  )
}