"use client"

import {  useState, useEffect  } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, X, RefreshCw, AlertTriangle, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [employerSearch, setEmployerSearch] = useState("");
  const [employers, setEmployers] = useState<Array<{ id: string; name: string }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Search employers when employer picker is shown
  useEffect(() => {
    if (showEmployerPicker) {
      searchEmployers();
    }
  }, [showEmployerPicker, employerSearch]);

  const searchEmployers = async () => {
    setSearchLoading(true);
    try {
      let query = supabase
        .from("employers")
        .select("id, name")
        .order("name");
      
      if (employerSearch) {
        query = query.ilike("name", `%${employerSearch}%`);
      }
      
      const { data, error } = await query.limit(50);
      if (error) throw error;
      
      setEmployers(data || []);
    } catch (error) {
      console.error("Error searching employers:", error);
    } finally {
      setSearchLoading(false);
    }
  };

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            {showEmployerPicker ? "Select Correct Employer" : "Auto-Matched Assignment"}
          </DialogTitle>
          <DialogDescription>
            {showEmployerPicker ? 
              "Choose the correct employer for this assignment." : 
              "This assignment was automatically matched from BCI project data and needs your review."}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {showEmployerPicker ? (
            <>
              {/* Employer Search */}
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Current: <span className="font-medium">{employerName}</span>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employers..."
                    value={employerSearch}
                    onChange={(e) => setEmployerSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                <ScrollArea className="h-[200px] border rounded-md">
                  <div className="p-2 space-y-1">
                    {searchLoading ? (
                      <div className="text-center py-4 text-muted-foreground">
                        Searching...
                      </div>
                    ) : employers.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        {employerSearch ? "No employers found" : "Type to search"}
                      </div>
                    ) : (
                      employers.map((employer) => (
                        <Button
                          key={employer.id}
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => handleEmployerSelected(employer.id, employer.name)}
                        >
                          {employer.name}
                        </Button>
                      ))
                    )}
                  </div>
                </ScrollArea>
                
                <Button 
                  onClick={() => {
                    setShowEmployerPicker(false);
                    setEmployerSearch("");
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
