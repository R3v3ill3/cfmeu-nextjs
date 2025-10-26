"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CheckCircle,
  AlertCircle,
  Info,
  ChevronLeft,
  ChevronRight,
  Save,
  Eye,
  Star,
  MessageSquare,
  Building,
  Shield,
  Users,
  Award
} from "lucide-react"
import { useHapticFeedback } from "@/components/mobile/shared/HapticFeedback"
import {
  AssessmentType,
  FourPointRating,
  FourPointRatingLabel,
  EmployerRole,
  UnionRespectAssessment,
  Safety4PointAssessment,
  SubcontractorUseAssessment,
  RoleSpecificAssessment,
} from "@/types/assessments"

interface FourPointAssessmentWizardProps {
  employerId: string
  employerName: string
  assessmentType: AssessmentType
  employerRole?: EmployerRole
  onSubmit: (data: any) => Promise<void>
  onCancel: () => void
  initialData?: any
  showPreview?: boolean
  allowSaveDraft?: boolean
  className?: string
}

type WizardStep = 'intro' | 'union_respect' | 'safety_4_point' | 'subcontractor_use' | 'role_specific' | 'review' | 'confirmation'

interface StepConfig {
  id: WizardStep
  title: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  required: boolean
}

export function FourPointAssessmentWizard({
  employerId,
  employerName,
  assessmentType,
  employerRole,
  onSubmit,
  onCancel,
  initialData,
  showPreview = true,
  allowSaveDraft = true,
  className
}: FourPointAssessmentWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('intro')
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPreviewData, setShowPreviewData] = useState(showPreview)
  const { triggerHaptic } = useHapticFeedback()

  // Form data state
  const [formData, setFormData] = useState({
    // Union Respect Assessment
    union_respect: {
      criteria: {
        union_engagement: 3,
        communication_respect: 3,
        collaboration_attitude: 3,
        dispute_resolution: 3,
        union_delegate_relations: 3,
      },
      additional_comments: {
        union_engagement: '',
        communication_respect: '',
        collaboration_attitude: '',
        dispute_resolution: '',
        union_delegate_relations: '',
      },
      supporting_evidence: {
        has_union_delegates: false,
        regular_meetings: false,
        formal_communication_channels: false,
        joint_safety_committee: false,
        union_training_participation: false,
      },
      notes: '',
    },
    // Safety 4-Point Assessment
    safety_4_point: {
      safety_criteria: {
        safety_management_systems: 3,
        incident_reporting: 3,
        site_safety_culture: 3,
        risk_assessment_processes: 3,
        emergency_preparedness: 3,
        worker_safety_training: 3,
      },
      safety_metrics: {
        lost_time_injuries: 0,
        near_misses: 0,
        safety_breaches: 0,
        safety_improvements: 0,
        training_hours: 0,
      },
      audit_compliance: {
        last_audit_date: '',
        audit_score: 3,
        outstanding_actions: 0,
        critical_risks_identified: 0,
      },
      notes: '',
    },
    // Subcontractor Use Assessment
    subcontractor_use: {
      subcontracting_criteria: {
        fair_subcontractor_selection: 3,
        payment_practices: 3,
        work_quality_standards: 3,
        subcontractor_relations: 3,
        contract_fairness: 3,
      },
      subcontractor_metrics: {
        active_subcontractors: 0,
        payment_terms_days: 30,
        dispute_count: 0,
        repeat_subcontractor_rate: 0,
      },
      compliance_records: {
        abn_verified: false,
        insurance_valid: false,
        licences_current: false,
        payment_history_clean: false,
      },
      notes: '',
    },
    // Role-Specific Assessment
    role_specific: {
      employer_role: employerRole || 'other',
      role_criteria: {
        industry_reputation: 3,
        work_quality: 3,
        reliability: 3,
        financial_stability: 3,
        expertise_level: 3,
      },
      role_specific_metrics: {
        years_in_industry: 0,
        project_success_rate: 0,
        staff_retention_rate: 0,
        average_project_size: 0,
      },
      certifications: {
        industry_certifications: [],
        quality_assurance_cert: false,
        environmental_cert: false,
        safety_certifications: [],
      },
      notes: '',
    },
  })

  // Define wizard steps based on assessment type
  const steps: StepConfig[] = [
    {
      id: 'intro',
      title: 'Introduction',
      icon: Info,
      description: 'Overview of the 4-point assessment process',
      required: true,
    },
    ...(assessmentType === 'union_respect' ? [{
      id: 'union_respect' as WizardStep,
      title: 'Union Respect Assessment',
      icon: Users,
      description: 'Evaluate union engagement and collaboration',
      required: true,
    }] : []),
    ...(assessmentType === 'safety_4_point' ? [{
      id: 'safety_4_point' as WizardStep,
      title: 'Safety Assessment',
      icon: Shield,
      description: 'Assess safety management and performance',
      required: true,
    }] : []),
    ...(assessmentType === 'subcontractor_use' ? [{
      id: 'subcontractor_use' as WizardStep,
      title: 'Subcontractor Use Assessment',
      icon: Building,
      description: 'Evaluate subcontractor relationships and practices',
      required: true,
    }] : []),
    ...(assessmentType === 'role_specific' ? [{
      id: 'role_specific' as WizardStep,
      title: 'Role-Specific Assessment',
      icon: Award,
      description: 'Assess role-specific capabilities and performance',
      required: true,
    }] : []),
    {
      id: 'review',
      title: 'Review & Submit',
      icon: Eye,
      description: 'Review your assessment before submission',
      required: true,
    },
    {
      id: 'confirmation',
      title: 'Confirmation',
      icon: CheckCircle,
      description: 'Assessment completed successfully',
      required: false,
    },
  ].filter(step => !step.required || (assessmentType === 'all' ||
    (assessmentType === 'union_respect' && step.id === 'union_respect') ||
    (assessmentType === 'safety_4_point' && step.id === 'safety_4_point') ||
    (assessmentType === 'subcontractor_use' && step.id === 'subcontractor_use') ||
    (assessmentType === 'role_specific' && step.id === 'role_specific') ||
    (!['union_respect', 'safety_4_point', 'subcontractor_use', 'role_specific'].includes(step.id))
  ))

  const currentStepIndex = steps.findIndex(step => step.id === currentStep)
  const currentStepConfig = steps[currentStepIndex]

  // Get 4-point rating label
  const getRatingLabel = (rating: FourPointRating): FourPointRatingLabel => {
    switch (rating) {
      case 1: return 'Poor'
      case 2: return 'Fair'
      case 3: return 'Good'
      case 4: return 'Excellent'
      default: return 'Good'
    }
  }

  // Get rating color
  const getRatingColor = (rating: FourPointRating): string => {
    switch (rating) {
      case 1: return 'text-red-600 bg-red-50 border-red-200'
      case 2: return 'text-amber-600 bg-amber-50 border-amber-200'
      case 3: return 'text-lime-600 bg-lime-50 border-lime-200'
      case 4: return 'text-green-600 bg-green-50 border-green-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  // Navigation functions
  const goToNextStep = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      const nextStep = steps[currentStepIndex + 1]
      setCurrentStep(nextStep.id)
      setCompletedSteps(prev => new Set([...prev, currentStep]))
      triggerHaptic('light')
    }
  }, [currentStepIndex, steps, currentStep, triggerHaptic])

  const goToPreviousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      const previousStep = steps[currentStepIndex - 1]
      setCurrentStep(previousStep.id)
      triggerHaptic('light')
    }
  }, [currentStepIndex, steps, triggerHaptic])

  const goToStep = useCallback((stepId: WizardStep) => {
    setCurrentStep(stepId)
    triggerHaptic('light')
  }, [triggerHaptic])

  // Validation functions
  const validateCurrentStep = useCallback((): boolean => {
    switch (currentStep) {
      case 'union_respect':
        const unionCriteria = formData.union_respect.criteria
        return Object.values(unionCriteria).every(value => value >= 1 && value <= 4)

      case 'safety_4_point':
        const safetyCriteria = formData.safety_4_point.safety_criteria
        return Object.values(safetyCriteria).every(value => value >= 1 && value <= 4)

      case 'subcontractor_use':
        const subcontractorCriteria = formData.subcontractor_use.subcontracting_criteria
        return Object.values(subcontractorCriteria).every(value => value >= 1 && value <= 4)

      case 'role_specific':
        const roleCriteria = formData.role_specific.role_criteria
        return Object.values(roleCriteria).every(value => value >= 1 && value <= 4)

      default:
        return true
    }
  }, [currentStep, formData])

  // Submit handler
  const handleSubmit = async () => {
    if (!validateCurrentStep()) {
      triggerHaptic('error')
      return
    }

    setIsSubmitting(true)
    triggerHaptic('medium')

    try {
      let submissionData: any = {
        employer_id: employerId,
        assessment_type: assessmentType,
        notes: '',
      }

      switch (assessmentType) {
        case 'union_respect':
          submissionData = {
            ...submissionData,
            criteria: formData.union_respect.criteria,
            additional_comments: formData.union_respect.additional_comments,
            supporting_evidence: formData.union_respect.supporting_evidence,
            notes: formData.union_respect.notes,
          }
          break

        case 'safety_4_point':
          submissionData = {
            ...submissionData,
            safety_criteria: formData.safety_4_point.safety_criteria,
            safety_metrics: formData.safety_4_point.safety_metrics,
            audit_compliance: formData.safety_4_point.audit_compliance,
            notes: formData.safety_4_point.notes,
          }
          break

        case 'subcontractor_use':
          submissionData = {
            ...submissionData,
            subcontracting_criteria: formData.subcontractor_use.subcontracting_criteria,
            subcontractor_metrics: formData.subcontractor_use.subcontractor_metrics,
            compliance_records: formData.subcontractor_use.compliance_records,
            notes: formData.subcontractor_use.notes,
          }
          break

        case 'role_specific':
          submissionData = {
            ...submissionData,
            employer_role: formData.role_specific.employer_role,
            role_criteria: formData.role_specific.role_criteria,
            role_specific_metrics: formData.role_specific.role_specific_metrics,
            certifications: formData.role_specific.certifications,
            notes: formData.role_specific.notes,
          }
          break
      }

      await onSubmit(submissionData)
      setCompletedSteps(prev => new Set([...prev, currentStep]))
      goToNextStep()
    } catch (error) {
      console.error('Assessment submission failed:', error)
      triggerHaptic('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'intro':
        return <IntroStep employerName={employerName} assessmentType={assessmentType} />

      case 'union_respect':
        return (
          <UnionRespectStep
            data={formData.union_respect}
            onChange={(updates) => setFormData(prev => ({
              ...prev,
              union_respect: { ...prev.union_respect, ...updates }
            }))}
          />
        )

      case 'safety_4_point':
        return (
          <SafetyStep
            data={formData.safety_4_point}
            onChange={(updates) => setFormData(prev => ({
              ...prev,
              safety_4_point: { ...prev.safety_4_point, ...updates }
            }))}
          />
        )

      case 'subcontractor_use':
        return (
          <SubcontractorUseStep
            data={formData.subcontractor_use}
            onChange={(updates) => setFormData(prev => ({
              ...prev,
              subcontractor_use: { ...prev.subcontractor_use, ...updates }
            }))}
          />
        )

      case 'role_specific':
        return (
          <RoleSpecificStep
            data={formData.role_specific}
            onChange={(updates) => setFormData(prev => ({
              ...prev,
              role_specific: { ...prev.role_specific, ...updates }
            }))}
          />
        )

      case 'review':
        return (
          <ReviewStep
            assessmentType={assessmentType}
            formData={formData}
            employerName={employerName}
          />
        )

      case 'confirmation':
        return <ConfirmationStep employerName={employerName} assessmentType={assessmentType} />

      default:
        return null
    }
  }

  return (
    <div className={cn("flex flex-col h-full max-w-4xl mx-auto", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center space-x-3">
          {currentStepConfig && <currentStepConfig.icon className="w-5 h-5" />}
          <div>
            <h1 className="text-lg font-semibold">{currentStepConfig?.title}</h1>
            <p className="text-sm text-gray-600">{currentStepConfig?.description}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center p-4 bg-gray-50 border-b">
        <div className="flex items-center space-x-2">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => goToStep(step.id)}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors",
                  completedSteps.has(step.id) || currentStep === step.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                )}
                disabled={index > currentStepIndex + 1}
              >
                <step.icon className="w-4 h-4" />
              </button>
              {index < steps.length - 1 && (
                <div className={cn(
                  "w-8 h-0.5 mx-2",
                  completedSteps.has(step.id) ? "bg-blue-600" : "bg-gray-300"
                )} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between p-4 border-t bg-white">
        <div className="flex space-x-2">
          {currentStepIndex > 0 && (
            <Button variant="outline" onClick={goToPreviousStep}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {allowSaveDraft && currentStep !== 'intro' && currentStep !== 'confirmation' && (
            <Button variant="outline" onClick={() => {/* Save draft logic */}}>
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </Button>
          )}

          {currentStep === 'review' ? (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !validateCurrentStep()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
              <CheckCircle className="w-4 h-4 ml-2" />
            </Button>
          ) : currentStep !== 'confirmation' ? (
            <Button
              onClick={goToNextStep}
              disabled={!validateCurrentStep()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={onCancel} className="bg-green-600 hover:bg-green-700">
              Done
              <CheckCircle className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// Step Components
function IntroStep({ employerName, assessmentType }: { employerName: string, assessmentType: AssessmentType }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Info className="w-5 h-5 mr-2" />
          4-Point Assessment: {employerName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-medium mb-2">Assessment Overview</h3>
          <p className="text-sm text-gray-700">
            This assessment will evaluate {employerName} using the CFMEU's new 4-point rating system.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">4</div>
            <div className="text-sm text-green-700">Excellent</div>
          </div>
          <div className="text-center p-3 bg-lime-50 rounded-lg">
            <div className="text-2xl font-bold text-lime-600">3</div>
            <div className="text-sm text-lime-700">Good</div>
          </div>
          <div className="text-center p-3 bg-amber-50 rounded-lg">
            <div className="text-2xl font-bold text-amber-600">2</div>
            <div className="text-sm text-amber-700">Fair</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">1</div>
            <div className="text-sm text-red-700">Poor</div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium mb-2">What to Expect</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• Assessment should take approximately 10-15 minutes</li>
            <li>• You can save your progress and return later</li>
            <li>• All ratings are confidential and used for internal evaluation</li>
            <li>• You'll be able to review your answers before submitting</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

function UnionRespectStep({
  data,
  onChange
}: {
  data: any,
  onChange: (updates: any) => void
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Union Respect Assessment Criteria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(data.criteria).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <Label className="text-sm font-medium">
                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Label>
              <RadioGroup
                value={String(value)}
                onValueChange={(newValue) => onChange({
                  criteria: { ...data.criteria, [key]: parseInt(newValue) }
                })}
                className="flex flex-wrap gap-4"
              >
                {[1, 2, 3, 4].map(rating => (
                  <div key={rating} className="flex items-center space-x-2">
                    <RadioGroupItem value={String(rating)} id={`${key}-${rating}`} />
                    <Label htmlFor={`${key}-${rating}`} className="text-sm">
                      {rating} - {getRatingLabel(rating as FourPointRating)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Supporting Evidence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(data.supporting_evidence).map(([key, value]) => (
            <div key={key} className="flex items-center space-x-2">
              <Checkbox
                id={key}
                checked={Boolean(value)}
                onCheckedChange={(checked) => onChange({
                  supporting_evidence: { ...data.supporting_evidence, [key]: checked }
                })}
              />
              <Label htmlFor={key} className="text-sm">
                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Label>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Additional Comments</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Add any additional comments about the union respect assessment..."
            value={data.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            rows={4}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function SafetyStep({
  data,
  onChange
}: {
  data: any,
  onChange: (updates: any) => void
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Safety Criteria Assessment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(data.safety_criteria).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <Label className="text-sm font-medium">
                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Label>
              <RadioGroup
                value={String(value)}
                onValueChange={(newValue) => onChange({
                  safety_criteria: { ...data.safety_criteria, [key]: parseInt(newValue) }
                })}
                className="flex flex-wrap gap-4"
              >
                {[1, 2, 3, 4].map(rating => (
                  <div key={rating} className="flex items-center space-x-2">
                    <RadioGroupItem value={String(rating)} id={`${key}-${rating}`} />
                    <Label htmlFor={`${key}-${rating}`} className="text-sm">
                      {rating} - {getRatingLabel(rating as FourPointRating)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Safety Metrics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {Object.entries(data.safety_metrics).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <Label className="text-sm font-medium">
                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Label>
              <Input
                type="number"
                value={String(value)}
                onChange={(e) => onChange({
                  safety_metrics: { ...data.safety_metrics, [key]: parseInt(e.target.value) || 0 }
                })}
                min="0"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Additional Comments</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Add any additional comments about the safety assessment..."
            value={data.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            rows={4}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function SubcontractorUseStep({
  data,
  onChange
}: {
  data: any,
  onChange: (updates: any) => void
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Subcontracting Criteria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(data.subcontracting_criteria).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <Label className="text-sm font-medium">
                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Label>
              <RadioGroup
                value={String(value)}
                onValueChange={(newValue) => onChange({
                  subcontracting_criteria: { ...data.subcontracting_criteria, [key]: parseInt(newValue) }
                })}
                className="flex flex-wrap gap-4"
              >
                {[1, 2, 3, 4].map(rating => (
                  <div key={rating} className="flex items-center space-x-2">
                    <RadioGroupItem value={String(rating)} id={`${key}-${rating}`} />
                    <Label htmlFor={`${key}-${rating}`} className="text-sm">
                      {rating} - {getRatingLabel(rating as FourPointRating)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subcontractor Metrics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {Object.entries(data.subcontractor_metrics).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <Label className="text-sm font-medium">
                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Label>
              <Input
                type="number"
                value={String(value)}
                onChange={(e) => onChange({
                  subcontractor_metrics: { ...data.subcontractor_metrics, [key]: parseInt(e.target.value) || 0 }
                })}
                min="0"
                max={key === 'repeat_subcontractor_rate' ? 100 : undefined}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compliance Records</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(data.compliance_records).map(([key, value]) => (
            <div key={key} className="flex items-center space-x-2">
              <Checkbox
                id={key}
                checked={Boolean(value)}
                onCheckedChange={(checked) => onChange({
                  compliance_records: { ...data.compliance_records, [key]: checked }
                })}
              />
              <Label htmlFor={key} className="text-sm">
                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Label>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function RoleSpecificStep({
  data,
  onChange
}: {
  data: any,
  onChange: (updates: any) => void
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Employer Role</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={data.employer_role}
            onValueChange={(value) => onChange({ employer_role: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select employer role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="head_contractor">Head Contractor</SelectItem>
              <SelectItem value="subcontractor">Subcontractor</SelectItem>
              <SelectItem value="trade_contractor">Trade Contractor</SelectItem>
              <SelectItem value="labour_hire">Labour Hire</SelectItem>
              <SelectItem value="consultant">Consultant</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role Criteria Assessment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(data.role_criteria).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <Label className="text-sm font-medium">
                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Label>
              <RadioGroup
                value={String(value)}
                onValueChange={(newValue) => onChange({
                  role_criteria: { ...data.role_criteria, [key]: parseInt(newValue) }
                })}
                className="flex flex-wrap gap-4"
              >
                {[1, 2, 3, 4].map(rating => (
                  <div key={rating} className="flex items-center space-x-2">
                    <RadioGroupItem value={String(rating)} id={`${key}-${rating}`} />
                    <Label htmlFor={`${key}-${rating}`} className="text-sm">
                      {rating} - {getRatingLabel(rating as FourPointRating)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role-Specific Metrics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {Object.entries(data.role_specific_metrics).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <Label className="text-sm font-medium">
                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Label>
              <Input
                type="number"
                value={String(value)}
                onChange={(e) => onChange({
                  role_specific_metrics: { ...data.role_specific_metrics, [key]: parseInt(e.target.value) || 0 }
                })}
                min="0"
                max={key.includes('rate') ? 100 : undefined}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function ReviewStep({
  assessmentType,
  formData,
  employerName
}: {
  assessmentType: AssessmentType
  formData: any
  employerName: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Assessment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium mb-2">Assessment Summary</h3>
          <p className="text-sm text-gray-700">
            Review your assessment for <strong>{employerName}</strong> before submitting.
          </p>
        </div>

        {/* Display assessment-specific summary based on type */}
        {assessmentType === 'union_respect' && (
          <div className="space-y-4">
            <h4 className="font-medium">Union Respect Criteria</h4>
            {Object.entries(formData.union_respect.criteria).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="text-sm">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                <Badge variant="outline">
                  {value} - {getRatingLabel(value as FourPointRating)}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* Similar sections for other assessment types... */}

        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">Ready to Submit?</h4>
          <p className="text-sm text-gray-700">
            Once submitted, this assessment will be used to calculate the employer's 4-point rating.
            You can edit this assessment later if needed.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function ConfirmationStep({
  employerName,
  assessmentType
}: {
  employerName: string
  assessmentType: AssessmentType
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-green-600">
          <CheckCircle className="w-5 h-5 mr-2" />
          Assessment Completed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
          <h3 className="font-medium text-green-800">Success!</h3>
          <p className="text-sm text-green-700">
            Your {assessmentType.replace(/_/g, ' ')} assessment for {employerName} has been submitted successfully.
          </p>
        </div>

        <div className="text-sm text-gray-600 space-y-1">
          <p>• The assessment will be reviewed by an administrator</p>
          <p>• Rating calculations will be updated automatically</p>
          <p>• You can view the assessment results in the employer's profile</p>
        </div>
      </CardContent>
    </Card>
  )
}

// Helper function for getting rating label
function getRatingLabel(rating: FourPointRating): FourPointRatingLabel {
  switch (rating) {
    case 1: return 'Poor'
    case 2: return 'Fair'
    case 3: return 'Good'
    case 4: return 'Excellent'
    default: return 'Good'
  }
}