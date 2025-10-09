"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getOrganisingUniverseBadgeVariant, OrganisingUniverseStatus } from "@/utils/organisingUniverse"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface OrganizingUniverseBadgeProps {
  projectId: string
  currentStatus: OrganisingUniverseStatus
  size?: "sm" | "default"
  className?: string
}

export function OrganizingUniverseBadge({
  projectId,
  currentStatus,
  size = "default",
  className = "",
}: OrganizingUniverseBadgeProps) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: async (newStatus: 'active' | 'potential' | 'excluded') => {
      const { error } = await supabase
        .from("projects")
        .update({ organising_universe: newStatus })
        .eq("id", projectId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] })
      toast.success("Organizing universe updated")
    },
    onError: (err) => {
      toast.error("Failed to update: " + (err as Error).message)
    },
  })

  const handleStatusChange = (newStatus: 'active' | 'potential' | 'excluded') => {
    if (newStatus !== currentStatus) {
      updateMutation.mutate(newStatus)
    }
    setOpen(false)
  }

  const badgeVariant = getOrganisingUniverseBadgeVariant(currentStatus)
  const sizeClass = size === "sm" ? "text-[10px]" : "text-xs"

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Badge
          variant={badgeVariant}
          className={`${sizeClass} capitalize cursor-pointer hover:opacity-80 transition-opacity ${className}`}
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            currentStatus || 'potential'
          )}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DropdownMenuCheckboxItem
          checked={currentStatus === 'active'}
          onCheckedChange={() => handleStatusChange('active')}
        >
          Active
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={currentStatus === 'potential'}
          onCheckedChange={() => handleStatusChange('potential')}
        >
          Potential
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={currentStatus === 'excluded'}
          onCheckedChange={() => handleStatusChange('excluded')}
        >
          Excluded
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
