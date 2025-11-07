"use client"

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
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
  Info
} from "lucide-react";
import { useEmployerCompliance, useUpsertEmployerCompliance } from "./hooks/useEmployerCompliance";
import { ComplianceChecker, PaymentStatus, PaymentTiming, WorkerCountStatus, EmployerComplianceCheck } from "@/types/compliance";
import { FourPointRatingDisplay } from "@/components/ui/FourPointScaleSelector";
import { UnionRespectAssessment } from "@/components/assessments/UnionRespectAssessment";
import { SafetyAssessment4Point } from "@/components/assessments/SafetyAssessment4Point";
import { SubcontractorAssessmentForm4Point } from "@/components/assessments/SubcontractorAssessmentForm4Point";
import { ClearShamContractingDialog } from "@/components/compliance/ClearShamContractingDialog";
import { toast } from "sonner";
import {
  FourPointRating,
  Assessment,
  UnionRespectAssessment as UnionRespectType,
  Safety4PointAssessment as SafetyAssessmentType,
  CreateUnionRespectAssessmentPayload,
  CreateSafety4PointAssessmentPayload
} from "@/types/assessments";

interface EmployerComplianceDetailProps {
  projectId: string;
  employerId: string;
  employerName: string;
}

export function EmployerComplianceDetail({
  projectId,
  employerId,
  employerName
}: EmployerComplianceDetailProps) {
  const { data: compliance = [] } = useEmployerCompliance(projectId, employerId);
  const upsertCompliance = useUpsertEmployerCompliance(projectId);
  const [showHistory, setShowHistory] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('compliance');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [overallRating, setOverallRating] = useState<FourPointRating | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);

  // Current compliance record (most recent)
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
  const [isMutating, setIsMutating] = useState(false);

  // Sync formData when compliance data changes (but not during mutations)
  useEffect(() => {
    // Don't sync if we're currently mutating to avoid overwriting pending changes
    if (isMutating) return;
    
    if (compliance.length > 0 && currentCompliance) {
      // Only update if the data actually changed to avoid loops
      // Compare IDs if available, otherwise compare the whole object
      const currentId = currentCompliance.id;
      if (currentId && formData.id && currentId === formData.id) {
        // Same record, check if data changed
        // Use a more granular comparison for status fields to avoid unnecessary updates
        const hasDataChanged = 
          currentCompliance.cbus_payment_status !== formData.cbus_payment_status ||
          currentCompliance.cbus_payment_timing !== formData.cbus_payment_timing ||
          currentCompliance.cbus_worker_count_status !== formData.cbus_worker_count_status ||
          currentCompliance.incolink_payment_status !== formData.incolink_payment_status ||
          currentCompliance.incolink_payment_timing !== formData.incolink_payment_timing ||
          currentCompliance.incolink_worker_count_status !== formData.incolink_worker_count_status ||
          currentCompliance.cbus_check_conducted !== formData.cbus_check_conducted ||
          currentCompliance.incolink_check_conducted !== formData.incolink_check_conducted ||
          currentCompliance.id !== formData.id;
        
        if (hasDataChanged) {
          setFormData(currentCompliance as any);
        }
      } else if (!formData.id || (currentId && currentId !== formData.id)) {
        // New record or ID changed, update formData
        setFormData(currentCompliance as any);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compliance, isMutating]);

  // Helper function to clean data before sending to database
  const cleanComplianceData = (data: any): Partial<EmployerComplianceCheck> => {
    // Fields to exclude (metadata and relations)
    const excludeFields = [
      'id', 'created_at', 'updated_at', 'effective_from', 'effective_to', 
      'version', 'is_current', 'updated_by', 'employers'
    ];
    
    // Status fields that should be null if empty string
    const statusFields = [
      'cbus_payment_status', 'cbus_payment_timing', 'cbus_worker_count_status',
      'incolink_payment_status', 'incolink_payment_timing', 'incolink_worker_count_status'
    ];
    
    // Get all valid compliance fields from the type
    const cleaned: any = {};
    const validFields = [
      'cbus_check_conducted', 'cbus_check_date', 'cbus_checked_by', 'cbus_payment_status',
      'cbus_payment_timing', 'cbus_worker_count_status', 'cbus_enforcement_flag',
      'cbus_followup_required', 'cbus_notes',
      'incolink_check_conducted', 'incolink_check_date', 'incolink_checked_by',
      'incolink_payment_status', 'incolink_payment_timing', 'incolink_worker_count_status',
      'incolink_enforcement_flag', 'incolink_followup_required', 'incolink_notes',
      'incolink_company_id', 'site_visit_id'
    ];
    
    validFields.forEach(field => {
      if (data.hasOwnProperty(field) && !excludeFields.includes(field)) {
        let value = data[field];
        
        // Convert empty strings to null for status fields
        if (statusFields.includes(field) && value === '') {
          value = null;
        }
        
        // Convert empty arrays to empty array (keep as is)
        if (Array.isArray(value) && value.length === 0) {
          value = [];
        }
        
        cleaned[field] = value;
      }
    });
    
    return cleaned;
  };

  const handleFieldChange = (field: string, value: any) => {
    // Use functional update pattern to get latest state and avoid stale closures
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
          // Set date to today if not already set
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
          // Set date to today if not already set
          if (!updated.incolink_check_date) {
            updated.incolink_check_date = new Date().toISOString().split('T')[0];
          }
        }
      }

      // Auto-save for CBUS compliance fields (including 3-point check dropdowns)
      if (field.startsWith('cbus_')) {
        setIsMutating(true);
        const cleanedUpdates = cleanComplianceData(updated);
        upsertCompliance.mutate({
          employerId,
          updates: cleanedUpdates
        }, {
          onSuccess: (data) => {
            // Update formData with the returned data to keep UI in sync
            if (data) {
              setFormData(prevData => {
                // Merge the returned data, preserving all field values including null
                const merged = { ...prevData };
                // Update all compliance fields from the returned data
                if ('cbus_payment_status' in data) merged.cbus_payment_status = data.cbus_payment_status;
                if ('cbus_payment_timing' in data) merged.cbus_payment_timing = data.cbus_payment_timing;
                if ('cbus_worker_count_status' in data) merged.cbus_worker_count_status = data.cbus_worker_count_status;
                if ('cbus_check_conducted' in data) merged.cbus_check_conducted = data.cbus_check_conducted;
                if ('cbus_check_date' in data) merged.cbus_check_date = data.cbus_check_date;
                if ('cbus_checked_by' in data) merged.cbus_checked_by = data.cbus_checked_by;
                if ('cbus_enforcement_flag' in data) merged.cbus_enforcement_flag = data.cbus_enforcement_flag;
                if ('cbus_followup_required' in data) merged.cbus_followup_required = data.cbus_followup_required;
                if ('cbus_notes' in data) merged.cbus_notes = data.cbus_notes;
                return merged;
              });
            }
            setHasChanges(false);
            // Delay resetting isMutating to allow refetch to complete
            setTimeout(() => setIsMutating(false), 500);
            toast.success("CBUS compliance updated");
          },
          onError: (error: any) => {
            console.error("CBUS update error:", error);
            setIsMutating(false);
            toast.error(`Failed to update CBUS compliance: ${error.message || 'Unknown error'}`);
          }
        });
      }

      // Auto-save for INCOLINK compliance fields (including 3-point check dropdowns)
      if (field.startsWith('incolink_')) {
        setIsMutating(true);
        const cleanedUpdates = cleanComplianceData(updated);
        upsertCompliance.mutate({
          employerId,
          updates: cleanedUpdates
        }, {
          onSuccess: (data) => {
            // Update formData with the returned data to keep UI in sync
            if (data) {
              setFormData(prevData => {
                // Merge the returned data, preserving all field values including null
                const merged = { ...prevData };
                // Update all compliance fields from the returned data
                if ('incolink_payment_status' in data) merged.incolink_payment_status = data.incolink_payment_status;
                if ('incolink_payment_timing' in data) merged.incolink_payment_timing = data.incolink_payment_timing;
                if ('incolink_worker_count_status' in data) merged.incolink_worker_count_status = data.incolink_worker_count_status;
                if ('incolink_check_conducted' in data) merged.incolink_check_conducted = data.incolink_check_conducted;
                if ('incolink_check_date' in data) merged.incolink_check_date = data.incolink_check_date;
                if ('incolink_checked_by' in data) merged.incolink_checked_by = data.incolink_checked_by;
                if ('incolink_enforcement_flag' in data) merged.incolink_enforcement_flag = data.incolink_enforcement_flag;
                if ('incolink_followup_required' in data) merged.incolink_followup_required = data.incolink_followup_required;
                if ('incolink_notes' in data) merged.incolink_notes = data.incolink_notes;
                return merged;
              });
            }
            setHasChanges(false);
            // Delay resetting isMutating to allow refetch to complete
            setTimeout(() => setIsMutating(false), 500);
            toast.success("INCOLINK compliance updated");
          },
          onError: (error: any) => {
            console.error("INCOLINK update error:", error);
            setIsMutating(false);
            toast.error(`Failed to update INCOLINK compliance: ${error.message || 'Unknown error'}`);
          }
        });
      }

      return updated;
    });
  };

  const handleSave = () => {
    const cleanedUpdates = cleanComplianceData(formData);
    upsertCompliance.mutate({
      employerId,
      updates: cleanedUpdates
    }, {
      onSuccess: () => {
        setHasChanges(false);
        toast.success("Compliance data saved");
      },
      onError: (error: any) => {
        console.error("Save error:", error);
        toast.error(`Failed to save compliance data: ${error.message || 'Unknown error'}`);
      }
    });
  };

  const checkerOptions: { value: ComplianceChecker; label: string }[] = [
    { value: 'organiser', label: 'Organiser' },
    { value: 'delegate', label: 'Delegate' },
    { value: 'both', label: 'Both' },
    { value: 'cbus_officer', label: 'CBUS Officer' },
    { value: 'incolink_officer', label: 'INCOLINK Officer' }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-lg">{employerName} Compliance Details</h4>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="h-4 w-4 mr-1" />
            History
          </Button>
          {hasChanges && (
            <Button size="sm" onClick={handleSave}>
              <Save className="h-4 w-4 mr-1" />
              Save Changes
            </Button>
          )}
        </div>
      </div>

      {/* Sham Contracting Warning Banner */}
      {formData.sham_contracting_detected && !formData.sham_contracting_cleared_date && (
        <Alert variant="destructive" className="border-2">
          <AlertTriangle className="h-5 w-5" />
          <div className="flex-1">
            <div className="font-semibold">Sham Contracting Detected</div>
            <AlertDescription className="mt-1">
              This employer has been flagged for sham contracting. They are blocked from receiving a green rating (maximum yellow/amber).
              {formData.sham_contracting_detection_notes && (
                <div className="mt-2 text-sm">
                  <strong>Notes:</strong> {formData.sham_contracting_detection_notes}
                </div>
              )}
            </AlertDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowClearDialog(true)}
            className="ml-2"
          >
            Clear Flag
          </Button>
        </Alert>
      )}

      {/* Enhanced Assessment Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="union-respect">Union Respect</TabsTrigger>
          <TabsTrigger value="safety">Safety</TabsTrigger>
          <TabsTrigger value="contracting">Contracting</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        {/* Tab 1: Traditional Compliance (CBUS/INCOLINK) */}
        <TabsContent value="compliance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CBUS Compliance Card - Enhanced */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium">CBUS Compliance (3-Point Check)</h5>
                  <Badge variant={formData.cbus_enforcement_flag ? 'destructive' : 'default'}>
                    {formData.cbus_enforcement_flag ? 'Flagged' : 'OK'}
                  </Badge>
                </div>

                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    CBUS compliance requires 3 checks: paying to correct entity, paying on time, and paying for all workers.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`cbus-conducted-${employerId}`}>Check Conducted</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`cbus-conducted-${employerId}`}
                        checked={formData.cbus_check_conducted}
                        onCheckedChange={(checked) => handleFieldChange('cbus_check_conducted', checked)}
                        disabled={upsertCompliance.isPending}
                      />
                      {upsertCompliance.isPending && (
                        <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                      )}
                    </div>
                  </div>

                  {/* Check Date - Always visible when check is conducted or all 3 selections are made */}
                  {(formData.cbus_check_conducted || 
                    (formData.cbus_payment_status !== null && 
                     formData.cbus_payment_timing !== null && 
                     formData.cbus_worker_count_status !== null)) && (
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
                            selected={formData.cbus_check_date ? new Date(formData.cbus_check_date) : new Date()}
                            onSelect={(date) => handleFieldChange('cbus_check_date', date?.toISOString().split('T')[0])}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {/* 3-Point CBUS Superannuation Audit - Always Visible */}
                  <div className="space-y-3 border-t pt-3">
                    <h6 className="font-medium text-sm flex items-center gap-2">
                      📊 CBUS Superannuation Audit - 3 Point Check
                      {formData.cbus_check_conducted && (
                        <Badge variant="default" className="text-xs">In Progress</Badge>
                      )}
                    </h6>

                    <div className="grid grid-cols-1 gap-3">
                      <div className={cn(
                        "p-4 border-2 rounded-lg transition-all",
                        formData.cbus_payment_status === 'correct' ? "border-green-500 bg-green-50" :
                        formData.cbus_payment_status === 'incorrect' ? "border-red-500 bg-red-50" :
                        formData.cbus_payment_status === 'uncertain' ? "border-yellow-500 bg-yellow-50" :
                        "border-gray-200 bg-gray-50"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Label className="font-medium">1. Paying to CBUS</Label>
                              {formData.cbus_payment_status === 'correct' && <span className="text-green-600">✅</span>}
                              {formData.cbus_payment_status === 'incorrect' && <span className="text-red-600">❌</span>}
                              {formData.cbus_payment_status === 'uncertain' && <span className="text-yellow-600">❓</span>}
                            </div>
                            <p className="text-xs text-muted-foreground">Superannuation paid to correct entity</p>
                          </div>
                          <Select
                            value={formData.cbus_payment_status || undefined}
                            onValueChange={(value) => handleFieldChange('cbus_payment_status', value as PaymentStatus)}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="correct">✅ Correct</SelectItem>
                              <SelectItem value="incorrect">❌ Incorrect</SelectItem>
                              <SelectItem value="uncertain">❓ Uncertain</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className={cn(
                        "p-4 border-2 rounded-lg transition-all",
                        formData.cbus_payment_timing === 'on_time' ? "border-green-500 bg-green-50" :
                        formData.cbus_payment_timing === 'late' ? "border-red-500 bg-red-50" :
                        formData.cbus_payment_timing === 'uncertain' ? "border-yellow-500 bg-yellow-50" :
                        "border-gray-200 bg-gray-50"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Label className="font-medium">2. Paying On Time</Label>
                              {formData.cbus_payment_timing === 'on_time' && <span className="text-green-600">✅</span>}
                              {formData.cbus_payment_timing === 'late' && <span className="text-red-600">⏰</span>}
                              {formData.cbus_payment_timing === 'uncertain' && <span className="text-yellow-600">❓</span>}
                            </div>
                            <p className="text-xs text-muted-foreground">Timely superannuation payments</p>
                          </div>
                          <Select
                            value={formData.cbus_payment_timing || undefined}
                            onValueChange={(value) => handleFieldChange('cbus_payment_timing', value as PaymentTiming)}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue placeholder="Select timing" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="on_time">✅ On Time</SelectItem>
                              <SelectItem value="late">⏰ Late</SelectItem>
                              <SelectItem value="uncertain">❓ Uncertain</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className={cn(
                        "p-4 border-2 rounded-lg transition-all",
                        formData.cbus_worker_count_status === 'correct' ? "border-green-500 bg-green-50" :
                        formData.cbus_worker_count_status === 'incorrect' ? "border-red-500 bg-red-50" :
                        "border-gray-200 bg-gray-50"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Label className="font-medium">3. Paying for All Workers</Label>
                              {formData.cbus_worker_count_status === 'correct' && <span className="text-green-600">✅</span>}
                              {formData.cbus_worker_count_status === 'incorrect' && <span className="text-red-600">❌</span>}
                            </div>
                            <p className="text-xs text-muted-foreground">All employees covered by superannuation</p>
                          </div>
                          <Select
                            value={formData.cbus_worker_count_status || undefined}
                            onValueChange={(value) => handleFieldChange('cbus_worker_count_status', value as WorkerCountStatus)}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue placeholder="Select coverage" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="correct">✅ All Workers</SelectItem>
                              <SelectItem value="incorrect">❌ Missing Workers</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* CBUS Summary */}
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-900">CBUS Audit Status</span>
                        <Badge variant={
                          (formData.cbus_payment_status === 'correct' &&
                           formData.cbus_payment_timing === 'on_time' &&
                           formData.cbus_worker_count_status === 'correct') ? "default" : "destructive"
                        }>
                          {(formData.cbus_payment_status === 'correct' &&
                            formData.cbus_payment_timing === 'on_time' &&
                            formData.cbus_worker_count_status === 'correct') ? "✅ Compliant" : "⚠️ Issues Found"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* These fields should only show when check is conducted */}
                  {formData.cbus_check_conducted && (
                    <>
                      <div>
                        <Label>Checked By</Label>
                        <Select
                          value={formData.cbus_checked_by?.[0] || ''}
                          onValueChange={(value) => handleFieldChange('cbus_checked_by', [value])}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select who checked" />
                          </SelectTrigger>
                          <SelectContent>
                            {checkerOptions.slice(0, 4).map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
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
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label htmlFor={`cbus-followup-${employerId}`}>Follow-up Required</Label>
                          <Switch
                            id={`cbus-followup-${employerId}`}
                            checked={formData.cbus_followup_required}
                            onCheckedChange={(checked) => handleFieldChange('cbus_followup_required', checked)}
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
                        />
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* INCOLINK Compliance Card - Enhanced */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium">INCOLINK Compliance (3-Point Check)</h5>
                  <Badge variant={formData.incolink_enforcement_flag ? 'destructive' : 'default'}>
                    {formData.incolink_enforcement_flag ? 'Flagged' : 'OK'}
                  </Badge>
                </div>

                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    INCOLINK compliance requires 3 checks: paying all entitlements, paying on time, and paying for all workers.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`incolink-conducted-${employerId}`}>Check Conducted</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`incolink-conducted-${employerId}`}
                        checked={formData.incolink_check_conducted}
                        onCheckedChange={(checked) => handleFieldChange('incolink_check_conducted', checked)}
                        disabled={upsertCompliance.isPending}
                      />
                      {upsertCompliance.isPending && (
                        <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                      )}
                    </div>
                  </div>

                  {/* Check Date - Always visible when check is conducted or all 3 selections are made */}
                  {(formData.incolink_check_conducted || 
                    (formData.incolink_payment_status !== null && 
                     formData.incolink_payment_timing !== null && 
                     formData.incolink_worker_count_status !== null)) && (
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
                            selected={formData.incolink_check_date ? new Date(formData.incolink_check_date) : new Date()}
                            onSelect={(date) => handleFieldChange('incolink_check_date', date?.toISOString().split('T')[0])}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {/* 3-Point INCOLINK Entitlements Audit - Always Visible */}
                  <div className="space-y-3 border-t pt-3">
                    <h6 className="font-medium text-sm flex items-center gap-2">
                      📊 INCOLINK Entitlements Audit - 3 Point Check
                      {formData.incolink_check_conducted && (
                        <Badge variant="default" className="text-xs">In Progress</Badge>
                      )}
                    </h6>

                    <div className="grid grid-cols-1 gap-3">
                      <div className={cn(
                        "p-4 border-2 rounded-lg transition-all",
                        formData.incolink_payment_status === 'correct' ? "border-green-500 bg-green-50" :
                        formData.incolink_payment_status === 'incorrect' ? "border-red-500 bg-red-50" :
                        formData.incolink_payment_status === 'uncertain' ? "border-yellow-500 bg-yellow-50" :
                        "border-gray-200 bg-gray-50"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Label className="font-medium">1. Paying All Entitlements</Label>
                              {formData.incolink_payment_status === 'correct' && <span className="text-green-600">✅</span>}
                              {formData.incolink_payment_status === 'incorrect' && <span className="text-red-600">❌</span>}
                              {formData.incolink_payment_status === 'uncertain' && <span className="text-yellow-600">❓</span>}
                            </div>
                            <p className="text-xs text-muted-foreground">Training and safety fund payments</p>
                          </div>
                          <Select
                            value={formData.incolink_payment_status || undefined}
                            onValueChange={(value) => handleFieldChange('incolink_payment_status', value as PaymentStatus)}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="correct">✅ Correct</SelectItem>
                              <SelectItem value="incorrect">❌ Incorrect</SelectItem>
                              <SelectItem value="uncertain">❓ Uncertain</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className={cn(
                        "p-4 border-2 rounded-lg transition-all",
                        formData.incolink_payment_timing === 'on_time' ? "border-green-500 bg-green-50" :
                        formData.incolink_payment_timing === 'late' ? "border-red-500 bg-red-50" :
                        formData.incolink_payment_timing === 'uncertain' ? "border-yellow-500 bg-yellow-50" :
                        "border-gray-200 bg-gray-50"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Label className="font-medium">2. Paying On Time</Label>
                              {formData.incolink_payment_timing === 'on_time' && <span className="text-green-600">✅</span>}
                              {formData.incolink_payment_timing === 'late' && <span className="text-red-600">⏰</span>}
                              {formData.incolink_payment_timing === 'uncertain' && <span className="text-yellow-600">❓</span>}
                            </div>
                            <p className="text-xs text-muted-foreground">Timely INCOLINK payments</p>
                          </div>
                          <Select
                            value={formData.incolink_payment_timing || undefined}
                            onValueChange={(value) => handleFieldChange('incolink_payment_timing', value as PaymentTiming)}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue placeholder="Select timing" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="on_time">✅ On Time</SelectItem>
                              <SelectItem value="late">⏰ Late</SelectItem>
                              <SelectItem value="uncertain">❓ Uncertain</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className={cn(
                        "p-4 border-2 rounded-lg transition-all",
                        formData.incolink_worker_count_status === 'correct' ? "border-green-500 bg-green-50" :
                        formData.incolink_worker_count_status === 'incorrect' ? "border-red-500 bg-red-50" :
                        "border-gray-200 bg-gray-50"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Label className="font-medium">3. Paying for All Workers</Label>
                              {formData.incolink_worker_count_status === 'correct' && <span className="text-green-600">✅</span>}
                              {formData.incolink_worker_count_status === 'incorrect' && <span className="text-red-600">❌</span>}
                            </div>
                            <p className="text-xs text-muted-foreground">All employees covered by entitlements</p>
                          </div>
                          <Select
                            value={formData.incolink_worker_count_status || undefined}
                            onValueChange={(value) => handleFieldChange('incolink_worker_count_status', value as WorkerCountStatus)}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue placeholder="Select coverage" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="correct">✅ All Workers</SelectItem>
                              <SelectItem value="incorrect">❌ Missing Workers</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* INCOLINK Summary */}
                    <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-purple-900">INCOLINK Audit Status</span>
                        <Badge variant={
                          (formData.incolink_payment_status === 'correct' &&
                           formData.incolink_payment_timing === 'on_time' &&
                           formData.incolink_worker_count_status === 'correct') ? "default" : "destructive"
                        }>
                          {(formData.incolink_payment_status === 'correct' &&
                            formData.incolink_payment_timing === 'on_time' &&
                            formData.incolink_worker_count_status === 'correct') ? "✅ Compliant" : "⚠️ Issues Found"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* These fields should only show when check is conducted */}
                  {formData.incolink_check_conducted && (
                    <>
                      <div>
                        <Label>Checked By</Label>
                        <Select
                          value={formData.incolink_checked_by?.[0] || ''}
                          onValueChange={(value) => handleFieldChange('incolink_checked_by', [value])}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select who checked" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="organiser">Organiser</SelectItem>
                            <SelectItem value="delegate">Delegate</SelectItem>
                            <SelectItem value="both">Both</SelectItem>
                            <SelectItem value="incolink_officer">INCOLINK Officer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`incolink-enforcement-${employerId}`}>Flag for Enforcement</Label>
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`incolink-enforcement-${employerId}`}
                              checked={formData.incolink_enforcement_flag}
                              onCheckedChange={(checked) => handleFieldChange('incolink_enforcement_flag', checked)}
                              disabled={upsertCompliance.isPending}
                            />
                            {upsertCompliance.isPending && (
                              <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <Label htmlFor={`incolink-followup-${employerId}`}>Follow-up Required</Label>
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`incolink-followup-${employerId}`}
                              checked={formData.incolink_followup_required}
                              onCheckedChange={(checked) => handleFieldChange('incolink_followup_required', checked)}
                              disabled={upsertCompliance.isPending}
                            />
                            {upsertCompliance.isPending && (
                              <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                            )}
                          </div>
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
                        />
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Union Respect Assessment (4-Point Scale) */}
        <TabsContent value="union-respect">
          <UnionRespectAssessment
            employerId={employerId}
            employerName={employerName}
            onSave={async (data) => {
              // This will be connected to the actual API when implemented
              console.log('Union Respect Assessment data:', data)
              toast.success("Union Respect Assessment saved successfully")
            }}
            onViewHistory={() => setShowHistory(!showHistory)}
          />
        </TabsContent>

        {/* Tab 3: Safety Assessment (4-Point Scale) */}
        <TabsContent value="safety">
          <SafetyAssessment4Point
            employerId={employerId}
            employerName={employerName}
            onSave={async (data) => {
              // This will be connected to the actual API when implemented
              console.log('Safety Assessment data:', data)
              toast.success("Safety Assessment saved successfully")
            }}
            onViewHistory={() => setShowHistory(!showHistory)}
          />
        </TabsContent>

        {/* Tab 4: Subcontractor Use Assessment (4-Point Scale) */}
        <TabsContent value="contracting" className="space-y-4">
          {/* Sham Contracting Detection Card */}
          <Card className="border-2 border-amber-200 bg-amber-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Sham Contracting Detection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Evidence of sham contracting is a <strong>hard block</strong> to green ratings. 
                  Employers flagged for sham contracting can receive a maximum rating of yellow/amber.
                </AlertDescription>
              </Alert>

              <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
                <div className="space-y-1">
                  <Label htmlFor="sham-contracting-toggle" className="text-base font-semibold">
                    Evidence of Sham Contracting Detected
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Flag this employer for sham contracting practices
                  </p>
                </div>
                <Switch
                  id="sham-contracting-toggle"
                  checked={formData.sham_contracting_detected}
                  onCheckedChange={(checked) => {
                    handleFieldChange('sham_contracting_detected', checked)
                    if (checked) {
                      handleFieldChange('sham_contracting_detected_date', new Date().toISOString())
                      // Clear the cleared fields if re-flagging
                      handleFieldChange('sham_contracting_cleared_date', null)
                      handleFieldChange('sham_contracting_cleared_by', null)
                      handleFieldChange('sham_contracting_clearing_reason', null)
                    }
                  }}
                  disabled={upsertCompliance.isPending}
                />
              </div>

              {formData.sham_contracting_detected && (
                <div className="space-y-3 p-4 bg-white rounded-lg border">
                  <div>
                    <Label htmlFor="sham-contracting-notes">
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
                      Required when flagging sham contracting. Be specific about the evidence.
                    </p>
                  </div>
                </div>
              )}

              {formData.sham_contracting_cleared_date && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    <strong>Previously flagged - Cleared on {format(new Date(formData.sham_contracting_cleared_date), 'PPP')}</strong>
                    {formData.sham_contracting_clearing_reason && (
                      <div className="mt-2 text-sm">
                        Reason: {formData.sham_contracting_clearing_reason}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Subcontractor Assessment Form */}
          <SubcontractorAssessmentForm4Point
            employerId={employerId}
            employerName={employerName}
            projectId={projectId}
            onSave={async (data) => {
              // This will be connected to the actual API when implemented
              console.log('Subcontractor Assessment data:', data)
              toast.success("Subcontractor Assessment saved successfully")
            }}
            onViewHistory={() => setShowHistory(!showHistory)}
          />
        </TabsContent>

        {/* Tab 5: Overall Rating Overview */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Overall Rating Card */}
            <Card className="md:col-span-2">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Overall 4-Point Rating</h3>
                  <div className="text-center space-y-2">
                    {overallRating ? (
                      <FourPointRatingDisplay
                        value={overallRating}
                        size="lg"
                        showLabel={true}
                        showColor={true}
                      />
                    ) : (
                      <div className="py-8">
                        <p className="text-muted-foreground">No assessment data available yet</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Complete the assessments in other tabs to generate an overall rating
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Assessment Status */}
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Assessment Status</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Compliance</span>
                      <Badge variant={formData.cbus_check_conducted || formData.incolink_check_conducted ? "default" : "secondary"}>
                        {formData.cbus_check_conducted || formData.incolink_check_conducted ? "Complete" : "Pending"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Union Respect</span>
                      <Badge variant="secondary">Pending</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Safety</span>
                      <Badge variant="secondary">Pending</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Subcontractors</span>
                      <Badge variant="secondary">Pending</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* History section - TODO: Implement history view */}
      {showHistory && (
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground">Compliance history will be shown here</p>
          </CardContent>
        </Card>
      )}

      {/* Clear Sham Contracting Dialog */}
      <ClearShamContractingDialog
        open={showClearDialog}
        onOpenChange={setShowClearDialog}
        employerId={employerId}
        employerName={employerName}
        projectId={projectId}
        onSuccess={() => {
          // Refetch compliance data
          window.location.reload() // Simple refetch for now
        }}
      />
    </div>
  );
}
