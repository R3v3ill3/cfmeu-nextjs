"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertCircle, CheckCircle, Clock, Building2 } from "lucide-react";
import { EmployerSelectionDashboard } from "./EmployerSelectionDashboard";
import { IndividualEmployerAssessment } from "./IndividualEmployerAssessment";
import { useAuditFormProgress } from "@/hooks/useAuditFormProgress";
import { clearAllDrafts, clearProgress, getDraftCount } from "@/lib/auditFormDraftManager";
import { EmployerAssessmentData } from "./AssessmentFormFields";

interface Employer {
  id: string;
  name: string;
  currentCompliance: any;
  currentUnionRespect: any;
  currentSafety: any;
  currentSubcontractor: any;
}

interface PublicAuditFormData {
  token: string;
  resourceType: string;
  expiresAt: string;
  projectId: string;
  projectName: string;
  employers: Employer[];
  submittedEmployers: string[];
}

interface PublicAuditComplianceFormProps {
  formData: PublicAuditFormData;
}

export function PublicAuditComplianceForm({ formData }: PublicAuditComplianceFormProps) {
  const hasEmployers = formData?.employers && Array.isArray(formData.employers) && formData.employers.length > 0;
  
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);

  // Enrich employers with roleOrTrade field
  const enrichedEmployers = useMemo(() => {
    if (!formData?.employers) return [];
    return formData.employers.map(emp => ({
      ...emp,
      roleOrTrade: 'Employer', // You could enhance this by fetching from mapping data
    }));
  }, [formData?.employers]);

  // Use progress hook
  const {
    selectedEmployerId,
    inProgressEmployers,
    selectEmployer,
    deselectEmployer,
    getNextIncompleteEmployer,
    completedCount,
    totalCount,
    allComplete,
  } = useAuditFormProgress({
    token: formData?.token || '',
    employers: enrichedEmployers,
    submittedEmployers: formData?.submittedEmployers || [],
  });

  const draftCount = getDraftCount(formData?.token || '');

  // Handle individual employer submission
  const handleEmployerSubmit = async (data: EmployerAssessmentData) => {
    const employerComplianceUpdates = [{
      employerId: selectedEmployerId!,
      updates: buildUpdatePayload(data),
    }];

    const response = await fetch(`/api/public/form-data/${formData.token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employerComplianceUpdates }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to submit assessment');
    }

    // Return to dashboard
    deselectEmployer();
    
    // Reload page data to get updated submittedEmployers
    window.location.reload();
  };

  // Handle submit and next
  const handleEmployerSubmitAndNext = async (data: EmployerAssessmentData) => {
    const employerComplianceUpdates = [{
      employerId: selectedEmployerId!,
      updates: buildUpdatePayload(data),
    }];

    const response = await fetch(`/api/public/form-data/${formData.token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employerComplianceUpdates }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to submit assessment');
    }

    const currentEmployer = enrichedEmployers.find(e => e.id === selectedEmployerId);
    toast.success(`Assessment for ${currentEmployer?.name} submitted!`);

    // Find next incomplete employer
    const nextEmployerId = getNextIncompleteEmployer();
    
    if (nextEmployerId && nextEmployerId !== selectedEmployerId) {
      // Navigate to next
      selectEmployer(nextEmployerId);
      // Reload to get updated data
      window.location.reload();
    } else {
      // No more employers, return to dashboard
      deselectEmployer();
      window.location.reload();
    }
  };

  // Handle finalize (mark token as complete)
  const handleFinalize = async () => {
    try {
      setFinalizing(true);

      const response = await fetch(`/api/public/form-data/${formData.token}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to finalize form');
      }

      const result = await response.json();
      
      // Clear all local data
      clearAllDrafts(formData.token);
      clearProgress(formData.token);
      
      setFinalized(true);
      toast.success(result.message || 'Audit form completed successfully!');

    } catch (error: any) {
      console.error('Failed to finalize:', error);
      toast.error(error.message || 'Failed to finalize form');
    } finally {
      setFinalizing(false);
    }
  };

  // Build update payload from form data
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
    };
  };

  const formatExpiryTime = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const hoursRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    if (hoursRemaining <= 0) {
      return { text: 'Expired', variant: 'destructive' as const };
    } else if (hoursRemaining < 24) {
      return { 
        text: `${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'} remaining`, 
        variant: hoursRemaining < 6 ? 'destructive' as const : 'secondary' as const 
      };
    } else {
      const daysRemaining = Math.ceil(hoursRemaining / 24);
      return { 
        text: `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`, 
        variant: 'default' as const 
      };
    }
  };

  const expiryInfo = hasEmployers ? formatExpiryTime(formData.expiresAt) : { text: 'Expired', variant: 'destructive' as const };
  const singleEmployer = hasEmployers && formData.employers.length === 1;

  // Get selected employer data
  const selectedEmployer = selectedEmployerId 
    ? enrichedEmployers.find(e => e.id === selectedEmployerId)
    : null;

  // Render error state if no employers (AFTER all hooks)
  if (!hasEmployers) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">No Employers Selected</h3>
                <p className="text-sm text-muted-foreground">
                  This audit form has no employers assigned. Please contact the person who shared this link.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render success state after finalization
  if (finalized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Audit Form Completed!</h3>
                <p className="text-sm text-muted-foreground">
                  Thank you for completing comprehensive assessments for all {totalCount} employers on {formData.projectName}.
                  All submissions have been recorded successfully.
                </p>
              </div>
              <div className="pt-4">
                <Badge variant="outline" className="text-sm">
                  {completedCount} of {totalCount} employers assessed
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // For single employer, auto-select it if not already selected
  const effectiveSelectedEmployer = singleEmployer && !selectedEmployerId 
    ? enrichedEmployers[0] 
    : selectedEmployer;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-base sm:text-xl font-bold leading-tight">
                  {selectedEmployerId || singleEmployer ? 'Employer Assessment' : 'Audit & Compliance Assessment'}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground">{formData.projectName}</p>
              </div>
            </div>
            <div className="self-start sm:self-auto flex items-center gap-2">
              {!selectedEmployerId && !singleEmployer && (
                <Badge variant="outline" className="gap-1 text-xs">
                  {completedCount} / {totalCount}
                </Badge>
              )}
              <Badge variant={expiryInfo.variant} className="gap-1 text-xs">
                <Clock className="h-3 w-3" />
                {expiryInfo.text}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {singleEmployer ? (
          /* Single Employer - Direct Form (no dashboard) */
          effectiveSelectedEmployer && (
            <IndividualEmployerAssessment
              token={formData.token}
              projectId={formData.projectId}
              employer={effectiveSelectedEmployer}
              onBack={deselectEmployer}
              onSubmit={async (data) => {
                await handleEmployerSubmit(data);
              }}
              onSubmitAndNext={async (data) => {
                await handleEmployerSubmit(data);
              }}
              hasNextIncomplete={false}
            />
          )
        ) : (
          /* Multiple Employers - Dashboard or Individual Form */
          <>
            {!selectedEmployerId ? (
              /* Show Dashboard */
              <EmployerSelectionDashboard
                token={formData.token}
                employers={enrichedEmployers}
                submittedEmployers={formData.submittedEmployers || []}
                inProgressEmployers={inProgressEmployers}
                onSelectEmployer={selectEmployer}
                onFinalize={handleFinalize}
                draftCount={draftCount}
              />
            ) : (
              /* Show Individual Employer Form */
              selectedEmployer && (
                <IndividualEmployerAssessment
                  token={formData.token}
                  projectId={formData.projectId}
                  employer={selectedEmployer}
                  onBack={deselectEmployer}
                  onSubmit={handleEmployerSubmit}
                  onSubmitAndNext={handleEmployerSubmitAndNext}
                  hasNextIncomplete={!!getNextIncompleteEmployer()}
                />
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
