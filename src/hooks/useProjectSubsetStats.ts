"use client"

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectSubsetStats {
  known_employer_count: number;
  eba_active_count: number;
  eba_percentage: number;
}

/**
 * Hook to get subset EBA statistics for a specific project
 * Focuses on builders, project managers, and key trade types:
 * - Demolition, Piling, Concrete, Scaffolding, Form Work, Tower Crane, Mobile Crane
 */
export function useProjectSubsetStats(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["project-subset-stats", projectId],
    enabled: !!projectId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ProjectSubsetStats> => {
      if (!projectId) {
        return { known_employer_count: 0, eba_active_count: 0, eba_percentage: 0 };
      }

      const { data, error } = await supabase
        .rpc('get_project_subset_stats', { p_project_id: projectId });

      if (error) {
        console.error('Error fetching project subset stats:', error);
        throw error;
      }

      // The RPC returns an array, we want the first (and only) result
      const stats = data?.[0] || { known_employer_count: 0, eba_active_count: 0, eba_percentage: 0 };
      
      return {
        known_employer_count: stats.known_employer_count || 0,
        eba_active_count: stats.eba_active_count || 0,
        eba_percentage: stats.eba_percentage || 0,
      };
    }
  });
}

/**
 * Hook to get subset EBA statistics for multiple projects at once
 * Uses the pre-calculated view for better performance
 */
export function useMultipleProjectSubsetStats(projectIds: string[]) {
  return useQuery({
    queryKey: ["multiple-project-subset-stats", projectIds.sort()],
    enabled: projectIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Record<string, ProjectSubsetStats>> => {
      if (projectIds.length === 0) return {};

      const { data, error } = await supabase
        .from('project_subset_eba_stats')
        .select('project_id, known_employer_count, eba_active_count, eba_percentage')
        .in('project_id', projectIds);

      if (error) {
        console.error('Error fetching multiple project subset stats:', error);
        throw error;
      }

      // Transform array to object keyed by project_id
      const statsMap: Record<string, ProjectSubsetStats> = {};
      (data || []).forEach((row: any) => {
        statsMap[row.project_id] = {
          known_employer_count: row.known_employer_count || 0,
          eba_active_count: row.eba_active_count || 0,
          eba_percentage: row.eba_percentage || 0,
        };
      });

      return statsMap;
    }
  });
}
