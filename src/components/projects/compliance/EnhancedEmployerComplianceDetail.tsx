"use client"

import { useState, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { format } from "date-fns"
import {
  CalendarIcon,
  History,
  Save,
  Users,
  Shield,
  TrendingUp,
  FileText,
  CheckCircle,
  AlertTriangle,
  Star,
  Clock,
  BarChart3,
  Building,
  Settings,
  Eye
} from "lucide-react"
import { useEmployerCompliance, useUpsertEmployerCompliance } from "./hooks/useEmployerCompliance"
import { ComplianceChecker, PaymentStatus, PaymentTiming, WorkerCountStatus } from "@/types/compliance"
import { FourPointRatingDisplay, FourPointTrendIndicator, MiniTrendIndicator } from "@/components/ui/FourPointRatingDisplay"
import { UnionRespectAssessment } from "@/components/assessments/UnionRespectAssessment"
import { SafetyAssessment4Point } from "@/components/assessments/SafetyAssessment4Point"
import { toast } from "sonner"
import {
  FourPointRating,
  Assessment,
  UnionRespectAssessment as UnionRespectType,
  Safety4PointAssessment as SafetyAssessmentType,
  CreateUnionRespectAssessmentPayload,
  CreateSafety4PointAssessmentPayload
} from "@/types/assessments"

interface EnhancedEmployerComplianceDetailProps {
  projectId: string
  employerId: string
  employerName: string
  employerRole?: 'head_contractor' | 'subcontractor' | 'trade_contractor' | 'labour_hire' | 'consultant' | 'other'
  onViewHistory?: () => void
  readonly?: boolean
  className?: string
}

interface ComplianceSummary {
  overallRating?: FourPointRating
  completionPercentage: number
  lastAssessmentDate?: string
  nextAssessmentDue?: string
  outstandingTasks: number
  criticalIssues: number
}

export function EnhancedEmployerComplianceDetail({
  projectId,
  employerId,
  employerName,
  employerRole = 'trade_contractor',
  onViewHistory,
  readonly = false,
  className
}: EnhancedEmployerComplianceDetailProps) {
  const { data: compliance = [] } = useEmployerCompliance(projectId, employerId)
  const upsertCompliance = useUpsertEmployerCompliance(projectId)
  const [activeTab, setActiveTab] = useState('overview')
  const [showHistory, setShowHistory] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [summary, setSummary] = useState<ComplianceSummary>({
    completionPercentage: 0,
    outstandingTasks: 0,
    criticalIssues: 0
  })

  // Current compliance record (most recent)
  const currentCompliance = compliance[0] || {
    cbus_check_conducted: false,
    incolink_check_conducted: false,
    cbus_enforcement_flag: false,
    incolink_enforcement_flag: false,
    cbus_followup_required: false,
    incolink_followup_required: false
  }

  const [formData, setFormData] = useState(currentCompliance)

  const handleFieldChange = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }, [])

  const handleSave = useCallback(async () => {
    try {
      await upsertCompliance.mutateAsync({
        employerId,
        updates: formData
      })
      setHasChanges(false)
      toast.success("Compliance data saved")
    } catch (error) {
      toast.error("Failed to save compliance data")
    }
  }, [upsertCompliance, employerId, formData])

  const handleSaveUnionRespectAssessment = useCallback(async (data: CreateUnionRespectAssessmentPayload) => {
    try {
      const response = await fetch('/api/assessments/union-respect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to save union respect assessment')
      }

      toast.success("Union Respect Assessment saved successfully")
      // Refresh assessments data
      if (onRefresh) {
        onRefresh()
      }
    } catch (error) {
      console.error('Error saving union respect assessment:', error)
      toast.error(error instanceof Error ? error.message : "Failed to save union respect assessment")
      throw error
    }
  }, [onRefresh])

  const handleSaveSafetyAssessment = useCallback(async (data: CreateSafety4PointAssessmentPayload) => {
    try {
      const response = await fetch('/api/assessments/safety-4-point', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to save safety assessment')
      }

      toast.success("Safety Assessment saved successfully")
      // Refresh assessments data
      if (onRefresh) {
        onRefresh()
      }
    } catch (error) {
      console.error('Error saving safety assessment:', error)
      toast.error(error instanceof Error ? error.message : "Failed to save safety assessment")
      throw error
    }
  }, [onRefresh])

  // Calculate compliance summary
  useEffect(() => {
    const unionRespectAssessments = assessments.filter(a => a.assessment_type === 'union_respect')
    const safetyAssessments = assessments.filter(a => a.assessment_type === 'safety_4_point')

    const completionPercentage = (
      (currentCompliance.cbus_check_conducted ? 25 : 0) +
      (currentCompliance.incolink_check_conducted ? 25 : 0) +
      (unionRespectAssessments.length > 0 ? 25 : 0) +
      (safetyAssessments.length > 0 ? 25 : 0)
    )

    const outstandingTasks = [
      currentCompliance.cbus_followup_required,
      currentCompliance.incolink_followup_required
    ].filter(Boolean).length

    const criticalIssues = [
      currentCompliance.cbus_enforcement_flag,
      currentCompliance.incolink_enforcement_flag
    ].filter(Boolean).length

    setSummary({
      completionPercentage,
      outstandingTasks,
      criticalIssues,
      lastAssessmentDate: assessments[0]?.assessment_date,
      nextAssessmentDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 days from now
    })
  }, [currentCompliance, assessments])

  const checkerOptions: { value: ComplianceChecker; label: string }[] = [
    { value: 'organiser', label: 'Organiser' },
    { value: 'delegate', label: 'Delegate' },
    { value: 'both', label: 'Both' },
    { value: 'cbus_officer', label: 'CBUS Officer' },
    { value: 'incolink_officer', label: 'INCOLINK Officer' }
  ]

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'overview':
        return BarChart3
      case 'compliance':
        return FileText
      case 'union-respect':
        return Users
      case 'safety':
        return Shield
      case 'history':
        return History
      default:
        return FileText
    }
  }

  return (
    <div className={className}>
      {/* Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                {employerName} - Compliance & Assessment Center
              </CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <Badge variant="outline" className="gap-1">
                  <Settings className="h-3 w-3" />
                  {employerRole.replace('_', ' ')}
                </Badge>
                {summary.lastAssessmentDate && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last assessed: {format(new Date(summary.lastAssessmentDate), 'MMM d, yyyy')}
                  </div>
                )}
                {summary.nextAssessmentDue && (
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    Due: {format(new Date(summary.nextAssessmentDue), 'MMM d, yyyy')}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onViewHistory && (
                <Button variant="outline" size="sm" onClick={onViewHistory}>
                  <Eye className="h-4 w-4 mr-1" />
                  Full History
                </Button>
              )}
              {hasChanges && (
                <Button size="sm" onClick={handleSave}>
                  <Save className="h-4 w-4 mr-1" />
                  Save Changes
                </Button>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-blue-600">
                {summary.completionPercentage}%
              </div>
              <div className="text-xs text-muted-foreground">Complete</div>
              <Progress value={summary.completionPercentage} className="mt-2 h-1" />
            </div>
            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-green-600">
                {assessments.length}
              </div>
              <div className="text-xs text-muted-foreground">Assessments</div>
            </div>
            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-orange-600">
                {summary.outstandingTasks}
              </div>
              <div className="text-xs text-muted-foreground">Follow-ups</div>
            </div>
            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-red-600">
                {summary.criticalIssues}
              </div>
              <div className="text-xs text-muted-foreground">Issues</div>
            </div>
            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-purple-600">
                {summary.overallRating || '-'}
              </div>
              <div className="text-xs text-muted-foreground">Overall Rating</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'compliance', label: 'CBUS/INCOLINK' },
            { id: 'union-respect', label: 'Union Respect' },
            { id: 'safety', label: 'Safety' },
            { id: 'history', label: 'History' }
          ].map((tab) => {
            const Icon = getTabIcon(tab.id)
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Compliance Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">CBUS Compliance</span>
                    <Badge variant={currentCompliance.cbus_enforcement_flag ? 'destructive' : 'default'}>
                      {currentCompliance.cbus_enforcement_flag ? 'Flagged' : 'OK'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">INCOLINK Compliance</span>
                    <Badge variant={currentCompliance.incolink_enforcement_flag ? 'destructive' : 'default'}>
                      {currentCompliance.incolink_enforcement_flag ? 'Flagged' : 'OK'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Union Respect Assessment</span>
                    <Badge variant={assessments.some(a => a.assessment_type === 'union_respect') ? 'default' : 'secondary'}>
                      {assessments.some(a => a.assessment_type === 'union_respect') ? 'Complete' : 'Pending'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Safety Assessment</span>
                    <Badge variant={assessments.some(a => a.assessment_type === 'safety_4_point') ? 'default' : 'secondary'}>
                      {assessments.some(a => a.assessment_type === 'safety_4_point') ? 'Complete' : 'Pending'}
                    </Badge>
                  </div>
                </div>

                <Separator />

                {summary.criticalIssues > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {summary.criticalIssues} critical issue{summary.criticalIssues > 1 ? 's' : ''} require immediate attention.
                    </AlertDescription>
                  </Alert>
                )}

                {summary.outstandingTasks > 0 && (
                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertDescription>
                      {summary.outstandingTasks} follow-up task{summary.outstandingTasks > 1 ? 's' : ''} pending.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Recent Assessments */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Assessments</CardTitle>
              </CardHeader>
              <CardContent>
                {assessments.length > 0 ? (
                  <div className="space-y-3">
                    {assessments.slice(0, 3).map((assessment) => (
                      <div key={assessment.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <div>
                            <div className="font-medium text-sm">
                              {assessment.assessment_type === 'union_respect' ? 'Union Respect' :
                               assessment.assessment_type === 'safety_4_point' ? 'Safety' :
                               assessment.assessment_type}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(assessment.assessment_date), 'MMM d, yyyy')}
                            </div>
                          </div>
                        </div>
                        {assessment.assessment_type === 'union_respect' && (
                          <FourPointRatingDisplay
                            rating={(assessment as UnionRespectType).overall_score}
                            variant="minimal"
                          />
                        )}
                        {assessment.assessment_type === 'safety_4_point' && (
                          <FourPointRatingDisplay
                            rating={(assessment as SafetyAssessmentType).overall_safety_score}
                            variant="minimal"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No assessments completed yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Overall Rating Display */}
          {summary.overallRating && (
            <FourPointRatingDisplay
              rating={summary.overallRating}
              label="Overall 4-Point Rating"
              description="Based on all completed assessments and compliance data"
              size="lg"
              variant="detailed"
              confidenceLevel={summary.completionPercentage}
            />
          )}

          {/* Action Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recommended Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {!currentCompliance.cbus_check_conducted && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">Complete CBUS Check</div>
                      <div className="text-xs text-muted-foreground">Verify CBUS compliance and payment status</div>
                    </div>
                    <Button size="sm" onClick={() => setActiveTab('compliance')}>
                      Complete
                    </Button>
                  </div>
                )}

                {!currentCompliance.incolink_check_conducted && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">Complete INCOLINK Check</div>
                      <div className="text-xs text-muted-foreground">Verify INCOLINK compliance and coverage</div>
                    </div>
                    <Button size="sm" onClick={() => setActiveTab('compliance')}>
                      Complete
                    </Button>
                  </div>
                )}

                {!assessments.some(a => a.assessment_type === 'union_respect') && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-green-200 bg-green-50">
                    <Users className="h-4 w-4 text-green-600" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">Complete Union Respect Assessment</div>
                      <div className="text-xs text-muted-foreground">Assess union relationship and engagement</div>
                    </div>
                    <Button size="sm" onClick={() => setActiveTab('union-respect')}>
                      Start Assessment
                    </Button>
                  </div>
                )}

                {!assessments.some(a => a.assessment_type === 'safety_4_point') && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-green-200 bg-green-50">
                    <Shield className="h-4 w-4 text-green-600" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">Complete Safety Assessment</div>
                      <div className="text-xs text-muted-foreground">Assess safety systems and performance</div>
                    </div>
                    <Button size="sm" onClick={() => setActiveTab('safety')}>
                      Start Assessment
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CBUS/INCOLINK Compliance Tab */}
        <TabsContent value="compliance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CBUS Compliance Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">CBUS Compliance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant={formData.cbus_enforcement_flag ? 'destructive' : 'default'}>
                    {formData.cbus_enforcement_flag ? 'Flagged' : 'OK'}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`cbus-conducted-${employerId}`}>Check Conducted</Label>
                    <Switch
                      id={`cbus-conducted-${employerId}`}
                      checked={formData.cbus_check_conducted}
                      onCheckedChange={(checked) => handleFieldChange('cbus_check_conducted', checked)}
                      disabled={readonly}
                    />
                  </div>

                  {formData.cbus_check_conducted && (
                    <>
                      <div>
                        <Label>Check Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formData.cbus_check_date
                                ? format(new Date(formData.cbus_check_date), "PPP")
                                : "Select date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={formData.cbus_check_date ? new Date(formData.cbus_check_date) : undefined}
                              onSelect={(date) => handleFieldChange('cbus_check_date', date?.toISOString().split('T')[0])}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div>
                        <Label>Payment Status</Label>
                        <Select
                          value={formData.cbus_payment_status || ''}
                          onValueChange={(value) => handleFieldChange('cbus_payment_status', value as PaymentStatus)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="correct">Correct</SelectItem>
                            <SelectItem value="incorrect">Incorrect</SelectItem>
                            <SelectItem value="uncertain">Uncertain</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`cbus-enforcement-${employerId}`}>Flag for Enforcement</Label>
                          <Switch
                            id={`cbus-enforcement-${employerId}`}
                            checked={formData.cbus_enforcement_flag}
                            onCheckedChange={(checked) => handleFieldChange('cbus_enforcement_flag', checked)}
                            disabled={readonly}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label htmlFor={`cbus-followup-${employerId}`}>Follow-up Required</Label>
                          <Switch
                            id={`cbus-followup-${employerId}`}
                            checked={formData.cbus_followup_required}
                            onCheckedChange={(checked) => handleFieldChange('cbus_followup_required', checked)}
                            disabled={readonly}
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Notes</Label>
                        <Textarea
                          className="mt-1"
                          placeholder="Add any notes..."
                          value={formData.cbus_notes || ''}
                          onChange={(e) => handleFieldChange('cbus_notes', e.target.value)}
                          rows={3}
                          disabled={readonly}
                        />
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* INCOLINK Compliance Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">INCOLINK Compliance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant={formData.incolink_enforcement_flag ? 'destructive' : 'default'}>
                    {formData.incolink_enforcement_flag ? 'Flagged' : 'OK'}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`incolink-conducted-${employerId}`}>Check Conducted</Label>
                    <Switch
                      id={`incolink-conducted-${employerId}`}
                      checked={formData.incolink_check_conducted}
                      onCheckedChange={(checked) => handleFieldChange('incolink_check_conducted', checked)}
                      disabled={readonly}
                    />
                  </div>

                  {formData.incolink_check_conducted && (
                    <>
                      <div>
                        <Label>Check Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formData.incolink_check_date
                                ? format(new Date(formData.incolink_check_date), "PPP")
                                : "Select date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={formData.incolink_check_date ? new Date(formData.incolink_check_date) : undefined}
                              onSelect={(date) => handleFieldChange('incolink_check_date', date?.toISOString().split('T')[0])}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div>
                        <Label>Payment Status</Label>
                        <Select
                          value={formData.incolink_payment_status || ''}
                          onValueChange={(value) => handleFieldChange('incolink_payment_status', value as PaymentStatus)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="correct">Correct</SelectItem>
                            <SelectItem value="incorrect">Incorrect</SelectItem>
                            <SelectItem value="uncertain">Uncertain</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`incolink-enforcement-${employerId}`}>Flag for Enforcement</Label>
                          <Switch
                            id={`incolink-enforcement-${employerId}`}
                            checked={formData.incolink_enforcement_flag}
                            onCheckedChange={(checked) => handleFieldChange('incolink_enforcement_flag', checked)}
                            disabled={readonly}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label htmlFor={`incolink-followup-${employerId}`}>Follow-up Required</Label>
                          <Switch
                            id={`incolink-followup-${employerId}`}
                            checked={formData.incolink_followup_required}
                            onCheckedChange={(checked) => handleFieldChange('incolink_followup_required', checked)}
                            disabled={readonly}
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Notes</Label>
                        <Textarea
                          className="mt-1"
                          placeholder="Add any notes..."
                          value={formData.incolink_notes || ''}
                          onChange={(e) => handleFieldChange('incolink_notes', e.target.value)}
                          rows={3}
                          disabled={readonly}
                        />
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Union Respect Assessment Tab */}
        <TabsContent value="union-respect">
          <UnionRespectAssessment
            employerId={employerId}
            employerName={employerName}
            onSave={handleSaveUnionRespectAssessment}
            onViewHistory={onViewHistory}
            readonly={readonly}
          />
        </TabsContent>

        {/* Safety Assessment Tab */}
        <TabsContent value="safety">
          <SafetyAssessment4Point
            employerId={employerId}
            employerName={employerName}
            onSave={handleSaveSafetyAssessment}
            onViewHistory={onViewHistory}
            readonly={readonly}
          />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assessment History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No assessment history available</p>
                <p className="text-sm">
                  Complete assessments to see historical data and trends here.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}