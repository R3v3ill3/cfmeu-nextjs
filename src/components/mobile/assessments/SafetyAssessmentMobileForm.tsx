"use client"

import { useState, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Slider } from "@/components/ui/slider"
import { format } from "date-fns"
import {
  Shield,
  AlertTriangle,
  Camera,
  ChevronRight,
  ChevronLeft,
  Save,
  Clock,
  TrendingUp,
  CheckCircle,
  CalendarIcon
} from "lucide-react"
import { FourPointScaleMobile } from "@/components/ui/FourPointScaleSelector"
import { useHapticFeedback } from "../shared/HapticFeedback"
import { toast } from "sonner"
import {
  FourPointRating,
  Safety4PointAssessment,
  CreateSafety4PointAssessmentPayload
} from "@/types/assessments"

interface SafetyAssessmentMobileFormProps {
  employerId: string
  employerName: string
  initialData?: Partial<Safety4PointAssessment>
  onSave: (data: CreateSafety4PointAssessmentPayload) => Promise<void>
  onCancel?: () => void
  className?: string
}

interface SafetyCriteriaItem {
  id: keyof Safety4PointAssessment['safety_criteria']
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  examples: string[]
}

interface PhotoEvidence {
  id: string
  url: string
  timestamp: string
  category: 'hazard' | 'good-practice' | 'incident' | 'documentation'
  caption?: string
}

const safetyCriteria: SafetyCriteriaItem[] = [
  {
    id: 'safety_management_systems',
    label: 'Safety Management',
    description: 'Quality of safety systems and procedures',
    icon: Shield,
    examples: ['Safety manual', 'Regular reviews', 'Clear procedures', 'Emergency plans']
  },
  {
    id: 'incident_reporting',
    label: 'Incident Reporting',
    description: 'Effectiveness of incident reporting culture',
    icon: AlertTriangle,
    examples: ['Near-miss reporting', 'Timely investigations', 'Root cause analysis', 'Learning shared']
  },
  {
    id: 'site_safety_culture',
    label: 'Site Safety Culture',
    description: 'Overall safety attitude and behavior',
    icon: Shield,
    examples: ['Worker participation', 'Safety discussions', 'Peer monitoring', 'Management presence']
  },
  {
    id: 'risk_assessment_processes',
    label: 'Risk Assessment',
    description: 'Quality of risk assessment processes',
    icon: AlertTriangle,
    examples: ['Daily assessments', 'High-risk identification', 'Control measures', 'Documentation']
  },
  {
    id: 'emergency_preparedness',
    label: 'Emergency Preparedness',
    description: 'Readiness for emergency situations',
    icon: Shield,
    examples: ['Emergency drills', 'First aid equipment', 'Emergency contacts', 'Evacuation procedures']
  },
  {
    id: 'worker_safety_training',
    label: 'Safety Training',
    description: 'Quality and completeness of training',
    icon: Shield,
    examples: ['Induction training', 'Task-specific training', 'Training records', 'Regular refreshers']
  }
]

export function SafetyAssessmentMobileForm({
  employerId,
  employerName,
  initialData,
  onSave,
  onCancel,
  className
}: SafetyAssessmentMobileFormProps) {
  const { trigger, success, error } = useHapticFeedback()
  const [currentSection, setCurrentSection] = useState<'criteria' | 'metrics' | 'audit' | 'evidence'>('criteria')
  const [currentCriterionIndex, setCurrentCriterionIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Form state
  const [safetyCriteria, setSafetyCriteria] = useState<Safety4PointAssessment['safety_criteria']>({
    safety_management_systems: initialData?.safety_criteria?.safety_management_systems || undefined,
    incident_reporting: initialData?.safety_criteria?.incident_reporting || undefined,
    site_safety_culture: initialData?.safety_criteria?.site_safety_culture || undefined,
    risk_assessment_processes: initialData?.safety_criteria?.risk_assessment_processes || undefined,
    emergency_preparedness: initialData?.safety_criteria?.emergency_preparedness || undefined,
    worker_safety_training: initialData?.safety_criteria?.worker_safety_training || undefined
  })

  const [safetyMetrics, setSafetyMetrics] = useState<Safety4PointAssessment['safety_metrics']>({
    lost_time_injuries: initialData?.safety_metrics?.lost_time_injuries || 0,
    near_misses: initialData?.safety_metrics?.near_misses || 0,
    safety_breaches: initialData?.safety_metrics?.safety_breaches || 0,
    safety_improvements: initialData?.safety_metrics?.safety_improvements || 0,
    training_hours: initialData?.safety_metrics?.training_hours || 0
  })

  const [auditCompliance, setAuditCompliance] = useState<Safety4PointAssessment['audit_compliance']>({
    last_audit_date: initialData?.audit_compliance?.last_audit_date,
    audit_score: initialData?.audit_compliance?.audit_score,
    outstanding_actions: initialData?.audit_compliance?.outstanding_actions || 0,
    critical_risks_identified: initialData?.audit_compliance?.critical_risks_identified || 0
  })

  const [notes, setNotes] = useState(initialData?.notes || '')
  const [photos, setPhotos] = useState<PhotoEvidence[]>([])

  const currentCriterion = safetyCriteria[currentCriterionIndex]
  const criteriaProgress = (Object.values(safetyCriteria).filter(Boolean).length / safetyCriteria.length) * 100

  const handleRatingChange = useCallback((rating: FourPointRating) => {
    setSafetyCriteria(prev => ({ ...prev, [currentCriterion.id]: rating }))
    setHasChanges(true)
    trigger('success')
  }, [currentCriterion.id, trigger])

  const handleMetricChange = useCallback((field: keyof Safety4PointAssessment['safety_metrics'], value: number) => {
    setSafetyMetrics(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }, [])

  const handleAuditChange = useCallback((field: keyof Safety4PointAssessment['audit_compliance'], value: any) => {
    setAuditCompliance(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }, [])

  const handlePhotoCapture = useCallback((category: PhotoEvidence['category']) => {
    // Simulate photo capture
    const newPhoto: PhotoEvidence = {
      id: Date.now().toString(),
      url: `/api/placeholder/400/300`, // Would be actual photo
      timestamp: new Date().toISOString(),
      category
    }
    setPhotos(prev => [...prev, newPhoto])
    trigger('success')
    toast.success(`${category.replace('-', ' ')} photo captured`)
  }, [trigger])

  const handleNextCriterion = useCallback(() => {
    if (currentCriterionIndex < safetyCriteria.length - 1) {
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

  const handleSave = async () => {
    const incompleteCriteria = Object.entries(safetyCriteria).filter(([_, value]) => !value)

    if (incompleteCriteria.length > 0) {
      toast.error(`Please complete all criteria before saving. ${incompleteCriteria.length} remaining.`)
      return
    }

    setIsSubmitting(true)
    try {
      const payload: CreateSafety4PointAssessmentPayload = {
        employer_id: employerId,
        safety_criteria: safetyCriteria as Safety4PointAssessment['safety_criteria'],
        safety_metrics: safetyMetrics,
        audit_compliance: auditCompliance,
        notes: notes.trim() || undefined
      }

      await onSave(payload)
      setHasChanges(false)
      success()
      toast.success("Safety assessment completed successfully!")
    } catch (err) {
      error()
      toast.error("Failed to save assessment")
    } finally {
      setIsSubmitting(false)
    }
  }

  const getSectionProgress = () => {
    switch (currentSection) {
      case 'criteria':
        return criteriaProgress
      case 'metrics':
        return 100 // Metrics are always considered complete
      case 'audit':
        return auditCompliance.last_audit_date ? 100 : 0
      case 'evidence':
        return photos.length > 0 ? 100 : 0
      default:
        return 0
    }
  }

  return (
    <div className={className}>
      {/* Header */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-600" />
              <div>
                <h2 className="font-semibold text-lg">Safety Assessment</h2>
                <p className="text-sm text-muted-foreground">{employerName}</p>
              </div>
            </div>
            <Badge variant="outline">
              {currentSection}
            </Badge>
          </div>

          {/* Section Navigation */}
          <div className="flex gap-2 mb-3">
            {[
              { id: 'criteria', label: 'Criteria', icon: Shield },
              { id: 'metrics', label: 'Metrics', icon: TrendingUp },
              { id: 'audit', label: 'Audit', icon: Clock },
              { id: 'evidence', label: 'Evidence', icon: Camera }
            ].map((section) => {
              const Icon = section.icon
              const isActive = currentSection === section.id
              const isComplete = getSectionProgress() === 100

              return (
                <Button
                  key={section.id}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentSection(section.id as any)}
                  className="flex items-center gap-1"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{section.label}</span>
                  {isComplete && <CheckCircle className="h-3 w-3" />}
                </Button>
              )
            })}
          </div>

          <Progress value={getSectionProgress()} className="h-2" />
        </CardContent>
      </Card>

      {/* Section Content */}
      {currentSection === 'criteria' && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <currentCriterion.icon className="h-6 w-6 text-green-600" />
                <div>
                  <CardTitle className="text-lg">{currentCriterion.label}</CardTitle>
                  <p className="text-sm text-muted-foreground">{currentCriterion.description}</p>
                </div>
              </div>
              <Badge variant="outline">
                {currentCriterionIndex + 1}/{safetyCriteria.length}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Examples */}
            <div className="bg-green-50 p-4 rounded-lg">
              <Label className="text-sm font-medium text-green-900 mb-2 block">Key indicators:</Label>
              <ul className="space-y-1">
                {currentCriterion.examples.map((example, index) => (
                  <li key={index} className="text-sm text-green-800 flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">•</span>
                    <span>{example}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Rating Selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Rate this criterion:</Label>
              <div className="px-2 py-1 -mx-2 -my-1">
                <FourPointScaleMobile
                  value={safetyCriteria[currentCriterion.id]}
                  onChange={handleRatingChange}
                />
              </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handlePreviousCriterion}
                disabled={currentCriterionIndex === 0}
                className="flex-1"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              {currentCriterionIndex === safetyCriteria.length - 1 ? (
                <Button
                  onClick={() => setCurrentSection('metrics')}
                  className="flex-1"
                >
                  Next Section
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleNextCriterion}
                  disabled={!safetyCriteria[currentCriterion.id]}
                  className="flex-1"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {currentSection === 'metrics' && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Safety Metrics (Last 12 Months)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label className="text-base font-medium">Lost Time Injuries</Label>
                <Input
                  type="number"
                  min="0"
                  value={safetyMetrics.lost_time_injuries}
                  onChange={(e) => handleMetricChange('lost_time_injuries', parseInt(e.target.value) || 0)}
                  placeholder="Enter number of LTIs"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium">Near Misses</Label>
                <Input
                  type="number"
                  min="0"
                  value={safetyMetrics.near_misses}
                  onChange={(e) => handleMetricChange('near_misses', parseInt(e.target.value) || 0)}
                  placeholder="Enter number of near misses"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium">Safety Breaches</Label>
                <Input
                  type="number"
                  min="0"
                  value={safetyMetrics.safety_breaches}
                  onChange={(e) => handleMetricChange('safety_breaches', parseInt(e.target.value) || 0)}
                  placeholder="Enter number of breaches"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium">Safety Improvements</Label>
                <Input
                  type="number"
                  min="0"
                  value={safetyMetrics.safety_improvements}
                  onChange={(e) => handleMetricChange('safety_improvements', parseInt(e.target.value) || 0)}
                  placeholder="Enter number of improvements"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium">Training Hours</Label>
                <Input
                  type="number"
                  min="0"
                  value={safetyMetrics.training_hours}
                  onChange={(e) => handleMetricChange('training_hours', parseInt(e.target.value) || 0)}
                  placeholder="Enter total training hours"
                />
              </div>
            </div>

            <Button
              onClick={() => setCurrentSection('audit')}
              className="w-full"
            >
              Next Section
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {currentSection === 'audit' && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Audit Compliance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-base font-medium">Last Audit Date</Label>
                <Input
                  type="date"
                  value={auditCompliance.last_audit_date || ''}
                  onChange={(e) => handleAuditChange('last_audit_date', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium">Audit Score (if available)</Label>
                <div className="px-2 py-1 -mx-2 -my-1">
                  <FourPointScaleMobile
                    value={auditCompliance.audit_score}
                    onChange={(value) => handleAuditChange('audit_score', value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium">Outstanding Actions</Label>
                <Input
                  type="number"
                  min="0"
                  value={auditCompliance.outstanding_actions}
                  onChange={(e) => handleAuditChange('outstanding_actions', parseInt(e.target.value) || 0)}
                  placeholder="Number of outstanding actions"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium">Critical Risks Identified</Label>
                <Input
                  type="number"
                  min="0"
                  value={auditCompliance.critical_risks_identified}
                  onChange={(e) => handleAuditChange('critical_risks_identified', parseInt(e.target.value) || 0)}
                  placeholder="Number of critical risks"
                />
              </div>
            </div>

            <Button
              onClick={() => setCurrentSection('evidence')}
              className="w-full"
            >
              Next Section
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {currentSection === 'evidence' && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Photo Evidence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              {[
                { category: 'hazard' as const, label: 'Hazards', color: 'red' },
                { category: 'good-practice' as const, label: 'Good Practice', color: 'green' },
                { category: 'incident' as const, label: 'Incidents', color: 'orange' },
                { category: 'documentation' as const, label: 'Documentation', color: 'blue' }
              ].map((type) => (
                <Button
                  key={type.category}
                  variant="outline"
                  onClick={() => handlePhotoCapture(type.category)}
                  className="h-20 flex-col gap-2"
                >
                  <Camera className="h-6 w-6" />
                  <span className="text-xs">{type.label}</span>
                </Button>
              ))}
            </div>

            {/* Show captured photos */}
            {photos.length > 0 && (
              <div className="space-y-3">
                <Label className="text-base font-medium">Captured Photos ({photos.length})</Label>
                <div className="grid grid-cols-2 gap-3">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative">
                      <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                        <Camera className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <Badge
                        variant="secondary"
                        className="absolute top-2 right-2 text-xs"
                      >
                        {photo.category.replace('-', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Additional Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional observations about safety performance..."
                rows={4}
                className="resize-none"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Card */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Criteria Complete</span>
              <span className="text-sm">{Object.values(safetyCriteria).filter(Boolean).length}/{safetyCriteria.length}</span>
            </div>
            <Progress value={criteriaProgress} />

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Photos Captured</span>
              <span className="text-sm">{photos.length}</span>
            </div>

            {hasChanges && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  You have unsaved changes. Complete all sections to save the assessment.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Final Actions */}
      {currentSection === 'evidence' && (
        <div className="space-y-2">
          <Button
            onClick={handleSave}
            disabled={criteriaProgress < 100 || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? 'Saving...' : 'Complete Safety Assessment'}
          </Button>

          {onCancel && (
            <Button
              variant="ghost"
              onClick={onCancel}
              className="w-full"
              disabled={isSubmitting}
            >
              Cancel Assessment
            </Button>
          )}
        </div>
      )}
    </div>
  )
}