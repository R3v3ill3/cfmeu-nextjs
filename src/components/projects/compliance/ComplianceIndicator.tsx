"use client"

import { AlertCircle, CheckCircle, Clock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRouter } from "next/navigation";
import { EmployerComplianceCheck } from "@/types/compliance";

interface ComplianceIndicatorProps {
  projectId: string;
  employerId: string;
  complianceData: EmployerComplianceCheck[];
}

export function ComplianceIndicator({ 
  projectId, 
  employerId, 
  complianceData 
}: ComplianceIndicatorProps) {
  const router = useRouter();
  
  // Find compliance record for this employer
  const compliance = complianceData.find(c => c.employer_id === employerId);
  
  const getStatusInfo = () => {
    if (!compliance) {
      return {
        icon: Clock,
        color: "text-gray-400",
        tooltip: "No compliance checks recorded",
        status: "pending"
      };
    }
    
    // Check for enforcement flags
    if (compliance.cbus_enforcement_flag || compliance.incolink_enforcement_flag) {
      return {
        icon: AlertCircle,
        color: "text-red-600",
        tooltip: "Compliance issues flagged for enforcement",
        status: "critical"
      };
    }
    
    // Check for follow-up required
    if (compliance.cbus_followup_required || compliance.incolink_followup_required) {
      return {
        icon: Info,
        color: "text-yellow-600",
        tooltip: "Follow-up required",
        status: "warning"
      };
    }
    
    // Check if any checks have been conducted
    if (compliance.cbus_check_conducted || compliance.incolink_check_conducted) {
      // Check payment status
      const cbusIssue = compliance.cbus_payment_status === 'incorrect' || 
                       compliance.cbus_payment_timing === 'late';
      const incolinkIssue = compliance.incolink_payment_status === 'incorrect' || 
                           compliance.incolink_payment_timing === 'late';
      
      if (cbusIssue || incolinkIssue) {
        return {
          icon: AlertCircle,
          color: "text-yellow-600",
          tooltip: "Payment issues detected",
          status: "warning"
        };
      }
      
      return {
        icon: CheckCircle,
        color: "text-green-600",
        tooltip: "Compliance checks completed",
        status: "compliant"
      };
    }
    
    return {
      icon: Clock,
      color: "text-gray-400",
      tooltip: "Compliance checks pending",
      status: "pending"
    };
  };
  
  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;
  
  const handleClick = () => {
    router.push(`/projects/${projectId}?tab=audit-compliance&employer=${employerId}`);
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleClick}
          >
            <Icon className={`h-4 w-4 ${statusInfo.color}`} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{statusInfo.tooltip}</p>
          <p className="text-xs text-muted-foreground mt-1">Click to view details</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
