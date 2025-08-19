import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import { AddEmployerToJobSiteModal } from "./AddEmployerToJobSiteModal";
import { useToast } from "@/hooks/use-toast";

interface JobSiteEmployerManagerProps {
  jobSiteId: string;
  selectedEmployerIds: string[];
  onEmployerSelectionChange: (employerIds: string[]) => void;
}

export function JobSiteEmployerManager({
  jobSiteId,
  selectedEmployerIds,
  onEmployerSelectionChange
}: JobSiteEmployerManagerProps) {
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);

  // Get all employers linked to this job site
  const { data: linkedEmployers = [], refetch } = useQuery({
    queryKey: ["job-site-employers", jobSiteId],
    enabled: !!jobSiteId,
    queryFn: async () => {
      // Get employers through site_contractor_trades
      const { data: siteContractors, error: siteError } = await supabase
        .from("site_contractor_trades")
        .select(`
          employer_id,
          employer:employers(id, name)
        `)
        .eq("job_site_id", jobSiteId);

      if (siteError) throw siteError;

      // Get employers through project relationships
      const { data: jobSite, error: jobSiteError } = await supabase
        .from("job_sites")
        .select(`
          project_id,
          project:projects(
            project_employer_roles(
              employer_id,
              employer:employers(id, name)
            )
          )
        `)
        .eq("id", jobSiteId)
        .single();

      if (jobSiteError) throw jobSiteError;

      // Combine employers from both sources
      type EmployerBasic = { id: string; name: string };
      const allEmployers = new Map<string, EmployerBasic>();
      
      // Add direct site contractors
      siteContractors?.forEach((sc: any) => {
        const employers: EmployerBasic[] = Array.isArray(sc?.employer)
          ? sc.employer
          : sc?.employer
          ? [sc.employer]
          : [];
        employers.forEach((e) => allEmployers.set(e.id, e));
      });

      // Add project employers
      (jobSite as any)?.project?.project_employer_roles?.forEach((per: any) => {
        const employers: EmployerBasic[] = Array.isArray(per?.employer)
          ? per.employer
          : per?.employer
          ? [per.employer]
          : [];
        employers.forEach((e) => allEmployers.set(e.id, e));
      });

      return Array.from(allEmployers.values());
    },
  });

  const handleRemoveEmployer = (employerId: string) => {
    const newSelection = selectedEmployerIds.filter(id => id !== employerId);
    onEmployerSelectionChange(newSelection);
  };

  const handleEmployerAdded = () => {
    refetch();
    setShowAddModal(false);
    toast({
      title: "Employer Added",
      description: "Employer has been successfully linked to the job site.",
    });
  };

  const selectedEmployers = (linkedEmployers as Array<{ id: string; name: string }>).filter((emp) =>
    selectedEmployerIds.includes(emp.id)
  );

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Selected Employers</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedEmployers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No employers selected</p>
          ) : (
            selectedEmployers.map(employer => (
              <Badge key={employer.id} variant="secondary" className="flex items-center gap-2">
                {employer.name}
                <button
                  onClick={() => handleRemoveEmployer(employer.id)}
                  className="hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          )}
        </div>
      </div>

      {(linkedEmployers as Array<{ id: string; name: string }>).length > selectedEmployers.length && (
        <div>
          <label className="text-sm font-medium">Available Employers</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(linkedEmployers as Array<{ id: string; name: string }>)
              .filter((emp) => !selectedEmployerIds.includes(emp.id))
              .map((employer) => (
                <Badge 
                  key={employer.id} 
                  variant="outline" 
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => onEmployerSelectionChange([...selectedEmployerIds, employer.id])}
                >
                  {employer.name}
                </Badge>
              ))
            }
          </div>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setShowAddModal(true)}
        className="flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Add Employer to Job Site
      </Button>

      <AddEmployerToJobSiteModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        jobSiteId={jobSiteId}
        onEmployerAdded={handleEmployerAdded}
      />
    </div>
  );
}