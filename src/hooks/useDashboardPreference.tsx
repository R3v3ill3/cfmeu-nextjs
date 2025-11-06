import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import { toast } from "sonner"

export type DashboardPreference = 'legacy' | 'new' | 'auto'

interface AppSettingsRow {
  value: string
}

interface DashboardSettings {
  default_dashboard: DashboardPreference
  allow_user_override: boolean
}

const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
  default_dashboard: 'legacy',
  allow_user_override: true,
}

/**
 * Hook to manage dashboard preference
 * Returns resolved dashboard preference (user override → admin default → legacy)
 */
export function useDashboardPreference() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Get user's dashboard preference
  const { data: userPreference, isLoading: userLoading } = useQuery({
    queryKey: ["user-dashboard-preference", user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      
      const { data, error } = await supabase
        .from("profiles")
        .select("dashboard_preference")
        .eq("id", user.id)
        .single()

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching user dashboard preference:", error)
        return null
      }

      return (data?.dashboard_preference as DashboardPreference | null) || null
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Get admin default dashboard setting
  const { data: adminSettings, isLoading: adminLoading } = useQuery({
    queryKey: ["admin-dashboard-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "default_dashboard")
        .single<AppSettingsRow>()

      if (error) {
        if (error.code === "PGRST116") {
          return DEFAULT_DASHBOARD_SETTINGS
        }
        console.error("Error fetching admin dashboard settings:", error)
        return DEFAULT_DASHBOARD_SETTINGS
      }

      try {
        const parsed = JSON.parse(data.value) as DashboardPreference
        return {
          default_dashboard: parsed,
          allow_user_override: true, // Default to true, can be extended later
        }
      } catch {
        return DEFAULT_DASHBOARD_SETTINGS
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Resolve final dashboard preference
  const resolvedPreference: DashboardPreference = 
    userPreference !== null && userPreference !== 'auto'
      ? userPreference
      : adminSettings?.default_dashboard || 'legacy'

  // Update user preference mutation
  const updatePreference = useMutation({
    mutationFn: async (preference: DashboardPreference) => {
      if (!user?.id) throw new Error("User not authenticated")

      const { error } = await supabase
        .from("profiles")
        .update({ dashboard_preference: preference })
        .eq("id", user.id)

      if (error) throw error
      return preference
    },
    onMutate: async (preference) => {
      await queryClient.cancelQueries({ queryKey: ["user-dashboard-preference", user?.id] })
      const previousPreference = queryClient.getQueryData<DashboardPreference>([
        "user-dashboard-preference",
        user?.id,
      ])
      queryClient.setQueryData(["user-dashboard-preference", user?.id], preference)
      return { previousPreference }
    },
    onError: (err, preference, context) => {
      if (context?.previousPreference !== undefined) {
        queryClient.setQueryData(
          ["user-dashboard-preference", user?.id],
          context.previousPreference
        )
      }
      toast.error("Failed to update dashboard preference")
    },
    onSuccess: () => {
      toast.success("Dashboard preference updated")
      queryClient.invalidateQueries({ queryKey: ["user-dashboard-preference", user?.id] })
    },
  })

  return {
    resolvedPreference,
    userPreference: userPreference || null,
    adminDefault: adminSettings?.default_dashboard || 'legacy',
    isLoading: userLoading || adminLoading,
    updatePreference: updatePreference.mutate,
    isUpdating: updatePreference.isPending,
  }
}

/**
 * Hook for admin to manage default dashboard setting
 */
export function useAdminDashboardSettings() {
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-dashboard-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "default_dashboard")
        .single<AppSettingsRow>()

      if (error) {
        if (error.code === "PGRST116") {
          return DEFAULT_DASHBOARD_SETTINGS
        }
        throw error
      }

      try {
        const parsed = JSON.parse(data.value) as DashboardPreference
        return {
          default_dashboard: parsed,
          allow_user_override: true,
        }
      } catch {
        return DEFAULT_DASHBOARD_SETTINGS
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  const updateDefaultDashboard = useMutation({
    mutationFn: async (defaultDashboard: DashboardPreference) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          key: "default_dashboard",
          value: JSON.stringify(defaultDashboard),
          updated_at: new Date().toISOString(),
        })

      if (error) throw error
      return { default_dashboard: defaultDashboard, allow_user_override: true }
    },
    onSuccess: () => {
      toast.success("Default dashboard updated")
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-settings"] })
      // Also invalidate user preferences to trigger recalculation
      queryClient.invalidateQueries({ queryKey: ["user-dashboard-preference"] })
    },
    onError: () => {
      toast.error("Failed to update default dashboard")
    },
  })

  return {
    settings: settings || DEFAULT_DASHBOARD_SETTINGS,
    isLoading,
    updateDefaultDashboard: updateDefaultDashboard.mutate,
    isUpdating: updateDefaultDashboard.isPending,
  }
}

