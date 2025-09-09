import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SingleEmployerPicker } from "./SingleEmployerPicker";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, AlertCircle, Building2, Users } from "lucide-react";
import { getTradeTypeLabel, getAllTradeTypes, type TradeType } from "@/utils/tradeUtils";

interface UnifiedContractorAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  siteId?: string; // Optional: if specified, focus on this site
  onSuccess: () => void;
}

interface JobSite {
  id: string;
  name: string;
  is_main_site: boolean;
}

interface Project {
  id: string;
  name: string;
  main_job_site_id: string | null;
}

const EBA_SIGNATORY_OPTIONS = [
  { value: "not_specified", label: "Not Specified" },
  { value: "yes", label: "Yes - EBA Signatory" },
  { value: "no", label: "No - Not EBA Signatory" },
  { value: "unknown", label: "Unknown" },
] as const;

const TRADE_STAGE_OPTIONS = [
  { value: "early_works", label: "Early Works" },
  { value: "structure", label: "Structure" },
  { value: "finishing", label: "Finishing" },
  { value: "other", label: "Other" },
] as const;

export function UnifiedContractorAssignmentModal({
  isOpen,
  onClose,
  projectId,
  siteId,
  onSuccess
}: UnifiedContractorAssignmentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form state
  const [selectedEmployerId, setSelectedEmployerId] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState(siteId || "");
  const [selectedTradeType, setSelectedTradeType] = useState<TradeType | "">("");
  const [estimatedWorkforce, setEstimatedWorkforce] = useState("");
  const [ebaSignatory, setEbaSignatory] = useState<"not_specified" | "yes" | "no" | "unknown">("not_specified");
  const [tradeStage, setTradeStage] = useState<"early_works" | "structure" | "finishing" | "other">("structure");
  const [isAssigning, setIsAssigning] = useState(false);

  // Get project details
  const { data: project } = useQuery({
    queryKey: ["project-detail", projectId],
    enabled: !!projectId && isOpen,
    queryFn: async (): Promise<Project> => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, main_job_site_id")
        .eq("id", projectId)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  // Get job sites for this project
  const { data: jobSites = [] } = useQuery({
    queryKey: ["project-job-sites", projectId],
    enabled: !!projectId && isOpen,
    queryFn: async (): Promise<JobSite[]> => {
      const { data, error } = await supabase
        .from("job_sites")
        .select("id, name, is_main_site")
        .eq("project_id", projectId)
        .order("is_main_site", { ascending: false }) // Main site first
        .order("name");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Auto-select main site if no site specified and only one site exists
  useEffect(() => {
    if (!selectedSiteId && jobSites.length > 0) {
      const mainSite = jobSites.find(site => site.is_main_site) || jobSites[0];
      setSelectedSiteId(mainSite.id);
    }
  }, [jobSites, selectedSiteId]);

  // Get existing assignments for validation
  const { data: existingAssignments = [] } = useQuery({
    queryKey: ["contractor-assignments", projectId, selectedEmployerId],
    enabled: !!projectId && !!selectedEmployerId && isOpen,
    queryFn: async () => {
      if (!selectedEmployerId) return [];
      
      const { data, error } = await supabase
        .rpc('get_unified_contractors', { p_project_id: projectId });
      
      if (error) throw error;
      
      return (data || []).find((contractor: any) => 
        contractor.employer_id === selectedEmployerId
      )?.assignments || [];
    },
  });

  const tradeTypeOptions = useMemo(() => {
    return getAllTradeTypes().map(tradeType => ({
      value: tradeType,
      label: getTradeTypeLabel(tradeType)
    }));
  }, []);

  const selectedSite = useMemo(() => {
    return jobSites.find(site => site.id === selectedSiteId);
  }, [jobSites, selectedSiteId]);

  const hasExistingAssignment = useMemo(() => {
    if (!selectedSiteId || !selectedTradeType) return false;
    
    return existingAssignments.some((assignment: any) => 
      assignment.type === 'site_trade' && 
      assignment.site_id === selectedSiteId && 
      assignment.trade_type === selectedTradeType
    );
  }, [existingAssignments, selectedSiteId, selectedTradeType]);

  const assignContractorMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmployerId || !selectedSiteId || !selectedTradeType) {
        throw new Error("Please fill in all required fields");
      }

      const workforce = estimatedWorkforce ? parseInt(estimatedWorkforce) : null;
      if (estimatedWorkforce && (!workforce || workforce <= 0)) {
        throw new Error("Estimated workforce must be a positive number");
      }

      // Use the unified assignment function
      const { data, error } = await supabase.rpc('assign_contractor_unified', {
        p_project_id: projectId,
        p_job_site_id: selectedSiteId,
        p_employer_id: selectedEmployerId,
        p_trade_type: selectedTradeType,
        p_estimated_workforce: workforce,
        p_eba_signatory: ebaSignatory,
        p_stage: tradeStage
      });

      if (error) throw error;
      
      const result = data?.[0];
      if (!result?.success) {
        throw new Error(result?.message || "Failed to assign contractor");
      }

      return result;
    },
    onSuccess: (result) => {
      toast({
        title: "Success",
        description: result.message || "Contractor assigned successfully",
      });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["unified-contractors", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-contractor-employers"] });
      queryClient.invalidateQueries({ queryKey: ["contractor-assignments"] });
      
      onSuccess();
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign contractor",
        variant: "destructive",
      });
    },
  });

  const handleAssign = () => {
    setIsAssigning(true);
    assignContractorMutation.mutate();
  };

  const handleClose = () => {
    setSelectedEmployerId("");
    setSelectedSiteId(siteId || "");
    setSelectedTradeType("");
    setEstimatedWorkforce("");
    setEbaSignatory("not_specified");
    setTradeStage("structure");
    setIsAssigning(false);
    onClose();
  };

  const isMultiSiteProject = jobSites.length > 1;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Assign Contractor to Project
          </DialogTitle>
          <DialogDescription>
            Assign a contractor to {project?.name || "this project"} with specific trade and site details.
            {isMultiSiteProject && " This project has multiple sites - please select the appropriate site."}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Project Info */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="h-4 w-4" />
              {project?.name}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {jobSites.length} site{jobSites.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Employer Selection */}
          <div>
            <SingleEmployerPicker
              label="Contractor/Employer"
              selectedId={selectedEmployerId}
              onChange={setSelectedEmployerId}
            />
          </div>

          {/* Site Selection (if multiple sites) */}
          {isMultiSiteProject && (
            <div>
              <Label>Job Site</Label>
              <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select job site..." />
                </SelectTrigger>
                <SelectContent>
                  {jobSites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      <div className="flex items-center gap-2">
                        <span>{site.name}</span>
                        {site.is_main_site && <Badge variant="secondary" className="text-xs">Main</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Single site display */}
          {!isMultiSiteProject && selectedSite && (
            <div>
              <Label>Job Site</Label>
              <div className="p-2 border rounded bg-muted text-sm flex items-center gap-2">
                <span>{selectedSite.name}</span>
                {selectedSite.is_main_site && <Badge variant="secondary" className="text-xs">Main Site</Badge>}
              </div>
            </div>
          )}

          {/* Trade Type Selection */}
          <div>
            <Label>Trade Type *</Label>
            <Select value={selectedTradeType} onValueChange={(value) => setSelectedTradeType(value as TradeType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select trade type..." />
              </SelectTrigger>
              <SelectContent>
                {tradeTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Trade Stage */}
          <div>
            <Label>Construction Stage</Label>
            <Select value={tradeStage} onValueChange={(value) => setTradeStage(value as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRADE_STAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Estimated Workforce */}
          <div>
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Estimated Workforce (Optional)
            </Label>
            <Input
              type="number"
              min="1"
              placeholder="e.g., 10"
              value={estimatedWorkforce}
              onChange={(e) => setEstimatedWorkforce(e.target.value)}
            />
          </div>

          {/* EBA Signatory Status */}
          <div>
            <Label>EBA Signatory Status</Label>
            <Select value={ebaSignatory} onValueChange={(value) => setEbaSignatory(value as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EBA_SIGNATORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Existing Assignment Warning */}
          {hasExistingAssignment && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This contractor is already assigned to this trade type on this site. 
                Proceeding will update the existing assignment.
              </AlertDescription>
            </Alert>
          )}

          {/* Existing Assignments Display */}
          {existingAssignments.length > 0 && (
            <div>
              <Label>Current Assignments</Label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {existingAssignments.map((assignment: any, index: number) => (
                  <div key={index} className="text-xs p-2 bg-muted rounded">
                    <div className="font-medium">
                      {assignment.type === 'project_role' && `Project Role: ${assignment.role}`}
                      {assignment.type === 'site_trade' && `Site Trade: ${getTradeTypeLabel(assignment.trade_type)}`}
                      {assignment.type === 'project_trade' && `Project Trade: ${getTradeTypeLabel(assignment.trade_type)} (${assignment.stage})`}
                    </div>
                    {assignment.site_name && (
                      <div className="text-muted-foreground">Site: {assignment.site_name}</div>
                    )}
                    {assignment.estimated_workforce && (
                      <div className="text-muted-foreground">Est. Workers: {assignment.estimated_workforce}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={isAssigning}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedEmployerId || !selectedSiteId || !selectedTradeType || isAssigning}
            >
              {isAssigning ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Assigning...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Assign Contractor
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
