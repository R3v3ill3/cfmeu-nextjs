import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmployerComplianceCheck } from "@/types/compliance";
import { toast } from "sonner";

export function useEmployerCompliance(projectId: string, employerId?: string) {
  return useQuery({
    queryKey: ["employer-compliance", projectId, employerId],
    queryFn: async () => {
      let query = supabase
        .from("employer_compliance_checks")
        .select(`
          *,
          employers(
            id,
            name,
            enterprise_agreement_status
          )
        `)
        .eq("project_id", projectId)
        .eq("is_current", true);

      if (employerId) {
        query = query.eq("employer_id", employerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return data as EmployerComplianceCheck[];
    },
    enabled: !!projectId
  });
}

export function useUpsertEmployerCompliance(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ employerId, updates }: { 
      employerId: string; 
      updates: Partial<EmployerComplianceCheck> 
    }) => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Check if record exists
      const { data: existing } = await supabase
        .from("employer_compliance_checks")
        .select("id")
        .eq("project_id", projectId)
        .eq("employer_id", employerId)
        .eq("is_current", true)
        .maybeSingle();

      if (existing) {
        // Create new version (trigger will archive old one)
        const { data, error } = await supabase
          .from("employer_compliance_checks")
          .insert({
            project_id: projectId,
            employer_id: employerId,
            ...updates,
            updated_by: user?.id,
            is_current: true
          })
          .select(`
            *,
            employers(
              id,
              name,
              enterprise_agreement_status
            )
          `)
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create initial record
        const { data, error } = await supabase
          .from("employer_compliance_checks")
          .insert({
            project_id: projectId,
            employer_id: employerId,
            ...updates,
            updated_by: user?.id
          })
          .select(`
            *,
            employers(
              id,
              name,
              enterprise_agreement_status
            )
          `)
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employer-compliance", projectId] });
      toast.success("Employer compliance updated");
    },
    onError: (error) => {
      console.error("Error updating employer compliance:", error);
      toast.error("Failed to update employer compliance");
    }
  });
}

export function useEmployerComplianceHistory(projectId: string, employerId: string) {
  return useQuery({
    queryKey: ["employer-compliance-history", projectId, employerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employer_compliance_checks")
        .select(`
          *,
          employers(
            id,
            name,
            enterprise_agreement_status
          ),
          updated_by_profile:profiles!employer_compliance_checks_updated_by_fkey(
            id,
            full_name
          )
        `)
        .eq("project_id", projectId)
        .eq("employer_id", employerId)
        .order("version", { ascending: false });

      if (error) throw error;
      return data as (EmployerComplianceCheck & {
        updated_by_profile?: { id: string; full_name: string | null };
      })[];
    },
    enabled: !!projectId && !!employerId
  });
}

// Bulk operations for efficiency
export function useBulkUpdateEmployerCompliance(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (updates: { 
      employerIds: string[]; 
      field: keyof EmployerComplianceCheck;
      value: any;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Process each employer
      const promises = updates.employerIds.map(async (employerId) => {
        const { data: existing } = await supabase
          .from("employer_compliance_checks")
          .select("*")
          .eq("project_id", projectId)
          .eq("employer_id", employerId)
          .eq("is_current", true)
          .maybeSingle();

        const updateData = existing || { project_id: projectId, employer_id: employerId };
        updateData[updates.field] = updates.value;
        updateData.updated_by = user?.id;
        updateData.is_current = true;

        return supabase
          .from("employer_compliance_checks")
          .insert(updateData)
          .select();
      });

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);
      
      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} employers`);
      }
      
      return results.map(r => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employer-compliance", projectId] });
      toast.success("Bulk compliance update completed");
    },
    onError: (error) => {
      console.error("Error in bulk update:", error);
      toast.error("Some updates failed");
    }
  });
}
