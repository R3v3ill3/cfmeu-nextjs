"use client"

import { useState, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Slider } from "@/components/ui/slider"
import {
  Users,
  MessageSquare,
  Handshake,
  Shield,
  UserCheck,
  Mic,
  Camera,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Save,
  Volume2,
  VolumeX
} from "lucide-react"
import { FourPointScaleMobile } from "@/components/ui/FourPointScaleSelector"
import { useHapticFeedback } from "../shared/HapticFeedback"
import { toast } from "sonner"
import {
  FourPointRating,
  UnionRespectAssessment,
  CreateUnionRespectAssessmentPayload
} from "@/types/assessments"

interface UnionRespectMobileFormProps {
  employerId: string
  employerName: string
  initialData?: Partial<UnionRespectAssessment>
  onSave: (data: CreateUnionRespectAssessmentPayload) => Promise<void>
  onCancel?: () => void
  className?: string
}

interface CriteriaItem {
  id: keyof UnionRespectAssessment['criteria']
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  examples: string[]
}

interface VoiceNote {
  id: string
  duration: number
  timestamp: string
  transcript?: string
}

interface PhotoEvidence {
  id: string
  url: string
  timestamp: string
  caption?: string
}

const unionRespectCriteria: CriteriaItem[] = [
  {
    id: 'union_engagement',
    label: 'Union Engagement',
    description: 'Willingness to engage with union representatives',
    icon: Users,
    examples: ['Participates in meetings', 'Respects representatives', 'Cooperates with initiatives']
  },
  {
    id: 'communication_respect',
    label: 'Communication Respect',
    description: 'Quality of communication with union representatives',
    icon: MessageSquare,
    examples: ['Responds promptly', 'Professional dialogue', 'Provides requested information']
  },
  {
    id: 'collaboration_attitude',
    label: 'Collaboration Attitude',
    description: 'Willingness to work collaboratively with the union',
    icon: Handshake,
    examples: ['Works together on safety', 'Collaborative problem solving', 'Open to suggestions']
  },
  {
    id: 'dispute_resolution',
    label: 'Dispute Resolution',
    description: 'Approach to resolving workplace disputes',
    icon: Shield,
    examples: ['Follows proper procedures', 'Seeks solutions', 'Maintains constructive approach']
  },
  {
    id: 'union_delegate_relations',
    label: 'Union Delegate Relations',
    description: 'Relationship with union delegates',
    icon: UserCheck,
    examples: ['Respects delegate authority', 'Provides facilities', 'Positive working relationship']
  }
]

export function UnionRespectMobileForm({
  employerId,
  employerName,
  initialData,
  onSave,
  onCancel,
  className
}: UnionRespectMobileFormProps) {
  const { trigger, success, error } = useHapticFeedback()
  const [currentCriterionIndex, setCurrentCriterionIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
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

  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([])
  const [photos, setPhotos] = useState<PhotoEvidence[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)

  const currentCriterion = unionRespectCriteria[currentCriterionIndex]
  const progress = ((currentCriterionIndex + 1) / unionRespectCriteria.length) * 100

  // Recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isRecording])

  const handleRatingChange = useCallback((rating: FourPointRating) => {
    setCriteria(prev => ({ ...prev, [currentCriterion.id]: rating }))
    setHasChanges(true)
    trigger('success')
  }, [currentCriterion.id, trigger])

  const handleCommentChange = useCallback((comment: string) => {
    setAdditionalComments(prev => ({ ...prev, [currentCriterion.id]: comment }))
    setHasChanges(true)
  }, [])

  const handleNextCriterion = useCallback(() => {
    if (currentCriterionIndex < unionRespectCriteria.length - 1) {
      setCurrentCriterionIndex(prev => prev + 1)
      trigger('selection')
    }
  }, [currentCriterionIndex, trigger])

  const handlePreviousCriterion = useCallback(() => {
    if (currentCriterionIndex > 0) {
      setCurrentCriterionIndex(prev => prev - 1)
      trigger('selection')
    }
  }, [currentCriterionIndex, trigger])

  const handleVoiceRecording = useCallback(() => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false)
      const newVoiceNote: VoiceNote = {
        id: Date.now().toString(),
        duration: recordingTime,
        timestamp: new Date().toISOString()
      }
      setVoiceNotes(prev => [...prev, newVoiceNote])
      setRecordingTime(0)
      trigger('success')
      toast.success("Voice note recorded")
    } else {
      // Start recording
      setIsRecording(true)
      setRecordingTime(0)
      trigger('selection')
    }
  }, [isRecording, recordingTime, trigger])

  const handlePhotoCapture = useCallback(() => {
    // Simulate photo capture
    const newPhoto: PhotoEvidence = {
      id: Date.now().toString(),
      url: `/api/placeholder/400/300`, // Would be actual photo
      timestamp: new Date().toISOString()
    }
    setPhotos(prev => [...prev, newPhoto])
    trigger('success')
    toast.success("Photo captured")
  }, [trigger])

  const handleSave = async () => {
    const incompleteCriteria = Object.entries(criteria).filter(([_, value]) => !value)

    if (incompleteCriteria.length > 0) {
      toast.error(`Please complete all criteria before saving. ${incompleteCriteria.length} remaining.`)
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
        notes: voiceNotes.length > 0 || photos.length > 0
          ? `Evidence: ${voiceNotes.length} voice notes, ${photos.length} photos`
          : undefined
      }

      await onSave(payload)
      setHasChanges(false)
      success()
      toast.success("Assessment completed successfully!")
    } catch (err) {
      error()
      toast.error("Failed to save assessment")
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const isLastCriterion = currentCriterionIndex === unionRespectCriteria.length - 1
  const isFirstCriterion = currentCriterionIndex === 0

  return (
    <div className={className}>
      {/* Header */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <h2 className="font-semibold text-lg">Union Respect Assessment</h2>
                <p className="text-sm text-muted-foreground">{employerName}</p>
              </div>
            </div>
            <Badge variant="outline">
              {currentCriterionIndex + 1}/{unionRespectCriteria.length}
            </Badge>
          </div>

          <Progress value={progress} className="h-3 mb-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress.toFixed(0)}% Complete</span>
            <span>{currentCriterion.label}</span>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <currentCriterion.icon className="h-6 w-6 text-blue-600" />
            <div>
              <CardTitle className="text-lg">{currentCriterion.label}</CardTitle>
              <p className="text-sm text-muted-foreground">{currentCriterion.description}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Examples */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <Label className="text-sm font-medium text-blue-900 mb-2 block">Look for:</Label>
            <ul className="space-y-1">
              {currentCriterion.examples.map((example, index) => (
                <li key={index} className="text-sm text-blue-800 flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>{example}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Rating Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Rate this criterion:</Label>
            <FourPointScaleMobile
              value={criteria[currentCriterion.id]}
              onChange={handleRatingChange}
            />
          </div>

          {/* Comment Input */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Add observations (Optional):</Label>
            <Textarea
              value={additionalComments[currentCriterion.id] || ''}
              onChange={(e) => handleCommentChange(e.target.value)}
              placeholder="Describe specific examples or context for this rating..."
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Evidence Collection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Evidence Collection:</Label>

            {/* Voice Recording */}
            <div className="flex gap-2">
              <Button
                variant={isRecording ? "destructive" : "outline"}
                onClick={handleVoiceRecording}
                className="flex-1"
              >
                {isRecording ? (
                  <>
                    <VolumeX className="h-4 w-4 mr-2" />
                    Stop Recording ({formatTime(recordingTime)})
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4 mr-2" />
                    Add Voice Note
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handlePhotoCapture}>
                <Camera className="h-4 w-4" />
              </Button>
            </div>

            {/* Show collected evidence */}
            {(voiceNotes.length > 0 || photos.length > 0) && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Collected Evidence:</Label>
                {voiceNotes.map((note) => (
                  <div key={note.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                    <Volume2 className="h-4 w-4" />
                    <span className="text-sm">Voice note ({formatTime(note.duration)})</span>
                  </div>
                ))}
                {photos.map((photo) => (
                  <div key={photo.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                    <Camera className="h-4 w-4" />
                    <span className="text-sm">Photo captured</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Supporting Evidence Summary */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <Label className="text-base font-medium mb-3 block">Supporting Evidence Checklist:</Label>
          <div className="space-y-3">
            {Object.entries({
              has_union_delegates: 'Has active union delegates',
              regular_meetings: 'Regular union meetings',
              formal_communication_channels: 'Formal communication channels',
              joint_safety_committee: 'Joint safety committee',
              union_training_participation: 'Union training participation'
            }).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <Switch
                  checked={supportingEvidence[key as keyof typeof supportingEvidence]}
                  onCheckedChange={(checked) => {
                    setSupportingEvidence(prev => ({ ...prev, [key]: checked }))
                    setHasChanges(true)
                  }}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex gap-2 mb-4">
        <Button
          variant="outline"
          onClick={handlePreviousCriterion}
          disabled={isFirstCriterion}
          className="flex-1"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>

        {isLastCriterion ? (
          <Button
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Saving...' : 'Complete Assessment'}
          </Button>
        ) : (
          <Button
            onClick={handleNextCriterion}
            disabled={!criteria[currentCriterion.id]}
            className="flex-1"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>

      {/* Progress Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Assessment Progress</span>
            <span className="text-sm text-muted-foreground">
              {Object.values(criteria).filter(Boolean).length} of {unionRespectCriteria.length} completed
            </span>
          </div>
          <Progress value={(Object.values(criteria).filter(Boolean).length / unionRespectCriteria.length) * 100} />

          {hasChanges && (
            <Alert className="mt-3">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                You have unsaved changes. Complete all criteria to save the assessment.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {onCancel && (
        <Button
          variant="ghost"
          onClick={onCancel}
          className="w-full mt-2"
          disabled={isSubmitting}
        >
          Cancel Assessment
        </Button>
      )}
    </div>
  )
}