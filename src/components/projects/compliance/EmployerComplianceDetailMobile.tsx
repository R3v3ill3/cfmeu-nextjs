"use client"

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Save } from "lucide-react";
import { useEmployerCompliance, useUpsertEmployerCompliance } from "./hooks/useEmployerCompliance";
import { ComplianceChecker, PaymentStatus, PaymentTiming, WorkerCountStatus } from "@/types/compliance";
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
    incolink_followup_required: false
  };

  const [formData, setFormData] = useState(currentCompliance);

  const handleFieldChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    upsertCompliance.mutate({
      employerId,
      updates: formData
    }, {
      onSuccess: () => {
        setHasChanges(false);
        toast.success("Compliance saved");
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

              <div>
                <Label className="text-sm">Payment Status</Label>
                <Select
                  value={formData.cbus_payment_status || ''}
                  onValueChange={(value) => handleFieldChange('cbus_payment_status', value as PaymentStatus)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="correct">Correct</SelectItem>
                    <SelectItem value="incorrect">Incorrect</SelectItem>
                    <SelectItem value="uncertain">Uncertain</SelectItem>
                  </SelectContent>
                </Select>
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

              <div>
                <Label className="text-sm">Payment Status</Label>
                <Select
                  value={formData.incolink_payment_status || ''}
                  onValueChange={(value) => handleFieldChange('incolink_payment_status', value as PaymentStatus)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="correct">Correct</SelectItem>
                    <SelectItem value="incorrect">Incorrect</SelectItem>
                    <SelectItem value="uncertain">Uncertain</SelectItem>
                  </SelectContent>
                </Select>
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
