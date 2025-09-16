"use client"

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Check, X, AlertCircle, User, Users, Shield, ClipboardCheck } from "lucide-react";
import { useProjectCompliance, useUpdateProjectCompliance } from "./hooks/useProjectCompliance";
import { WorkerSelector } from "./WorkerSelector";
import { toast } from "sonner";
import { InductionAttendee, DelegateSiteAccess } from "@/types/compliance";

interface ProjectComplianceGridProps {
  projectId: string;
}

export function ProjectComplianceGrid({ projectId }: ProjectComplianceGridProps) {
  const { data: compliance, isLoading } = useProjectCompliance(projectId);
  const updateCompliance = useUpdateProjectCompliance(projectId);
  const [showDelegateSelector, setShowDelegateSelector] = useState(false);
  const [showHsrSelector, setShowHsrSelector] = useState(false);

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading compliance data...</div>;
  }

  if (!compliance) {
    return <div className="text-center py-8 text-muted-foreground">No compliance data found</div>;
  }

  const handleUpdate = (field: string, value: any) => {
    updateCompliance.mutate({ [field]: value });
  };

  const StatusIcon = ({ status }: { status: boolean }) => {
    return status ? (
      <Check className="h-4 w-4 text-green-600" />
    ) : (
      <X className="h-4 w-4 text-red-600" />
    );
  };

  const getComplianceScore = () => {
    let total = 0;
    let completed = 0;

    // Count completed items
    if (compliance.delegate_identified) completed++;
    if (compliance.delegate_elected) completed++;
    if (compliance.hsr_chair_exists) completed++;
    if (compliance.abn_worker_check_conducted) completed++;
    if (compliance.inductions_attended) completed++;
    if (compliance.delegate_site_access && compliance.delegate_site_access !== 'none') completed++;

    total = 6; // Total possible items

    return { completed, total, percentage: Math.round((completed / total) * 100) };
  };

  const score = getComplianceScore();

  return (
    <div className="space-y-4">
      {/* Compliance Score Summary */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div>
          <h3 className="font-medium">Overall Compliance Score</h3>
          <p className="text-sm text-muted-foreground">
            {score.completed} of {score.total} items completed
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{score.percentage}%</div>
          <Badge variant={score.percentage >= 80 ? "default" : score.percentage >= 50 ? "secondary" : "destructive"}>
            {score.percentage >= 80 ? "Good" : score.percentage >= 50 ? "Needs Attention" : "Critical"}
          </Badge>
        </div>
      </div>

      {/* Compliance Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Delegate Card */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <h4 className="font-medium">Delegate</h4>
                </div>
                <StatusIcon status={compliance.delegate_identified && compliance.delegate_elected} />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="delegate-identified">Identified</Label>
                  <Switch
                    id="delegate-identified"
                    checked={compliance.delegate_identified}
                    onCheckedChange={(checked) => handleUpdate("delegate_identified", checked)}
                  />
                </div>
                
                {compliance.delegate_identified && (
                  <>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="delegate-elected">Elected</Label>
                      <Switch
                        id="delegate-elected"
                        checked={compliance.delegate_elected}
                        onCheckedChange={(checked) => handleUpdate("delegate_elected", checked)}
                      />
                    </div>
                    
                    {compliance.delegate_elected && (
                      <div className="space-y-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {compliance.delegate_elected_date
                                ? format(new Date(compliance.delegate_elected_date), "PPP")
                                : "Select date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={compliance.delegate_elected_date ? new Date(compliance.delegate_elected_date) : undefined}
                              onSelect={(date) => handleUpdate("delegate_elected_date", date?.toISOString().split('T')[0])}
                            />
                          </PopoverContent>
                        </Popover>
                        
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setShowDelegateSelector(true)}
                        >
                          {compliance.delegate_worker ? (
                            <span>{compliance.delegate_worker.first_name} {compliance.delegate_worker.surname}</span>
                          ) : (
                            <span className="text-muted-foreground">Select Delegate</span>
                          )}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* HSR Card */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <h4 className="font-medium">HSR Chair</h4>
                </div>
                <StatusIcon status={compliance.hsr_chair_exists} />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="hsr-exists">HSR Exists</Label>
                  <Switch
                    id="hsr-exists"
                    checked={compliance.hsr_chair_exists}
                    onCheckedChange={(checked) => handleUpdate("hsr_chair_exists", checked)}
                  />
                </div>
                
                {compliance.hsr_chair_exists && (
                  <>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="hsr-is-delegate">Is also Delegate</Label>
                      <Switch
                        id="hsr-is-delegate"
                        checked={compliance.hsr_is_delegate}
                        onCheckedChange={(checked) => handleUpdate("hsr_is_delegate", checked)}
                      />
                    </div>
                    
                    {!compliance.hsr_is_delegate && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowHsrSelector(true)}
                      >
                        {compliance.hsr_worker ? (
                          <span>{compliance.hsr_worker.first_name} {compliance.hsr_worker.surname}</span>
                        ) : (
                          <span className="text-muted-foreground">Select HSR</span>
                        )}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ABN Worker Check Card */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <h4 className="font-medium">ABN Worker Check</h4>
                </div>
                <StatusIcon status={compliance.abn_worker_check_conducted} />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="abn-check">Conducted</Label>
                  <Switch
                    id="abn-check"
                    checked={compliance.abn_worker_check_conducted}
                    onCheckedChange={(checked) => handleUpdate("abn_worker_check_conducted", checked)}
                  />
                </div>
                
                {compliance.abn_worker_check_conducted && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {compliance.abn_worker_check_date
                          ? format(new Date(compliance.abn_worker_check_date), "PPP")
                          : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={compliance.abn_worker_check_date ? new Date(compliance.abn_worker_check_date) : undefined}
                        onSelect={(date) => handleUpdate("abn_worker_check_date", date?.toISOString().split('T')[0])}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inductions Card */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                  <h4 className="font-medium">Inductions</h4>
                </div>
                <StatusIcon status={compliance.inductions_attended} />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="inductions-attended">Attended</Label>
                  <Switch
                    id="inductions-attended"
                    checked={compliance.inductions_attended}
                    onCheckedChange={(checked) => handleUpdate("inductions_attended", checked)}
                  />
                </div>
                
                {compliance.inductions_attended && (
                  <>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {compliance.last_induction_date
                            ? format(new Date(compliance.last_induction_date), "PPP")
                            : "Last induction date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={compliance.last_induction_date ? new Date(compliance.last_induction_date) : undefined}
                          onSelect={(date) => handleUpdate("last_induction_date", date?.toISOString().split('T')[0])}
                        />
                      </PopoverContent>
                    </Popover>
                    
                    <Select
                      value={compliance.induction_attendees?.[0] || ""}
                      onValueChange={(value) => handleUpdate("induction_attendees", [value as InductionAttendee])}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Who attended?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="organiser">Organiser</SelectItem>
                        <SelectItem value="delegate">Delegate</SelectItem>
                        <SelectItem value="both">Delegate and Organiser</SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Site Access Card */}
        <Card className="md:col-span-2">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Delegate Site Access</h4>
                <StatusIcon status={compliance.delegate_site_access !== null && compliance.delegate_site_access !== 'none'} />
              </div>
              
              <div className="flex gap-2">
                <Select
                  value={compliance.delegate_site_access || "none"}
                  onValueChange={(value) => handleUpdate("delegate_site_access", value as DelegateSiteAccess)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="hammertech">Hammertech</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                
                {compliance.delegate_site_access === 'other' && (
                  <Input
                    className="flex-1"
                    placeholder="Specify system..."
                    value={compliance.delegate_site_access_other || ""}
                    onChange={(e) => handleUpdate("delegate_site_access_other", e.target.value)}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Worker Selectors */}
      {showDelegateSelector && (
        <WorkerSelector
          projectId={projectId}
          title="Select Delegate"
          onSelect={(workerId) => {
            handleUpdate("delegate_worker_id", workerId);
            setShowDelegateSelector(false);
          }}
          onClose={() => setShowDelegateSelector(false)}
        />
      )}
      
      {showHsrSelector && (
        <WorkerSelector
          projectId={projectId}
          title="Select HSR"
          onSelect={(workerId) => {
            handleUpdate("hsr_worker_id", workerId);
            setShowHsrSelector(false);
          }}
          onClose={() => setShowHsrSelector(false)}
        />
      )}
    </div>
  );
}
