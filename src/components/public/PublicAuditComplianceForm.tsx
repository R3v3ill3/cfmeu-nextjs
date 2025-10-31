"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, AlertCircle, CheckCircle, Clock, Building2, Users, Shield, Building } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { format } from "date-fns";
import { FourPointRating } from "@/types/assessments";
import { UNION_RESPECT_CRITERIA, SAFETY_CRITERIA, SUBCONTRACTOR_CRITERIA, FOUR_POINT_SCALE } from "@/constants/assessment-criteria";

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
}

interface EmployerAssessmentData {
  // CBUS/INCOLINK Compliance
  cbus_check_conducted: boolean;
  cbus_check_date: string | null;
  cbus_payment_status: 'correct' | 'incorrect' | 'uncertain' | null;
  cbus_payment_timing: 'on_time' | 'late' | 'uncertain' | null;
  cbus_worker_count_status: 'correct' | 'incorrect' | null;
  cbus_enforcement_flag: boolean;
  cbus_followup_required: boolean;
  cbus_notes: string | null;
  
  incolink_check_conducted: boolean;
  incolink_check_date: string | null;
  incolink_payment_status: 'correct' | 'incorrect' | 'uncertain' | null;
  incolink_payment_timing: 'on_time' | 'late' | 'uncertain' | null;
  incolink_worker_count_status: 'correct' | 'incorrect' | null;
  incolink_enforcement_flag: boolean;
  incolink_followup_required: boolean;
  incolink_notes: string | null;
  incolink_company_id: string | null;
  
  // Union Respect Assessment (5 criteria)
  right_of_entry: FourPointRating;
  delegate_accommodation: FourPointRating;
  access_to_information: FourPointRating;
  access_to_inductions: FourPointRating;
  eba_status: FourPointRating;
  union_respect_notes: string;
  
  // Safety Assessment (6 criteria)
  safety_management_systems: FourPointRating;
  incident_reporting: FourPointRating;
  site_safety_culture: FourPointRating;
  risk_assessment_processes: FourPointRating;
  emergency_preparedness: FourPointRating;
  worker_safety_training: FourPointRating;
  lost_time_injuries: number;
  near_misses: number;
  safety_breaches: number;
  safety_notes: string;
  
  // Subcontractor Use Assessment (3 criteria)
  subcontractor_usage: FourPointRating;
  payment_terms: FourPointRating;
  treatment_of_subbies: FourPointRating;
  subcontractor_notes: string;
}

interface PublicAuditComplianceFormProps {
  formData: PublicAuditFormData;
}

export function PublicAuditComplianceForm({ formData }: PublicAuditComplianceFormProps) {
  const hasEmployers = formData?.employers && Array.isArray(formData.employers) && formData.employers.length > 0;
  
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  // Initialize comprehensive form data for each employer
  const [employerForms, setEmployerForms] = useState<Record<string, EmployerAssessmentData>>(() => {
    const forms: Record<string, EmployerAssessmentData> = {};
    if (!hasEmployers || !formData.employers) {
      return forms;
    }
    formData.employers.forEach(employer => {
      forms[employer.id] = {
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
        
        // Union Respect (5 criteria)
        right_of_entry: employer.currentUnionRespect?.criteria?.right_of_entry || 3,
        delegate_accommodation: employer.currentUnionRespect?.criteria?.delegate_accommodation || 3,
        access_to_information: employer.currentUnionRespect?.criteria?.access_to_information || 3,
        access_to_inductions: employer.currentUnionRespect?.criteria?.access_to_inductions || 3,
        eba_status: employer.currentUnionRespect?.criteria?.eba_status || 3,
        union_respect_notes: employer.currentUnionRespect?.notes || '',
        
        // Safety (6 criteria)
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
        
        // Subcontractor (3 criteria)
        subcontractor_usage: employer.currentSubcontractor?.subcontracting_criteria?.subcontractor_usage || 3,
        payment_terms: employer.currentSubcontractor?.subcontracting_criteria?.payment_terms || 3,
        treatment_of_subbies: employer.currentSubcontractor?.subcontracting_criteria?.treatment_of_subbies || 3,
        subcontractor_notes: employer.currentSubcontractor?.notes || '',
      };
    });
    return forms;
  });

  const updateEmployerForm = (employerId: string, field: string, value: any) => {
    setEmployerForms(prev => ({
      ...prev,
      [employerId]: {
        ...prev[employerId],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      const employerComplianceUpdates = formData.employers.map(employer => {
        const data = employerForms[employer.id];
        return {
          employerId: employer.id,
          updates: {
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
          },
        };
      });

      const response = await fetch(`/api/public/form-data/${formData.token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employerComplianceUpdates,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit compliance data');
      }

      const result = await response.json();
      
      if (result.success) {
        setSubmitted(true);
        toast.success('All assessments submitted successfully!');
      } else {
        throw new Error(result.error || 'Submission failed');
      }

    } catch (error: any) {
      console.error('Failed to submit assessments:', error);
      toast.error(error.message || 'Failed to submit assessments');
    } finally {
      setSubmitting(false);
    }
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

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Assessments Submitted</h3>
                <p className="text-sm text-muted-foreground">
                  Thank you for completing the comprehensive audit & compliance assessments for {formData.projectName}.
                  Your submissions have been recorded successfully.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-base sm:text-xl font-bold leading-tight">Audit & Compliance Assessment</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">{formData.projectName}</p>
              </div>
            </div>
            <div className="self-start sm:self-auto">
              <Badge variant={expiryInfo.variant} className="gap-1 text-xs">
                <Clock className="h-3 w-3" />
                {expiryInfo.text}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">
        {singleEmployer ? (
          /* Single Employer - Direct Form with Accordions */
          <SingleEmployerComprehensiveForm
            employer={formData.employers[0]}
            formData={employerForms[formData.employers[0].id]}
            onUpdate={(field, value) => updateEmployerForm(formData.employers[0].id, field, value)}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        ) : (
          /* Multiple Employers - Tabbed Interface with Accordions */
          <MultipleEmployersComprehensiveForm
            employers={formData.employers}
            employerForms={employerForms}
            onUpdate={updateEmployerForm}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  );
}

// Single Employer Comprehensive Form
function SingleEmployerComprehensiveForm({
  employer,
  formData,
  onUpdate,
  onSubmit,
  submitting,
}: {
  employer: Employer;
  formData: EmployerAssessmentData;
  onUpdate: (field: string, value: any) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{employer.name}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Complete all Track 1 assessments for this employer on this project
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Accordion type="multiple" defaultValue={["compliance", "union", "safety", "subcontractor"]} className="w-full">
          <AccordionItem value="compliance">
            <AccordionTrigger className="text-base font-semibold">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                CBUS & INCOLINK Compliance
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <ComplianceFields formData={formData} onUpdate={onUpdate} />
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
              <UnionRespectFields formData={formData} onUpdate={onUpdate} />
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
              <SafetyFields formData={formData} onUpdate={onUpdate} />
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
              <SubcontractorFields formData={formData} onUpdate={onUpdate} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        
        <div className="pt-4 border-t">
          <Button onClick={onSubmit} disabled={submitting} className="w-full">
            {submitting ? 'Submitting...' : 'Submit All Assessments'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Multiple Employers Comprehensive Form
function MultipleEmployersComprehensiveForm({
  employers,
  employerForms,
  onUpdate,
  onSubmit,
  submitting,
}: {
  employers: Employer[];
  employerForms: Record<string, EmployerAssessmentData>;
  onUpdate: (employerId: string, field: string, value: any) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Employer Compliance Assessments</CardTitle>
        <p className="text-sm text-muted-foreground">
          Complete all Track 1 assessments for {employers.length} employers
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={employers[0].id} className="w-full">
          <TabsList className="w-full flex-wrap h-auto gap-1">
            {employers.map(employer => (
              <TabsTrigger key={employer.id} value={employer.id} className="flex-1 min-w-[120px]">
                {employer.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {employers.map(employer => (
            <TabsContent key={employer.id} value={employer.id} className="mt-6">
              <Accordion type="multiple" defaultValue={["compliance", "union", "safety", "subcontractor"]} className="w-full">
                <AccordionItem value="compliance">
                  <AccordionTrigger className="text-base font-semibold">
                    <div className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      CBUS & INCOLINK Compliance
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <ComplianceFields 
                      formData={employerForms[employer.id]} 
                      onUpdate={(field, value) => onUpdate(employer.id, field, value)}
                    />
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
                    <UnionRespectFields 
                      formData={employerForms[employer.id]} 
                      onUpdate={(field, value) => onUpdate(employer.id, field, value)}
                    />
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
                    <SafetyFields 
                      formData={employerForms[employer.id]} 
                      onUpdate={(field, value) => onUpdate(employer.id, field, value)}
                    />
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
                    <SubcontractorFields 
                      formData={employerForms[employer.id]} 
                      onUpdate={(field, value) => onUpdate(employer.id, field, value)}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>
          ))}
        </Tabs>

        <div className="pt-6 border-t mt-6">
          <Button onClick={onSubmit} disabled={submitting} className="w-full">
            {submitting ? 'Submitting...' : `Submit All Assessments (${employers.length} employer${employers.length > 1 ? 's' : ''})`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// CBUS & INCOLINK Compliance Fields
function ComplianceFields({
  formData,
  onUpdate,
}: {
  formData: EmployerAssessmentData;
  onUpdate: (field: string, value: any) => void;
}) {
  return (
    <div className="space-y-6">
      {/* CBUS Section */}
      <div className="space-y-4">
        <h4 className="font-medium flex items-center gap-2">
          CBUS Compliance
          {formData.cbus_check_conducted && <Badge variant="default" className="text-xs">Checked</Badge>}
        </h4>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="cbus-conducted"
            checked={formData.cbus_check_conducted}
            onCheckedChange={(checked) => onUpdate('cbus_check_conducted', checked)}
          />
          <Label htmlFor="cbus-conducted" className="text-sm">
            CBUS Check Conducted
          </Label>
        </div>

        <div className="space-y-4 pl-4 border-l-2 border-muted">
          <div className="space-y-2">
            <Label>Check Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <Calendar className="mr-2 h-4 w-4" />
                  {formData.cbus_check_date
                    ? format(new Date(formData.cbus_check_date), "PPP")
                    : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={formData.cbus_check_date ? new Date(formData.cbus_check_date) : undefined}
                  onSelect={(date) => onUpdate('cbus_check_date', date?.toISOString().split('T')[0])}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ThreePointCheckBox
              label="1. Payment Status"
              value={formData.cbus_payment_status}
              onChange={(value) => onUpdate('cbus_payment_status', value)}
            />
            <ThreePointCheckBox
              label="2. Payment Timing"
              value={formData.cbus_payment_timing}
              onChange={(value) => onUpdate('cbus_payment_timing', value)}
              options={['on_time', 'late', 'uncertain']}
            />
            <ThreePointCheckBox
              label="3. Worker Count"
              value={formData.cbus_worker_count_status}
              onChange={(value) => onUpdate('cbus_worker_count_status', value)}
              options={['correct', 'incorrect']}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="cbus-enforcement"
                checked={formData.cbus_enforcement_flag}
                onCheckedChange={(checked) => onUpdate('cbus_enforcement_flag', checked)}
              />
              <Label htmlFor="cbus-enforcement" className="text-sm">Enforcement Required</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="cbus-followup"
                checked={formData.cbus_followup_required}
                onCheckedChange={(checked) => onUpdate('cbus_followup_required', checked)}
              />
              <Label htmlFor="cbus-followup" className="text-sm">Follow-up Required</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Add any additional notes..."
              value={formData.cbus_notes || ''}
              onChange={(e) => onUpdate('cbus_notes', e.target.value)}
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* INCOLINK Section */}
      <div className="space-y-4">
        <h4 className="font-medium flex items-center gap-2">
          INCOLINK Compliance
          {formData.incolink_check_conducted && <Badge variant="default" className="text-xs">Checked</Badge>}
        </h4>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="incolink-conducted"
            checked={formData.incolink_check_conducted}
            onCheckedChange={(checked) => onUpdate('incolink_check_conducted', checked)}
          />
          <Label htmlFor="incolink-conducted" className="text-sm">
            INCOLINK Check Conducted
          </Label>
        </div>

        <div className="space-y-4 pl-4 border-l-2 border-muted">
          <div className="space-y-2">
            <Label>Check Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <Calendar className="mr-2 h-4 w-4" />
                  {formData.incolink_check_date
                    ? format(new Date(formData.incolink_check_date), "PPP")
                    : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={formData.incolink_check_date ? new Date(formData.incolink_check_date) : undefined}
                  onSelect={(date) => onUpdate('incolink_check_date', date?.toISOString().split('T')[0])}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ThreePointCheckBox
              label="1. Payment Status"
              value={formData.incolink_payment_status}
              onChange={(value) => onUpdate('incolink_payment_status', value)}
            />
            <ThreePointCheckBox
              label="2. Payment Timing"
              value={formData.incolink_payment_timing}
              onChange={(value) => onUpdate('incolink_payment_timing', value)}
              options={['on_time', 'late', 'uncertain']}
            />
            <ThreePointCheckBox
              label="3. Worker Count"
              value={formData.incolink_worker_count_status}
              onChange={(value) => onUpdate('incolink_worker_count_status', value)}
              options={['correct', 'incorrect']}
            />
          </div>

          <div className="space-y-2">
            <Label>INCOLINK Company ID (Optional)</Label>
            <Input
              placeholder="Enter company ID..."
              value={formData.incolink_company_id || ''}
              onChange={(e) => onUpdate('incolink_company_id', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="incolink-enforcement"
                checked={formData.incolink_enforcement_flag}
                onCheckedChange={(checked) => onUpdate('incolink_enforcement_flag', checked)}
              />
              <Label htmlFor="incolink-enforcement" className="text-sm">Enforcement Required</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="incolink-followup"
                checked={formData.incolink_followup_required}
                onCheckedChange={(checked) => onUpdate('incolink_followup_required', checked)}
              />
              <Label htmlFor="incolink-followup" className="text-sm">Follow-up Required</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Add any additional notes..."
              value={formData.incolink_notes || ''}
              onChange={(e) => onUpdate('incolink_notes', e.target.value)}
              rows={2}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Union Respect Assessment Fields
function UnionRespectFields({
  formData,
  onUpdate,
}: {
  formData: EmployerAssessmentData;
  onUpdate: (field: string, value: any) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>4-Point Rating Scale:</strong> 1 = Good, 2 = Fair, 3 = Poor, 4 = Terrible
        </p>
      </div>

      {UNION_RESPECT_CRITERIA.map(criterion => (
        <div key={criterion.id} className="space-y-2">
          <Label className="font-medium">{criterion.name}</Label>
          <p className="text-xs text-muted-foreground">{criterion.description}</p>
          <FourPointSelector
            value={formData[criterion.id as keyof EmployerAssessmentData] as FourPointRating}
            onChange={(value) => onUpdate(criterion.id, value)}
          />
        </div>
      ))}

      <div className="space-y-2">
        <Label>Additional Notes</Label>
        <Textarea
          placeholder="Add any context or observations..."
          value={formData.union_respect_notes}
          onChange={(e) => onUpdate('union_respect_notes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

// Safety 4-Point Assessment Fields
function SafetyFields({
  formData,
  onUpdate,
}: {
  formData: EmployerAssessmentData;
  onUpdate: (field: string, value: any) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>4-Point Rating Scale:</strong> 1 = Good, 2 = Fair, 3 = Poor, 4 = Terrible
        </p>
      </div>

      <div className="space-y-4">
        <h5 className="font-medium">Safety Criteria</h5>
        {SAFETY_CRITERIA.map(criterion => (
          <div key={criterion.id} className="space-y-2">
            <Label className="font-medium text-sm">{criterion.name}</Label>
            <p className="text-xs text-muted-foreground">{criterion.description}</p>
            <FourPointSelector
              value={formData[criterion.id as keyof EmployerAssessmentData] as FourPointRating}
              onChange={(value) => onUpdate(criterion.id, value)}
            />
          </div>
        ))}
      </div>

      <div className="space-y-4 border-t pt-4">
        <h5 className="font-medium">Safety Metrics</h5>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Lost Time Injuries</Label>
            <Input
              type="number"
              min="0"
              value={formData.lost_time_injuries}
              onChange={(e) => onUpdate('lost_time_injuries', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Near Misses</Label>
            <Input
              type="number"
              min="0"
              value={formData.near_misses}
              onChange={(e) => onUpdate('near_misses', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Safety Breaches</Label>
            <Input
              type="number"
              min="0"
              value={formData.safety_breaches}
              onChange={(e) => onUpdate('safety_breaches', parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Safety Notes</Label>
        <Textarea
          placeholder="Add safety observations..."
          value={formData.safety_notes}
          onChange={(e) => onUpdate('safety_notes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

// Subcontractor Use Assessment Fields
function SubcontractorFields({
  formData,
  onUpdate,
}: {
  formData: EmployerAssessmentData;
  onUpdate: (field: string, value: any) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>4-Point Rating Scale:</strong> 1 = Good, 2 = Fair, 3 = Poor, 4 = Terrible
        </p>
      </div>

      {SUBCONTRACTOR_CRITERIA.map(criterion => (
        <div key={criterion.id} className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="font-medium text-sm">{criterion.name}</Label>
            {criterion.weight && criterion.weight !== 1.0 && (
              <Badge variant="outline" className="text-xs">
                Weight: {criterion.weight}x
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{criterion.description}</p>
          <FourPointSelector
            value={formData[criterion.id as keyof EmployerAssessmentData] as FourPointRating}
            onChange={(value) => onUpdate(criterion.id, value)}
          />
        </div>
      ))}

      <div className="space-y-2">
        <Label>Subcontractor Notes</Label>
        <Textarea
          placeholder="Add observations about subcontractor practices..."
          value={formData.subcontractor_notes}
          onChange={(e) => onUpdate('subcontractor_notes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

// 4-Point Rating Selector Component
function FourPointSelector({
  value,
  onChange,
}: {
  value: FourPointRating;
  onChange: (value: FourPointRating) => void;
}) {
  return (
    <RadioGroup value={value?.toString()} onValueChange={(v) => onChange(parseInt(v) as FourPointRating)}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Object.entries(FOUR_POINT_SCALE).map(([key, rating]) => (
          <div key={key} className="flex items-center space-x-2">
            <RadioGroupItem value={key} id={`rating-${value}-${key}`} />
            <Label 
              htmlFor={`rating-${value}-${key}`}
              className="flex items-center gap-2 cursor-pointer text-sm"
            >
              <div className={cn("w-3 h-3 rounded-full", rating.color)} />
              {rating.label}
            </Label>
          </div>
        ))}
      </div>
    </RadioGroup>
  );
}

// 3-Point Check Box Component
function ThreePointCheckBox({
  label,
  value,
  onChange,
  options = ['correct', 'incorrect', 'uncertain'],
}: {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  options?: string[];
}) {
  const getColor = (val: string | null) => {
    if (val === 'correct' || val === 'on_time') return 'border-green-500 bg-green-50';
    if (val === 'incorrect' || val === 'late') return 'border-red-500 bg-red-50';
    if (val === 'uncertain') return 'border-yellow-500 bg-yellow-50';
    return 'border-gray-200 bg-gray-50';
  };

  const getIcon = (val: string) => {
    if (val === 'correct' || val === 'on_time') return '✅';
    if (val === 'incorrect' || val === 'late') return '❌';
    if (val === 'uncertain') return '❓';
    return '';
  };

  const getLabel = (val: string) => {
    if (val === 'correct') return 'Correct';
    if (val === 'incorrect') return 'Incorrect';
    if (val === 'uncertain') return 'Uncertain';
    if (val === 'on_time') return 'On Time';
    if (val === 'late') return 'Late';
    return val;
  };

  return (
    <div className={cn("p-3 border-2 rounded-lg transition-all", getColor(value))}>
      <Label className="font-medium block mb-2 text-sm">{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt} value={opt}>
              {getIcon(opt)} {getLabel(opt)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
