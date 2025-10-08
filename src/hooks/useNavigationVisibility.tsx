import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

export interface NavigationVisibility {
  patch: boolean
  employers: boolean
  eba_employers: boolean
  workers: boolean
  map: boolean
  site_visits: boolean
  lead_console: boolean
  campaigns: boolean
}

const DEFAULT_VISIBILITY: NavigationVisibility = {
  patch: true,
  employers: true,
  eba_employers: true,
  workers: true,
  map: true,
  site_visits: true,
  lead_console: true,
  campaigns: true,
}

const SETTINGS_KEY = "navigation_visibility"

interface NavigationSettingsRow {
  value: string
}

export function useNavigationVisibility() {
  const queryClient = useQueryClient()

  const { data: visibility, isLoading } = useQuery({
    queryKey: ["navigation-visibility"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", SETTINGS_KEY)
        .single<NavigationSettingsRow>()

      if (error) {
        if (error.code === "PGRST116") {
          // No settings found, return defaults
          return DEFAULT_VISIBILITY
        }
        throw error
      }

      try {
        const parsed = JSON.parse(data.value) as Partial<NavigationVisibility>
        return {
          ...DEFAULT_VISIBILITY,
          ...parsed,
        }
      } catch {
        return DEFAULT_VISIBILITY
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })

  const updateVisibility = useMutation({
    mutationFn: async (newVisibility: NavigationVisibility) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          key: SETTINGS_KEY,
          value: JSON.stringify(newVisibility),
          updated_at: new Date().toISOString(),
        })

      if (error) throw error
      return newVisibility
    },
    onMutate: async (newVisibility) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["navigation-visibility"] })

      // Snapshot the previous value
      const previousVisibility = queryClient.getQueryData<NavigationVisibility>(["navigation-visibility"])

      // Optimistically update to the new value
      queryClient.setQueryData(["navigation-visibility"], newVisibility)

      // Return a context object with the snapshotted value
      return { previousVisibility }
    },
    onError: (err, newVisibility, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousVisibility) {
        queryClient.setQueryData(["navigation-visibility"], context.previousVisibility)
      }
      toast.error("Failed to update navigation settings")
    },
    onSuccess: () => {
      toast.success("Navigation settings updated successfully")
      // Invalidate the query to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["navigation-visibility"] })
    },
  })

  return {
    visibility: visibility || DEFAULT_VISIBILITY,
    isLoading,
    updateVisibility: updateVisibility.mutate,
    isUpdating: updateVisibility.isPending,
  }
}
