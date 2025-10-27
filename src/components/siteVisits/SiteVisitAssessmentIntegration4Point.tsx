"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronUp, Star, Shield, Users, Plus, CheckCircle } from "lucide-react"
import { UnionRespectAssessmentForm4Point } from "@/components/assessments/UnionRespectAssessmentForm4Point"
import { SafetyAssessmentForm4Point } from "@/components/assessments/SafetyAssessmentForm4Point"
import { SubcontractorAssessmentForm4Point } from "@/components/assessments/SubcontractorAssessmentForm4Point"
import { RatingDisplay4Point } from "@/components/ratings/RatingDisplay4Point"
import { cn } from "@/lib/utils"

interface SiteVisitAssessmentIntegration4PointProps {
  employerId: string
  employerName: string
  projectId?: string
  siteVisitId?: string
  visitDate?: string
  onAssessmentComplete?: (assessmentType: string, data: any) => void
  className?: string
}

interface AssessmentProgress {
  unionRespect: boolean
  safety: boolean
  subcontractor: boolean
}

export function SiteVisitAssessmentIntegration4Point({
  employerId,
  employerName,
  projectId,
  siteVisitId,
  visitDate,
  onAssessmentComplete,
  className
}: SiteVisitAssessmentIntegration4PointProps) {
  const [assessmentProgress, setAssessmentProgress] = useState<AssessmentProgress>({
    unionRespect: false,
    safety: false,
    subcontractor: false
  })
  const [completedAssessments, setCompletedAssessments] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState("overview")

  const handleAssessmentComplete = (assessmentType: keyof AssessmentProgress, data: any) => {
    setAssessmentProgress(prev => ({
      ...prev,
      [assessmentType]: true
    }))

    setCompletedAssessments(prev => [...prev, { type: assessmentType, data, timestamp: new Date() }])

    if (onAssessmentComplete) {
      onAssessmentComplete(assessmentType, data)
    }
  }

  const getOverallProgress = () => {
    const completed = Object.values(assessmentProgress).filter(Boolean).length
    const total = Object.keys(assessmentProgress).length
    return (completed / total) * 100
  }

  const getCompletionStatus = () => {
    const completed = Object.values(assessmentProgress).filter(Boolean).length
    const total = Object.keys(assessmentProgress).length

    if (completed === 0) return { color: "bg-gray-500", text: "Not Started", icon: "○" }
    if (completed === total) return { color: "bg-green-500", text: "Complete", icon: "✓" }
    return { color: "bg-blue-500", text: "In Progress", icon: "◐" }
  }

  const completionStatus = getCompletionStatus()

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              4-Point Assessment Integration
            </CardTitle>
            <Badge className={completionStatus.color} variant="secondary">
              <span className="mr-1">{completionStatus.icon}</span>
              {completionStatus.text}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {employerName} {visitDate && `• Visit: ${visitDate}`}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Progress Overview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Overall Progress</span>
                <span>{Math.round(getOverallProgress())}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${getOverallProgress()}%` }}
                />
              </div>
            </div>

            {/* Assessment Checklist */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={cn(
                "p-3 rounded-lg border-2 transition-colors",
                assessmentProgress.unionRespect
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 bg-gray-50"
              )}>
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-sm font-medium">Union Respect</span>
                  {assessmentProgress.unionRespect && (
                    <CheckCircle className="h-3 w-3 text-green-600 ml-auto" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  5 criteria assessment
                </p>
              </div>

              <div className={cn(
                "p-3 rounded-lg border-2 transition-colors",
                assessmentProgress.safety
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 bg-gray-50"
              )}>
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4" />
                  <span className="text-sm font-medium">Safety</span>
                  {assessmentProgress.safety && (
                    <CheckCircle className="h-3 w-3 text-green-600 ml-auto" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  3 criteria assessment
                </p>
              </div>

              <div className={cn(
                "p-3 rounded-lg border-2 transition-colors",
                assessmentProgress.subcontractor
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 bg-gray-50"
              )}>
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-sm font-medium">Subcontractor</span>
                  {assessmentProgress.subcontractor && (
                    <CheckCircle className="h-3 w-3 text-green-600 ml-auto" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  3 criteria assessment
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assessment Forms */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="union-respect">Union Respect</TabsTrigger>
          <TabsTrigger value="safety">Safety</TabsTrigger>
          <TabsTrigger value="subcontractor">Subcontractor</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assessment Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>Complete the 4-point assessments during your site visit to generate a comprehensive rating for {employerName}.</p>
                <p className="mt-2">Each assessment uses a 4-point scale (1=Good, 4=Terrible) and will contribute to the overall employer rating.</p>
              </div>

              {completedAssessments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Completed Assessments:</h4>
                  {completedAssessments.map((assessment, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-green-50 rounded">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      <span className="text-sm capitalize">
                        {assessment.type.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(assessment.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button
                  variant={assessmentProgress.unionRespect ? "outline" : "default"}
                  onClick={() => setActiveTab("union-respect")}
                  className="w-full"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Union Respect
                </Button>
                <Button
                  variant={assessmentProgress.safety ? "outline" : "default"}
                  onClick={() => setActiveTab("safety")}
                  className="w-full"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Safety
                </Button>
                <Button
                  variant={assessmentProgress.subcontractor ? "outline" : "default"}
                  onClick={() => setActiveTab("subcontractor")}
                  className="w-full"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Subcontractor
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="union-respect" className="space-y-4">
          <Collapsible defaultOpen={!assessmentProgress.unionRespect}>
            <CollapsibleTrigger asChild>
              <Card className="cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Union Respect Assessment
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {assessmentProgress.unionRespect && (
                        <Badge className="bg-green-500" variant="secondary">
                          Completed
                        </Badge>
                      )}
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <UnionRespectAssessmentForm4Point
                employerId={employerId}
                employerName={employerName}
                projectId={projectId}
                onSave={(data) => handleAssessmentComplete("unionRespect", data)}
                onCancel={() => setActiveTab("overview")}
              />
            </CollapsibleContent>
          </Collapsible>
        </TabsContent>

        <TabsContent value="safety" className="space-y-4">
          <Collapsible defaultOpen={!assessmentProgress.safety}>
            <CollapsibleTrigger asChild>
              <Card className="cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Safety Assessment
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {assessmentProgress.safety && (
                        <Badge className="bg-green-500" variant="secondary">
                          Completed
                        </Badge>
                      )}
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SafetyAssessmentForm4Point
                employerId={employerId}
                employerName={employerName}
                projectId={projectId}
                onSave={(data) => handleAssessmentComplete("safety", data)}
                onCancel={() => setActiveTab("overview")}
              />
            </CollapsibleContent>
          </Collapsible>
        </TabsContent>

        <TabsContent value="subcontractor" className="space-y-4">
          <Collapsible defaultOpen={!assessmentProgress.subcontractor}>
            <CollapsibleTrigger asChild>
              <Card className="cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Subcontractor Assessment
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {assessmentProgress.subcontractor && (
                        <Badge className="bg-green-500" variant="secondary">
                          Completed
                        </Badge>
                      )}
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SubcontractorAssessmentForm4Point
                employerId={employerId}
                employerName={employerName}
                projectId={projectId}
                onSave={(data) => handleAssessmentComplete("subcontractor", data)}
                onCancel={() => setActiveTab("overview")}
              />
            </CollapsibleContent>
          </Collapsible>
        </TabsContent>
      </Tabs>
    </div>
  )
}