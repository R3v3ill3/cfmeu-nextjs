"use client"

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { IndividualEmployerAssessment } from '@/components/public/IndividualEmployerAssessment'
import { Loader2 } from 'lucide-react'
import { EmployerAssessmentData } from '@/components/public/AssessmentFormFields'
import { useUpsertEmployerCompliance } from '@/components/projects/compliance/hooks/useEmployerCompliance'
import { toast } from 'sonner'

export default function MobileIndividualAssessmentPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  const employerId = params.employerId as string

  // Get selected employer IDs from sessionStorage
  const getSelectedEmployerIds = (): string[] => {
    if (typeof window === 'undefined') return []
    const stored = sessionStorage.getItem(`assessment-employers-${projectId}`)
    return stored ? JSON.parse(stored) : [employerId]
  }

  const selectedEmployerIds = getSelectedEmployerIds()
  const currentIndex = selectedEmployerIds.indexOf(employerId)
  const hasNextIncomplete = currentIndex < selectedEmployerIds.length - 1
  const nextEmployerId = hasNextIncomplete ? selectedEmployerIds[currentIndex + 1] : null

  // Fetch employer data
  const { data: employerData, isLoading: isLoadingEmployer } = useQuery({
    queryKey: ['employer', employerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employers')
        .select('id, name')
        .eq('id', employerId)
        .single()

      if (error) throw error
      return data
    },
  })

  // Fetch existing compliance data
  const { data: complianceData } = useQuery({
    queryKey: ['employer-compliance', projectId, employerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employer_compliance_checks')
        .select('*')
        .eq('project_id', projectId)
        .eq('employer_id', employerId)
        .eq('is_current', true)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') throw error // PGRST116 is "not found"
      return data
    },
  })

  // Fetch employer role/trade from project assignments
  const { data: roleData } = useQuery({
    queryKey: ['employer-role', projectId, employerId],
    queryFn: async () => {
      const { data: assignments } = await supabase
        .from('project_assignments')
        .select('role')
        .eq('project_id', projectId)
        .eq('employer_id', employerId)
        .limit(1)
        .maybeSingle()

      return assignments?.role || null
    },
  })

  const upsertCompliance = useUpsertEmployerCompliance(projectId)

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

  const submitAllAssessments = async (data: EmployerAssessmentData) => {
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
  }

  const handleSubmit = async (data: EmployerAssessmentData) => {
    try {
      await submitAllAssessments(data)
      toast.success(`Assessment for ${employerData?.name} submitted successfully!`)
      
      // Navigate back to selection page
      router.push(`/mobile/projects/${projectId}/assessments`)
    } catch (error: any) {
      console.error('Error submitting assessment:', error)
      toast.error(error.message || 'Failed to submit assessment')
      throw error
    }
  }

  const handleSubmitAndNext = async (data: EmployerAssessmentData) => {
    try {
      await submitAllAssessments(data)
      toast.success(`Assessment for ${employerData?.name} submitted!`)
      
      // Navigate to next employer
      if (nextEmployerId) {
        router.push(`/mobile/projects/${projectId}/assessments/${nextEmployerId}`)
      } else {
        // No more employers, go back to selection
        router.push(`/mobile/projects/${projectId}/assessments`)
      }
    } catch (error: any) {
      console.error('Error submitting assessment:', error)
      toast.error(error.message || 'Failed to submit assessment')
      throw error
    }
  }

  const handleBack = () => {
    router.push(`/mobile/projects/${projectId}/assessments`)
  }

  if (isLoadingEmployer) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
          <p className="text-sm text-muted-foreground">Loading employer data...</p>
        </div>
      </div>
    )
  }

  if (!employerData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Employer not found</h2>
          <p className="text-gray-600">The employer you're looking for doesn't exist or you don't have access to it.</p>
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  // Prepare employer data for IndividualEmployerAssessment
  const employer = {
    id: employerData.id,
    name: employerData.name,
    roleOrTrade: roleData || undefined,
    currentCompliance: complianceData || null,
    currentUnionRespect: complianceData?.unionRespect || null,
    currentSafety: complianceData?.safety || null,
    currentSubcontractor: complianceData?.subcontractor || null,
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-safe-bottom">
      <IndividualEmployerAssessment
        token={`mobile-${projectId}-${employerId}`} // Use a unique token for mobile mode
        projectId={projectId}
        employer={employer}
        onBack={handleBack}
        onSubmit={handleSubmit}
        onSubmitAndNext={handleSubmitAndNext}
        hasNextIncomplete={hasNextIncomplete}
        mode="authenticated" // Pass authenticated mode
      />
    </div>
  )
}

