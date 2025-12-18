"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  Save, 
  Shield, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  BarChart3,
  Info
} from "lucide-react";
import { useEmployerCompliance, useUpsertEmployerCompliance } from "./hooks/useEmployerCompliance";
import { ComplianceChecker, PaymentStatus, PaymentTiming, WorkerCountStatus, EmployerComplianceCheck } from "@/types/compliance";
import { format } from "date-fns";
import { toast } from "sonner";
// Removed external assessment components - using inline forms for better mobile UX

interface EmployerComplianceDetailMobileProps {
  projectId: string;
  employerId: string;
  employerName: string;
}

export function EmployerComplianceDetailMobile({ 
  projectId, 
  employerId, 
  employerName 
}: EmployerComplianceDetailMobileProps) {
  const { data: compliance = [] } = useEmployerCompliance(projectId, employerId);
  const upsertCompliance = useUpsertEmployerCompliance(projectId);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("compliance");
  const [expandedComplianceForm, setExpandedComplianceForm] = useState<'cbus' | 'incolink' | null>(null);

  const currentCompliance = compliance[0] || {
    cbus_check_conducted: false,
    incolink_check_conducted: false,
    cbus_enforcement_flag: false,
    incolink_enforcement_flag: false,
    cbus_followup_required: false,
    incolink_followup_required: false,
    // CBUS 3-point check fields
    cbus_payment_status: null,
    cbus_payment_timing: null,
    cbus_worker_count_status: null,
    cbus_check_date: null,
    cbus_checked_by: [],
    cbus_notes: null,
    // INCOLINK 3-point check fields
    incolink_payment_status: null,
    incolink_payment_timing: null,
    incolink_worker_count_status: null,
    incolink_check_date: null,
    incolink_checked_by: [],
    incolink_notes: null,
    // Sham contracting detection
    sham_contracting_detected: false,
    sham_contracting_detected_date: null,
    sham_contracting_detected_by: null,
    sham_contracting_detection_notes: null,
    sham_contracting_cleared_date: null,
    sham_contracting_cleared_by: null,
    sham_contracting_clearing_reason: null
  };

  const [formData, setFormData] = useState(currentCompliance);

  // Sync formData when compliance data changes
  useEffect(() => {
    if (compliance.length > 0 && currentCompliance) {
      const currentId = currentCompliance.id;
      if (currentId && formData.id && currentId === formData.id) {
        const currentJson = JSON.stringify(currentCompliance);
        const formJson = JSON.stringify(formData);
        if (currentJson !== formJson) {
          setFormData(currentCompliance as any);
        }
      } else if (!formData.id || (currentId && currentId !== formData.id)) {
        setFormData(currentCompliance as any);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compliance]);

  const handleFieldChange = (field: string, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      setHasChanges(true);

      // Auto-enable "Check Conducted" and set date when all 3 CBUS selections are made
      if (field.startsWith('cbus_payment_') || field === 'cbus_worker_count_status') {
        const allThreeSelected = 
          updated.cbus_payment_status !== null &&
          updated.cbus_payment_timing !== null &&
          updated.cbus_worker_count_status !== null;
        
        if (allThreeSelected && !updated.cbus_check_conducted) {
          updated.cbus_check_conducted = true;
          if (!updated.cbus_check_date) {
            updated.cbus_check_date = new Date().toISOString().split('T')[0];
          }
        }
      }

      // Auto-enable "Check Conducted" and set date when all 3 INCOLINK selections are made
      if (field.startsWith('incolink_payment_') || field === 'incolink_worker_count_status') {
        const allThreeSelected = 
          updated.incolink_payment_status !== null &&
          updated.incolink_payment_timing !== null &&
          updated.incolink_worker_count_status !== null;
        
        if (allThreeSelected && !updated.incolink_check_conducted) {
          updated.incolink_check_conducted = true;
          if (!updated.incolink_check_date) {
            updated.incolink_check_date = new Date().toISOString().split('T')[0];
          }
        }
      }

      return updated;
    });
  };

  // Helper function to clean data before sending to database
  const cleanComplianceData = (data: any): Partial<EmployerComplianceCheck> => {
    const excludeFields = [
      'id', 'created_at', 'updated_at', 'effective_from', 'effective_to', 
      'version', 'is_current', 'updated_by', 'employers'
    ];
    
    const statusFields = [
      'cbus_payment_status', 'cbus_payment_timing', 'cbus_worker_count_status',
      'incolink_payment_status', 'incolink_payment_timing', 'incolink_worker_count_status'
    ];
    
    const cleaned: any = {};
    const validFields = [
      'cbus_check_conducted', 'cbus_check_date', 'cbus_checked_by', 'cbus_payment_status',
      'cbus_payment_timing', 'cbus_worker_count_status', 'cbus_enforcement_flag',
      'cbus_followup_required', 'cbus_notes',
      'incolink_check_conducted', 'incolink_check_date', 'incolink_checked_by',
      'incolink_payment_status', 'incolink_payment_timing', 'incolink_worker_count_status',
      'incolink_enforcement_flag', 'incolink_followup_required', 'incolink_notes',
      'incolink_company_id', 'site_visit_id',
      'sham_contracting_detected', 'sham_contracting_detected_date',
      'sham_contracting_detected_by', 'sham_contracting_detection_notes',
      'sham_contracting_cleared_date', 'sham_contracting_cleared_by',
      'sham_contracting_clearing_reason'
    ];
    
    validFields.forEach(field => {
      if (data.hasOwnProperty(field) && !excludeFields.includes(field)) {
        let value = data[field];
        if (statusFields.includes(field) && value === '') {
          value = null;
        }
        cleaned[field] = value;
      }
    });
    
    return cleaned;
  };

  const handleSave = () => {
    const cleanedUpdates = cleanComplianceData(formData);
    upsertCompliance.mutate({
      employerId,
      updates: cleanedUpdates
    }, {
      onSuccess: (data) => {
        if (data) {
          setFormData(prevData => {
            const merged = { ...prevData };
            Object.keys(data).forEach(key => {
              if (key.startsWith('cbus_') || key.startsWith('incolink_') || 
                  key.startsWith('sham_') || key === 'site_visit_id') {
                merged[key] = (data as any)[key];
              }
            });
            return merged;
          });
        }
        setHasChanges(false);
        toast.success("Compliance saved");
      },
      onError: (error: any) => {
        console.error("Save error:", error);
        toast.error(`Failed to save compliance: ${error.message || 'Unknown error'}`);
      }
    });
  };

  // Check if CBUS ratings exist (any of the 3 ratings have been set)
  const hasCbusRatings = () => {
    return formData.cbus_payment_status !== null || 
           formData.cbus_payment_timing !== null || 
           formData.cbus_worker_count_status !== null;
  };

  // Check if all CBUS ratings are complete
  const isCbusComplete = () => {
    return formData.cbus_payment_status !== null && 
           formData.cbus_payment_timing !== null && 
           formData.cbus_worker_count_status !== null;
  };

  // Check if INCOLINK ratings exist (any of the 3 ratings have been set)
  const hasIncolinkRatings = () => {
    return formData.incolink_payment_status !== null || 
           formData.incolink_payment_timing !== null || 
           formData.incolink_worker_count_status !== null;
  };

  // Check if all INCOLINK ratings are complete
  const isIncolinkComplete = () => {
    return formData.incolink_payment_status !== null && 
           formData.incolink_payment_timing !== null && 
           formData.incolink_worker_count_status !== null;
  };

  // Get CBUS status display info
  const getCbusStatusInfo = () => {
    if (formData.cbus_enforcement_flag) {
      return { label: 'Issues Found', variant: 'destructive' as const, color: 'bg-red-50 border-red-200' };
    }
    if (isCbusComplete()) {
      return { label: 'Complete', variant: 'default' as const, color: 'bg-green-50 border-green-200' };
    }
    if (hasCbusRatings()) {
      return { label: 'In Progress', variant: 'outline' as const, color: 'bg-amber-50 border-amber-200' };
    }
    return { label: 'Not Started', variant: 'secondary' as const, color: 'bg-gray-50 border-gray-200' };
  };

  // Get INCOLINK status display info
  const getIncolinkStatusInfo = () => {
    if (formData.incolink_enforcement_flag) {
      return { label: 'Issues Found', variant: 'destructive' as const, color: 'bg-red-50 border-red-200' };
    }
    if (isIncolinkComplete()) {
      return { label: 'Complete', variant: 'default' as const, color: 'bg-green-50 border-green-200' };
    }
    if (hasIncolinkRatings()) {
      return { label: 'In Progress', variant: 'outline' as const, color: 'bg-amber-50 border-amber-200' };
    }
    return { label: 'Not Started', variant: 'secondary' as const, color: 'bg-gray-50 border-gray-200' };
  };

  // Calculate compliance status for summary
  const getComplianceStatus = () => {
    const cbusComplete = formData.cbus_check_conducted || isCbusComplete();
    const incolinkComplete = formData.incolink_check_conducted || isIncolinkComplete();
    const cbusOk = cbusComplete && !formData.cbus_enforcement_flag;
    const incolinkOk = incolinkComplete && !formData.incolink_enforcement_flag;
    
    return {
      cbusComplete,
      incolinkComplete,
      cbusOk,
      incolinkOk,
      hasIssues: formData.cbus_enforcement_flag || formData.incolink_enforcement_flag || formData.sham_contracting_detected
    };
  };

  const status = getComplianceStatus();
  const cbusStatus = getCbusStatusInfo();
  const incolinkStatus = getIncolinkStatusInfo();

  return (
    <div className="space-y-3">
      {/* Header Card with Save Button */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{employerName}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Employer Assessment</p>
            </div>
            {hasChanges && (
              <Button size="sm" className="h-11" onClick={handleSave}>
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Sham Contracting Warning Banner */}
      {formData.sham_contracting_detected && !formData.sham_contracting_cleared_date && (
        <Alert variant="destructive" className="border-2">
          <AlertTriangle className="h-5 w-5" />
          <AlertDescription className="ml-2">
            <span className="font-semibold">Sham Contracting Detected</span>
            <p className="text-sm mt-1">Maximum rating limited to amber/yellow.</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Accordion Sections */}
      <Accordion 
        type="single" 
        collapsible 
        value={activeSection}
        onValueChange={setActiveSection}
        className="space-y-2"
      >
        {/* Section 1: CBUS/INCOLINK Compliance */}
        <AccordionItem value="compliance" className="border rounded-lg">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center justify-between w-full pr-2">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Compliance</span>
              </div>
              <div className="flex items-center gap-2">
                {status.hasIssues ? (
                  <Badge variant="destructive" className="text-xs">Issues</Badge>
                ) : status.cbusComplete || status.incolinkComplete ? (
                  <Badge variant="default" className="text-xs">Checked</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Pending</Badge>
                )}
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              {/* CBUS Compliance - Clickable Card */}
              <Card 
                className={`cursor-pointer transition-all border-2 ${cbusStatus.color} ${expandedComplianceForm === 'cbus' ? 'ring-2 ring-blue-500' : 'hover:shadow-md'}`}
                onClick={() => setExpandedComplianceForm(expandedComplianceForm === 'cbus' ? null : 'cbus')}
              >
                <CardContent className="p-4">
                  {/* Header row with status indicator and title */}
                  <div className="flex items-start gap-3">
                    {/* Status indicator */}
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1.5 ${
                      isCbusComplete() ? 'bg-green-500' : 
                      hasCbusRatings() ? 'bg-amber-500' : 
                      'bg-gray-300'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-base truncate">CBUS Compliance</div>
                        <Badge variant={cbusStatus.variant} className="text-xs flex-shrink-0">
                          {cbusStatus.label}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {isCbusComplete() ? '3/3 ratings complete' : 
                         hasCbusRatings() ? 'Ratings in progress' : 
                         'Superannuation 3-point check'}
                      </div>
                    </div>
                  </div>

                  {/* Action button - full width */}
                  <div className="mt-3">
                    <Button 
                      variant={hasCbusRatings() ? "outline" : "default"}
                      size="sm" 
                      className="w-full h-11"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedComplianceForm(expandedComplianceForm === 'cbus' ? null : 'cbus');
                      }}
                    >
                      {hasCbusRatings() ? 'Check Ratings' : 'Add Ratings'}
                    </Button>
                  </div>
                  
                  {/* Show summary of ratings if they exist */}
                  {hasCbusRatings() && expandedComplianceForm !== 'cbus' && (
                    <div className="mt-3 pt-3 border-t flex gap-2 flex-wrap">
                      {formData.cbus_payment_status && (
                        <Badge variant="outline" className="text-xs">
                          Entity: {formData.cbus_payment_status === 'correct' ? '✓' : formData.cbus_payment_status === 'incorrect' ? '✗' : '?'}
                        </Badge>
                      )}
                      {formData.cbus_payment_timing && (
                        <Badge variant="outline" className="text-xs">
                          Timing: {formData.cbus_payment_timing === 'on_time' ? '✓' : formData.cbus_payment_timing === 'late' ? '✗' : '?'}
                        </Badge>
                      )}
                      {formData.cbus_worker_count_status && (
                        <Badge variant="outline" className="text-xs">
                          Coverage: {formData.cbus_worker_count_status === 'correct' ? '✓' : '✗'}
                        </Badge>
                      )}
                      {formData.cbus_check_date && (
                        <span className="text-xs text-muted-foreground">
                          Last: {format(new Date(formData.cbus_check_date), "dd/MM/yy")}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* CBUS Rating Form - Shown when expanded */}
              {expandedComplianceForm === 'cbus' && (
                <Card className="border-2 border-blue-200 bg-blue-50/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">CBUS 3-Point Audit</CardTitle>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setExpandedComplianceForm(null)}
                        className="h-9"
                      >
                        Close
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <Label className="text-sm">Checked By</Label>
                      <Select
                        value={formData.cbus_checked_by?.[0] || ''}
                        onValueChange={(value) => handleFieldChange('cbus_checked_by', [value])}
                      >
                        <SelectTrigger className="mt-1 h-11">
                          <SelectValue placeholder="Who conducted the check?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="organiser">Organiser</SelectItem>
                          <SelectItem value="delegate">Delegate</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                          <SelectItem value="cbus_officer">CBUS Officer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <div className="p-3 bg-white rounded-lg border">
                        <Label className="text-sm font-medium">1. Paying to CBUS</Label>
                        <p className="text-xs text-muted-foreground mb-2">Superannuation paid to correct entity</p>
                        <Select
                          value={formData.cbus_payment_status || undefined}
                          onValueChange={(value) => handleFieldChange('cbus_payment_status', value as PaymentStatus)}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="correct">✓ Correct</SelectItem>
                            <SelectItem value="incorrect">✗ Incorrect</SelectItem>
                            <SelectItem value="uncertain">? Uncertain</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="p-3 bg-white rounded-lg border">
                        <Label className="text-sm font-medium">2. Paying On Time</Label>
                        <p className="text-xs text-muted-foreground mb-2">Timely superannuation payments</p>
                        <Select
                          value={formData.cbus_payment_timing || undefined}
                          onValueChange={(value) => handleFieldChange('cbus_payment_timing', value as PaymentTiming)}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select timing" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="on_time">✓ On Time</SelectItem>
                            <SelectItem value="late">✗ Late</SelectItem>
                            <SelectItem value="uncertain">? Uncertain</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="p-3 bg-white rounded-lg border">
                        <Label className="text-sm font-medium">3. All Workers Covered</Label>
                        <p className="text-xs text-muted-foreground mb-2">All employees have superannuation</p>
                        <Select
                          value={formData.cbus_worker_count_status || undefined}
                          onValueChange={(value) => handleFieldChange('cbus_worker_count_status', value as WorkerCountStatus)}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select coverage" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="correct">✓ All Workers Covered</SelectItem>
                            <SelectItem value="incorrect">✗ Missing Workers</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center justify-between min-h-[44px]">
                        <Label className="text-sm">Flag for Enforcement</Label>
                        <Switch
                          checked={formData.cbus_enforcement_flag}
                          onCheckedChange={(checked) => handleFieldChange('cbus_enforcement_flag', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between min-h-[44px]">
                        <Label className="text-sm">Follow-up Required</Label>
                        <Switch
                          checked={formData.cbus_followup_required}
                          onCheckedChange={(checked) => handleFieldChange('cbus_followup_required', checked)}
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm">Notes</Label>
                      <Textarea
                        className="mt-1"
                        placeholder="Add notes about this compliance check..."
                        value={formData.cbus_notes || ''}
                        onChange={(e) => handleFieldChange('cbus_notes', e.target.value)}
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* INCOLINK Compliance - Clickable Card */}
              <Card 
                className={`cursor-pointer transition-all border-2 ${incolinkStatus.color} ${expandedComplianceForm === 'incolink' ? 'ring-2 ring-purple-500' : 'hover:shadow-md'}`}
                onClick={() => setExpandedComplianceForm(expandedComplianceForm === 'incolink' ? null : 'incolink')}
              >
                <CardContent className="p-4">
                  {/* Header row with status indicator and title */}
                  <div className="flex items-start gap-3">
                    {/* Status indicator */}
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1.5 ${
                      isIncolinkComplete() ? 'bg-green-500' : 
                      hasIncolinkRatings() ? 'bg-amber-500' : 
                      'bg-gray-300'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-base truncate">INCOLINK Compliance</div>
                        <Badge variant={incolinkStatus.variant} className="text-xs flex-shrink-0">
                          {incolinkStatus.label}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {isIncolinkComplete() ? '3/3 ratings complete' : 
                         hasIncolinkRatings() ? 'Ratings in progress' : 
                         'Entitlements 3-point check'}
                      </div>
                    </div>
                  </div>

                  {/* Action button - full width */}
                  <div className="mt-3">
                    <Button 
                      variant={hasIncolinkRatings() ? "outline" : "default"}
                      size="sm" 
                      className="w-full h-11"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedComplianceForm(expandedComplianceForm === 'incolink' ? null : 'incolink');
                      }}
                    >
                      {hasIncolinkRatings() ? 'Check Ratings' : 'Add Ratings'}
                    </Button>
                  </div>
                  
                  {/* Show summary of ratings if they exist */}
                  {hasIncolinkRatings() && expandedComplianceForm !== 'incolink' && (
                    <div className="mt-3 pt-3 border-t flex gap-2 flex-wrap">
                      {formData.incolink_payment_status && (
                        <Badge variant="outline" className="text-xs">
                          Entitlements: {formData.incolink_payment_status === 'correct' ? '✓' : formData.incolink_payment_status === 'incorrect' ? '✗' : '?'}
                        </Badge>
                      )}
                      {formData.incolink_payment_timing && (
                        <Badge variant="outline" className="text-xs">
                          Timing: {formData.incolink_payment_timing === 'on_time' ? '✓' : formData.incolink_payment_timing === 'late' ? '✗' : '?'}
                        </Badge>
                      )}
                      {formData.incolink_worker_count_status && (
                        <Badge variant="outline" className="text-xs">
                          Coverage: {formData.incolink_worker_count_status === 'correct' ? '✓' : '✗'}
                        </Badge>
                      )}
                      {formData.incolink_check_date && (
                        <span className="text-xs text-muted-foreground">
                          Last: {format(new Date(formData.incolink_check_date), "dd/MM/yy")}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* INCOLINK Rating Form - Shown when expanded */}
              {expandedComplianceForm === 'incolink' && (
                <Card className="border-2 border-purple-200 bg-purple-50/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">INCOLINK 3-Point Audit</CardTitle>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setExpandedComplianceForm(null)}
                        className="h-9"
                      >
                        Close
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <Label className="text-sm">Checked By</Label>
                      <Select
                        value={formData.incolink_checked_by?.[0] || ''}
                        onValueChange={(value) => handleFieldChange('incolink_checked_by', [value])}
                      >
                        <SelectTrigger className="mt-1 h-11">
                          <SelectValue placeholder="Who conducted the check?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="organiser">Organiser</SelectItem>
                          <SelectItem value="delegate">Delegate</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                          <SelectItem value="incolink_officer">INCOLINK Officer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <div className="p-3 bg-white rounded-lg border">
                        <Label className="text-sm font-medium">1. Paying All Entitlements</Label>
                        <p className="text-xs text-muted-foreground mb-2">Training and safety fund payments</p>
                        <Select
                          value={formData.incolink_payment_status || undefined}
                          onValueChange={(value) => handleFieldChange('incolink_payment_status', value as PaymentStatus)}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="correct">✓ Correct</SelectItem>
                            <SelectItem value="incorrect">✗ Incorrect</SelectItem>
                            <SelectItem value="uncertain">? Uncertain</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="p-3 bg-white rounded-lg border">
                        <Label className="text-sm font-medium">2. Paying On Time</Label>
                        <p className="text-xs text-muted-foreground mb-2">Timely INCOLINK payments</p>
                        <Select
                          value={formData.incolink_payment_timing || undefined}
                          onValueChange={(value) => handleFieldChange('incolink_payment_timing', value as PaymentTiming)}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select timing" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="on_time">✓ On Time</SelectItem>
                            <SelectItem value="late">✗ Late</SelectItem>
                            <SelectItem value="uncertain">? Uncertain</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="p-3 bg-white rounded-lg border">
                        <Label className="text-sm font-medium">3. All Workers Covered</Label>
                        <p className="text-xs text-muted-foreground mb-2">All employees covered by entitlements</p>
                        <Select
                          value={formData.incolink_worker_count_status || undefined}
                          onValueChange={(value) => handleFieldChange('incolink_worker_count_status', value as WorkerCountStatus)}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select coverage" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="correct">✓ All Workers Covered</SelectItem>
                            <SelectItem value="incorrect">✗ Missing Workers</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center justify-between min-h-[44px]">
                        <Label className="text-sm">Flag for Enforcement</Label>
                        <Switch
                          checked={formData.incolink_enforcement_flag}
                          onCheckedChange={(checked) => handleFieldChange('incolink_enforcement_flag', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between min-h-[44px]">
                        <Label className="text-sm">Follow-up Required</Label>
                        <Switch
                          checked={formData.incolink_followup_required}
                          onCheckedChange={(checked) => handleFieldChange('incolink_followup_required', checked)}
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm">Notes</Label>
                      <Textarea
                        className="mt-1"
                        placeholder="Add notes about this compliance check..."
                        value={formData.incolink_notes || ''}
                        onChange={(e) => handleFieldChange('incolink_notes', e.target.value)}
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section 2: Union Respect */}
        <AccordionItem value="union-respect" className="border rounded-lg">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center justify-between w-full pr-2">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600" />
                <span className="font-medium">Union Respect</span>
              </div>
              <Badge variant="secondary" className="text-xs">Assessment</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Rate how well this employer respects union rights. Each criterion uses a 4-point scale.
                </AlertDescription>
              </Alert>

              {/* Right of Entry */}
              <Card className="border">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Right of Entry</Label>
                    <p className="text-xs text-muted-foreground">Union access to workplace</p>
                  </div>
                  <Select>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4 - Excellent (Full access, proactive)</SelectItem>
                      <SelectItem value="3">3 - Good (Generally cooperative)</SelectItem>
                      <SelectItem value="2">2 - Fair (Reluctant but compliant)</SelectItem>
                      <SelectItem value="1">1 - Poor (Obstructive)</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Delegate Relations */}
              <Card className="border">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Delegate Relations</Label>
                    <p className="text-xs text-muted-foreground">How employer treats union delegates</p>
                  </div>
                  <Select>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4 - Excellent (Supportive, provides facilities)</SelectItem>
                      <SelectItem value="3">3 - Good (Respectful, allows time)</SelectItem>
                      <SelectItem value="2">2 - Fair (Tolerant but unhelpful)</SelectItem>
                      <SelectItem value="1">1 - Poor (Hostile or dismissive)</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Information Access */}
              <Card className="border">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Information Access</Label>
                    <p className="text-xs text-muted-foreground">Access to workplace information</p>
                  </div>
                  <Select>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4 - Excellent (Proactively shares)</SelectItem>
                      <SelectItem value="3">3 - Good (Provides on request)</SelectItem>
                      <SelectItem value="2">2 - Fair (Slow or partial)</SelectItem>
                      <SelectItem value="1">1 - Poor (Withholds information)</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* New Starter Access */}
              <Card className="border">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <Label className="text-sm font-medium">New Starter Access</Label>
                    <p className="text-xs text-muted-foreground">Union access to new workers</p>
                  </div>
                  <Select>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4 - Excellent (Included in induction)</SelectItem>
                      <SelectItem value="3">3 - Good (Access arranged)</SelectItem>
                      <SelectItem value="2">2 - Fair (Limited access)</SelectItem>
                      <SelectItem value="1">1 - Poor (Blocked)</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Notes */}
              <div>
                <Label className="text-sm">Notes</Label>
                <Textarea
                  className="mt-1"
                  placeholder="Add any observations about union respect..."
                  rows={3}
                />
              </div>

              <Button className="w-full h-11" onClick={() => toast.success("Union Respect Assessment saved")}>
                Save Union Respect Assessment
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section 3: Safety */}
        <AccordionItem value="safety" className="border rounded-lg">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center justify-between w-full pr-2">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-600" />
                <span className="font-medium">Safety</span>
              </div>
              <Badge variant="secondary" className="text-xs">Assessment</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Assess the employer's safety practices. Each criterion uses a 4-point scale.
                </AlertDescription>
              </Alert>

              {/* Safety Management */}
              <Card className="border">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Safety Management Systems</Label>
                    <p className="text-xs text-muted-foreground">Quality of safety systems and procedures</p>
                  </div>
                  <Select>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4 - Excellent (Comprehensive, regularly reviewed)</SelectItem>
                      <SelectItem value="3">3 - Good (Adequate systems in place)</SelectItem>
                      <SelectItem value="2">2 - Fair (Basic systems, gaps exist)</SelectItem>
                      <SelectItem value="1">1 - Poor (Inadequate or missing)</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Incident Reporting */}
              <Card className="border">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Incident Reporting</Label>
                    <p className="text-xs text-muted-foreground">Effectiveness of incident reporting culture</p>
                  </div>
                  <Select>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4 - Excellent (Open culture, learning shared)</SelectItem>
                      <SelectItem value="3">3 - Good (Incidents reported promptly)</SelectItem>
                      <SelectItem value="2">2 - Fair (Some underreporting)</SelectItem>
                      <SelectItem value="1">1 - Poor (Discouraged or hidden)</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Site Safety Culture */}
              <Card className="border">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Site Safety Culture</Label>
                    <p className="text-xs text-muted-foreground">Overall safety attitude and behavior</p>
                  </div>
                  <Select>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4 - Excellent (Safety-first mindset)</SelectItem>
                      <SelectItem value="3">3 - Good (Generally safety conscious)</SelectItem>
                      <SelectItem value="2">2 - Fair (Variable commitment)</SelectItem>
                      <SelectItem value="1">1 - Poor (Safety is afterthought)</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* PPE Compliance */}
              <Card className="border">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <Label className="text-sm font-medium">PPE & Equipment</Label>
                    <p className="text-xs text-muted-foreground">Personal protective equipment provision and use</p>
                  </div>
                  <Select>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4 - Excellent (Quality PPE, 100% compliance)</SelectItem>
                      <SelectItem value="3">3 - Good (Adequate PPE provided)</SelectItem>
                      <SelectItem value="2">2 - Fair (Some gaps in provision/use)</SelectItem>
                      <SelectItem value="1">1 - Poor (PPE lacking or ignored)</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Notes */}
              <div>
                <Label className="text-sm">Notes</Label>
                <Textarea
                  className="mt-1"
                  placeholder="Add any observations about safety practices..."
                  rows={3}
                />
              </div>

              <Button className="w-full h-11" onClick={() => toast.success("Safety Assessment saved")}>
                Save Safety Assessment
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section 4: Contracting (Sham Detection) */}
        <AccordionItem value="contracting" className="border rounded-lg">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center justify-between w-full pr-2">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-600" />
                <span className="font-medium">Contracting</span>
              </div>
              {formData.sham_contracting_detected ? (
                <Badge variant="destructive" className="text-xs">Sham Detected</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">Check</Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              {/* Sham Contracting Detection */}
              <Card className="border-2 border-amber-200 bg-amber-50/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    Sham Contracting Detection
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      Evidence of sham contracting is a <strong>hard block</strong> to green ratings. 
                      Maximum rating of yellow/amber.
                    </AlertDescription>
                  </Alert>

                  <div className="flex items-center justify-between p-4 bg-white rounded-lg border min-h-[56px]">
                    <div className="space-y-1 flex-1 pr-4">
                      <Label htmlFor="sham-contracting-toggle" className="text-sm font-semibold">
                        Sham Contracting Detected
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Flag this employer for sham contracting practices
                      </p>
                    </div>
                    <Switch
                      id="sham-contracting-toggle"
                      checked={formData.sham_contracting_detected}
                      onCheckedChange={(checked) => {
                        handleFieldChange('sham_contracting_detected', checked);
                        if (checked) {
                          handleFieldChange('sham_contracting_detected_date', new Date().toISOString());
                          handleFieldChange('sham_contracting_cleared_date', null);
                          handleFieldChange('sham_contracting_cleared_by', null);
                          handleFieldChange('sham_contracting_clearing_reason', null);
                        }
                      }}
                      disabled={upsertCompliance.isPending}
                    />
                  </div>

                  {formData.sham_contracting_detected && (
                    <div className="space-y-3 p-4 bg-white rounded-lg border">
                      <div>
                        <Label htmlFor="sham-contracting-notes" className="text-sm">
                          Detection Notes <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                          id="sham-contracting-notes"
                          placeholder="Provide details about the evidence of sham contracting..."
                          value={formData.sham_contracting_detection_notes || ''}
                          onChange={(e) => handleFieldChange('sham_contracting_detection_notes', e.target.value)}
                          rows={4}
                          className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Required when flagging sham contracting.
                        </p>
                      </div>
                    </div>
                  )}

                  {formData.sham_contracting_cleared_date && (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-sm">
                        <strong>Previously flagged - Cleared on {format(new Date(formData.sham_contracting_cleared_date), 'PPP')}</strong>
                        {formData.sham_contracting_clearing_reason && (
                          <p className="mt-1 text-sm">
                            Reason: {formData.sham_contracting_clearing_reason}
                          </p>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Full Subcontractor Assessment - Mobile Optimized */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-5 w-5" />
                    Subcontractor Assessment
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Rate subcontractor practices (1=Good, 4=Terrible)
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Subcontractor Usage */}
                  <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium">Subcontractor Usage</Label>
                        <Badge variant="outline" className="text-xs">1.2x weight</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Extent and quality of subcontractor employment</p>
                    </div>
                    <Select>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select rating" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 - Good (Exceeds expectations)</SelectItem>
                        <SelectItem value="2">2 - Fair (Meets expectations)</SelectItem>
                        <SelectItem value="3">3 - Poor (Below expectations)</SelectItem>
                        <SelectItem value="4">4 - Terrible (Major concerns)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Payment Terms */}
                  <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium">Payment Terms</Label>
                        <Badge variant="outline" className="text-xs">0.8x weight</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Payment speed and terms to subcontractors</p>
                    </div>
                    <Select>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select rating" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 - Good (Prompt payment, fair terms)</SelectItem>
                        <SelectItem value="2">2 - Fair (Reasonable terms)</SelectItem>
                        <SelectItem value="3">3 - Poor (Slow payment, onerous terms)</SelectItem>
                        <SelectItem value="4">4 - Terrible (Non-payment, exploitative)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Treatment of Subcontractors */}
                  <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                    <div>
                      <Label className="text-sm font-medium">Treatment of Subcontractors</Label>
                      <p className="text-xs text-muted-foreground">Overall relationship and treatment</p>
                    </div>
                    <Select>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select rating" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 - Good (Respectful, collaborative)</SelectItem>
                        <SelectItem value="2">2 - Fair (Professional relationship)</SelectItem>
                        <SelectItem value="3">3 - Poor (Adversarial, demanding)</SelectItem>
                        <SelectItem value="4">4 - Terrible (Exploitative, abusive)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Assessment Details */}
                  <div className="space-y-3 pt-2 border-t">
                    <div>
                      <Label className="text-sm">Assessment Method</Label>
                      <Select>
                        <SelectTrigger className="h-11 mt-1">
                          <SelectValue placeholder="How was this assessed?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="site_visit">Site Visit</SelectItem>
                          <SelectItem value="phone_call">Phone Call</SelectItem>
                          <SelectItem value="subcontractor_meeting">Subcontractor Meeting</SelectItem>
                          <SelectItem value="worker_interview">Worker Interview</SelectItem>
                          <SelectItem value="document_review">Document Review</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm">Confidence Level</Label>
                      <Select>
                        <SelectTrigger className="h-11 mt-1">
                          <SelectValue placeholder="How confident are you?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="very_high">Very High</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm">Notes</Label>
                      <Textarea
                        className="mt-1"
                        placeholder="Add notes about subcontractor relationships, payment practices, or concerns..."
                        rows={3}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border min-h-[48px]">
                      <div className="flex-1 pr-3">
                        <Label className="text-sm font-medium">Follow Up Required</Label>
                        <p className="text-xs text-muted-foreground">Schedule a follow-up assessment</p>
                      </div>
                      <Switch />
                    </div>
                  </div>

                  <Button className="w-full h-11" onClick={() => toast.success("Subcontractor Assessment saved")}>
                    Save Subcontractor Assessment
                  </Button>
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section 5: Overview */}
        <AccordionItem value="overview" className="border rounded-lg">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center justify-between w-full pr-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-gray-600" />
                <span className="font-medium">Overview</span>
              </div>
              <Badge variant="outline" className="text-xs">Summary</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              {/* Overall Status Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Assessment Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-muted/30 rounded-lg text-center">
                      <div className="text-sm font-medium mb-1">CBUS</div>
                      <Badge variant={status.cbusOk ? "default" : status.cbusComplete ? "destructive" : "secondary"}>
                        {status.cbusOk ? "OK" : status.cbusComplete ? "Issues" : "Pending"}
                      </Badge>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-lg text-center">
                      <div className="text-sm font-medium mb-1">INCOLINK</div>
                      <Badge variant={status.incolinkOk ? "default" : status.incolinkComplete ? "destructive" : "secondary"}>
                        {status.incolinkOk ? "OK" : status.incolinkComplete ? "Issues" : "Pending"}
                      </Badge>
                    </div>
                  </div>

                  {/* Checklist */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>CBUS Compliance</span>
                      {status.cbusComplete ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>INCOLINK Compliance</span>
                      {status.incolinkComplete ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Union Respect</span>
                      <Badge variant="secondary" className="text-xs">Pending</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Safety</span>
                      <Badge variant="secondary" className="text-xs">Pending</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Sham Contracting</span>
                      {formData.sham_contracting_detected ? (
                        <Badge variant="destructive" className="text-xs">Detected</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Clear</Badge>
                      )}
                    </div>
                  </div>

                  {/* Issues Warning */}
                  {status.hasIssues && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        This employer has compliance issues that need to be addressed.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
