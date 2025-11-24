"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/hooks/useAuth"
import { toast } from "sonner"

const DEFAULT_AUDIT_TARGET = 75

/**
 * Hook to manage user-specific project audit target percentage
 * Stores in localStorage with user ID for user-specific settings
 * Default: 75%
 */
export function useProjectAuditTarget() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const storageKey = user?.id ? `project-audit-target-${user.id}` : null

  // Get user's audit target preference
  const { data: auditTarget, isLoading } = useQuery({
    queryKey: ["project-audit-target", user?.id],
    queryFn: async () => {
      if (!storageKey || typeof window === 'undefined') return DEFAULT_AUDIT_TARGET
      
      try {
        const stored = localStorage.getItem(storageKey)
        if (stored) {
          const parsed = parseInt(stored, 10)
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
            return parsed
          }
        }
      } catch (error) {
        console.error("Error loading audit target:", error)
      }
      
      return DEFAULT_AUDIT_TARGET
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Update audit target mutation
  const updateAuditTarget = useMutation({
    mutationFn: async (target: number) => {
      if (!storageKey || typeof window === 'undefined') {
        throw new Error("User not authenticated or localStorage not available")
      }

      if (target < 0 || target > 100) {
        throw new Error("Audit target must be between 0 and 100")
      }

      localStorage.setItem(storageKey, String(target))
      return target
    },
    onMutate: async (target) => {
      await queryClient.cancelQueries({ queryKey: ["project-audit-target", user?.id] })
      const previousTarget = queryClient.getQueryData<number>([
        "project-audit-target",
        user?.id,
      ])
      queryClient.setQueryData(["project-audit-target", user?.id], target)
      return { previousTarget }
    },
    onError: (err, target, context) => {
      if (context?.previousTarget !== undefined) {
        queryClient.setQueryData(
          ["project-audit-target", user?.id],
          context.previousTarget
        )
      }
      toast.error("Failed to update audit target")
    },
    onSuccess: () => {
      toast.success("Audit target updated")
      queryClient.invalidateQueries({ queryKey: ["project-audit-target", user?.id] })
    },
  })

  return {
    auditTarget: auditTarget ?? DEFAULT_AUDIT_TARGET,
    isLoading,
    updateAuditTarget: updateAuditTarget.mutate,
    isUpdating: updateAuditTarget.isPending,
  }
}




