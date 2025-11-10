/**
 * Individual Employer Assessment Form Wrapper
 * 
 * Wraps the assessment form with navigation, save/submit buttons,
 * and draft management for a single employer
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Send, ArrowRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Building, Users, Shield, Building2 } from "lucide-react";
import { saveDraft, loadDraft, clearDraft } from "@/lib/auditFormDraftManager";
import {
  ComplianceFields,
  UnionRespectFields,
  SafetyFields,
  SubcontractorFields,
  EmployerAssessmentData,
} from "./AssessmentFormFields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface IndividualEmployerAssessmentProps {
  token: string;
  projectId: string;
  employer: {
    id: string;
    name: string;
    roleOrTrade?: string;
    currentCompliance: any;
    currentUnionRespect: any;
    currentSafety: any;
    currentSubcontractor: any;
  };
  onBack: () => void;
  onSubmit: (data: EmployerAssessmentData) => Promise<void>;
  onSubmitAndNext: (data: EmployerAssessmentData) => Promise<void>;
  hasNextIncomplete: boolean;
}

export function IndividualEmployerAssessment({
  token,
  projectId,
  employer,
  onBack,
  onSubmit,
  onSubmitAndNext,
  hasNextIncomplete,
}: IndividualEmployerAssessmentProps) {
  const [submitting, setSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);

  // Initialize form data from existing data or draft
  const [formData, setFormData] = useState<EmployerAssessmentData>(() => {
    // Try to load draft first
    const draft = loadDraft(token, employer.id);
    if (draft) {
      return draft.data;
    }

    // Otherwise, initialize from current data
    return {
      // CBUS/INCOLINK
      cbus_check_conducted: employer.currentCompliance?.cbus_check_conducted || false,
      cbus_check_date: employer.currentCompliance?.cbus_check_date || null,
      cbus_payment_status: employer.currentCompliance?.cbus_payment_status || null,
      cbus_payment_timing: employer.currentCompliance?.cbus_payment_timing || null,
      cbus_worker_count_status: employer.currentCompliance?.cbus_worker_count_status || null,
      cbus_enforcement_flag: employer.currentCompliance?.cbus_enforcement_flag || false,
      cbus_followup_required: employer.currentCompliance?.cbus_followup_required || false,
      cbus_notes: employer.currentCompliance?.cbus_notes || null,
      
      incolink_check_conducted: employer.currentCompliance?.incolink_check_conducted || false,
      incolink_check_date: employer.currentCompliance?.incolink_check_date || null,
      incolink_payment_status: employer.currentCompliance?.incolink_payment_status || null,
      incolink_payment_timing: employer.currentCompliance?.incolink_payment_timing || null,
      incolink_worker_count_status: employer.currentCompliance?.incolink_worker_count_status || null,
      incolink_enforcement_flag: employer.currentCompliance?.incolink_enforcement_flag || false,
      incolink_followup_required: employer.currentCompliance?.incolink_followup_required || false,
      incolink_notes: employer.currentCompliance?.incolink_notes || null,
      incolink_company_id: employer.currentCompliance?.incolink_company_id || null,
      
      // Union Respect
      right_of_entry: employer.currentUnionRespect?.criteria?.right_of_entry || 3,
      delegate_accommodation: employer.currentUnionRespect?.criteria?.delegate_accommodation || 3,
      access_to_information: employer.currentUnionRespect?.criteria?.access_to_information || 3,
      access_to_inductions: employer.currentUnionRespect?.criteria?.access_to_inductions || 3,
      eba_status: employer.currentUnionRespect?.criteria?.eba_status || 3,
      union_respect_notes: employer.currentUnionRespect?.notes || '',
      
      // Safety
      safety_management_systems: employer.currentSafety?.safety_criteria?.safety_management_systems || 3,
      incident_reporting: employer.currentSafety?.safety_criteria?.incident_reporting || 3,
      site_safety_culture: employer.currentSafety?.safety_criteria?.site_safety_culture || 3,
      risk_assessment_processes: employer.currentSafety?.safety_criteria?.risk_assessment_processes || 3,
      emergency_preparedness: employer.currentSafety?.safety_criteria?.emergency_preparedness || 3,
      worker_safety_training: employer.currentSafety?.safety_criteria?.worker_safety_training || 3,
      lost_time_injuries: employer.currentSafety?.safety_metrics?.lost_time_injuries || 0,
      near_misses: employer.currentSafety?.safety_metrics?.near_misses || 0,
      safety_breaches: employer.currentSafety?.safety_metrics?.safety_breaches || 0,
      safety_notes: employer.currentSafety?.notes || '',
      
      // Subcontractor
      subcontractor_usage: employer.currentSubcontractor?.subcontracting_criteria?.subcontractor_usage || 3,
      payment_terms: employer.currentSubcontractor?.subcontracting_criteria?.payment_terms || 3,
      treatment_of_subbies: employer.currentSubcontractor?.subcontracting_criteria?.treatment_of_subbies || 3,
      subcontractor_notes: employer.currentSubcontractor?.notes || '',
    };
  });

  // Update form data
  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  // Auto-save draft when data changes
  useEffect(() => {
    if (hasUnsavedChanges) {
      const timeoutId = setTimeout(() => {
        saveDraft(token, employer.id, employer.name, formData);
      }, 1000); // Debounce 1 second

      return () => clearTimeout(timeoutId);
    }
  }, [formData, hasUnsavedChanges, token, employer.id, employer.name]);

  // Handle save draft (manual)
  const handleSaveDraft = () => {
    saveDraft(token, employer.id, employer.name, formData);
    setHasUnsavedChanges(false);
    toast.success('Draft saved locally');
  };

  // Handle submit
  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      await onSubmit(formData);
      clearDraft(token, employer.id);
      setHasUnsavedChanges(false);
      toast.success(`Assessment for ${employer.name} submitted successfully!`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit assessment');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle submit and next
  const handleSubmitAndNext = async () => {
    try {
      setSubmitting(true);
      await onSubmitAndNext(formData);
      clearDraft(token, employer.id);
      setHasUnsavedChanges(false);
      // Toast handled by parent component
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit assessment');
      setSubmitting(false);
    }
  };

  // Handle back with unsaved changes check
  const handleBack = () => {
    if (hasUnsavedChanges) {
      setShowExitDialog(true);
    } else {
      onBack();
    }
  };

  // Confirm exit without saving
  const confirmExit = () => {
    setShowExitDialog(false);
    onBack();
  };

  // Save and exit
  const saveAndExit = () => {
    handleSaveDraft();
    setShowExitDialog(false);
    onBack();
  };

  return (
    <>
      <Card>
        <CardHeader className="space-y-4">
          {/* Breadcrumb Navigation */}
          <Button
            variant="ghost"
            onClick={handleBack}
            className="w-full sm:w-auto justify-start sm:justify-center -ml-2 sm:ml-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Employer List
          </Button>

          {/* Employer Header */}
          <div>
            <CardTitle className="text-xl">{employer.name}</CardTitle>
            {employer.roleOrTrade && (
              <p className="text-sm text-muted-foreground mt-1">{employer.roleOrTrade}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Complete all Track 1 assessments for this employer on this project
            </p>
          </div>

          {/* Draft indicator */}
          {hasUnsavedChanges && (
            <Badge variant="outline" className="w-fit">
              <Save className="h-3 w-3 mr-1" />
              Unsaved changes
            </Badge>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Assessment Sections */}
          <Accordion 
            type="multiple" 
            defaultValue={["compliance", "union", "safety", "subcontractor"]} 
            className="w-full"
          >
            <AccordionItem value="compliance">
              <AccordionTrigger className="text-base font-semibold">
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  CBUS & INCOLINK Compliance
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <ComplianceFields formData={formData} onUpdate={updateFormData} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="union">
              <AccordionTrigger className="text-base font-semibold">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Union Respect Assessment
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <UnionRespectFields formData={formData} onUpdate={updateFormData} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="safety">
              <AccordionTrigger className="text-base font-semibold">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Safety 4-Point Assessment
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <SafetyFields formData={formData} onUpdate={updateFormData} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="subcontractor">
              <AccordionTrigger className="text-base font-semibold">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Subcontractor Use Assessment
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <SubcontractorFields formData={formData} onUpdate={updateFormData} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={!hasUnsavedChanges || submitting}
              className="sm:flex-1"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="sm:flex-1"
            >
              <Send className="h-4 w-4 mr-2" />
              {submitting ? 'Submitting...' : 'Submit'}
            </Button>

            {hasNextIncomplete && (
              <Button
                onClick={handleSubmitAndNext}
                disabled={submitting}
                className="sm:flex-1 bg-green-600 hover:bg-green-700"
              >
                {submitting ? 'Submitting...' : 'Submit & Next'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>

          {/* Bottom Back Button */}
          <div className="pt-4 border-t">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="w-full sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Employer List
            </Button>
          </div>

          {/* Help Text */}
          <div className="text-xs text-muted-foreground text-center pt-2">
            {hasNextIncomplete ? (
              <span>Use "Submit & Next" to quickly move to the next employer</span>
            ) : (
              <span>This is the last employer - return to dashboard after submitting</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Exit Confirmation Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              Unsaved Changes
            </DialogTitle>
            <DialogDescription>
              You have unsaved changes for {employer.name}. What would you like to do?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowExitDialog(false)}
            >
              Keep Editing
            </Button>
            <Button
              variant="outline"
              onClick={confirmExit}
            >
              Discard Changes
            </Button>
            <Button
              onClick={saveAndExit}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Draft & Exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}






