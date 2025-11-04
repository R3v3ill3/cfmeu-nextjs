"use client"

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { MobileForm } from '@/components/mobile/shared/MobileForm'
import { MobileCameraCapture } from '@/components/mobile/forms/MobileCameraCapture'
import { useHapticFeedback } from '@/components/mobile/shared/HapticFeedback'
import {
  Shield,
  Users,
  Building,
  MessageSquare,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  X,
  Star,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react'

interface ProjectData {
  id: string
  name: string
  address: string
  status: string
  employer_id?: string
  primary_trade?: string
  site_contact?: string
  site_phone?: string
  coordinates?: {
    lat: number
    lng: number
  }
}

interface ComplianceAuditData {
  overall_rating: 'green' | 'amber' | 'red'
  confidence_level: 'high' | 'medium' | 'low'
  sections: {
    safety: {
      rating: 'green' | 'amber' | 'red'
      score: number
      notes: string
      evidence: Array<{
        id: string
        type: 'photo' | 'document' | 'note'
        url?: string
        description: string
        timestamp: string
      }>
      issues: Array<{
        id: string
        severity: 'low' | 'medium' | 'high' | 'critical'
        description: string
        action_required: string
        deadline?: string
        resolved: boolean
      }>
    }
    union_rights: {
      rating: 'green' | 'amber' | 'red'
      score: number
      notes: string
      evidence: Array<{
        id: string
        type: 'photo' | 'document' | 'note'
        url?: string
        description: string
        timestamp: string
      }>
      issues: Array<{
        id: string
        severity: 'low' | 'medium' | 'high' | 'critical'
        description: string
        action_required: string
        deadline?: string
        resolved: boolean
      }>
    }
    workplace_conditions: {
      rating: 'green' | 'amber' | 'red'
      score: number
      notes: string
      evidence: Array<{
        id: string
        type: 'photo' | 'document' | 'note'
        url?: string
        description: string
        timestamp: string
      }>
      issues: Array<{
        id: string
        severity: 'low' | 'medium' | 'high' | 'critical'
        description: string
        action_required: string
        deadline?: string
        resolved: boolean
      }>
    }
    communication: {
      rating: 'green' | 'amber' | 'red'
      score: number
      notes: string
      evidence: Array<{
        id: string
        type: 'photo' | 'document' | 'note'
        url?: string
        description: string
        timestamp: string
      }>
      issues: Array<{
        id: string
        severity: 'low' | 'medium' | 'high' | 'critical'
        description: string
        action_required: string
        deadline?: string
        resolved: boolean
      }>
    }
  }
  delegate_interviews: Array<{
    id: string
    delegate_name: string
    role: string
    interview_date: string
    concerns_raised: string[]
    positive_feedback: string[]
    action_items: string[]
  }>
  recommendations: Array<{
    id: string
    priority: 'high' | 'medium' | 'low'
    category: string
    description: string
    responsible_party: string
    deadline?: string
    status: 'pending' | 'in_progress' | 'completed'
  }>
  follow_up_required: boolean
  follow_up_date?: string
}

interface MobileComplianceAuditProps {
  projectData: ProjectData
  initialData?: Partial<ComplianceAuditData>
  onSubmit: (data: Partial<ComplianceAuditData>) => Promise<void>
  onPartialSave: (data: Partial<ComplianceAuditData>) => Promise<void>
  submitting: boolean
  isOnline: boolean
  isLowEndDevice: boolean
}

const SEVERITY_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-blue-100 text-blue-800' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' }
]

const AUDIT_SECTIONS = [
  {
    key: 'safety',
    title: 'Workplace Health & Safety',
    icon: Shield,
    description: 'Safety procedures, equipment, and compliance',
    criteria: [
      'Safety signage and procedures displayed',
      'Personal protective equipment (PPE) provided and used',
      'Risk assessments completed',
      'Emergency procedures in place',
      'Incident reporting system active'
    ]
  },
  {
    key: 'union_rights',
    title: 'Union Rights & Representation',
    icon: Users,
    description: 'Union access, delegate rights, and member representation',
    criteria: [
      'Union delegate access to site',
      'Union posters and information displayed',
      'New worker induction includes union information',
      'Delegate consultation on workplace changes',
      'Union meetings permitted during breaks'
    ]
  },
  {
    key: 'workplace_conditions',
    title: 'Workplace Conditions',
    icon: Building,
    description: 'Facilities, amenities, and working conditions',
    criteria: [
      'Clean and adequate toilet facilities',
      'Access to drinking water',
      'Shelter and rest areas',
      'Adequate lighting and ventilation',
      'Reasonable working hours and breaks'
    ]
  },
  {
    key: 'communication',
    title: 'Communication & Consultation',
    icon: MessageSquare,
    description: 'Communication channels and worker consultation',
    criteria: [
      'Regular toolbox talks',
      'Worker consultation on safety matters',
      'Notice boards with current information',
      'Accessible management for concerns',
      'Clear reporting channels for issues'
    ]
  }
]

export function MobileComplianceAudit({
  projectData,
  initialData,
  onSubmit,
  onPartialSave,
  submitting,
  isOnline,
  isLowEndDevice
}: MobileComplianceAuditProps) {
  const [currentData, setCurrentData] = useState<Partial<ComplianceAuditData>>(initialData || {
    overall_rating: 'amber',
    confidence_level: 'medium',
    sections: {
      safety: { rating: 'amber', score: 50, notes: '', evidence: [], issues: [] },
      union_rights: { rating: 'amber', score: 50, notes: '', evidence: [], issues: [] },
      workplace_conditions: { rating: 'amber', score: 50, notes: '', evidence: [], issues: [] },
      communication: { rating: 'amber', score: 50, notes: '', evidence: [], issues: [] }
    },
    delegate_interviews: [],
    recommendations: [],
    follow_up_required: false
  })

  const { trigger, success, selection } = useHapticFeedback()

  // Auto-save effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentData && Object.keys(currentData).length > 0) {
        onPartialSave(currentData)
      }
    }, 3000) // Auto-save after 3 seconds of inactivity

    return () => clearTimeout(timer)
  }, [currentData, onPartialSave])

  const updateCurrentData = useCallback((updates: Partial<ComplianceAuditData>) => {
    setCurrentData(prev => ({ ...prev, ...updates }))
    selection()
  }, [selection])

  // Traffic Light Rating Component
  const TrafficLightRating = ({
    value,
    onChange,
    label
  }: {
    value: 'green' | 'amber' | 'red'
    onChange: (rating: 'green' | 'amber' | 'red') => void
    label: string
  }) => (
    <div className="space-y-3">
      <Label className="text-base font-medium">{label}</Label>
      <div className="flex gap-2">
        {[
          { value: 'green', label: 'Good', color: 'bg-green-500 hover:bg-green-600' },
          { value: 'amber', label: 'Concern', color: 'bg-yellow-500 hover:bg-yellow-600' },
          { value: 'red', label: 'Poor', color: 'bg-red-500 hover:bg-red-600' }
        ].map((rating) => (
          <Button
            key={rating.value}
            type="button"
            onClick={() => {
              trigger()
              onChange(rating.value as 'green' | 'amber' | 'red')
              success()
            }}
            variant={value === rating.value ? 'default' : 'outline'}
            className={`flex-1 h-12 text-sm font-medium ${
              value === rating.value ? rating.color : ''
            }`}
          >
            {rating.label}
          </Button>
        ))}
      </div>
    </div>
  )

  // Form Steps
  const steps = [
    {
      id: 'overall_assessment',
      title: 'Overall Assessment',
      description: 'Initial assessment of overall compliance',
      component: ({ data, onChange }: any) => (
        <div className="space-y-6">
          <TrafficLightRating
            value={data.overall_rating || 'amber'}
            onChange={(rating) => onChange({ overall_rating: rating })}
            label="Overall Compliance Rating"
          />

          <div>
            <Label className="text-base font-medium">Confidence Level</Label>
            <Select
              value={data.confidence_level || 'medium'}
              onValueChange={(value) => onChange({ confidence_level: value })}
            >
              <SelectTrigger className="h-11 mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High - Confident in assessment</SelectItem>
                <SelectItem value="medium">Medium - Some uncertainty</SelectItem>
                <SelectItem value="low">Low - Limited information</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="initial_notes" className="text-base font-medium">Initial Observations</Label>
            <Textarea
              id="initial_notes"
              placeholder="Provide brief initial observations about the site..."
              value={data.initial_notes || ''}
              onChange={(e) => onChange({ initial_notes: e.target.value })}
              className="mt-2 min-h-[100px]"
            />
          </div>
        </div>
      ),
      validation: (data: any) => {
        if (!data.overall_rating) {
          return "Please select an overall rating"
        }
        if (!data.confidence_level) {
          return "Please select a confidence level"
        }
        return true
      }
    },

    ...AUDIT_SECTIONS.map(section => ({
      id: section.key,
      title: section.title,
      description: section.description,
      component: ({ data, onChange }: any) => {
        const sectionData = data[section.key] || { rating: 'amber', score: 50, notes: '', evidence: [], issues: [] }

        return (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <section.icon className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-medium">{section.title}</h3>
            </div>

            <TrafficLightRating
              value={sectionData.rating}
              onChange={(rating) => onChange({
                [section.key]: { ...sectionData, rating }
              })}
              label="Compliance Rating"
            />

            <div>
              <Label className="text-base font-medium">Assessment Criteria</Label>
              <div className="space-y-2 mt-2">
                {section.criteria.map((criterion, index) => (
                  <label key={index} className="flex items-center gap-2 p-2 border rounded">
                    <input
                      type="checkbox"
                      checked={sectionData.criteria_met?.includes(index) || false}
                      onChange={(e) => {
                        const criteria_met = sectionData.criteria_met || []
                        const newCriteria = e.target.checked
                          ? [...criteria_met, index]
                          : criteria_met.filter((i: number) => i !== index)
                        onChange({
                          [section.key]: {
                            ...sectionData,
                            criteria_met: newCriteria,
                            score: Math.round((newCriteria.length / section.criteria.length) * 100)
                          }
                        })
                      }}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{criterion}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor={`${section.key}-notes`} className="text-base font-medium">Detailed Notes</Label>
              <Textarea
                id={`${section.key}-notes`}
                placeholder="Provide detailed observations and findings..."
                value={sectionData.notes || ''}
                onChange={(e) => onChange({
                  [section.key]: { ...sectionData, notes: e.target.value }
                })}
                className="mt-2 min-h-[120px]"
              />
            </div>

            <div>
              <Label className="text-base font-medium flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Evidence Photos
              </Label>
              <div className="space-y-3 mt-2">
                <MobileCameraCapture
                  onPhotoCaptured={(photoData) => {
                    const newEvidence = [
                      ...(sectionData.evidence || []),
                      {
                        id: `evidence-${Date.now()}`,
                        type: 'photo',
                        url: photoData.url,
                        description: photoData.description,
                        timestamp: new Date().toISOString()
                      }
                    ]
                    onChange({
                      [section.key]: { ...sectionData, evidence: newEvidence }
                    })
                  }}
                />

                {/* Display existing evidence */}
                <div className="grid grid-cols-2 gap-2">
                  {sectionData.evidence?.map((evidence: any, index: number) => (
                    <div key={evidence.id} className="relative group">
                      {evidence.type === 'photo' && evidence.url && (
                        <img
                          src={evidence.url}
                          alt={evidence.description || 'Evidence'}
                          className="w-full h-24 object-cover rounded-lg border"
                        />
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => {
                          const newEvidence = sectionData.evidence?.filter((e: any) => e.id !== evidence.id) || []
                          onChange({
                            [section.key]: { ...sectionData, evidence: newEvidence }
                          })
                        }}
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      }
    })),

    {
      id: 'issues',
      title: 'Issues & Actions',
      description: 'Document issues found and required actions',
      component: ({ data, onChange }: any) => (
        <div className="space-y-6">
          <div>
            <Label className="text-base font-medium flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Issues Identified
            </Label>
            <div className="space-y-4 mt-3">
              {data.all_issues?.map((issue: any, index: number) => (
                <Card key={index} className="border-2">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 space-y-3">
                        <Input
                          placeholder="Issue description"
                          value={issue.description || ''}
                          onChange={(e) => {
                            const newIssues = [...(data.all_issues || [])]
                            newIssues[index] = { ...issue, description: e.target.value }
                            onChange({ all_issues: newIssues })
                          }}
                          className="h-11"
                        />
                        <Textarea
                          placeholder="Action required"
                          value={issue.action_required || ''}
                          onChange={(e) => {
                            const newIssues = [...(data.all_issues || [])]
                            newIssues[index] = { ...issue, action_required: e.target.value }
                            onChange({ all_issues: newIssues })
                          }}
                          className="min-h-[60px]"
                        />
                        <div className="flex gap-2">
                          <Select
                            value={issue.severity || 'medium'}
                            onValueChange={(value) => {
                              const newIssues = [...(data.all_issues || [])]
                              newIssues[index] = { ...issue, severity: value }
                              onChange({ all_issues: newIssues })
                            }}
                          >
                            <SelectTrigger className="flex-1 h-11">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SEVERITY_LEVELS.map(level => (
                                <SelectItem key={level.value} value={level.value}>
                                  {level.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="date"
                            value={issue.deadline || ''}
                            onChange={(e) => {
                              const newIssues = [...(data.all_issues || [])]
                              newIssues[index] = { ...issue, deadline: e.target.value }
                              onChange({ all_issues: newIssues })
                            }}
                            className="flex-1 h-11"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const newIssues = data.all_issues?.filter((_: any, i: number) => i !== index) || []
                          onChange({ all_issues: newIssues })
                        }}
                        className="h-8 w-8 ml-2"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const newIssues = [...(data.all_issues || []), {
                    description: '',
                    action_required: '',
                    severity: 'medium',
                    deadline: '',
                    resolved: false
                  }]
                  onChange({ all_issues: newIssues })
                }}
                className="w-full h-11"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Issue
              </Button>
            </div>
          </div>
        </div>
      )
    },

    {
      id: 'recommendations',
      title: 'Recommendations',
      description: 'Recommendations for improvement',
      component: ({ data, onChange }: any) => (
        <div className="space-y-6">
          <div>
            <Label className="text-base font-medium">Recommendations</Label>
            <div className="space-y-4 mt-3">
              {data.recommendations?.map((rec: any, index: number) => (
                <Card key={index} className="border-2">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 space-y-3">
                        <Select
                          value={rec.priority || 'medium'}
                          onValueChange={(value) => {
                            const newRecs = [...(data.recommendations || [])]
                            newRecs[index] = { ...rec, priority: value }
                            onChange({ recommendations: newRecs })
                          }}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High Priority</SelectItem>
                            <SelectItem value="medium">Medium Priority</SelectItem>
                            <SelectItem value="low">Low Priority</SelectItem>
                          </SelectContent>
                        </Select>
                        <Textarea
                          placeholder="Recommendation description"
                          value={rec.description || ''}
                          onChange={(e) => {
                            const newRecs = [...(data.recommendations || [])]
                            newRecs[index] = { ...rec, description: e.target.value }
                            onChange({ recommendations: newRecs })
                          }}
                          className="min-h-[80px]"
                        />
                        <Input
                          placeholder="Responsible party"
                          value={rec.responsible_party || ''}
                          onChange={(e) => {
                            const newRecs = [...(data.recommendations || [])]
                            newRecs[index] = { ...rec, responsible_party: e.target.value }
                            onChange({ recommendations: newRecs })
                          }}
                          className="h-11"
                        />
                        <Input
                          type="date"
                          value={rec.deadline || ''}
                          onChange={(e) => {
                            const newRecs = [...(data.recommendations || [])]
                            newRecs[index] = { ...rec, deadline: e.target.value }
                            onChange({ recommendations: newRecs })
                          }}
                          className="h-11"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const newRecs = data.recommendations?.filter((_: any, i: number) => i !== index) || []
                          onChange({ recommendations: newRecs })
                        }}
                        className="h-8 w-8 ml-2"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const newRecs = [...(data.recommendations || []), {
                    priority: 'medium',
                    description: '',
                    responsible_party: '',
                    deadline: '',
                    status: 'pending'
                  }]
                  onChange({ recommendations: newRecs })
                }}
                className="w-full h-11"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Recommendation
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-base font-medium">Follow-up Required</Label>
            <div className="space-y-3 mt-2">
              <label className="flex items-center gap-2 p-3 border rounded-lg">
                <input
                  type="checkbox"
                  checked={data.follow_up_required || false}
                  onChange={(e) => onChange({ follow_up_required: e.target.checked })}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium">Schedule follow-up visit</span>
              </label>

              {data.follow_up_required && (
                <Input
                  type="date"
                  value={data.follow_up_date || ''}
                  onChange={(e) => onChange({ follow_up_date: e.target.value })}
                  className="h-11"
                />
              )}
            </div>
          </div>
        </div>
      )
    }
  ]

  const handleStepChange = useCallback((stepId: string, data: any) => {
    updateCurrentData({ [stepId]: data })
  }, [updateCurrentData])

  const handleFormSubmit = useCallback(async (formData: any) => {
    // Process and combine all step data into final audit data
    const finalData: Partial<ComplianceAuditData> = {
      overall_rating: formData.overall_assessment.overall_rating,
      confidence_level: formData.overall_assessment.confidence_level,
      sections: {
        safety: formData.safety?.safety || {},
        union_rights: formData.union_rights?.union_rights || {},
        workplace_conditions: formData.workplace_conditions?.workplace_conditions || {},
        communication: formData.communication?.communication || {}
      },
      all_issues: formData.issues?.all_issues || [],
      recommendations: formData.recommendations?.recommendations || [],
      follow_up_required: formData.recommendations?.follow_up_required || false,
      follow_up_date: formData.recommendations?.follow_up_date
    }

    await onSubmit(finalData)
  }, [onSubmit])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-gray-900">Compliance Audit</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building className="h-4 w-4" />
              <span>{projectData.name}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <Badge variant={projectData.status === 'active' ? 'default' : 'secondary'}>
                {projectData.status}
              </Badge>
              {projectData.primary_trade && (
                <span className="text-muted-foreground">
                  {projectData.primary_trade}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="pb-20">
        <MobileForm
          steps={steps}
          onSubmit={handleFormSubmit}
          onDataChange={handleStepChange}
          showProgress={true}
          allowSkip={false}
          saveOnStepChange={true}
          className="h-full"
        />
      </div>

      {/* Save Status */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <Clock className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-muted-foreground">
              {isOnline ? 'Online - Auto-saving' : 'Offline - Saved locally'}
            </span>
          </div>
          {submitting && (
            <span className="text-blue-600">Submitting...</span>
          )}
        </div>
      </div>
    </div>
  )
}