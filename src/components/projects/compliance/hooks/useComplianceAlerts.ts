import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ComplianceAlert } from "@/types/compliance";
import { toast } from "sonner";

export function useComplianceAlerts(projectId?: string, limit: number = 10) {
  return useQuery({
    queryKey: ["compliance-alerts", projectId, limit],
    queryFn: async () => {
      let query = supabase
        .from("compliance_alerts")
        .select("*")
        .eq("acknowledged", false)
        .order("severity", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (projectId) {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return data as ComplianceAlert[];
    }
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (alertId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("compliance_alerts")
        .update({
          acknowledged: true,
          acknowledged_by: user?.id,
          acknowledged_at: new Date().toISOString()
        })
        .eq("id", alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-alerts"] });
      toast.success("Alert acknowledged");
    },
    onError: (error) => {
      console.error("Error acknowledging alert:", error);
      toast.error("Failed to acknowledge alert");
    }
  });
}

export function useGenerateComplianceAlerts() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("generate_compliance_alerts");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-alerts"] });
    },
    onError: (error) => {
      console.error("Error generating alerts:", error);
    }
  });
}

// Hook to get alert counts for dashboard badge
export function useComplianceAlertCounts() {
  return useQuery({
    queryKey: ["compliance-alert-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_alerts")
        .select("severity, id")
        .eq("acknowledged", false);

      if (error) throw error;

      const counts = {
        total: data.length,
        critical: data.filter(a => a.severity === 'critical').length,
        warning: data.filter(a => a.severity === 'warning').length,
        info: data.filter(a => a.severity === 'info').length
      };

      return counts;
    }
  });
}
