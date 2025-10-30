"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Save } from "lucide-react";
import { useEmployerCompliance, useUpsertEmployerCompliance } from "./hooks/useEmployerCompliance";
import { ComplianceChecker, PaymentStatus, PaymentTiming, WorkerCountStatus, EmployerComplianceCheck } from "@/types/compliance";
import { format } from "date-fns";
import { toast } from "sonner";

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
    incolink_notes: null
  };

  const [formData, setFormData] = useState(currentCompliance);

  // Sync formData when compliance data changes
  useEffect(() => {
    if (compliance.length > 0 && currentCompliance) {
      // Only update if the data actually changed to avoid loops
      // Compare IDs if available, otherwise compare the whole object
      const currentId = currentCompliance.id;
      if (currentId && formData.id && currentId === formData.id) {
        // Same record, check if data changed
        const currentJson = JSON.stringify(currentCompliance);
        const formJson = JSON.stringify(formData);
        if (currentJson !== formJson) {
          setFormData(currentCompliance as any);
        }
      } else if (!formData.id || (currentId && currentId !== formData.id)) {
        // New record or ID changed, update formData
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

      return updated;
    });
  };

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
        // Update formData with the returned data to keep UI in sync
        if (data) {
          setFormData(prevData => {
            const merged = { ...prevData };
            // Update all compliance fields from the returned data
            if ('cbus_payment_status' in data) merged.cbus_payment_status = data.cbus_payment_status;
            if ('cbus_payment_timing' in data) merged.cbus_payment_timing = data.cbus_payment_timing;
            if ('cbus_worker_count_status' in data) merged.cbus_worker_count_status = data.cbus_worker_count_status;
            if ('incolink_payment_status' in data) merged.incolink_payment_status = data.incolink_payment_status;
            if ('incolink_payment_timing' in data) merged.incolink_payment_timing = data.incolink_payment_timing;
            if ('incolink_worker_count_status' in data) merged.incolink_worker_count_status = data.incolink_worker_count_status;
            // Update other fields too
            Object.keys(data).forEach(key => {
              if (key.startsWith('cbus_') || key.startsWith('incolink_') || key === 'site_visit_id') {
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

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{employerName}</CardTitle>
            {hasChanges && (
              <Button size="sm" className="h-11" onClick={handleSave}>
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* CBUS Compliance */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">CBUS Compliance</CardTitle>
            {formData.cbus_enforcement_flag && (
              <Badge variant="destructive" className="text-xs">Flagged</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor={`cbus-${employerId}`}>Check Conducted</Label>
            <Switch
              id={`cbus-${employerId}`}
              checked={formData.cbus_check_conducted}
              onCheckedChange={(checked) => handleFieldChange('cbus_check_conducted', checked)}
            />
          </div>

          {formData.cbus_check_conducted && (
            <>
              {formData.cbus_check_date && (
                <div className="text-sm text-muted-foreground">
                  Checked: {format(new Date(formData.cbus_check_date), "dd/MM/yyyy")}
                </div>
              )}

              <div>
                <Label className="text-sm">Checked By</Label>
                <Select
                  value={formData.cbus_checked_by?.[0] || ''}
                  onValueChange={(value) => handleFieldChange('cbus_checked_by', [value])}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="organiser">Organiser</SelectItem>
                    <SelectItem value="delegate">Delegate</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                    <SelectItem value="cbus_officer">CBUS Officer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* CBUS 3-Point Superannuation Audit */}
              <div className="space-y-3 border-t pt-3">
                <Label className="text-sm font-medium">📊 CBUS 3-Point Audit</Label>

                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">1. Paying to CBUS</Label>
                    <p className="text-xs text-muted-foreground">Superannuation paid to correct entity</p>
                    <Select
                      value={formData.cbus_payment_status || undefined}
                      onValueChange={(value) => handleFieldChange('cbus_payment_status', value as PaymentStatus)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="correct">✅ Correct</SelectItem>
                        <SelectItem value="incorrect">❌ Incorrect</SelectItem>
                        <SelectItem value="uncertain">❓ Uncertain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">2. Paying On Time</Label>
                    <p className="text-xs text-muted-foreground">Timely superannuation payments</p>
                    <Select
                      value={formData.cbus_payment_timing || undefined}
                      onValueChange={(value) => handleFieldChange('cbus_payment_timing', value as PaymentTiming)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select timing" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on_time">✅ On Time</SelectItem>
                        <SelectItem value="late">⏰ Late</SelectItem>
                        <SelectItem value="uncertain">❓ Uncertain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">3. All Workers Covered</Label>
                    <p className="text-xs text-muted-foreground">All employees have superannuation</p>
                    <Select
                      value={formData.cbus_worker_count_status || undefined}
                      onValueChange={(value) => handleFieldChange('cbus_worker_count_status', value as WorkerCountStatus)}
                    >
                      <SelectTrigger className="mt-1">
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Flag for Enforcement</Label>
                  <Switch
                    checked={formData.cbus_enforcement_flag}
                    onCheckedChange={(checked) => handleFieldChange('cbus_enforcement_flag', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
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
                  placeholder="Add notes..."
                  value={formData.cbus_notes || ''}
                  onChange={(e) => handleFieldChange('cbus_notes', e.target.value)}
                  rows={2}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* INCOLINK Compliance */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">INCOLINK Compliance</CardTitle>
            {formData.incolink_enforcement_flag && (
              <Badge variant="destructive" className="text-xs">Flagged</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor={`incolink-${employerId}`}>Check Conducted</Label>
            <Switch
              id={`incolink-${employerId}`}
              checked={formData.incolink_check_conducted}
              onCheckedChange={(checked) => handleFieldChange('incolink_check_conducted', checked)}
            />
          </div>

          {formData.incolink_check_conducted && (
            <>
              {formData.incolink_check_date && (
                <div className="text-sm text-muted-foreground">
                  Checked: {format(new Date(formData.incolink_check_date), "dd/MM/yyyy")}
                </div>
              )}

              <div>
                <Label className="text-sm">Checked By</Label>
                <Select
                  value={formData.incolink_checked_by?.[0] || ''}
                  onValueChange={(value) => handleFieldChange('incolink_checked_by', [value])}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="organiser">Organiser</SelectItem>
                    <SelectItem value="delegate">Delegate</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                    <SelectItem value="incolink_officer">INCOLINK Officer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* INCOLINK 3-Point Entitlements Audit */}
              <div className="space-y-3 border-t pt-3">
                <Label className="text-sm font-medium">📊 INCOLINK 3-Point Audit</Label>

                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">1. Paying All Entitlements</Label>
                    <p className="text-xs text-muted-foreground">Training and safety fund payments</p>
                    <Select
                      value={formData.incolink_payment_status || undefined}
                      onValueChange={(value) => handleFieldChange('incolink_payment_status', value as PaymentStatus)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="correct">✅ Correct</SelectItem>
                        <SelectItem value="incorrect">❌ Incorrect</SelectItem>
                        <SelectItem value="uncertain">❓ Uncertain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">2. Paying On Time</Label>
                    <p className="text-xs text-muted-foreground">Timely INCOLINK payments</p>
                    <Select
                      value={formData.incolink_payment_timing || undefined}
                      onValueChange={(value) => handleFieldChange('incolink_payment_timing', value as PaymentTiming)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select timing" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on_time">✅ On Time</SelectItem>
                        <SelectItem value="late">⏰ Late</SelectItem>
                        <SelectItem value="uncertain">❓ Uncertain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">3. All Workers Covered</Label>
                    <p className="text-xs text-muted-foreground">All employees covered by entitlements</p>
                    <Select
                      value={formData.incolink_worker_count_status || undefined}
                      onValueChange={(value) => handleFieldChange('incolink_worker_count_status', value as WorkerCountStatus)}
                    >
                      <SelectTrigger className="mt-1">
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Flag for Enforcement</Label>
                  <Switch
                    checked={formData.incolink_enforcement_flag}
                    onCheckedChange={(checked) => handleFieldChange('incolink_enforcement_flag', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
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
                  placeholder="Add notes..."
                  value={formData.incolink_notes || ''}
                  onChange={(e) => handleFieldChange('incolink_notes', e.target.value)}
                  rows={2}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
