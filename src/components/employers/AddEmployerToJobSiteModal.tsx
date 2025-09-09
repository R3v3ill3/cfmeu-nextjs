import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { SingleEmployerPicker } from "@/components/projects/SingleEmployerPicker";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

interface AddEmployerToJobSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobSiteId: string;
  onEmployerAdded: () => void;
}

export function AddEmployerToJobSiteModal({
  isOpen,
  onClose,
  jobSiteId,
  onEmployerAdded
}: AddEmployerToJobSiteModalProps) {
  const { toast } = useToast();
  const [selectedEmployerId, setSelectedEmployerId] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [estimate, setEstimate] = useState<string>("");

  // Get job site details including project
  const { data: jobSite } = useQuery({
    queryKey: ["job-site-detail", jobSiteId],
    enabled: !!jobSiteId && isOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_sites")
        .select("id, name, project_id")
        .eq("id", jobSiteId)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const handleAddEmployer = async () => {
    if (!selectedEmployerId || !jobSite) return;
    const est = Number(estimate)
    if (!Number.isFinite(est) || est <= 0) {
      toast({ title: "Estimated workers required", description: "Enter a positive estimate for this employer at this site.", variant: "destructive" })
      return
    }

    setIsAdding(true);
    try {
      // Add employer to project_employer_roles if project exists
      if (jobSite.project_id) {
        const { error: projectError } = await supabase
          .from("project_employer_roles")
          .insert({
            project_id: jobSite.project_id,
            employer_id: selectedEmployerId,
            role: "contractor" // Default role
          });

        if (projectError && !projectError.message.includes("duplicate")) {
          throw projectError;
        }
      }

      // Add employer to site_contractor_trades for direct job site link
      const { error: siteError } = await supabase
        .from("site_contractor_trades")
        .insert({
          job_site_id: jobSiteId,
          employer_id: selectedEmployerId,
          trade_type: "electrical", // Use a valid trade type from the enum
          eba_signatory: "not_specified"
        });

      if (siteError && !siteError.message.includes("duplicate")) {
        throw siteError;
      }

      // Upsert project-level estimate row for this employer
      if (jobSite.project_id) {
        // Try to find an existing project_contractor_trades row; otherwise insert one
        const { data: existingPct } = await (supabase as any)
          .from("project_contractor_trades")
          .select("id")
          .eq("project_id", jobSite.project_id)
          .eq("employer_id", selectedEmployerId)

        if ((existingPct as any[])?.length) {
          const firstId = (existingPct as any[])[0].id
          await (supabase as any)
            .from("project_contractor_trades")
            .update({ estimated_project_workforce: est })
            .eq("id", firstId)
        } else {
          await (supabase as any)
            .from("project_contractor_trades")
            .insert([{ 
              project_id: jobSite.project_id, 
              employer_id: selectedEmployerId, 
              trade_type: "labour_hire", 
              eba_signatory: "not_specified", 
              estimated_project_workforce: est,
              assignment_id: crypto.randomUUID(), // Add unique assignment ID for multiple trade type support
              created_at: new Date().toISOString(),
              assignment_notes: "Added via job site modal"
            }])
        }
      }

      toast({
        title: "Success",
        description: "Employer has been linked to the job site and project.",
      });

      setSelectedEmployerId("");
      setEstimate("");
      onEmployerAdded();
    } catch (error: any) {
      console.error("Error adding employer:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add employer to job site.",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    setSelectedEmployerId("");
    setEstimate("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Employer to Job Site</DialogTitle>
          <DialogDescription>
            Select an employer to link to this job site. The employer will be added to both the job site and its associated project.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Job Site</Label>
            <div className="p-2 border rounded bg-muted text-sm">
              {jobSite?.name ? jobSite.name : (<span className="inline-flex items-center gap-2"><img src="/spinner.gif" alt="Loading" className="h-4 w-4" /> Loading...</span>)}
            </div>
          </div>

          <div>
            <SingleEmployerPicker
              label="Employer"
              selectedId={selectedEmployerId}
              onChange={setSelectedEmployerId}
            />
          </div>

          <div>
            <Label>Estimated workers at this project</Label>
            <Input type="number" min={1} placeholder="e.g., 10" value={estimate} onChange={(e) => setEstimate(e.target.value)} />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleAddEmployer}
              disabled={!selectedEmployerId || isAdding}
            >
              {isAdding ? "Adding..." : "Add Employer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}