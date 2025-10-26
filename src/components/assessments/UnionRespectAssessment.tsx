"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Users,
  MessageSquare,
  Handshake,
  Shield,
  UserCheck,
  Info,
  Save,
  Eye,
  AlertTriangle,
  CheckCircle
} from "lucide-react"
import { FourPointScaleSelector, FourPointRatingDisplay } from "@/components/ui/FourPointScaleSelector"
import { useHapticFeedback } from "@/components/mobile/shared/HapticFeedback"
import { toast } from "sonner"
import {
  FourPointRating,
  UnionRespectAssessment,
  CreateUnionRespectAssessmentPayload
} from "@/types/assessments"

interface UnionRespectAssessmentProps {
  employerId: string
  employerName: string
  initialData?: Partial<UnionRespectAssessment>
  onSave: (data: CreateUnionRespectAssessmentPayload) => Promise<void>
  onViewHistory?: () => void
  readonly?: boolean
  className?: string
}

interface CriteriaItem {
  id: keyof UnionRespectAssessment['criteria']
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  examples: string[]
}

const unionRespectCriteria: CriteriaItem[] = [
  {
    id: 'union_engagement',
    label: 'Union Engagement',
    description: 'Employer\'s willingness to engage with union representatives and activities',
    icon: Users,
    examples: [
      'Participates in union meetings',
      'Respects union representatives',
      'Cooperates with union initiatives'
    ]
  },
  {
    id: 'communication_respect',
    label: 'Communication Respect',
    description: 'Quality and respectfulness of communication with union representatives',
    icon: MessageSquare,
    examples: [
      'Responds promptly to union communications',
      'Maintains professional dialogue',
      'Provides requested information in timely manner'
    ]
  },
  {
    id: 'collaboration_attitude',
    label: 'Collaboration Attitude',
    description: 'Willingness to work collaboratively with the union on workplace issues',
    icon: Handshake,
    examples: [
      'Works together on safety improvements',
      'Collaborative approach to problem solving',
      'Open to union suggestions'
    ]
  },
  {
    id: 'dispute_resolution',
    label: 'Dispute Resolution',
    description: 'Approach to resolving workplace disputes and grievances',
    icon: Shield,
    examples: [
      'Follows proper dispute procedures',
      'Seeks mutually beneficial solutions',
      'Maintains constructive approach during conflicts'
    ]
  },
  {
    id: 'union_delegate_relations',
    label: 'Union Delegate Relations',
    description: 'Relationship with union delegates and workplace representatives',
    icon: UserCheck,
    examples: [
      'Respects delegate authority',
      'Provides adequate facilities for delegates',
      'Maintains positive working relationship'
    ]
  }
]

export function UnionRespectAssessment({
  employerId,
  employerName,
  initialData,
  onSave,
  onViewHistory,
  readonly = false,
  className
}: UnionRespectAssessmentProps) {
  const { trigger, success, error } = useHapticFeedback()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Form state
  const [criteria, setCriteria] = useState<UnionRespectAssessment['criteria']>({
    union_engagement: initialData?.criteria?.union_engagement || undefined,
    communication_respect: initialData?.criteria?.communication_respect || undefined,
    collaboration_attitude: initialData?.criteria?.collaboration_attitude || undefined,
    dispute_resolution: initialData?.criteria?.dispute_resolution || undefined,
    union_delegate_relations: initialData?.criteria?.union_delegate_relations || undefined
  })

  const [additionalComments, setAdditionalComments] = useState<UnionRespectAssessment['additional_comments']>(
    initialData?.additional_comments || {}
  )

  const [supportingEvidence, setSupportingEvidence] = useState<UnionRespectAssessment['supporting_evidence']>(
    initialData?.supporting_evidence || {
      has_union_delegates: false,
      regular_meetings: false,
      formal_communication_channels: false,
      joint_safety_committee: false,
      union_training_participation: false
    }
  )

  const [notes, setNotes] = useState(initialData?.notes || '')

  const handleCriteriaChange = useCallback((field: keyof UnionRespectAssessment['criteria'], value: FourPointRating) => {
    setCriteria(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
    trigger('selection')
  }, [trigger])

  const handleCommentChange = useCallback((field: keyof UnionRespectAssessment['additional_comments'], value: string) => {
    setAdditionalComments(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }, [])

  const handleEvidenceChange = useCallback((field: keyof UnionRespectAssessment['supporting_evidence'], value: boolean) => {
    setSupportingEvidence(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }, [])

  // Calculate overall score
  const overallScore = Object.values(criteria).filter(Boolean).length > 0
    ? Math.round(Object.values(criteria).filter(Boolean).reduce((sum, rating) => sum + rating, 0) /
                Object.values(criteria).filter(Boolean).length) as FourPointRating
    : undefined

  // Calculate completion percentage
  const completionPercentage = (Object.values(criteria).filter(Boolean).length / unionRespectCriteria.length) * 100

  const handleSave = async () => {
    const incompleteCriteria = Object.entries(criteria).filter(([_, value]) => !value)

    if (incompleteCriteria.length > 0) {
      toast.error(`Please complete all criteria before saving. Missing: ${incompleteCriteria.map(([key]) =>
        unionRespectCriteria.find(c => c.id === key)?.label
      ).join(', ')}`)
      return
    }

    setIsSubmitting(true)
    try {
      const payload: CreateUnionRespectAssessmentPayload = {
        employer_id: employerId,
        criteria: criteria as UnionRespectAssessment['criteria'],
        additional_comments: Object.fromEntries(
          Object.entries(additionalComments).filter(([_, value]) => value?.trim())
        ),
        supporting_evidence: supportingEvidence,
        notes: notes.trim() || undefined
      }

      await onSave(payload)
      setHasChanges(false)
      success()
      toast.success("Union Respect Assessment saved successfully")
    } catch (err) {
      error()
      toast.error("Failed to save assessment")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (showPreview && overallScore) {
    return (
      <div className={className}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Union Respect Assessment Preview
              </CardTitle>
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Back to Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-2">
              <FourPointRatingDisplay
                rating={overallScore}
                label="Overall Union Respect Score"
                size="lg"
                variant="detailed"
                confidenceLevel={Math.round(completionPercentage)}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium">Assessment Breakdown</h4>
              <div className="space-y-3">
                {unionRespectCriteria.map((criterion) => {
                  const Icon = criterion.icon
                  const rating = criteria[criterion.id]
                  const comment = additionalComments[criterion.id]

                  return (
                    <div key={criterion.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium">{criterion.label}</h5>
                            <p className="text-sm text-muted-foreground">{criterion.description}</p>
                          </div>
                          {rating && (
                            <FourPointRatingDisplay
                              rating={rating}
                              variant="badge"
                              size="sm"
                            />
                          )}
                        </div>
                        {comment && (
                          <div className="text-sm p-2 bg-muted rounded">
                            <span className="font-medium">Comment:</span> {comment}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium">Supporting Evidence</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(supportingEvidence).map(([key, value]) => {
                  if (!value) return null
                  return (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {notes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-medium">Additional Notes</h4>
                  <p className="text-sm text-muted-foreground">{notes}</p>
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSubmitting || readonly}>
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Saving...' : 'Save Assessment'}
              </Button>
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Continue Editing
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Union Respect Assessment
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Assess {employerName}'s relationship and engagement with the union
              </p>
            </div>
            <div className="flex items-center gap-2">
              {onViewHistory && (
                <Button variant="outline" size="sm" onClick={onViewHistory}>
                  <Eye className="h-4 w-4 mr-1" />
                  History
                </Button>
              )}
              {overallScore && (
                <FourPointRatingDisplay
                  rating={overallScore}
                  variant="badge"
                  size="sm"
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Completion:</span>
              <Progress value={completionPercentage} className="w-32 h-2" />
              <span className="text-sm font-medium">{Math.round(completionPercentage)}%</span>
            </div>
            {hasChanges && (
              <Badge variant="outline" className="text-xs">
                Unsaved changes
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Rate each criterion on a 4-point scale: 1 (Poor) to 4 (Excellent).
              Consider recent interactions and overall relationship quality.
            </AlertDescription>
          </Alert>

          {/* Assessment Criteria */}
          <div className="space-y-6">
            {unionRespectCriteria.map((criterion) => {
              const Icon = criterion.icon
              const rating = criteria[criterion.id]
              const comment = additionalComments[criterion.id]

              return (
                <Card key={criterion.id} className="border-l-4 border-l-blue-200">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-start gap-3">
                      <Icon className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div className="flex-1 space-y-2">
                        <div>
                          <h4 className="font-medium">{criterion.label}</h4>
                          <p className="text-sm text-muted-foreground">{criterion.description}</p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Examples:</label>
                          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                            {criterion.examples.map((example, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <span className="text-blue-500 mt-0.5">•</span>
                                <span>{example}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">Rating</Label>
                        <FourPointScaleSelector
                          value={rating}
                          onChange={(value) => handleCriteriaChange(criterion.id, value)}
                          disabled={readonly}
                          size="md"
                          variant="compact"
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Comments (Optional)</Label>
                        <Textarea
                          value={comment || ''}
                          onChange={(e) => handleCommentChange(criterion.id, e.target.value)}
                          placeholder="Provide specific examples or context for this rating..."
                          disabled={readonly}
                          rows={3}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Supporting Evidence */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Supporting Evidence</CardTitle>
              <p className="text-sm text-muted-foreground">
                Check all applicable evidence that supports your assessment
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries({
                  has_union_delegates: 'Has active union delegates',
                  regular_meetings: 'Regular union meetings',
                  formal_communication_channels: 'Formal communication channels established',
                  joint_safety_committee: 'Joint safety committee',
                  union_training_participation: 'Participates in union training programs'
                }).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label className="text-sm">{label}</Label>
                    <Switch
                      checked={supportingEvidence[key as keyof typeof supportingEvidence]}
                      onCheckedChange={(checked) => handleEvidenceChange(
                        key as keyof typeof supportingEvidence,
                        checked
                      )}
                      disabled={readonly}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Additional Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional observations, concerns, or positive aspects to note..."
                disabled={readonly}
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Validation warnings */}
          {completionPercentage < 100 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Please complete all criteria before saving the assessment.
                Currently {unionRespectCriteria.length - Object.values(criteria).filter(Boolean).length} criteria remaining.
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={() => setShowPreview(true)}
              disabled={completionPercentage < 100 || readonly}
              variant="outline"
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview Assessment
            </Button>
            <Button
              onClick={handleSave}
              disabled={completionPercentage < 100 || isSubmitting || readonly}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Saving...' : 'Save Assessment'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}