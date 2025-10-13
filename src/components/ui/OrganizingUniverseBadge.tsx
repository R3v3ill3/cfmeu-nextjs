"use client"

import { useEffect, useState } from "react"
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
  const [displayStatus, setDisplayStatus] = useState(currentStatus)
  const queryClient = useQueryClient()

  useEffect(() => {
    setDisplayStatus(currentStatus)
  }, [currentStatus])

  const updateMutation = useMutation({
    mutationFn: async (newStatus: 'active' | 'potential' | 'excluded') => {
      const { error } = await supabase
        .from("projects")
        .update({ organising_universe: newStatus })
        .eq("id", projectId)

      if (error) throw error
    },
    onMutate: async (newStatus) => {
      const previousStatus = displayStatus
      setDisplayStatus(newStatus)
      setOpen(false)
      return { previousStatus }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] })
      toast.success("Organizing universe updated")
    },
    onError: (err, _newStatus, context) => {
      if (context?.previousStatus !== undefined) {
        setDisplayStatus(context.previousStatus)
      }
      toast.error("Failed to update: " + (err as Error).message)
    },
  })

  const handleStatusChange = (newStatus: 'active' | 'potential' | 'excluded') => {
    if (newStatus === displayStatus) {
      setOpen(false)
      return
    }

    updateMutation.mutate(newStatus)
  }

  const badgeVariant = getOrganisingUniverseBadgeVariant(displayStatus)
  const sizeClass = size === "sm" ? "text-[10px]" : "text-xs"

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Badge
          variant={badgeVariant}
          className={`${sizeClass} capitalize cursor-pointer hover:opacity-80 transition-opacity ${className}`}
          role="button"
          tabIndex={0}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          {updateMutation.isPending ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{displayStatus || 'potential'}</span>
            </span>
          ) : (
            displayStatus || 'potential'
          )}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DropdownMenuCheckboxItem
          checked={displayStatus === 'active'}
          onCheckedChange={() => handleStatusChange('active')}
        >
          Active
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={displayStatus === 'potential'}
          onCheckedChange={() => handleStatusChange('potential')}
        >
          Potential
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={displayStatus === 'excluded'}
          onCheckedChange={() => handleStatusChange('excluded')}
        >
          Excluded
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
