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
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Building,
  Users,
  Shield,
  FileText,
  Activity,
  BarChart3,
  Calendar,
  Clock,
  Save,
  CheckCircle,
  AlertTriangle,
  MapPin,
  Camera,
  FileCheck,
  UserCheck
} from "lucide-react"
import { MobileRatingSelector4Point } from "@/components/ui/MobileRatingSelector4Point"
import { UnionRespectAssessment4PointMobile } from "@/components/mobile/assessments/UnionRespectAssessment4PointMobile"
import { useHapticFeedback } from "@/components/mobile/shared/HapticFeedback"
import { toast } from "sonner"

interface SiteVisitAssessmentWizard4PointProps {
  employerId: string
  employerName: string
  projectId?: string
  siteLocation?: string
  onSave?: (data: any) => Promise<void>
  onComplete?: (data: any) => Promise<void>
  readonly?: boolean
  className?: string
}

interface SiteVisitData {
  visitDate: string
  visitStartTime: string
  visitEndTime: string
  siteLocation: string
  weatherConditions: string
  siteContact: string
  siteContactRole: string
  visitorNames: string[]
  visitPurpose: string
  overallFindings: string
  immediateActions: string[]
  photosTaken: number
  documentsReviewed: string[]
}

interface AssessmentData {
  unionRespect: any
  safety: any
  subcontractor: any
  compliance: any
}

const weatherOptions = [
  'Clear', 'Cloudy', 'Rainy', 'Windy', 'Hot', 'Cold', 'Mixed'
]

const visitPurposeOptions = [
  'Routine Inspection',
  'Compliance Check',
  'Worker Interview',
  'Safety Audit',
  'EBA Compliance Review',
  'Incident Investigation',
  'Follow-up Visit',
  'Other'
]

const assessmentTypes = [
  {
    id: 'union_respect',
    label: 'Union Respect',
    icon: Users,
    description: 'Assess relationship with union and delegates',
    required: true
  },
  {
    id: 'safety',
    label: 'Safety Assessment',
    icon: Shield,
    description: 'Evaluate safety performance and culture',
    required: true
  },
  {
    id: 'subcontractor',
    label: 'Subcontractor Usage',
    icon: BarChart3,
    description: 'Review subcontractor practices',
    required: false
  },
  {
    id: 'compliance',
    label: 'CBUS/INCOLINK Compliance',
    icon: FileText,
    description: 'Check superannuation and wage compliance',
    required: false
  }
]

export function SiteVisitAssessmentWizard4Point({
  employerId,
  employerName,
  projectId,
  siteLocation,
  onSave,
  onComplete,
  readonly = false,
  className = ""
}: SiteVisitAssessmentWizard4PointProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [siteVisitData, setSiteVisitData] = useState<SiteVisitData>({
    visitDate: new Date().toISOString().split('T')[0],
    visitStartTime: '',
    visitEndTime: '',
    siteLocation: siteLocation || '',
    weatherConditions: '',
    siteContact: '',
    siteContactRole: '',
    visitorNames: [],
    visitPurpose: 'Routine Inspection',
    overallFindings: '',
    immediateActions: [],
    photosTaken: 0,
    documentsReviewed: []
  })

  const [assessmentData, setAssessmentData] = useState<AssessmentData>({
    unionRespect: null,
    safety: null,
    subcontractor: null,
    compliance: null
  })

  const [selectedAssessments, setSelectedAssessments] = useState<string[]>(['union_respect', 'safety'])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { hapticFeedback } = useHapticFeedback()

  const totalSteps = 3 // Visit Details, Assessments, Summary
  const completedSteps = [
    siteVisitData.visitDate && siteVisitData.visitStartTime && siteVisitData.siteContact,
    selectedAssessments.filter(type => assessmentData[type as keyof AssessmentData]).length === selectedAssessments.length,
    siteVisitData.overallFindings.length > 0
  ].filter(Boolean).length

  const progressPercentage = (completedSteps / totalSteps) * 100

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1)
      hapticFeedback?.('light')
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      hapticFeedback?.('light')
    }
  }

  const handleAssessmentComplete = (type: string, data: any) => {
    setAssessmentData(prev => ({
      ...prev,
      [type]: data
    }))
    hapticFeedback?.('success')
  }

  const handleCompleteSiteVisit = async () => {
    setIsSubmitting(true)
    hapticFeedback?.('impactMedium')

    try {
      // Prepare complete site visit data
      const completeSiteVisitData = {
        ...siteVisitData,
        employerId,
        projectId,
        assessments: assessmentData,
        selectedAssessments,
        completedAt: new Date().toISOString()
      }

      if (onComplete) {
        await onComplete(completeSiteVisitData)
      } else {
        // Default save behavior - save each assessment individually
        for (const assessmentType of selectedAssessments) {
          if (assessmentData[assessmentType as keyof AssessmentData]) {
            const endpoint = `/api/assessments/${assessmentType}-4-point`
            await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                employer_id: employerId,
                project_id: projectId,
                ...assessmentData[assessmentType as keyof AssessmentData]
              })
            })
          }
        }
      }

      hapticFeedback?.('notificationSuccess')
      toast.success("Site visit assessment completed successfully")
    } catch (error) {
      console.error('Error completing site visit:', error)
      hapticFeedback?.('notificationError')
      toast.error("Failed to complete site visit assessment")
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderVisitDetails = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Site Visit Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Visit Date *</Label>
            <Input
              type="date"
              value={siteVisitData.visitDate}
              onChange={(e) => setSiteVisitData(prev => ({ ...prev, visitDate: e.target.value }))}
              disabled={readonly}
            />
          </div>

          <div className="space-y-2">
            <Label>Weather Conditions</Label>
            <Select
              value={siteVisitData.weatherConditions}
              onValueChange={(value) => setSiteVisitData(prev => ({ ...prev, weatherConditions: value }))}
              disabled={readonly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select weather" />
              </SelectTrigger>
              <SelectContent>
                {weatherOptions.map((weather) => (
                  <SelectItem key={weather} value={weather}>{weather}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Start Time *</Label>
            <Input
              type="time"
              value={siteVisitData.visitStartTime}
              onChange={(e) => setSiteVisitData(prev => ({ ...prev, visitStartTime: e.target.value }))}
              disabled={readonly}
            />
          </div>

          <div className="space-y-2">
            <Label>End Time</Label>
            <Input
              type="time"
              value={siteVisitData.visitEndTime}
              onChange={(e) => setSiteVisitData(prev => ({ ...prev, visitEndTime: e.target.value }))}
              disabled={readonly}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Site Location</Label>
            <Input
              placeholder="Enter site address or location"
              value={siteVisitData.siteLocation}
              onChange={(e) => setSiteVisitData(prev => ({ ...prev, siteLocation: e.target.value }))}
              disabled={readonly}
            />
          </div>

          <div className="space-y-2">
            <Label>Site Contact Name *</Label>
            <Input
              placeholder="Name of site contact person"
              value={siteVisitData.siteContact}
              onChange={(e) => setSiteVisitData(prev => ({ ...prev, siteContact: e.target.value }))}
              disabled={readonly}
            />
          </div>

          <div className="space-y-2">
            <Label>Site Contact Role</Label>
            <Input
              placeholder="e.g., Site Manager, Supervisor"
              value={siteVisitData.siteContactRole}
              onChange={(e) => setSiteVisitData(prev => ({ ...prev, siteContactRole: e.target.value }))}
              disabled={readonly}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Visit Purpose</Label>
            <Select
              value={siteVisitData.visitPurpose}
              onValueChange={(value) => setSiteVisitData(prev => ({ ...prev, visitPurpose: value }))}
              disabled={readonly}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {visitPurposeOptions.map((purpose) => (
                  <SelectItem key={purpose} value={purpose}>{purpose}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Site Visit Checklist</Label>
            <Badge variant="outline">
              {[
                siteVisitData.visitDate,
                siteVisitData.visitStartTime,
                siteVisitData.siteContact
              ].filter(Boolean).length}/3 Required
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className={`p-3 rounded-lg border ${siteVisitData.visitDate ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">Date Scheduled</span>
                {siteVisitData.visitDate && <CheckCircle className="h-4 w-4 text-green-600 ml-auto" />}
              </div>
            </div>

            <div className={`p-3 rounded-lg border ${siteVisitData.visitStartTime ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Time Logged</span>
                {siteVisitData.visitStartTime && <CheckCircle className="h-4 w-4 text-green-600 ml-auto" />}
              </div>
            </div>

            <div className={`p-3 rounded-lg border ${siteVisitData.siteContact ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                <span className="text-sm">Contact Met</span>
                {siteVisitData.siteContact && <CheckCircle className="h-4 w-4 text-green-600 ml-auto" />}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const renderAssessmentSelection = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Select Assessments</CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose which assessments to conduct during this site visit
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {assessmentTypes.map((type) => {
              const Icon = type.icon
              const isSelected = selectedAssessments.includes(type.id)
              const isCompleted = assessmentData[type.id as keyof AssessmentData] !== null

              return (
                <div
                  key={type.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    if (!readonly) {
                      setSelectedAssessments(prev =>
                        prev.includes(type.id)
                          ? prev.filter(id => id !== type.id)
                          : [...prev, type.id]
                      )
                      hapticFeedback?.('selectionChanged')
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-sm text-muted-foreground">{type.description}</div>
                        {type.required && <Badge variant="secondary" className="mt-1 text-xs">Required</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isCompleted && <CheckCircle className="h-5 w-5 text-green-600" />}
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected ? 'bg-primary border-primary' : 'border-gray-300'
                      }`}>
                        {isSelected && <span className="text-white text-xs">✓</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {selectedAssessments.map((assessmentType) => {
        const assessment = assessmentTypes.find(t => t.id === assessmentType)
        if (!assessment) return null

        return (
          <Card key={assessmentType}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <assessment.icon className="h-5 w-5" />
                {assessment.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assessmentType === 'union_respect' && (
                <UnionRespectAssessment4PointMobile
                  employerId={employerId}
                  employerName={employerName}
                  projectId={projectId}
                  onSave={(data) => handleAssessmentComplete(assessmentType, data)}
                  readonly={readonly}
                />
              )}
              {/* Placeholder for other assessment types */}
              {assessmentType !== 'union_respect' && (
                <div className="text-center py-8 text-muted-foreground">
                  <assessment.icon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>{assessment.label} form</p>
                  <p className="text-sm">Coming soon...</p>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )

  const renderSummary = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="h-5 w-5" />
          Site Visit Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-2">Visit Details</h4>
            <div className="space-y-1 text-sm">
              <div><strong>Date:</strong> {siteVisitData.visitDate}</div>
              <div><strong>Time:</strong> {siteVisitData.visitStartTime} - {siteVisitData.visitEndTime}</div>
              <div><strong>Location:</strong> {siteVisitData.siteLocation}</div>
              <div><strong>Contact:</strong> {siteVisitData.siteContact}</div>
              <div><strong>Purpose:</strong> {siteVisitData.visitPurpose}</div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Assessments Completed</h4>
            <div className="space-y-1">
              {selectedAssessments.map((type) => {
                const assessment = assessmentTypes.find(t => t.id === type)
                const isCompleted = assessmentData[type as keyof AssessmentData] !== null
                return (
                  <div key={type} className="flex items-center gap-2 text-sm">
                    {isCompleted ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    )}
                    <span>{assessment?.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>Overall Findings *</Label>
          <Textarea
            placeholder="Summarize key findings from the site visit..."
            value={siteVisitData.overallFindings}
            onChange={(e) => setSiteVisitData(prev => ({ ...prev, overallFindings: e.target.value }))}
            rows={4}
            disabled={readonly}
          />
        </div>

        <div className="space-y-2">
          <Label>Immediate Actions Required</Label>
          <Textarea
            placeholder="List any immediate actions that need to be taken..."
            value={siteVisitData.immediateActions.join('\n')}
            onChange={(e) => setSiteVisitData(prev => ({
              ...prev,
              immediateActions: e.target.value.split('\n').filter(action => action.trim())
            }))}
            rows={3}
            disabled={readonly}
          />
        </div>

        <Alert>
          <Camera className="h-4 w-4" />
          <AlertDescription>
            Remember to take photos of the site and any relevant documentation during the visit.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return renderVisitDetails()
      case 1:
        return renderAssessmentSelection()
      case 2:
        return renderSummary()
      default:
        return null
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return siteVisitData.visitDate && siteVisitData.visitStartTime && siteVisitData.siteContact
      case 1:
        return selectedAssessments.length > 0
      case 2:
        return siteVisitData.overallFindings.length > 0
      default:
        return false
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Progress Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Site Visit Assessment</h2>
            <Badge variant="outline">
              Step {currentStep + 1} of {totalSteps}
            </Badge>
          </div>
          <Progress value={progressPercentage} className="h-2" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Visit Details</span>
            <span>Assessments</span>
            <span>Summary</span>
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      {renderStep()}

      {/* Navigation */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0 || isSubmitting}
            >
              Previous
            </Button>

            {currentStep < totalSteps - 1 ? (
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleCompleteSiteVisit}
                disabled={!canProceed() || isSubmitting}
                className="min-w-32"
              >
                {isSubmitting ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Complete Site Visit
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}