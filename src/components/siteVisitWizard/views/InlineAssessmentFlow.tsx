"use client"

import { useState, useMemo, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Search, 
  Building, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  ArrowLeft,
  Loader2 
} from "lucide-react"
import { useMappingSheetData } from "@/hooks/useMappingSheetData"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { cn } from "@/lib/utils"
import { IndividualEmployerAssessment } from "@/components/public/IndividualEmployerAssessment"
import { EmployerAssessmentData } from "@/components/public/AssessmentFormFields"
import { useUpsertEmployerCompliance } from "@/components/projects/compliance/hooks/useEmployerCompliance"
import { toast } from "sonner"

interface InlineAssessmentFlowProps {
  projectId: string
  projectName: string
  onComplete: () => void
  onCancel?: () => void
}

interface Employer {
  id: string
  name: string
  roleOrTrade: string
  trafficLightRating?: 'green' | 'amber' | 'red' | null
}

type FlowStep = 'selection' | 'assessment'

export function InlineAssessmentFlow({
  projectId,
  projectName,
  onComplete,
  onCancel,
}: InlineAssessmentFlowProps) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<FlowStep>('selection')
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedEmployerIds, setSelectedEmployerIds] = useState<string[]>([])
  const [selectAllChecked, setSelectAllChecked] = useState(false)
  const [currentEmployerIndex, setCurrentEmployerIndex] = useState(0)

  const { data: mappingData, isLoading: isLoadingMapping } = useMappingSheetData(projectId)
  const upsertCompliance = useUpsertEmployerCompliance(projectId)

  // Build employer list from mapping data
  const employers = useMemo(() => {
    if (!mappingData) return []
    
    const employerMap = new Map<string, Employer>()
    
    // Add contractor roles
    mappingData.contractorRoles.forEach(role => {
      const existing = employerMap.get(role.employerId)
      if (!existing || role.role === 'builder' || role.role === 'head_contractor') {
        employerMap.set(role.employerId, {
          id: role.employerId,
          name: role.employerName,
          roleOrTrade: role.roleLabel,
        })
      }
    })
    
    // Add trade contractors
    mappingData.tradeContractors.forEach(trade => {
      if (!employerMap.has(trade.employerId)) {
        employerMap.set(trade.employerId, {
          id: trade.employerId,
          name: trade.employerName,
          roleOrTrade: trade.tradeLabel,
        })
      }
    })
    
    return Array.from(employerMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [mappingData])

  // Fetch traffic light ratings for employers
  const { data: ratingsData } = useQuery({
    queryKey: ['employer-ratings-inline', projectId, employers.map(e => e.id)],
    enabled: employers.length > 0,
    queryFn: async () => {
      if (employers.length === 0) return new Map<string, 'green' | 'amber' | 'red'>()
      
      const employerIds = employers.map(e => e.id)
      
      const { data: complianceData } = await supabase
        .from('employer_compliance_checks')
        .select('employer_id, traffic_light_rating')
        .eq('project_id', projectId)
        .eq('is_current', true)
        .in('employer_id', employerIds)
      
      const ratingMap = new Map<string, 'green' | 'amber' | 'red'>()
      ;(complianceData || []).forEach((c: any) => {
        if (c.traffic_light_rating) {
          ratingMap.set(c.employer_id, c.traffic_light_rating)
        }
      })
      
      return ratingMap
    },
    staleTime: 30000,
  })

  // Enrich employers with ratings
  const enrichedEmployers = useMemo(() => {
    return employers.map(emp => ({
      ...emp,
      trafficLightRating: ratingsData?.get(emp.id) || null,
    }))
  }, [employers, ratingsData])

  // Filter employers by search term
  const filteredEmployers = useMemo(() => {
    return enrichedEmployers.filter(employer => {
      const matchesSearch = employer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           employer.roleOrTrade?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesSearch
    })
  }, [enrichedEmployers, searchTerm])

  // Current employer being assessed
  const currentEmployerId = selectedEmployerIds[currentEmployerIndex]
  const currentEmployer = enrichedEmployers.find(e => e.id === currentEmployerId)
  const hasNextEmployer = currentEmployerIndex < selectedEmployerIds.length - 1

  // Fetch current employer's compliance data for assessment form
  const { data: currentComplianceData, isLoading: isLoadingCompliance } = useQuery({
    queryKey: ['employer-compliance-inline', projectId, currentEmployerId],
    enabled: !!currentEmployerId && step === 'assessment',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employer_compliance_checks')
        .select('*')
        .eq('project_id', projectId)
        .eq('employer_id', currentEmployerId)
        .eq('is_current', true)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') throw error
      return data
    },
  })

  const handleSelectAll = (checked: boolean) => {
    setSelectAllChecked(checked)
    if (checked) {
      setSelectedEmployerIds(filteredEmployers.map(e => e.id))
    } else {
      setSelectedEmployerIds([])
    }
  }

  const handleEmployerToggle = (employerId: string, checked: boolean) => {
    setSelectedEmployerIds(prev => {
      const newSelection = checked
        ? [...prev, employerId]
        : prev.filter(id => id !== employerId)
      
      setSelectAllChecked(newSelection.length === filteredEmployers.length && filteredEmployers.length > 0)
      return newSelection
    })
  }

  const getRatingIcon = (rating: 'green' | 'amber' | 'red' | null) => {
    switch (rating) {
      case 'green':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'amber':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />
      case 'red':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
    }
  }

  const getRatingColor = (rating: 'green' | 'amber' | 'red' | null) => {
    switch (rating) {
      case 'green':
        return 'bg-green-50 border-green-200'
      case 'amber':
        return 'bg-amber-50 border-amber-200'
      case 'red':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const handleStartAssessment = () => {
    if (selectedEmployerIds.length === 0) return
    setCurrentEmployerIndex(0)
    setStep('assessment')
  }

  const handleBackToSelection = () => {
    setStep('selection')
    setCurrentEmployerIndex(0)
  }

  // Build update payload from form data (same structure as public form)
  const buildUpdatePayload = (data: EmployerAssessmentData) => {
    return {
      // CBUS/INCOLINK basic compliance
      cbus_check_conducted: data.cbus_check_conducted,
      cbus_check_date: data.cbus_check_date,
      cbus_payment_status: data.cbus_payment_status,
      cbus_payment_timing: data.cbus_payment_timing,
      cbus_worker_count_status: data.cbus_worker_count_status,
      cbus_enforcement_flag: data.cbus_enforcement_flag,
      cbus_followup_required: data.cbus_followup_required,
      cbus_notes: data.cbus_notes,
      incolink_check_conducted: data.incolink_check_conducted,
      incolink_check_date: data.incolink_check_date,
      incolink_payment_status: data.incolink_payment_status,
      incolink_payment_timing: data.incolink_payment_timing,
      incolink_worker_count_status: data.incolink_worker_count_status,
      incolink_enforcement_flag: data.incolink_enforcement_flag,
      incolink_followup_required: data.incolink_followup_required,
      incolink_notes: data.incolink_notes,
      incolink_company_id: data.incolink_company_id,
      
      // Union Respect Assessment
      unionRespect: {
        criteria: {
          right_of_entry: data.right_of_entry,
          delegate_accommodation: data.delegate_accommodation,
          access_to_information: data.access_to_information,
          access_to_inductions: data.access_to_inductions,
          eba_status: data.eba_status,
        },
        overall_score: Math.round((
          data.right_of_entry +
          data.delegate_accommodation +
          data.access_to_information +
          data.access_to_inductions +
          data.eba_status
        ) / 5),
        confidence_level: 70,
        notes: data.union_respect_notes,
        assessment_date: new Date().toISOString().split('T')[0],
      },
      
      // Safety Assessment
      safety: {
        safety_criteria: {
          safety_management_systems: data.safety_management_systems,
          incident_reporting: data.incident_reporting,
          site_safety_culture: data.site_safety_culture,
          risk_assessment_processes: data.risk_assessment_processes,
          emergency_preparedness: data.emergency_preparedness,
          worker_safety_training: data.worker_safety_training,
        },
        safety_metrics: {
          lost_time_injuries: data.lost_time_injuries,
          near_misses: data.near_misses,
          safety_breaches: data.safety_breaches,
          safety_improvements: 0,
          training_hours: 0,
        },
        audit_compliance: {
          outstanding_actions: 0,
          critical_risks_identified: 0,
        },
        overall_safety_score: Math.round((
          data.safety_management_systems +
          data.incident_reporting +
          data.site_safety_culture +
          data.risk_assessment_processes +
          data.emergency_preparedness +
          data.worker_safety_training
        ) / 6),
        safety_confidence_level: 70,
        notes: data.safety_notes,
        assessment_date: new Date().toISOString().split('T')[0],
      },
      
      // Subcontractor Assessment  
      subcontractor: {
        subcontracting_criteria: {
          subcontractor_usage: data.subcontractor_usage,
          payment_terms: data.payment_terms,
          treatment_of_subbies: data.treatment_of_subbies,
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
        overall_subcontractor_score: Math.round((
          data.subcontractor_usage +
          data.payment_terms +
          data.treatment_of_subbies
        ) / 3),
        confidence_level: 70,
        notes: data.subcontractor_notes,
        assessment_date: new Date().toISOString().split('T')[0],
      },
    }
  }

  const submitAllAssessments = useCallback(async (data: EmployerAssessmentData, employerId: string) => {
    const updates = buildUpdatePayload(data)
    
    // 1. Update CBUS/INCOLINK compliance checks
    await upsertCompliance.mutateAsync({
      employerId,
      updates: {
        cbus_check_conducted: updates.cbus_check_conducted,
        cbus_check_date: updates.cbus_check_date,
        cbus_payment_status: updates.cbus_payment_status,
        cbus_payment_timing: updates.cbus_payment_timing,
        cbus_worker_count_status: updates.cbus_worker_count_status,
        cbus_enforcement_flag: updates.cbus_enforcement_flag,
        cbus_followup_required: updates.cbus_followup_required,
        cbus_notes: updates.cbus_notes,
        incolink_check_conducted: updates.incolink_check_conducted,
        incolink_check_date: updates.incolink_check_date,
        incolink_payment_status: updates.incolink_payment_status,
        incolink_payment_timing: updates.incolink_payment_timing,
        incolink_worker_count_status: updates.incolink_worker_count_status,
        incolink_enforcement_flag: updates.incolink_enforcement_flag,
        incolink_followup_required: updates.incolink_followup_required,
        incolink_notes: updates.incolink_notes,
        incolink_company_id: updates.incolink_company_id,
      } as any,
    })

    // 2. Create Union Respect Assessment
    const { data: { user } } = await supabase.auth.getUser()
    if (updates.unionRespect) {
      await supabase
        .from('union_respect_assessments_4point')
        .insert({
          project_id: projectId,
          employer_id: employerId,
          assessor_id: user?.id,
          assessment_date: updates.unionRespect.assessment_date,
          right_of_entry_rating: updates.unionRespect.criteria.right_of_entry,
          delegate_accommodation_rating: updates.unionRespect.criteria.delegate_accommodation,
          access_to_information_rating: updates.unionRespect.criteria.access_to_information,
          access_to_inductions_rating: updates.unionRespect.criteria.access_to_inductions,
          eba_status_rating: updates.unionRespect.criteria.eba_status,
          overall_union_respect_rating: updates.unionRespect.overall_score,
          confidence_level: 'medium',
          notes: updates.unionRespect.notes,
        })
    }

    // 3. Create Safety Assessment
    if (updates.safety) {
      await supabase
        .from('safety_assessments_4point')
        .insert({
          project_id: projectId,
          employer_id: employerId,
          assessor_id: user?.id,
          assessment_date: updates.safety.assessment_date,
          hsr_respect_rating: updates.safety.safety_criteria.safety_management_systems,
          general_safety_rating: updates.safety.safety_criteria.site_safety_culture,
          safety_incidents_rating: updates.safety.safety_criteria.incident_reporting,
          overall_safety_rating: updates.safety.overall_safety_score,
          confidence_level: 'medium',
          notes: updates.safety.notes,
        })
    }

    // 4. Create Subcontractor Assessment
    if (updates.subcontractor) {
      await supabase
        .from('subcontractor_assessments_4point')
        .insert({
          project_id: projectId,
          employer_id: employerId,
          assessor_id: user?.id,
          assessment_date: updates.subcontractor.assessment_date,
          usage_rating: Math.round((
            updates.subcontractor.subcontracting_criteria.subcontractor_usage +
            updates.subcontractor.subcontracting_criteria.payment_terms +
            updates.subcontractor.subcontracting_criteria.treatment_of_subbies
          ) / 3),
          subcontractor_count: updates.subcontractor.subcontractor_metrics.active_subcontractors || 0,
          confidence_level: 'medium',
          notes: updates.subcontractor.notes,
        })
    }
    
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['wizard-employer-ratings', projectId] })
    queryClient.invalidateQueries({ queryKey: ['employer-ratings-inline', projectId] })
  }, [projectId, upsertCompliance, queryClient])

  const handleSubmit = useCallback(async (data: EmployerAssessmentData) => {
    if (!currentEmployerId) return
    
    try {
      await submitAllAssessments(data, currentEmployerId)
      toast.success(`Assessment for ${currentEmployer?.name} submitted!`)
      
      // Go back to selection or close dialog
      handleBackToSelection()
    } catch (error: any) {
      console.error('Error submitting assessment:', error)
      toast.error(error.message || 'Failed to submit assessment')
      throw error
    }
  }, [currentEmployerId, currentEmployer?.name, submitAllAssessments])

  const handleSubmitAndNext = useCallback(async (data: EmployerAssessmentData) => {
    if (!currentEmployerId) return
    
    try {
      await submitAllAssessments(data, currentEmployerId)
      toast.success(`Assessment for ${currentEmployer?.name} submitted!`)
      
      // Move to next employer or finish
      if (hasNextEmployer) {
        setCurrentEmployerIndex(prev => prev + 1)
      } else {
        // All done
        onComplete()
      }
    } catch (error: any) {
      console.error('Error submitting assessment:', error)
      toast.error(error.message || 'Failed to submit assessment')
      throw error
    }
  }, [currentEmployerId, currentEmployer?.name, submitAllAssessments, hasNextEmployer, onComplete])

  // Render Selection Step
  if (step === 'selection') {
    return (
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="space-y-2">
          <h2 className="text-lg font-bold">Select Employers to Assess</h2>
          <p className="text-sm text-muted-foreground">{projectName}</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
          <Input
            placeholder="Search employers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11"
          />
        </div>

        {/* Employer List */}
        {isLoadingMapping ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : filteredEmployers.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
            <Building className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No employers found</p>
            {searchTerm && (
              <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Select All */}
            <div className="flex items-center space-x-3 pb-3 border-b">
              <Checkbox
                id="select-all-inline"
                checked={selectAllChecked}
                onCheckedChange={handleSelectAll}
                className="h-5 w-5"
              />
              <label
                htmlFor="select-all-inline"
                className="text-sm font-medium leading-none cursor-pointer flex-1"
              >
                Select All ({filteredEmployers.length})
              </label>
            </div>

            {/* Individual Employers */}
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {filteredEmployers.map((employer) => (
                <Card
                  key={employer.id}
                  className={cn(
                    "transition-all",
                    selectedEmployerIds.includes(employer.id) && "ring-2 ring-blue-500",
                    getRatingColor(employer.trafficLightRating)
                  )}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id={`emp-${employer.id}`}
                        checked={selectedEmployerIds.includes(employer.id)}
                        onCheckedChange={(checked) => handleEmployerToggle(employer.id, checked as boolean)}
                        className="h-5 w-5 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <label
                            htmlFor={`emp-${employer.id}`}
                            className="font-medium text-sm cursor-pointer flex-1 truncate"
                          >
                            {employer.name}
                          </label>
                          {getRatingIcon(employer.trafficLightRating)}
                        </div>
                        <p className="text-xs text-muted-foreground">{employer.roleOrTrade}</p>
                        {employer.trafficLightRating && (
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "mt-1 text-xs",
                              employer.trafficLightRating === 'green' && "text-green-700 border-green-300",
                              employer.trafficLightRating === 'amber' && "text-amber-700 border-amber-300",
                              employer.trafficLightRating === 'red' && "text-red-700 border-red-300"
                            )}
                          >
                            {employer.trafficLightRating.charAt(0).toUpperCase() + employer.trafficLightRating.slice(1)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          {onCancel && (
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
          )}
          <Button
            onClick={handleStartAssessment}
            disabled={selectedEmployerIds.length === 0}
            className="flex-1"
          >
            Start Assessment ({selectedEmployerIds.length})
          </Button>
        </div>
      </div>
    )
  }

  // Render Assessment Step
  if (step === 'assessment' && currentEmployer) {
    if (isLoadingCompliance) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )
    }

    // Prepare employer data for IndividualEmployerAssessment
    const employerData = {
      id: currentEmployer.id,
      name: currentEmployer.name,
      roleOrTrade: currentEmployer.roleOrTrade,
      currentCompliance: currentComplianceData || null,
      currentUnionRespect: currentComplianceData?.unionRespect || null,
      currentSafety: currentComplianceData?.safety || null,
      currentSubcontractor: currentComplianceData?.subcontractor || null,
    }

    return (
      <div className="max-h-[80vh] overflow-y-auto">
        {/* Progress indicator */}
        <div className="sticky top-0 bg-white px-4 py-2 border-b z-10">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Employer {currentEmployerIndex + 1} of {selectedEmployerIds.length}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToSelection}
              className="h-8"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Selection
            </Button>
          </div>
        </div>

        <div className="px-4 py-2">
          <IndividualEmployerAssessment
            token={`inline-${projectId}-${currentEmployer.id}`}
            projectId={projectId}
            employer={employerData}
            onBack={handleBackToSelection}
            onSubmit={handleSubmit}
            onSubmitAndNext={handleSubmitAndNext}
            hasNextIncomplete={hasNextEmployer}
            mode="authenticated"
          />
        </div>
      </div>
    )
  }

  return null
}

