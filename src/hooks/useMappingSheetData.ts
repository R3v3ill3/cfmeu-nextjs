import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchMappingSheetData, type MappingSheetData } from "@/lib/mappingSheetData";

/**
 * Specialized hook for mapping sheets that combines all contractor data sources
 * while preserving the required stage structure and trade labels
 */
export function useMappingSheetData(projectId: string) {
  return useQuery({
    queryKey: ["mapping-sheet-data", projectId],
    enabled: !!projectId,
    staleTime: 5000, // Reduced from 30s to 5s to pick up delegate changes faster
    refetchOnWindowFocus: true, // Refetch when user comes back to the window
    queryFn: async (): Promise<MappingSheetData> => {
      if (!projectId) throw new Error("Project ID required");
      return fetchMappingSheetData(supabase, projectId);
    },
  });
}
