"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { format } from "date-fns"
import {
  Shield,
  AlertTriangle,
  ClipboardList,
  Users,
  FileText,
  CalendarIcon,
  Save,
  Eye,
  CheckCircle,
  TrendingUp,
  Info
} from "lucide-react"
import { FourPointScaleSelector, FourPointRatingDisplay } from "@/components/ui/FourPointScaleSelector"
import { useHapticFeedback } from "@/components/mobile/shared/HapticFeedback"
import { toast } from "sonner"
import {
  FourPointRating,
  Safety4PointAssessment,
  CreateSafety4PointAssessmentPayload
} from "@/types/assessments"

interface SafetyAssessment4PointProps {
  employerId: string
  employerName: string
  initialData?: Partial<Safety4PointAssessment>
  onSave: (data: CreateSafety4PointAssessmentPayload) => Promise<void>
  onViewHistory?: () => void
  readonly?: boolean
  className?: string
}

interface SafetyCriteriaItem {
  id: keyof Safety4PointAssessment['safety_criteria']
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  examples: string[]
}

const safetyCriteria: SafetyCriteriaItem[] = [
  {
    id: 'safety_management_systems',
    label: 'Safety Management Systems',
    description: 'Quality and effectiveness of documented safety systems and procedures',
    icon: Shield,
    examples: [
      'Comprehensive safety manual',
      'Regular system reviews and updates',
      'Clear incident reporting procedures',
      'Emergency response plans'
    ]
  },
  {
    id: 'incident_reporting',
    label: 'Incident Reporting Culture',
    description: 'Effectiveness of incident reporting and investigation processes',
    icon: AlertTriangle,
    examples: [
      'Near-miss reporting encouraged',
      'Timely incident investigations',
      'Root cause analysis performed',
      'Learning shared across workforce'
    ]
  },
  {
    id: 'site_safety_culture',
    label: 'Site Safety Culture',
    description: 'Overall safety attitude and behavior on site',
    icon: Users,
    examples: [
      'Workers actively participate in safety',
      'Safety discussions before tasks',
      'Peer-to-peer safety monitoring',
      'Management visible on site'
    ]
  },
  {
    id: 'risk_assessment_processes',
    label: 'Risk Assessment Processes',
    description: 'Quality of risk identification, assessment, and control measures',
    icon: ClipboardList,
    examples: [
      'Daily risk assessments completed',
      'High-risk tasks properly identified',
      'Control measures implemented',
      'Risk assessments documented'
    ]
  },
  {
    id: 'emergency_preparedness',
    label: 'Emergency Preparedness',
    description: 'Readiness for emergency situations and response capabilities',
    icon: Shield,
    examples: [
      'Emergency drills conducted',
      'First aid equipment available',
      'Emergency contacts displayed',
      'Evacuation procedures clear'
    ]
  },
  {
    id: 'worker_safety_training',
    label: 'Worker Safety Training',
    description: 'Quality and completeness of safety training programs',
    icon: FileText,
    examples: [
      'Induction training comprehensive',
      'Task-specific training provided',
      'Training records maintained',
      'Regular refresher training'
    ]
  }
]

export function SafetyAssessment4Point({
  employerId,
  employerName,
  initialData,
  onSave,
  onViewHistory,
  readonly = false,
  className
}: SafetyAssessment4PointProps) {
  const { trigger, success, error } = useHapticFeedback()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Safety criteria state
  const [safetyCriteria, setSafetyCriteria] = useState<Safety4PointAssessment['safety_criteria']>({
    safety_management_systems: initialData?.safety_criteria?.safety_management_systems || undefined,
    incident_reporting: initialData?.safety_criteria?.incident_reporting || undefined,
    site_safety_culture: initialData?.safety_criteria?.site_safety_culture || undefined,
    risk_assessment_processes: initialData?.safety_criteria?.risk_assessment_processes || undefined,
    emergency_preparedness: initialData?.safety_criteria?.emergency_preparedness || undefined,
    worker_safety_training: initialData?.safety_criteria?.worker_safety_training || undefined
  })

  // Safety metrics state
  const [safetyMetrics, setSafetyMetrics] = useState<Safety4PointAssessment['safety_metrics']>({
    lost_time_injuries: initialData?.safety_metrics?.lost_time_injuries || 0,
    near_misses: initialData?.safety_metrics?.near_misses || 0,
    safety_breaches: initialData?.safety_metrics?.safety_breaches || 0,
    safety_improvements: initialData?.safety_metrics?.safety_improvements || 0,
    training_hours: initialData?.safety_metrics?.training_hours || 0
  })

  // Audit compliance state
  const [auditCompliance, setAuditCompliance] = useState<Safety4PointAssessment['audit_compliance']>({
    last_audit_date: initialData?.audit_compliance?.last_audit_date,
    audit_score: initialData?.audit_compliance?.audit_score,
    outstanding_actions: initialData?.audit_compliance?.outstanding_actions || 0,
    critical_risks_identified: initialData?.audit_compliance?.critical_risks_identified || 0
  })

  const [notes, setNotes] = useState(initialData?.notes || '')

  const handleCriteriaChange = useCallback((field: keyof Safety4PointAssessment['safety_criteria'], value: FourPointRating) => {
    setSafetyCriteria(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
    trigger('selection')
  }, [trigger])

  const handleMetricChange = useCallback((field: keyof Safety4PointAssessment['safety_metrics'], value: number) => {
    setSafetyMetrics(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }, [])

  const handleAuditChange = useCallback((field: keyof Safety4PointAssessment['audit_compliance'], value: any) => {
    setAuditCompliance(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }, [])

  // Calculate overall safety score
  const overallScore = Object.values(safetyCriteria).filter(Boolean).length > 0
    ? Math.round(Object.values(safetyCriteria).filter(Boolean).reduce((sum, rating) => sum + rating, 0) /
                Object.values(safetyCriteria).filter(Boolean).length) as FourPointRating
    : undefined

  // Calculate completion percentage
  const completionPercentage = (Object.values(safetyCriteria).filter(Boolean).length / safetyCriteria.length) * 100

  const handleSave = async () => {
    const incompleteCriteria = Object.entries(safetyCriteria).filter(([_, value]) => !value)

    if (incompleteCriteria.length > 0) {
      toast.error(`Please complete all criteria before saving. Missing: ${incompleteCriteria.map(([key]) =>
        safetyCriteria.find(c => c.id === key)?.label
      ).join(', ')}`)
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
      toast.success("Safety Assessment saved successfully")
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
                <Shield className="h-5 w-5" />
                Safety Assessment Preview
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
                label="Overall Safety Score"
                size="lg"
                variant="detailed"
                confidenceLevel={Math.round(completionPercentage)}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium">Safety Criteria Breakdown</h4>
              <div className="space-y-3">
                {safetyCriteria.map((criterion) => {
                  const Icon = criterion.icon
                  const rating = safetyCriteria[criterion.id]

                  return (
                    <div key={criterion.id} className="flex items-center gap-3 p-3 rounded-lg border">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
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
                  )
                })}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium">Safety Metrics</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-lg border">
                  <div className="text-2xl font-bold text-red-600">
                    {safetyMetrics.lost_time_injuries}
                  </div>
                  <div className="text-xs text-muted-foreground">LTIs</div>
                </div>
                <div className="text-center p-3 rounded-lg border">
                  <div className="text-2xl font-bold text-orange-600">
                    {safetyMetrics.near_misses}
                  </div>
                  <div className="text-xs text-muted-foreground">Near Misses</div>
                </div>
                <div className="text-center p-3 rounded-lg border">
                  <div className="text-2xl font-bold text-blue-600">
                    {safetyMetrics.training_hours}
                  </div>
                  <div className="text-xs text-muted-foreground">Training Hours</div>
                </div>
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
                <Shield className="h-5 w-5" />
                Safety Assessment (4-Point Scale)
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Assess {employerName}'s safety performance and systems
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
              Rate each safety criterion on a 4-point scale: 1 (Poor) to 4 (Excellent).
              Consider documented evidence, observations, and worker feedback.
            </AlertDescription>
          </Alert>

          {/* Safety Criteria */}
          <div className="space-y-6">
            {safetyCriteria.map((criterion) => {
              const Icon = criterion.icon
              const rating = safetyCriteria[criterion.id]

              return (
                <Card key={criterion.id} className="border-l-4 border-l-green-200">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-start gap-3">
                      <Icon className="h-5 w-5 text-green-600 mt-0.5" />
                      <div className="flex-1 space-y-2">
                        <div>
                          <h4 className="font-medium">{criterion.label}</h4>
                          <p className="text-sm text-muted-foreground">{criterion.description}</p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Key indicators:</label>
                          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                            {criterion.examples.map((example, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">•</span>
                                <span>{example}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

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
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Safety Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Safety Metrics (Last 12 Months)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Lost Time Injuries</Label>
                  <Input
                    type="number"
                    min="0"
                    value={safetyMetrics.lost_time_injuries}
                    onChange={(e) => handleMetricChange('lost_time_injuries', parseInt(e.target.value) || 0)}
                    disabled={readonly}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Near Misses</Label>
                  <Input
                    type="number"
                    min="0"
                    value={safetyMetrics.near_misses}
                    onChange={(e) => handleMetricChange('near_misses', parseInt(e.target.value) || 0)}
                    disabled={readonly}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Safety Breaches</Label>
                  <Input
                    type="number"
                    min="0"
                    value={safetyMetrics.safety_breaches}
                    onChange={(e) => handleMetricChange('safety_breaches', parseInt(e.target.value) || 0)}
                    disabled={readonly}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Safety Improvements</Label>
                  <Input
                    type="number"
                    min="0"
                    value={safetyMetrics.safety_improvements}
                    onChange={(e) => handleMetricChange('safety_improvements', parseInt(e.target.value) || 0)}
                    disabled={readonly}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Training Hours</Label>
                  <Input
                    type="number"
                    min="0"
                    value={safetyMetrics.training_hours}
                    onChange={(e) => handleMetricChange('training_hours', parseInt(e.target.value) || 0)}
                    disabled={readonly}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audit Compliance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit Compliance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Last Audit Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {auditCompliance.last_audit_date
                          ? format(new Date(auditCompliance.last_audit_date), "PPP")
                          : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={auditCompliance.last_audit_date ? new Date(auditCompliance.last_audit_date) : undefined}
                        onSelect={(date) => handleAuditChange('last_audit_date', date?.toISOString().split('T')[0])}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Audit Score (if available)</Label>
                  <FourPointScaleSelector
                    value={auditCompliance.audit_score}
                    onChange={(value) => handleAuditChange('audit_score', value)}
                    disabled={readonly}
                    size="sm"
                    variant="compact"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Outstanding Actions</Label>
                  <Input
                    type="number"
                    min="0"
                    value={auditCompliance.outstanding_actions}
                    onChange={(e) => handleAuditChange('outstanding_actions', parseInt(e.target.value) || 0)}
                    disabled={readonly}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Critical Risks Identified</Label>
                  <Input
                    type="number"
                    min="0"
                    value={auditCompliance.critical_risks_identified}
                    onChange={(e) => handleAuditChange('critical_risks_identified', parseInt(e.target.value) || 0)}
                    disabled={readonly}
                  />
                </div>
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
                placeholder="Any additional observations about safety performance, incidents, or improvements..."
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
                Currently {safetyCriteria.length - Object.values(safetyCriteria).filter(Boolean).length} criteria remaining.
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