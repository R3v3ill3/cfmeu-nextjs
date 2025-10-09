import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/hooks/useAuth"
import { supabase } from "@/integrations/supabase/client"

/**
 * Centralized hook for fetching and caching user role.
 * Uses React Query to ensure consistent role data across all components
 * and eliminate race conditions in navigation rendering.
 */
export function useUserRole() {
  const { user } = useAuth()
  
  return useQuery({
    queryKey: ["user-role", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes - role changes are rare
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!user?.id) return null
      
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
      
      if (error) {
        console.error("Error fetching user role:", error)
        throw error
      }
      
      return (profile?.role as string | null) || null
    }
  })
}


