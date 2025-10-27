"use client"

import { useState, useCallback } from "react";
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
  BarChart3
} from "lucide-react";
import { useEmployerCompliance, useUpsertEmployerCompliance } from "./hooks/useEmployerCompliance";
import { ComplianceChecker, PaymentStatus, PaymentTiming, WorkerCountStatus } from "@/types/compliance";
import { FourPointRatingDisplay } from "@/components/ui/FourPointScaleSelector";
import { UnionRespectAssessment } from "@/components/assessments/UnionRespectAssessment";
import { SafetyAssessment4Point } from "@/components/assessments/SafetyAssessment4Point";
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

      {/* Enhanced Assessment Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="union-respect">Union Respect</TabsTrigger>
          <TabsTrigger value="safety">Safety</TabsTrigger>
          <TabsTrigger value="subcontractors">Subcontractors</TabsTrigger>
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

                      {/* 3-Point CBUS Check Components */}
                      <div className="space-y-3 border-t pt-3">
                        <h6 className="font-medium text-sm">CBUS 3-Point Compliance Check</h6>

                        <div className="grid grid-cols-1 gap-3">
                          <div className="flex items-center justify-between p-3 border rounded">
                            <div>
                              <Label className="font-medium">1. Paying to Correct Entity</Label>
                              <p className="text-xs text-muted-foreground">Superannuation paid to CBUS</p>
                            </div>
                            <Select
                              value={formData.cbus_payment_status || ''}
                              onValueChange={(value) => handleFieldChange('cbus_payment_status', value as PaymentStatus)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="correct">✅ Correct</SelectItem>
                                <SelectItem value="incorrect">❌ Incorrect</SelectItem>
                                <SelectItem value="uncertain">❓ Uncertain</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-center justify-between p-3 border rounded">
                            <div>
                              <Label className="font-medium">2. Paying On Time</Label>
                              <p className="text-xs text-muted-foreground">Timely superannuation payments</p>
                            </div>
                            <Select
                              value={formData.cbus_payment_timing || ''}
                              onValueChange={(value) => handleFieldChange('cbus_payment_timing', value as PaymentTiming)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="on_time">✅ On Time</SelectItem>
                                <SelectItem value="late">⏰ Late</SelectItem>
                                <SelectItem value="uncertain">❓ Uncertain</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-center justify-between p-3 border rounded">
                            <div>
                              <Label className="font-medium">3. Paying for All Workers</Label>
                              <p className="text-xs text-muted-foreground">All employees covered</p>
                            </div>
                            <Select
                              value={formData.cbus_worker_count_status || ''}
                              onValueChange={(value) => handleFieldChange('cbus_worker_count_status', value as WorkerCountStatus)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="correct">✅ Correct</SelectItem>
                                <SelectItem value="incorrect">❌ Incorrect</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
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

                      {/* 3-Point INCOLINK Check Components */}
                      <div className="space-y-3 border-t pt-3">
                        <h6 className="font-medium text-sm">INCOLINK 3-Point Compliance Check</h6>

                        <div className="grid grid-cols-1 gap-3">
                          <div className="flex items-center justify-between p-3 border rounded">
                            <div>
                              <Label className="font-medium">1. Paying All Entitlements</Label>
                              <p className="text-xs text-muted-foreground">Training and safety fund payments</p>
                            </div>
                            <Select
                              value={formData.incolink_payment_status || ''}
                              onValueChange={(value) => handleFieldChange('incolink_payment_status', value as PaymentStatus)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="correct">✅ Correct</SelectItem>
                                <SelectItem value="incorrect">❌ Incorrect</SelectItem>
                                <SelectItem value="uncertain">❓ Uncertain</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-center justify-between p-3 border rounded">
                            <div>
                              <Label className="font-medium">2. Paying On Time</Label>
                              <p className="text-xs text-muted-foreground">Timely INCOLINK payments</p>
                            </div>
                            <Select
                              value={formData.incolink_payment_timing || ''}
                              onValueChange={(value) => handleFieldChange('incolink_payment_timing', value as PaymentTiming)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="on_time">✅ On Time</SelectItem>
                                <SelectItem value="late">⏰ Late</SelectItem>
                                <SelectItem value="uncertain">❓ Uncertain</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-center justify-between p-3 border rounded">
                            <div>
                              <Label className="font-medium">3. Paying for All Workers</Label>
                              <p className="text-xs text-muted-foreground">All employees covered</p>
                            </div>
                            <Select
                              value={formData.incolink_worker_count_status || ''}
                              onValueChange={(value) => handleFieldChange('incolink_worker_count_status', value as WorkerCountStatus)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="correct">✅ Correct</SelectItem>
                                <SelectItem value="incorrect">❌ Incorrect</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
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
        <TabsContent value="subcontractors">
          <Card>
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <Users className="h-12 w-12 text-muted-foreground mx-auto" />
                <h3 className="text-lg font-semibold">Subcontractor Use Assessment</h3>
                <p className="text-muted-foreground">
                  Assess subcontractor usage patterns and relationships
                </p>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    This assessment is primarily for head contractors and builders who manage subcontractors.
                  </AlertDescription>
                </Alert>
                <Button variant="outline">
                  Coming Soon
                </Button>
              </div>
            </CardContent>
          </Card>
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
    </div>
  );
}
