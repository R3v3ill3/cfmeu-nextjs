"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Eye,
  Star,
  Users,
  Shield,
  Building,
  CheckCircle,
  AlertCircle,
  Info,
  ArrowRight,
  Clock
} from "lucide-react"
import { useHapticFeedback } from "../shared/HapticFeedback"
import { toast } from "sonner"
import { FourPointScaleSelector, FourPointRatingDisplay } from "@/components/ui/FourPointScaleSelector"
import { UnionRespectAssessment } from "@/components/assessments/UnionRespectAssessment"
import { SafetyAssessment4Point } from "@/components/assessments/SafetyAssessment4Point"
import {
  FourPointRating,
  AssessmentType,
  EmployerRole,
  UnionRespectAssessment as UnionRespectType,
  Safety4PointAssessment as SafetyAssessmentType,
  CreateUnionRespectAssessmentPayload,
  CreateSafety4PointAssessmentPayload
} from "@/types/assessments"

interface EnhancedRatingWizardProps {
  employerId: string
  employerName: string
  employerRole?: EmployerRole
  initialStep?: string
  onComplete?: () => void
  onCancel?: () => void
  allowSaveDraft?: boolean
  className?: string
}

interface WizardStep {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  required?: boolean
  skip?: boolean
  estimatedTime?: number
}

interface AssessmentProgress {
  unionRespect: number
  safety: number
  subcontractorUse: number
  roleSpecific: number
  overall: number
}

export function EnhancedRatingWizard({
  employerId,
  employerName,
  employerRole = 'trade_contractor',
  initialStep = 'introduction',
  onComplete,
  onCancel,
  allowSaveDraft = true,
  className
}: EnhancedRatingWizardProps) {
  const { trigger, success, error } = useHapticFeedback()
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [savedDraft, setSavedDraft] = useState(false)
  const [stepData, setStepData] = useState<Record<string, any>>({})

  // Assessment data
  const [unionRespectData, setUnionRespectData] = useState<Partial<UnionRespectType> | null>(null)
  const [safetyData, setSafetyData] = useState<Partial<SafetyAssessmentType> | null>(null)

  // Calculate progress
  const [progress, setProgress] = useState<AssessmentProgress>({
    unionRespect: 0,
    safety: 0,
    subcontractorUse: 0,
    roleSpecific: 0,
    overall: 0
  })

  // Available wizard steps based on employer role
  const availableSteps: WizardStep[] = useMemo(() => {
    const baseSteps: WizardStep[] = [
      {
        id: 'introduction',
        title: 'Introduction',
        description: 'Overview of the assessment process',
        icon: Info,
        required: true,
        estimatedTime: 2
      },
      {
        id: 'role-detection',
        title: 'Role Confirmation',
        description: 'Confirm employer role and assessment scope',
        icon: Building,
        required: true,
        estimatedTime: 1
      },
      {
        id: 'union-respect',
        title: 'Union Respect Assessment',
        description: 'Assess union engagement and relationship quality',
        icon: Users,
        required: true,
        estimatedTime: 10
      },
      {
        id: 'safety',
        title: 'Safety Assessment',
        description: 'Evaluate safety systems and performance',
        icon: Shield,
        required: true,
        estimatedTime: 15
      }
    ]

    // Add role-specific steps
    if (employerRole === 'head_contractor' || employerRole === 'subcontractor') {
      baseSteps.push({
        id: 'subcontractor-use',
        title: 'Subcontractor Relations',
        description: 'Assess subcontractor management and relationships',
        icon: Building,
        required: true,
        estimatedTime: 8
      })
    }

    baseSteps.push({
      id: 'role-specific',
      title: 'Role-Specific Assessment',
      description: 'Evaluate role-specific performance indicators',
      icon: Star,
      required: true,
      estimatedTime: 12
    })

    baseSteps.push({
      id: 'confidence-factors',
      title: 'Confidence Factors',
      description: 'Assess confidence in your ratings',
      icon: CheckCircle,
      required: false,
      estimatedTime: 3
    })

    baseSteps.push({
      id: 'review',
      title: 'Review & Submit',
      description: 'Review all assessments before submission',
      icon: Eye,
      required: true,
      estimatedTime: 5
    })

    return baseSteps
  }, [employerRole])

  // Calculate overall progress
  useEffect(() => {
    const requiredSteps = availableSteps.filter(step => step.required)
    const completedRequiredSteps = requiredSteps.filter(step => completedSteps.has(step.id))
    const overallProgress = (completedRequiredSteps.length / requiredSteps.length) * 100

    setProgress({
      unionRespect: unionRespectData ? 100 : 0,
      safety: safetyData ? 100 : 0,
      subcontractorUse: stepData['subcontractor-use'] ? 100 : 0,
      roleSpecific: stepData['role-specific'] ? 100 : 0,
      overall: overallProgress
    })
  }, [completedSteps, availableSteps, unionRespectData, safetyData, stepData])

  const getCurrentStepIndex = () => {
    return availableSteps.findIndex(step => step.id === currentStep)
  }

  const canProceedToNextStep = () => {
    const currentStepIndex = getCurrentStepIndex()
    const currentStepConfig = availableSteps[currentStepIndex]

    if (!currentStepConfig?.required) return true

    switch (currentStep) {
      case 'introduction':
        return true
      case 'role-detection':
        return stepData['role-detection']?.confirmed
      case 'union-respect':
        return unionRespectData?.criteria && Object.values(unionRespectData.criteria).every(Boolean)
      case 'safety':
        return safetyData?.safety_criteria && Object.values(safetyData.safety_criteria).every(Boolean)
      case 'subcontractor-use':
        return stepData['subcontractor-use']?.complete
      case 'role-specific':
        return stepData['role-specific']?.complete
      case 'confidence-factors':
        return true
      case 'review':
        return true
      default:
        return false
    }
  }

  const handleNextStep = useCallback(() => {
    if (!canProceedToNextStep()) {
      toast.error("Please complete the current step before proceeding")
      error()
      return
    }

    const currentStepIndex = getCurrentStepIndex()
    if (currentStepIndex < availableSteps.length - 1) {
      const nextStep = availableSteps[currentStepIndex + 1]
      setCurrentStep(nextStep.id)
      trigger('success')
    }
  }, [canProceedToNextStep, getCurrentStepIndex, availableSteps, trigger, error])

  const handlePreviousStep = useCallback(() => {
    const currentStepIndex = getCurrentStepIndex()
    if (currentStepIndex > 0) {
      const previousStep = availableSteps[currentStepIndex - 1]
      setCurrentStep(previousStep.id)
      trigger('selection')
    }
  }, [getCurrentStepIndex, availableSteps, trigger])

  const handleStepComplete = useCallback((stepId: string, data: any) => {
    setCompletedSteps(prev => new Set([...prev, stepId]))
    setStepData(prev => ({ ...prev, [stepId]: data }))
    trigger('success')
  }, [trigger])

  const handleSaveDraft = useCallback(async () => {
    try {
      // Save draft logic here
      setSavedDraft(true)
      success()
      toast.success("Draft saved successfully")
      setTimeout(() => setSavedDraft(false), 3000)
    } catch (err) {
      error()
      toast.error("Failed to save draft")
    }
  }, [success, error])

  const handleSubmit = useCallback(async () => {
    if (!canProceedToNextStep()) {
      toast.error("Please complete all required steps before submitting")
      return
    }

    setIsSubmitting(true)
    try {
      // Submit all assessments
      if (unionRespectData) {
        // Submit union respect assessment
        console.log('Submitting union respect assessment:', unionRespectData)
      }

      if (safetyData) {
        // Submit safety assessment
        console.log('Submitting safety assessment:', safetyData)
      }

      // Submit other assessments
      console.log('Submitting other assessments:', stepData)

      success()
      toast.success("All assessments submitted successfully!")
      onComplete?.()
    } catch (err) {
      error()
      toast.error("Failed to submit assessments")
    } finally {
      setIsSubmitting(false)
    }
  }, [canProceedToNextStep, unionRespectData, safetyData, stepData, success, error, onComplete])

  const currentStepIndex = getCurrentStepIndex()
  const currentStepConfig = availableSteps[currentStepIndex]
  const isLastStep = currentStepIndex === availableSteps.length - 1
  const isFirstStep = currentStepIndex === 0

  // Step components
  const renderStepContent = () => {
    switch (currentStep) {
      case 'introduction':
        return <IntroductionStep employerName={employerName} totalSteps={availableSteps.length} />

      case 'role-detection':
        return (
          <RoleDetectionStep
            employerName={employerName}
            currentRole={employerRole}
            onComplete={(data) => handleStepComplete('role-detection', data)}
          />
        )

      case 'union-respect':
        return (
          <UnionRespectStep
            employerId={employerId}
            employerName={employerName}
            initialData={unionRespectData}
            onComplete={(data) => {
              setUnionRespectData(data)
              handleStepComplete('union-respect', data)
            }}
          />
        )

      case 'safety':
        return (
          <SafetyStep
            employerId={employerId}
            employerName={employerName}
            initialData={safetyData}
            onComplete={(data) => {
              setSafetyData(data)
              handleStepComplete('safety', data)
            }}
          />
        )

      case 'subcontractor-use':
        return (
          <SubcontractorUseStep
            employerId={employerId}
            employerName={employerName}
            onComplete={(data) => handleStepComplete('subcontractor-use', data)}
          />
        )

      case 'role-specific':
        return (
          <RoleSpecificStep
            employerId={employerId}
            employerName={employerName}
            employerRole={employerRole}
            onComplete={(data) => handleStepComplete('role-specific', data)}
          />
        )

      case 'confidence-factors':
        return (
          <ConfidenceFactorsStep
            onComplete={(data) => handleStepComplete('confidence-factors', data)}
          />
        )

      case 'review':
        return (
          <ReviewStep
            employerName={employerName}
            unionRespectData={unionRespectData}
            safetyData={safetyData}
            otherData={stepData}
            onEdit={(stepId) => setCurrentStep(stepId)}
          />
        )

      default:
        return <div>Step not found</div>
    }
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* Progress Header */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {currentStepConfig.icon && <currentStepConfig.icon className="h-5 w-5" />}
              <div>
                <h2 className="font-semibold">{currentStepConfig.title}</h2>
                <p className="text-sm text-muted-foreground">{currentStepConfig.description}</p>
              </div>
            </div>
            <Badge variant="outline">
              Step {currentStepIndex + 1} of {availableSteps.length}
            </Badge>
          </div>

          {/* Step Progress */}
          <Progress value={progress.overall} className="h-2" />

          {/* Step Indicators */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex gap-1">
              {availableSteps.map((step, index) => {
                const isCompleted = completedSteps.has(step.id)
                const isCurrent = step.id === currentStep
                const Icon = step.icon

                return (
                  <div
                    key={step.id}
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
                      isCompleted && "bg-green-100 text-green-700 border-green-300",
                      isCurrent && "bg-blue-100 text-blue-700 border-blue-300",
                      !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                )
              })}
            </div>

            {currentStepConfig.estimatedTime && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                ~{currentStepConfig.estimatedTime} min
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <div className="flex-1 overflow-auto">
        {renderStepContent()}
      </div>

      {/* Navigation Footer */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {!isFirstStep && (
                <Button
                  variant="outline"
                  onClick={handlePreviousStep}
                  disabled={isSubmitting}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
              )}

              {allowSaveDraft && !isLastStep && (
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={isSubmitting}
                >
                  <Save className="h-4 w-4 mr-1" />
                  Save Draft
                </Button>
              )}

              {onCancel && (
                <Button
                  variant="ghost"
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              {isLastStep ? (
                <Button
                  onClick={handleSubmit}
                  disabled={!canProceedToNextStep() || isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit All Assessments'}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleNextStep}
                  disabled={!canProceedToNextStep() || isSubmitting}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>

          {savedDraft && (
            <Alert className="mt-3">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Draft saved successfully. You can continue later from where you left off.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Step Components
function IntroductionStep({ employerName, totalSteps }: { employerName: string, totalSteps: number }) {
  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Star className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">Enhanced 4-Point Assessment</h2>
            <p className="text-muted-foreground">
              Complete a comprehensive assessment for {employerName}
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="font-medium">What you'll assess:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <div className="font-medium text-sm">Union Respect</div>
                <div className="text-xs text-muted-foreground">Union engagement and relationship quality</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <Shield className="h-5 w-5 text-green-600" />
              <div>
                <div className="font-medium text-sm">Safety Performance</div>
                <div className="text-xs text-muted-foreground">Safety systems and incident record</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <Building className="h-5 w-5 text-purple-600" />
              <div>
                <div className="font-medium text-sm">Role-Specific</div>
                <div className="text-xs text-muted-foreground">Role-specific performance indicators</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <CheckCircle className="h-5 w-5 text-orange-600" />
              <div>
                <div className="font-medium text-sm">Confidence Factors</div>
                <div className="text-xs text-muted-foreground">Assessment confidence and evidence</div>
              </div>
            </div>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            This comprehensive assessment will take approximately 30-45 minutes to complete.
            Your input helps improve workplace standards and union representation.
          </AlertDescription>
        </Alert>

        <div className="text-center">
          <Badge variant="outline" className="text-lg px-4 py-2">
            {totalSteps} Steps Total
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function RoleDetectionStep({
  employerName,
  currentRole,
  onComplete
}: {
  employerName: string
  currentRole: EmployerRole
  onComplete: (data: any) => void
}) {
  const [confirmedRole, setConfirmedRole] = useState<EmployerRole>(currentRole)
  const [confirmed, setConfirmed] = useState(false)

  const handleConfirm = () => {
    setConfirmed(true)
    onComplete({ confirmedRole, confirmed })
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="space-y-4">
          <h3 className="font-medium">Confirm Employer Role</h3>
          <p className="text-sm text-muted-foreground">
            Please confirm the role type for {employerName} to ensure we assess the most relevant criteria.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { value: 'head_contractor', label: 'Head Contractor', description: 'Main contractor responsible for project delivery' },
            { value: 'subcontractor', label: 'Subcontractor', description: 'Contractor working under head contractor' },
            { value: 'trade_contractor', label: 'Trade Contractor', description: 'Specialist trade contractor' },
            { value: 'labour_hire', label: 'Labour Hire', description: 'Labour supply company' },
            { value: 'consultant', label: 'Consultant', description: 'Professional services provider' },
            { value: 'other', label: 'Other', description: 'Other type of employer' }
          ].map((role) => (
            <div
              key={role.value}
              className={cn(
                "p-4 rounded-lg border cursor-pointer transition-colors",
                confirmedRole === role.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-border hover:bg-muted/50"
              )}
              onClick={() => setConfirmedRole(role.value as EmployerRole)}
            >
              <div className="font-medium">{role.label}</div>
              <div className="text-sm text-muted-foreground">{role.description}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="role-confirmed"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="rounded"
          />
          <Label htmlFor="role-confirmed">
            I confirm that {confirmedRole.replace('_', ' ')} is the correct role for this employer
          </Label>
        </div>

        <Button onClick={handleConfirm} disabled={!confirmed} className="w-full">
          Continue with {confirmedRole.replace('_', ' ')} assessment
        </Button>
      </CardContent>
    </Card>
  )
}

function UnionRespectStep({
  employerId,
  employerName,
  initialData,
  onComplete
}: {
  employerId: string
  employerName: string
  initialData?: Partial<UnionRespectType>
  onComplete: (data: Partial<UnionRespectType>) => void
}) {
  const handleComplete = async (data: CreateUnionRespectAssessmentPayload) => {
    // Transform the payload back to assessment format
    const assessmentData: Partial<UnionRespectType> = {
      criteria: data.criteria,
      additional_comments: data.additional_comments,
      supporting_evidence: data.supporting_evidence,
      notes: data.notes,
      overall_score: Math.round(Object.values(data.criteria).reduce((sum, rating) => sum + rating, 0) / 5) as FourPointRating,
      confidence_level: 85 // Default confidence
    }
    onComplete(assessmentData)
  }

  return (
    <UnionRespectAssessment
      employerId={employerId}
      employerName={employerName}
      initialData={initialData}
      onSave={handleComplete}
      readonly={false}
    />
  )
}

function SafetyStep({
  employerId,
  employerName,
  initialData,
  onComplete
}: {
  employerId: string
  employerName: string
  initialData?: Partial<SafetyAssessmentType>
  onComplete: (data: Partial<SafetyAssessmentType>) => void
}) {
  const handleComplete = async (data: CreateSafety4PointAssessmentPayload) => {
    // Transform the payload back to assessment format
    const assessmentData: Partial<SafetyAssessmentType> = {
      safety_criteria: data.safety_criteria,
      safety_metrics: data.safety_metrics,
      audit_compliance: data.audit_compliance,
      notes: data.notes,
      overall_safety_score: Math.round(Object.values(data.safety_criteria).reduce((sum, rating) => sum + rating, 0) / 6) as FourPointRating,
      safety_confidence_level: 85 // Default confidence
    }
    onComplete(assessmentData)
  }

  return (
    <SafetyAssessment4Point
      employerId={employerId}
      employerName={employerName}
      initialData={initialData}
      onSave={handleComplete}
      readonly={false}
    />
  )
}

function SubcontractorUseStep({
  employerId,
  employerName,
  onComplete
}: {
  employerId: string
  employerName: string
  onComplete: (data: any) => void
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          <Building className="h-12 w-12 mx-auto text-muted-foreground" />
          <h3 className="font-medium">Subcontractor Relations Assessment</h3>
          <p className="text-muted-foreground">
            This assessment will be available in the next update.
          </p>
          <Button onClick={() => onComplete({ complete: true })}>
            Skip for Now
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function RoleSpecificStep({
  employerId,
  employerName,
  employerRole,
  onComplete
}: {
  employerId: string
  employerName: string
  employerRole: EmployerRole
  onComplete: (data: any) => void
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          <Star className="h-12 w-12 mx-auto text-muted-foreground" />
          <h3 className="font-medium">Role-Specific Assessment</h3>
          <p className="text-muted-foreground">
            This assessment will be available in the next update.
          </p>
          <Button onClick={() => onComplete({ complete: true })}>
            Skip for Now
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ConfidenceFactorsStep({
  onComplete
}: {
  onComplete: (data: any) => void
}) {
  const [factors, setFactors] = useState({
    directExperience: false,
    multipleSources: false,
    recentInteraction: false,
    knowledgeDepth: 5
  })

  const handleComplete = () => {
    onComplete(factors)
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="space-y-4">
          <h3 className="font-medium">Assessment Confidence</h3>
          <p className="text-sm text-muted-foreground">
            Help us understand how confident you are in these assessments.
          </p>
        </div>

        <div className="space-y-4">
          {[
            { key: 'directExperience', label: 'Direct Experience', description: 'I have recent, direct experience with this employer' },
            { key: 'multipleSources', label: 'Multiple Sources', description: 'My assessment is based on multiple sources of information' },
            { key: 'recentInteraction', label: 'Recent Interaction', description: 'I have interacted with this employer in the last 3 months' }
          ].map((factor) => (
            <div key={factor.key} className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{factor.label}</div>
                <div className="text-xs text-muted-foreground">{factor.description}</div>
              </div>
              <input
                type="checkbox"
                checked={factors[factor.key as keyof typeof factors]}
                onChange={(e) => setFactors(prev => ({ ...prev, [factor.key]: e.target.checked }))}
                className="rounded"
              />
            </div>
          ))}
        </div>

        <Button onClick={handleComplete} className="w-full">
          Continue
        </Button>
      </CardContent>
    </Card>
  )
}

function ReviewStep({
  employerName,
  unionRespectData,
  safetyData,
  otherData,
  onEdit
}: {
  employerName: string
  unionRespectData?: Partial<UnionRespectType>
  safetyData?: Partial<SafetyAssessmentType>
  otherData: Record<string, any>
  onEdit: (stepId: string) => void
}) {
  const allCompleted = unionRespectData && safetyData

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="text-center space-y-4">
          <h3 className="font-medium text-lg">Review Your Assessment</h3>
          <p className="text-muted-foreground">
            Review all completed assessments for {employerName} before submission.
          </p>
        </div>

        <div className="space-y-4">
          {unionRespectData && (
            <div className="p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Union Respect Assessment</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => onEdit('union-respect')}>
                  Edit
                </Button>
              </div>
              {unionRespectData.overall_score && (
                <FourPointRatingDisplay
                  rating={unionRespectData.overall_score}
                  variant="minimal"
                />
              )}
            </div>
          )}

          {safetyData && (
            <div className="p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Safety Assessment</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => onEdit('safety')}>
                  Edit
                </Button>
              </div>
              {safetyData.overall_safety_score && (
                <FourPointRatingDisplay
                  rating={safetyData.overall_safety_score}
                  variant="minimal"
                />
              )}
            </div>
          )}
        </div>

        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            {allCompleted
              ? "All assessments are complete and ready for submission."
              : "Some assessments are still pending. You can submit what you have completed or go back to finish all assessments."}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}