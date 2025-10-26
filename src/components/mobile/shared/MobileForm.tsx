"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useHapticFeedback } from "./HapticFeedback"

interface MobileFormStep {
  id: string
  title: string
  description?: string
  component: React.ComponentType<any>
  validation?: (data: any) => boolean | string
  skip?: boolean
}

interface MobileFormProps {
  steps: MobileFormStep[]
  initialStep?: number
  onSubmit: (data: any) => Promise<void> | void
  className?: string
  showProgress?: boolean
  allowSkip?: boolean
  saveOnStepChange?: boolean
  onDataChange?: (stepId: string, data: any) => void
}

export function MobileForm({
  steps,
  initialStep = 0,
  onSubmit,
  className,
  showProgress = true,
  allowSkip = false,
  saveOnStepChange = false,
  onDataChange,
}: MobileFormProps) {
  const [currentStep, setCurrentStep] = React.useState(initialStep)
  const [formData, setFormData] = React.useState<Record<string, any>>({})
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [visitedSteps, setVisitedSteps] = React.useState<Set<string>>(new Set())
  const { trigger, success, error, selection } = useHapticFeedback()

  const currentStepData = steps[currentStep]
  const progress = ((currentStep + 1) / steps.length) * 100

  // Validate current step
  const validateStep = React.useCallback(() => {
    if (!currentStepData.validation) return true

    const stepData = formData[currentStepData.id] || {}
    const result = currentStepData.validation(stepData)

    if (result === true) {
      setErrors(prev => ({ ...prev, [currentStepData.id]: "" }))
      return true
    } else {
      setErrors(prev => ({ ...prev, [currentStepData.id]: result as string }))
      return false
    }
  }, [currentStepData, formData])

  // Handle step data change
  const handleStepDataChange = React.useCallback((data: any) => {
    const newFormData = { ...formData, [currentStepData.id]: data }
    setFormData(newFormData)

    // Clear errors when data changes
    if (errors[currentStepData.id]) {
      setErrors(prev => ({ ...prev, [currentStepData.id]: "" }))
    }

    // Notify parent of data change
    if (onDataChange) {
      onDataChange(currentStepData.id, data)
    }

    // Trigger haptic feedback for selection changes
    selection()
  }, [formData, currentStepData.id, errors, onDataChange, selection])

  // Navigate to next step
  const handleNext = React.useCallback(async () => {
    if (!validateStep()) {
      error()
      return
    }

    trigger()

    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
      setVisitedSteps(prev => new Set(prev).add(steps[currentStep + 1].id))
      success()
    } else {
      // Submit form
      setIsSubmitting(true)
      try {
        await onSubmit(formData)
        success()
      } catch (err) {
        error()
        console.error("Form submission failed:", err)
      } finally {
        setIsSubmitting(false)
      }
    }
  }, [validateStep, currentStep, steps.length, onSubmit, formData, trigger, success, error])

  // Navigate to previous step
  const handlePrevious = React.useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
      trigger()
    }
  }, [currentStep, trigger])

  // Skip current step
  const handleSkip = React.useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
      setVisitedSteps(prev => new Set(prev).add(steps[currentStep + 1].id))
      trigger()
    }
  }, [currentStep, steps.length, trigger])

  // Go to specific step
  const goToStep = React.useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < steps.length) {
      setCurrentStep(stepIndex)
      setVisitedSteps(prev => new Set(prev).add(steps[stepIndex].id))
      selection()
    }
  }, [steps.length, selection])

  const CurrentStepComponent = currentStepData.component

  return (
    <div className={cn("flex flex-col h-full max-h-screen bg-background", className)}>
      {/* Progress Bar */}
      {showProgress && (
        <div className="flex-shrink-0 p-4 border-b bg-background/95 backdrop-blur-sm">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>Step {currentStep + 1} of {steps.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />

            {/* Step indicators */}
            <div className="flex gap-2 mt-3">
              {steps.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => goToStep(index)}
                  className={cn(
                    "flex-1 h-1 rounded-full transition-all duration-200",
                    index < currentStep
                      ? "bg-primary"
                      : index === currentStep
                      ? "bg-primary"
                      : visitedSteps.has(step.id)
                      ? "bg-primary/50"
                      : "bg-muted"
                  )}
                  aria-label={`Go to step ${index + 1}: ${step.title}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto">
        <Card className="h-full border-0 shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold">{currentStepData.title}</CardTitle>
            {currentStepData.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {currentStepData.description}
              </p>
            )}
          </CardHeader>

          <CardContent className="pt-0">
            <div className="space-y-4">
              {errors[currentStepData.id] && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{errors[currentStepData.id]}</p>
                </div>
              )}

              <CurrentStepComponent
                data={formData[currentStepData.id] || {}}
                onChange={handleStepDataChange}
                error={errors[currentStepData.id]}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Footer */}
      <div className="flex-shrink-0 p-4 border-t bg-background/95 backdrop-blur-sm">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="flex-1"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          {allowSkip && currentStepData.skip && currentStep < steps.length - 1 && (
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="flex-1"
            >
              Skip
            </Button>
          )}

          <Button
            onClick={handleNext}
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? (
              "Submitting..."
            ) : currentStep === steps.length - 1 ? (
              "Submit"
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>

        {/* Optional: Step summary for quick navigation */}
        {steps.length > 3 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {steps.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => goToStep(index)}
                  className={cn(
                    "flex-shrink-0 px-3 py-1.5 text-xs rounded-full border transition-colors",
                    index === currentStep
                      ? "bg-primary text-primary-foreground border-primary"
                      : index < currentStep
                      ? "bg-green-50 text-green-700 border-green-200"
                      : visitedSteps.has(step.id)
                      ? "bg-muted text-muted-foreground border-muted-foreground/20"
                      : "bg-background text-muted-foreground border-muted-foreground/20"
                  )}
                >
                  {index + 1}. {step.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}