"use client"

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, History, Save } from "lucide-react";
import { useEmployerCompliance, useUpsertEmployerCompliance } from "./hooks/useEmployerCompliance";
import { ComplianceChecker, PaymentStatus, PaymentTiming, WorkerCountStatus } from "@/types/compliance";
import { toast } from "sonner";

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

  // Current compliance record (most recent)
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
        toast.success("Compliance data saved");
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CBUS Compliance Card */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="font-medium">CBUS Compliance</h5>
              <Badge variant={formData.cbus_enforcement_flag ? 'destructive' : 'default'}>
                {formData.cbus_enforcement_flag ? 'Flagged' : 'OK'}
              </Badge>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor={`cbus-conducted-${employerId}`}>Check Conducted</Label>
                <Switch
                  id={`cbus-conducted-${employerId}`}
                  checked={formData.cbus_check_conducted}
                  onCheckedChange={(checked) => handleFieldChange('cbus_check_conducted', checked)}
                />
              </div>

              {formData.cbus_check_conducted && (
                <>
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
                          selected={formData.cbus_check_date ? new Date(formData.cbus_check_date) : undefined}
                          onSelect={(date) => handleFieldChange('cbus_check_date', date?.toISOString().split('T')[0])}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

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

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Payment Status</Label>
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

                    <div>
                      <Label>Payment Timing</Label>
                      <Select
                        value={formData.cbus_payment_timing || ''}
                        onValueChange={(value) => handleFieldChange('cbus_payment_timing', value as PaymentTiming)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="on_time">On Time</SelectItem>
                          <SelectItem value="late">Late</SelectItem>
                          <SelectItem value="uncertain">Uncertain</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Worker Count</Label>
                    <Select
                      value={formData.cbus_worker_count_status || ''}
                      onValueChange={(value) => handleFieldChange('cbus_worker_count_status', value as WorkerCountStatus)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="correct">Correct</SelectItem>
                        <SelectItem value="incorrect">Incorrect</SelectItem>
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

        {/* INCOLINK Compliance Card */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="font-medium">INCOLINK Compliance</h5>
              <Badge variant={formData.incolink_enforcement_flag ? 'destructive' : 'default'}>
                {formData.incolink_enforcement_flag ? 'Flagged' : 'OK'}
              </Badge>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor={`incolink-conducted-${employerId}`}>Check Conducted</Label>
                <Switch
                  id={`incolink-conducted-${employerId}`}
                  checked={formData.incolink_check_conducted}
                  onCheckedChange={(checked) => handleFieldChange('incolink_check_conducted', checked)}
                />
              </div>

              {formData.incolink_check_conducted && (
                <>
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
                          selected={formData.incolink_check_date ? new Date(formData.incolink_check_date) : undefined}
                          onSelect={(date) => handleFieldChange('incolink_check_date', date?.toISOString().split('T')[0])}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

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

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Payment Status</Label>
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

                    <div>
                      <Label>Payment Timing</Label>
                      <Select
                        value={formData.incolink_payment_timing || ''}
                        onValueChange={(value) => handleFieldChange('incolink_payment_timing', value as PaymentTiming)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="on_time">On Time</SelectItem>
                          <SelectItem value="late">Late</SelectItem>
                          <SelectItem value="uncertain">Uncertain</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Worker Count</Label>
                    <Select
                      value={formData.incolink_worker_count_status || ''}
                      onValueChange={(value) => handleFieldChange('incolink_worker_count_status', value as WorkerCountStatus)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="correct">Correct</SelectItem>
                        <SelectItem value="incorrect">Incorrect</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`incolink-enforcement-${employerId}`}>Flag for Enforcement</Label>
                      <Switch
                        id={`incolink-enforcement-${employerId}`}
                        checked={formData.incolink_enforcement_flag}
                        onCheckedChange={(checked) => handleFieldChange('incolink_enforcement_flag', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor={`incolink-followup-${employerId}`}>Follow-up Required</Label>
                      <Switch
                        id={`incolink-followup-${employerId}`}
                        checked={formData.incolink_followup_required}
                        onCheckedChange={(checked) => handleFieldChange('incolink_followup_required', checked)}
                      />
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

      {/* History section - TODO: Implement history view */}
      {showHistory && (
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground">Compliance history will be shown here</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
