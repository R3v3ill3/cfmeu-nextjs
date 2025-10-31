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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, Check, X, AlertCircle, CheckCircle, Clock, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";

interface Employer {
  id: string;
  name: string;
  currentCompliance: any;
}

interface PublicAuditFormData {
  token: string;
  resourceType: string;
  expiresAt: string;
  projectId: string;
  projectName: string;
  employers: Employer[];
}

interface EmployerComplianceFormData {
  cbus_check_conducted: boolean;
  cbus_check_date: string | null;
  cbus_checked_by: string[];
  cbus_payment_status: 'correct' | 'incorrect' | 'uncertain' | null;
  cbus_payment_timing: 'on_time' | 'late' | 'uncertain' | null;
  cbus_worker_count_status: 'correct' | 'incorrect' | null;
  cbus_enforcement_flag: boolean;
  cbus_followup_required: boolean;
  cbus_notes: string | null;
  
  incolink_check_conducted: boolean;
  incolink_check_date: string | null;
  incolink_checked_by: string[];
  incolink_payment_status: 'correct' | 'incorrect' | 'uncertain' | null;
  incolink_payment_timing: 'on_time' | 'late' | 'uncertain' | null;
  incolink_worker_count_status: 'correct' | 'incorrect' | null;
  incolink_enforcement_flag: boolean;
  incolink_followup_required: boolean;
  incolink_notes: string | null;
  incolink_company_id: string | null;
}

interface PublicAuditComplianceFormProps {
  formData: PublicAuditFormData;
}

export function PublicAuditComplianceForm({ formData }: PublicAuditComplianceFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  // Initialize form data for each employer
  const [employerForms, setEmployerForms] = useState<Record<string, EmployerComplianceFormData>>(() => {
    const forms: Record<string, EmployerComplianceFormData> = {};
    formData.employers.forEach(employer => {
      forms[employer.id] = {
        cbus_check_conducted: employer.currentCompliance?.cbus_check_conducted || false,
        cbus_check_date: employer.currentCompliance?.cbus_check_date || null,
        cbus_checked_by: employer.currentCompliance?.cbus_checked_by || [],
        cbus_payment_status: employer.currentCompliance?.cbus_payment_status || null,
        cbus_payment_timing: employer.currentCompliance?.cbus_payment_timing || null,
        cbus_worker_count_status: employer.currentCompliance?.cbus_worker_count_status || null,
        cbus_enforcement_flag: employer.currentCompliance?.cbus_enforcement_flag || false,
        cbus_followup_required: employer.currentCompliance?.cbus_followup_required || false,
        cbus_notes: employer.currentCompliance?.cbus_notes || null,
        
        incolink_check_conducted: employer.currentCompliance?.incolink_check_conducted || false,
        incolink_check_date: employer.currentCompliance?.incolink_check_date || null,
        incolink_checked_by: employer.currentCompliance?.incolink_checked_by || [],
        incolink_payment_status: employer.currentCompliance?.incolink_payment_status || null,
        incolink_payment_timing: employer.currentCompliance?.incolink_payment_timing || null,
        incolink_worker_count_status: employer.currentCompliance?.incolink_worker_count_status || null,
        incolink_enforcement_flag: employer.currentCompliance?.incolink_enforcement_flag || false,
        incolink_followup_required: employer.currentCompliance?.incolink_followup_required || false,
        incolink_notes: employer.currentCompliance?.incolink_notes || null,
        incolink_company_id: employer.currentCompliance?.incolink_company_id || null,
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

      const employerComplianceUpdates = formData.employers.map(employer => ({
        employerId: employer.id,
        updates: employerForms[employer.id],
      }));

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
        toast.success('Compliance data submitted successfully!');
      } else {
        throw new Error(result.error || 'Submission failed');
      }

    } catch (error: any) {
      console.error('Failed to submit compliance data:', error);
      toast.error(error.message || 'Failed to submit compliance data');
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

  const expiryInfo = formatExpiryTime(formData.expiresAt);
  const singleEmployer = formData.employers.length === 1;

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
                <h3 className="text-lg font-semibold">Compliance Data Submitted</h3>
                <p className="text-sm text-muted-foreground">
                  Thank you for completing the audit & compliance assessment for {formData.projectName}.
                  Your submission has been recorded successfully.
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
          /* Single Employer - Direct Form */
          <SingleEmployerForm
            employer={formData.employers[0]}
            formData={employerForms[formData.employers[0].id]}
            onUpdate={(field, value) => updateEmployerForm(formData.employers[0].id, field, value)}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        ) : (
          /* Multiple Employers - Tabbed Interface */
          <MultipleEmployersForm
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

// Single Employer Form Component
function SingleEmployerForm({
  employer,
  formData,
  onUpdate,
  onSubmit,
  submitting,
}: {
  employer: Employer;
  formData: EmployerComplianceFormData;
  onUpdate: (field: string, value: any) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{employer.name}</CardTitle>
        <p className="text-sm text-muted-foreground">Complete the compliance assessment below</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <ComplianceFormFields formData={formData} onUpdate={onUpdate} />
        
        <div className="pt-4 border-t">
          <Button onClick={onSubmit} disabled={submitting} className="w-full">
            {submitting ? 'Submitting...' : 'Submit Compliance Assessment'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Multiple Employers Form Component
function MultipleEmployersForm({
  employers,
  employerForms,
  onUpdate,
  onSubmit,
  submitting,
}: {
  employers: Employer[];
  employerForms: Record<string, EmployerComplianceFormData>;
  onUpdate: (employerId: string, field: string, value: any) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Employer Compliance Assessments</CardTitle>
        <p className="text-sm text-muted-foreground">
          Complete compliance assessments for {employers.length} employers
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={employers[0].id} className="w-full">
          <TabsList className="w-full flex-wrap h-auto">
            {employers.map(employer => (
              <TabsTrigger key={employer.id} value={employer.id} className="flex-1">
                {employer.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {employers.map(employer => (
            <TabsContent key={employer.id} value={employer.id} className="space-y-6 mt-6">
              <ComplianceFormFields
                formData={employerForms[employer.id]}
                onUpdate={(field, value) => onUpdate(employer.id, field, value)}
              />
            </TabsContent>
          ))}
        </Tabs>

        <div className="pt-6 border-t mt-6">
          <Button onClick={onSubmit} disabled={submitting} className="w-full">
            {submitting ? 'Submitting...' : `Submit All Assessments (${employers.length})`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Compliance Form Fields Component (reusable)
function ComplianceFormFields({
  formData,
  onUpdate,
}: {
  formData: EmployerComplianceFormData;
  onUpdate: (field: string, value: any) => void;
}) {
  return (
    <div className="space-y-6">
      {/* CBUS Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b">
          <h3 className="text-lg font-semibold">CBUS Compliance</h3>
          {formData.cbus_check_conducted && (
            <Badge variant="default" className="text-xs">Checked</Badge>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="cbus-conducted"
            checked={formData.cbus_check_conducted}
            onCheckedChange={(checked) => onUpdate('cbus_check_conducted', checked)}
          />
          <Label htmlFor="cbus-conducted" className="text-sm font-medium">
            CBUS Check Conducted
          </Label>
        </div>

        {formData.cbus_check_conducted && (
          <div className="space-y-4 pl-6 border-l-2 border-muted">
            <div className="space-y-2">
              <Label htmlFor="cbus-date">Check Date</Label>
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className={cn(
                "p-4 border-2 rounded-lg transition-all cursor-pointer",
                formData.cbus_payment_status === 'correct' ? "border-green-500 bg-green-50" :
                formData.cbus_payment_status === 'incorrect' ? "border-red-500 bg-red-50" :
                formData.cbus_payment_status === 'uncertain' ? "border-yellow-500 bg-yellow-50" :
                "border-gray-200 bg-gray-50"
              )}>
                <Label className="font-medium block mb-2">1. Payment Status</Label>
                <Select
                  value={formData.cbus_payment_status || undefined}
                  onValueChange={(value) => onUpdate('cbus_payment_status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="correct">✅ Correct</SelectItem>
                    <SelectItem value="incorrect">❌ Incorrect</SelectItem>
                    <SelectItem value="uncertain">❓ Uncertain</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className={cn(
                "p-4 border-2 rounded-lg transition-all cursor-pointer",
                formData.cbus_payment_timing === 'on_time' ? "border-green-500 bg-green-50" :
                formData.cbus_payment_timing === 'late' ? "border-red-500 bg-red-50" :
                formData.cbus_payment_timing === 'uncertain' ? "border-yellow-500 bg-yellow-50" :
                "border-gray-200 bg-gray-50"
              )}>
                <Label className="font-medium block mb-2">2. Payment Timing</Label>
                <Select
                  value={formData.cbus_payment_timing || undefined}
                  onValueChange={(value) => onUpdate('cbus_payment_timing', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select timing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_time">✅ On Time</SelectItem>
                    <SelectItem value="late">❌ Late</SelectItem>
                    <SelectItem value="uncertain">❓ Uncertain</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className={cn(
                "p-4 border-2 rounded-lg transition-all cursor-pointer",
                formData.cbus_worker_count_status === 'correct' ? "border-green-500 bg-green-50" :
                formData.cbus_worker_count_status === 'incorrect' ? "border-red-500 bg-red-50" :
                "border-gray-200 bg-gray-50"
              )}>
                <Label className="font-medium block mb-2">3. Worker Count</Label>
                <Select
                  value={formData.cbus_worker_count_status || undefined}
                  onValueChange={(value) => onUpdate('cbus_worker_count_status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="correct">✅ Correct</SelectItem>
                    <SelectItem value="incorrect">❌ Incorrect</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cbus-enforcement"
                  checked={formData.cbus_enforcement_flag}
                  onCheckedChange={(checked) => onUpdate('cbus_enforcement_flag', checked)}
                />
                <Label htmlFor="cbus-enforcement" className="text-sm">
                  Enforcement Required
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cbus-followup"
                  checked={formData.cbus_followup_required}
                  onCheckedChange={(checked) => onUpdate('cbus_followup_required', checked)}
                />
                <Label htmlFor="cbus-followup" className="text-sm">
                  Follow-up Required
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cbus-notes">Notes</Label>
              <Textarea
                id="cbus-notes"
                placeholder="Add any additional notes..."
                value={formData.cbus_notes || ''}
                onChange={(e) => onUpdate('cbus_notes', e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}
      </div>

      {/* INCOLINK Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b">
          <h3 className="text-lg font-semibold">INCOLINK Compliance</h3>
          {formData.incolink_check_conducted && (
            <Badge variant="default" className="text-xs">Checked</Badge>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="incolink-conducted"
            checked={formData.incolink_check_conducted}
            onCheckedChange={(checked) => onUpdate('incolink_check_conducted', checked)}
          />
          <Label htmlFor="incolink-conducted" className="text-sm font-medium">
            INCOLINK Check Conducted
          </Label>
        </div>

        {formData.incolink_check_conducted && (
          <div className="space-y-4 pl-6 border-l-2 border-muted">
            <div className="space-y-2">
              <Label htmlFor="incolink-date">Check Date</Label>
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className={cn(
                "p-4 border-2 rounded-lg transition-all cursor-pointer",
                formData.incolink_payment_status === 'correct' ? "border-green-500 bg-green-50" :
                formData.incolink_payment_status === 'incorrect' ? "border-red-500 bg-red-50" :
                formData.incolink_payment_status === 'uncertain' ? "border-yellow-500 bg-yellow-50" :
                "border-gray-200 bg-gray-50"
              )}>
                <Label className="font-medium block mb-2">1. Payment Status</Label>
                <Select
                  value={formData.incolink_payment_status || undefined}
                  onValueChange={(value) => onUpdate('incolink_payment_status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="correct">✅ Correct</SelectItem>
                    <SelectItem value="incorrect">❌ Incorrect</SelectItem>
                    <SelectItem value="uncertain">❓ Uncertain</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className={cn(
                "p-4 border-2 rounded-lg transition-all cursor-pointer",
                formData.incolink_payment_timing === 'on_time' ? "border-green-500 bg-green-50" :
                formData.incolink_payment_timing === 'late' ? "border-red-500 bg-red-50" :
                formData.incolink_payment_timing === 'uncertain' ? "border-yellow-500 bg-yellow-50" :
                "border-gray-200 bg-gray-50"
              )}>
                <Label className="font-medium block mb-2">2. Payment Timing</Label>
                <Select
                  value={formData.incolink_payment_timing || undefined}
                  onValueChange={(value) => onUpdate('incolink_payment_timing', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select timing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_time">✅ On Time</SelectItem>
                    <SelectItem value="late">❌ Late</SelectItem>
                    <SelectItem value="uncertain">❓ Uncertain</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className={cn(
                "p-4 border-2 rounded-lg transition-all cursor-pointer",
                formData.incolink_worker_count_status === 'correct' ? "border-green-500 bg-green-50" :
                formData.incolink_worker_count_status === 'incorrect' ? "border-red-500 bg-red-50" :
                "border-gray-200 bg-gray-50"
              )}>
                <Label className="font-medium block mb-2">3. Worker Count</Label>
                <Select
                  value={formData.incolink_worker_count_status || undefined}
                  onValueChange={(value) => onUpdate('incolink_worker_count_status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="correct">✅ Correct</SelectItem>
                    <SelectItem value="incorrect">❌ Incorrect</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="incolink-company-id">INCOLINK Company ID (Optional)</Label>
              <Input
                id="incolink-company-id"
                placeholder="Enter company ID..."
                value={formData.incolink_company_id || ''}
                onChange={(e) => onUpdate('incolink_company_id', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="incolink-enforcement"
                  checked={formData.incolink_enforcement_flag}
                  onCheckedChange={(checked) => onUpdate('incolink_enforcement_flag', checked)}
                />
                <Label htmlFor="incolink-enforcement" className="text-sm">
                  Enforcement Required
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="incolink-followup"
                  checked={formData.incolink_followup_required}
                  onCheckedChange={(checked) => onUpdate('incolink_followup_required', checked)}
                />
                <Label htmlFor="incolink-followup" className="text-sm">
                  Follow-up Required
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="incolink-notes">Notes</Label>
              <Textarea
                id="incolink-notes"
                placeholder="Add any additional notes..."
                value={formData.incolink_notes || ''}
                onChange={(e) => onUpdate('incolink_notes', e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

