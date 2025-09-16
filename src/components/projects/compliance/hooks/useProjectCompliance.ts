import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProjectCompliance } from "@/types/compliance";
import { toast } from "sonner";

export function useProjectCompliance(projectId: string) {
  return useQuery({
    queryKey: ["project-compliance", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_compliance")
        .select(`
          *,
          delegate_worker:workers!project_compliance_delegate_worker_id_fkey(
            id,
            first_name,
            surname
          ),
          hsr_worker:workers!project_compliance_hsr_worker_id_fkey(
            id,
            first_name,
            surname
          )
        `)
        .eq("project_id", projectId)
        .eq("is_current", true)
        .maybeSingle();

      if (error) throw error;
      
      // If no record exists, create a default one
      if (!data) {
        const { data: newData, error: insertError } = await supabase
          .from("project_compliance")
          .insert({
            project_id: projectId,
            reporting_frequency: 'monthly'
          })
          .select(`
            *,
            delegate_worker:workers!project_compliance_delegate_worker_id_fkey(
              id,
              first_name,
              surname
            ),
            hsr_worker:workers!project_compliance_hsr_worker_id_fkey(
              id,
              first_name,
              surname
            )
          `)
          .single();
          
        if (insertError) throw insertError;
        return newData as ProjectCompliance;
      }
      
      return data as ProjectCompliance;
    },
    enabled: !!projectId
  });
}

export function useUpdateProjectCompliance(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (updates: Partial<ProjectCompliance>) => {
      // First, get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Archive current record by creating a new one (trigger will handle archiving)
      const { data, error } = await supabase
        .from("project_compliance")
        .insert({
          project_id: projectId,
          ...updates,
          updated_by: user?.id,
          is_current: true
        })
        .select(`
          *,
          delegate_worker:workers!project_compliance_delegate_worker_id_fkey(
            id,
            first_name,
            surname
          ),
          hsr_worker:workers!project_compliance_hsr_worker_id_fkey(
            id,
            first_name,
            surname
          )
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-compliance", projectId] });
      toast.success("Compliance updated successfully");
    },
    onError: (error) => {
      console.error("Error updating compliance:", error);
      toast.error("Failed to update compliance");
    }
  });
}

export function useProjectComplianceHistory(projectId: string) {
  return useQuery({
    queryKey: ["project-compliance-history", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_compliance")
        .select(`
          *,
          delegate_worker:workers!project_compliance_delegate_worker_id_fkey(
            id,
            first_name,
            surname
          ),
          hsr_worker:workers!project_compliance_hsr_worker_id_fkey(
            id,
            first_name,
            surname
          ),
          created_by_profile:profiles!project_compliance_created_by_fkey(
            id,
            full_name
          ),
          updated_by_profile:profiles!project_compliance_updated_by_fkey(
            id,
            full_name
          )
        `)
        .eq("project_id", projectId)
        .order("version", { ascending: false });

      if (error) throw error;
      return data as (ProjectCompliance & {
        created_by_profile?: { id: string; full_name: string | null };
        updated_by_profile?: { id: string; full_name: string | null };
      })[];
    },
    enabled: !!projectId
  });
}
