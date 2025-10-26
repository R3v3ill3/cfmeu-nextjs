"use client"

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Check, X, User, Shield, Users, ClipboardCheck, ChevronRight } from "lucide-react";
import { useProjectCompliance, useUpdateProjectCompliance } from "./hooks/useProjectCompliance";
import { WorkerSelector } from "./WorkerSelector";
import { format } from "date-fns";
import { InductionAttendee, DelegateSiteAccess } from "@/types/compliance";

interface ProjectComplianceMobileProps {
  projectId: string;
}

export function ProjectComplianceMobile({ projectId }: ProjectComplianceMobileProps) {
  const { data: compliance, isLoading } = useProjectCompliance(projectId);
  const updateCompliance = useUpdateProjectCompliance(projectId);
  const [showDelegateSelector, setShowDelegateSelector] = useState(false);
  const [showHsrSelector, setShowHsrSelector] = useState(false);

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  if (!compliance) {
    return <div className="text-center py-8 text-muted-foreground">No data found</div>;
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

  const ComplianceItem = ({ 
    icon: Icon, 
    title, 
    status, 
    children 
  }: { 
    icon: any; 
    title: string; 
    status: boolean; 
    children: ReactNode;
  }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{title}</span>
          </div>
          <StatusIcon status={status} />
        </div>
        <div className="space-y-3">
          {children}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-3">
      {/* Delegate */}
      <ComplianceItem
        icon={User}
        title="Delegate"
        status={compliance.delegate_identified && compliance.delegate_elected}
      >
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
              <>
                {compliance.delegate_elected_date && (
                  <div className="text-sm text-muted-foreground">
                    Elected: {format(new Date(compliance.delegate_elected_date), "dd/MM/yyyy")}
                  </div>
                )}
                
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setShowDelegateSelector(true)}
                >
                  <span className="text-sm">
                    {compliance.delegate_worker ? (
                      `${compliance.delegate_worker.first_name} ${compliance.delegate_worker.surname}`
                    ) : (
                      "Select Delegate"
                    )}
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </>
        )}
      </ComplianceItem>

      {/* HSR */}
      <ComplianceItem
        icon={Shield}
        title="HSR Chair"
        status={compliance.hsr_chair_exists}
      >
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
                className="w-full justify-between"
                onClick={() => setShowHsrSelector(true)}
              >
                <span className="text-sm">
                  {compliance.hsr_worker ? (
                    `${compliance.hsr_worker.first_name} ${compliance.hsr_worker.surname}`
                  ) : (
                    "Select HSR"
                  )}
                </span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </ComplianceItem>

      {/* ABN Worker Check */}
      <ComplianceItem
        icon={Users}
        title="ABN Worker Check"
        status={compliance.abn_worker_check_conducted}
      >
        <div className="flex items-center justify-between">
          <Label htmlFor="abn-check">Conducted</Label>
          <Switch
            id="abn-check"
            checked={compliance.abn_worker_check_conducted}
            onCheckedChange={(checked) => handleUpdate("abn_worker_check_conducted", checked)}
          />
        </div>
        
        {compliance.abn_worker_check_conducted && compliance.abn_worker_check_date && (
          <div className="text-sm text-muted-foreground">
            Checked: {format(new Date(compliance.abn_worker_check_date), "dd/MM/yyyy")}
          </div>
        )}
      </ComplianceItem>

      {/* Inductions */}
      <ComplianceItem
        icon={ClipboardCheck}
        title="Inductions"
        status={compliance.inductions_attended}
      >
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
            {compliance.last_induction_date && (
              <div className="text-sm text-muted-foreground">
                Last: {format(new Date(compliance.last_induction_date), "dd/MM/yyyy")}
              </div>
            )}
            
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
      </ComplianceItem>

      {/* Site Access */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">Delegate Site Access</span>
              <StatusIcon status={compliance.delegate_site_access !== null && compliance.delegate_site_access !== 'none'} />
            </div>
            
            <Select
              value={compliance.delegate_site_access || "none"}
              onValueChange={(value) => handleUpdate("delegate_site_access", value as DelegateSiteAccess)}
            >
              <SelectTrigger>
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
                placeholder="Specify system..."
                value={compliance.delegate_site_access_other || ""}
                onChange={(e) => handleUpdate("delegate_site_access_other", e.target.value)}
              />
            )}
          </div>
        </CardContent>
      </Card>

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
