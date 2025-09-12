"use client"

import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, X, RefreshCw, AlertTriangle } from "lucide-react";
import { SingleEmployerDialogPicker } from "@/components/projects/SingleEmployerDialogPicker";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AutoMatchActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignmentId: string;
  assignmentTable: 'project_assignments' | 'project_contractor_trades';
  employerName: string;
  tradeOrRole: string;
  matchConfidence?: number;
  matchNotes?: string;
  onAction: (action: 'confirmed' | 'removed' | 'changed') => void;
}

export function AutoMatchActionsDialog({
  open,
  onOpenChange,
  assignmentId,
  assignmentTable,
  employerName,
  tradeOrRole,
  matchConfidence,
  matchNotes,
  onAction
}: AutoMatchActionsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [showEmployerPicker, setShowEmployerPicker] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('confirm_assignment', {
        assignment_table: assignmentTable,
        assignment_id: assignmentId
      });
      
      if (error) throw error;
      
      toast.success("Assignment confirmed");
      onAction('confirmed');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to confirm assignment");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from(assignmentTable)
        .delete()
        .eq('id', assignmentId);
        
      if (error) throw error;
      
      toast.success("Assignment removed");
      onAction('removed');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to remove assignment");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = () => {
    setShowEmployerPicker(true);
  };

  const handleEmployerSelected = async (employerId: string, employerName: string) => {
    setLoading(true);
    try {
      // Update the assignment with the new employer
      const { error } = await supabase
        .from(assignmentTable)
        .update({ 
          employer_id: employerId,
          match_status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          confirmed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', assignmentId);
        
      if (error) throw error;
      
      toast.success(`Assignment updated to ${employerName}`);
      onAction('changed');
      setShowEmployerPicker(false);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update assignment");
    } finally {
      setLoading(false);
    }
  };

  if (showEmployerPicker) {
    return (
      <SingleEmployerDialogPicker
        open={showEmployerPicker}
        onOpenChange={setShowEmployerPicker}
        title="Select Correct Employer"
        onEmployerSelected={handleEmployerSelected}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Auto-Matched Assignment
          </DialogTitle>
          <DialogDescription>
            This assignment was automatically matched from BCI project data and needs your review.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Assignment Details */}
          <div className="border rounded-lg p-3 bg-muted/20">
            <div className="font-medium">{employerName}</div>
            <div className="text-sm text-muted-foreground">{tradeOrRole}</div>
            {matchConfidence !== undefined && matchConfidence < 1 && (
              <div className="text-sm text-muted-foreground mt-1">
                Match Confidence: {Math.round(matchConfidence * 100)}%
              </div>
            )}
            {matchNotes && (
              <div className="text-sm text-muted-foreground mt-1">
                Notes: {matchNotes}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button 
              onClick={handleConfirm} 
              disabled={loading}
              className="w-full justify-start"
              variant="default"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirm - This is correct
            </Button>
            
            <Button 
              onClick={handleChange}
              disabled={loading}
              className="w-full justify-start"
              variant="outline"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Change - Select different employer
            </Button>
            
            <Button 
              onClick={handleRemove}
              disabled={loading}
              className="w-full justify-start"
              variant="destructive"
            >
              <X className="w-4 h-4 mr-2" />
              Remove - This is incorrect
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
