"use client"

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, CheckCircle, AlertCircle, Calendar, FileText } from "lucide-react";
import { useBulkUpdateEmployerCompliance } from "./hooks/useEmployerCompliance";
import { toast } from "sonner";

interface BulkActionsMenuProps {
  projectId: string;
  selectedEmployerIds: string[];
}

export function BulkActionsMenu({ projectId, selectedEmployerIds }: BulkActionsMenuProps) {
  const bulkUpdate = useBulkUpdateEmployerCompliance(projectId);

  const handleBulkAction = (field: string, value: any) => {
    if (selectedEmployerIds.length === 0) {
      toast.error("No employers selected");
      return;
    }

    bulkUpdate.mutate({
      employerIds: selectedEmployerIds,
      field: field as any,
      value
    });
  };

  const isDisabled = selectedEmployerIds.length === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <MoreHorizontal className="h-4 w-4 mr-1" />
          Bulk Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Bulk Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={() => handleBulkAction('cbus_check_conducted', true)}
          disabled={isDisabled}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Mark CBUS Checked
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => handleBulkAction('incolink_check_conducted', true)}
          disabled={isDisabled}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Mark INCOLINK Checked
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={() => handleBulkAction('cbus_followup_required', true)}
          disabled={isDisabled}
        >
          <AlertCircle className="h-4 w-4 mr-2" />
          Flag CBUS Follow-up
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => handleBulkAction('incolink_followup_required', true)}
          disabled={isDisabled}
        >
          <AlertCircle className="h-4 w-4 mr-2" />
          Flag INCOLINK Follow-up
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={() => {
            const today = new Date().toISOString().split('T')[0];
            handleBulkAction('cbus_check_date', today);
          }}
          disabled={isDisabled}
        >
          <Calendar className="h-4 w-4 mr-2" />
          Set CBUS Check Today
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => {
            const today = new Date().toISOString().split('T')[0];
            handleBulkAction('incolink_check_date', today);
          }}
          disabled={isDisabled}
        >
          <Calendar className="h-4 w-4 mr-2" />
          Set INCOLINK Check Today
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem disabled>
          <FileText className="h-4 w-4 mr-2" />
          Export Selected (Coming Soon)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
