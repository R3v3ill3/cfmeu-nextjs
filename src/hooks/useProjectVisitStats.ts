import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

export interface ProjectVisitStats {
  project_id: string
  last_visit_date: string | null
  total_visits: number
  unique_organisers: number
}

export interface ProjectVisitFrequency {
  project_id: string
  visits_last_3_months: number
  visits_last_6_months: number
  visits_last_12_months: number
  total_completed_visits: number
  draft_visits: number
  last_completed_visit_date: string | null
}

export interface PatchVisitCoverage {
  patch_id: string
  patch_name: string
  total_projects: number
  projects_visited_3m: number
  projects_visited_6m: number
  projects_visited_12m: number
  projects_never_visited: number
  pct_visited_3m: number
  pct_visited_6m: number
  pct_visited_12m: number
}

export interface LeadOrganiserVisitSummary {
  lead_organiser_id: string
  lead_organiser_name: string
  total_projects_in_scope: number
  projects_visited_3m: number
  projects_visited_6m: number
  projects_visited_12m: number
  pct_visited_3m: number
  pct_visited_6m: number
  pct_visited_12m: number
  visits_this_month: number
  team_organisers_count: number
}

/**
 * Hook to fetch last visit stats for a project
 */
export function useProjectLastVisit(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["project-last-visit", projectId],
    queryFn: async () => {
      if (!projectId) return null

      const { data, error } = await supabase
        .from("v_project_last_visit")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle()
      
      if (error) throw error
      return data as ProjectVisitStats | null
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to fetch visit frequency for a project
 */
export function useProjectVisitFrequency(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["project-visit-frequency", projectId],
    queryFn: async () => {
      if (!projectId) return null

      const { data, error } = await supabase
        .from("v_project_visit_frequency")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle()
      
      if (error) throw error
      return data as ProjectVisitFrequency | null
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Hook to fetch visit coverage for a patch
 */
export function usePatchVisitCoverage(patchId: string | null | undefined) {
  return useQuery({
    queryKey: ["patch-visit-coverage", patchId],
    queryFn: async () => {
      if (!patchId) return null

      const { data, error } = await supabase
        .from("v_patch_visit_coverage")
        .select("*")
        .eq("patch_id", patchId)
        .maybeSingle()
      
      if (error) throw error
      return data as PatchVisitCoverage | null
    },
    enabled: !!patchId,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Hook to fetch visit summary for a lead organiser
 */
export function useLeadOrganiserVisitSummary(leadOrganiserId: string | null | undefined) {
  return useQuery({
    queryKey: ["lead-organiser-visit-summary", leadOrganiserId],
    queryFn: async () => {
      if (!leadOrganiserId) return null

      const { data, error } = await supabase
        .from("v_lead_organiser_visit_summary")
        .select("*")
        .eq("lead_organiser_id", leadOrganiserId)
        .maybeSingle()
      
      if (error) throw error
      return data as LeadOrganiserVisitSummary | null
    },
    enabled: !!leadOrganiserId,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Hook to fetch all patch visit coverage
 */
export function useAllPatchesVisitCoverage() {
  return useQuery({
    queryKey: ["all-patches-visit-coverage"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_patch_visit_coverage")
        .select("*")
        .order("patch_name")
      
      if (error) throw error
      return data as PatchVisitCoverage[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

