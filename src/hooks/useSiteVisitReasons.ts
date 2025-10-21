import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

export interface SiteVisitReasonDefinition {
  id: string
  name: string
  display_name: string
  description: string | null
  is_global: boolean
  created_by_lead_organiser_id: string | null
  is_active: boolean
  display_order: number
  always_visible: boolean
  created_at: string
  updated_at: string
}

/**
 * Hook to fetch available visit reason definitions for the current user
 * Returns global reasons + custom reasons from the user's lead organisers
 */
export function useSiteVisitReasonDefinitions(organiserId?: string) {
  return useQuery({
    queryKey: ["site-visit-reason-definitions", organiserId],
    queryFn: async () => {
      // Get global reasons
      const { data: globalReasons, error: globalError } = await supabase
        .from("site_visit_reason_definitions")
        .select("*")
        .eq("is_global", true)
        .eq("is_active", true)
        .order("display_order")
      
      if (globalError) throw globalError

      // If no organiser specified, return only global
      if (!organiserId) {
        return globalReasons || []
      }

      // Get custom reasons from lead organisers managing this organiser
      const { data: leadAssignments, error: leadError } = await supabase
        .from("v_organiser_lead_assignments")
        .select("lead_organiser_id")
        .eq("organiser_id", organiserId)
      
      if (leadError) throw leadError

      const leadIds = (leadAssignments || []).map((la: any) => la.lead_organiser_id)

      if (leadIds.length === 0) {
        return globalReasons || []
      }

      // Get custom reasons from these leads
      const { data: customReasons, error: customError } = await supabase
        .from("site_visit_reason_definitions")
        .select("*")
        .eq("is_global", false)
        .eq("is_active", true)
        .in("created_by_lead_organiser_id", leadIds)
        .order("display_order")
      
      if (customError) throw customError

      // Combine and sort by display_order
      const allReasons = [...(globalReasons || []), ...(customReasons || [])]
      allReasons.sort((a, b) => a.display_order - b.display_order)

      return allReasons as SiteVisitReasonDefinition[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to fetch custom reasons created by a specific lead organiser
 */
export function useLeadOrganiserCustomReasons(leadOrganiserId?: string) {
  return useQuery({
    queryKey: ["lead-custom-reasons", leadOrganiserId],
    queryFn: async () => {
      if (!leadOrganiserId) return []

      const { data, error } = await supabase
        .from("site_visit_reason_definitions")
        .select("*")
        .eq("is_global", false)
        .eq("created_by_lead_organiser_id", leadOrganiserId)
        .order("display_order")
      
      if (error) throw error
      return data as SiteVisitReasonDefinition[]
    },
    enabled: !!leadOrganiserId,
  })
}

/**
 * Hook to create a new custom visit reason
 */
export function useCreateSiteVisitReason() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (reason: Omit<SiteVisitReasonDefinition, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("site_visit_reason_definitions")
        .insert(reason)
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lead-custom-reasons", variables.created_by_lead_organiser_id] })
      queryClient.invalidateQueries({ queryKey: ["site-visit-reason-definitions"] })
      toast.success("Visit reason created successfully")
    },
    onError: (error: Error) => {
      toast.error(`Failed to create visit reason: ${error.message}`)
    },
  })
}

/**
 * Hook to update a custom visit reason
 */
export function useUpdateSiteVisitReason() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { 
      id: string
      updates: Partial<Omit<SiteVisitReasonDefinition, "id" | "created_at" | "updated_at">>
    }) => {
      const { data, error } = await supabase
        .from("site_visit_reason_definitions")
        .update(updates)
        .eq("id", id)
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-custom-reasons"] })
      queryClient.invalidateQueries({ queryKey: ["site-visit-reason-definitions"] })
      toast.success("Visit reason updated successfully")
    },
    onError: (error: Error) => {
      toast.error(`Failed to update visit reason: ${error.message}`)
    },
  })
}

/**
 * Hook to delete/deactivate a custom visit reason
 */
export function useDeleteSiteVisitReason() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from("site_visit_reason_definitions")
        .update({ is_active: false })
        .eq("id", id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-custom-reasons"] })
      queryClient.invalidateQueries({ queryKey: ["site-visit-reason-definitions"] })
      toast.success("Visit reason deactivated successfully")
    },
    onError: (error: Error) => {
      toast.error(`Failed to deactivate visit reason: ${error.message}`)
    },
  })
}

