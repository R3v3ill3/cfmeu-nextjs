"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"

type LiveUser = { id: string; full_name: string | null; email: string | null; role: string | null }
type PendingUser = { id: string; full_name: string | null; email: string | null; role: string | null; status: string | null; assigned_patch_ids?: string[] | null }
type RoleLink = { parent_user_id: string; child_user_id: string; start_date: string; end_date: string | null }
type DraftLink = { lead_user_id: string; pending_user_id: string; start_date: string; end_date: string | null }
type DraftLeadLink = { draft_lead_pending_user_id: string; organiser_user_id: string | null; organiser_pending_user_id: string | null; start_date: string; end_date: string | null }
type Assignment = { organiser_id: string; patch_id: string; effective_from: string; effective_to: string | null }
type LeadAssignment = { lead_organiser_id: string; patch_id: string; effective_from: string; effective_to: string | null }

type CoordinatorOption = { id: string; label: string; type: "live" | "draft" }

interface CoordinatorRollupSummaryProps {
  effectiveDate: string
  title?: string
  description?: string
}

export function CoordinatorRollupSummary({ effectiveDate, title, description }: CoordinatorRollupSummaryProps) {
  const effectiveDateValue = effectiveDate || new Date().toISOString().slice(0, 10)
  const effectiveDateTime = `${effectiveDateValue}T00:00:00.000Z`
  const [selected, setSelected] = useState<CoordinatorOption | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["admin-coordinator-rollup", effectiveDateValue],
    queryFn: async () => {
      const [
        { data: liveUsers, error: liveError },
        { data: pendingUsers, error: pendingError },
        { data: roleLinks, error: roleError },
        { data: draftLinks, error: draftError },
        { data: draftLeadLinks, error: draftLeadError },
        { data: organiserAssignments, error: organiserAssignmentError },
        { data: leadAssignments, error: leadAssignmentError }
      ] = await Promise.all([
        (supabase as any)
          .from("profiles")
          .select("id,full_name,email,role")
          .in("role", ["lead_organiser", "admin"])
          .order("full_name"),
        (supabase as any)
          .from("pending_users")
          .select("id,full_name,email,role,status,assigned_patch_ids")
          .in("role", ["lead_organiser", "admin", "organiser"])
          .in("status", ["draft", "invited"])
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("role_hierarchy")
          .select("parent_user_id,child_user_id,start_date,end_date")
          .eq("is_active", true)
          .lte("start_date", effectiveDateValue)
          .or(`end_date.is.null,end_date.gte.${effectiveDateValue}`),
        (supabase as any)
          .from("lead_draft_organiser_links")
          .select("lead_user_id,pending_user_id,start_date,end_date")
          .eq("is_active", true)
          .lte("start_date", effectiveDateValue)
          .or(`end_date.is.null,end_date.gte.${effectiveDateValue}`),
        (supabase as any)
          .from("draft_lead_organiser_links")
          .select("draft_lead_pending_user_id,organiser_user_id,organiser_pending_user_id,start_date,end_date")
          .eq("is_active", true)
          .lte("start_date", effectiveDateValue)
          .or(`end_date.is.null,end_date.gte.${effectiveDateValue}`),
        (supabase as any)
          .from("organiser_patch_assignments")
          .select("organiser_id,patch_id,effective_from,effective_to")
          .lte("effective_from", effectiveDateTime)
          .or(`effective_to.is.null,effective_to.gte.${effectiveDateTime}`),
        (supabase as any)
          .from("lead_organiser_patch_assignments")
          .select("lead_organiser_id,patch_id,effective_from,effective_to")
          .lte("effective_from", effectiveDateTime)
          .or(`effective_to.is.null,effective_to.gte.${effectiveDateTime}`)
      ])

      if (liveError) throw liveError
      if (pendingError) throw pendingError
      if (roleError) throw roleError
      if (draftError) throw draftError
      if (draftLeadError) throw draftLeadError
      if (organiserAssignmentError) throw organiserAssignmentError
      if (leadAssignmentError) throw leadAssignmentError

      return {
        liveUsers: (liveUsers || []) as LiveUser[],
        pendingUsers: (pendingUsers || []) as PendingUser[],
        roleLinks: (roleLinks || []) as RoleLink[],
        draftLinks: (draftLinks || []) as DraftLink[],
        draftLeadLinks: (draftLeadLinks || []) as DraftLeadLink[],
        organiserAssignments: (organiserAssignments || []) as Assignment[],
        leadAssignments: (leadAssignments || []) as LeadAssignment[]
      }
    }
  })

  const options = useMemo<CoordinatorOption[]>(() => {
    if (!data) return []
    const live = data.liveUsers.map(user => ({
      id: user.id,
      label: user.full_name || user.email || user.id,
      type: "live" as const
    }))
    const draft = data.pendingUsers
      .filter(user => user.role === "lead_organiser" || user.role === "admin")
      .map(user => ({
        id: user.id,
        label: `${user.full_name || user.email || user.id} (draft)`,
        type: "draft" as const
      }))
    return [...live, ...draft]
  }, [data])

  useEffect(() => {
    if (!selected && options.length > 0) {
      setSelected(options[0])
    }
  }, [options, selected])

  const rollup = useMemo(() => {
    if (!data || !selected) return null

    const organiserIds = new Set<string>()
    const pendingOrganiserIds = new Set<string>()
    const patchIds = new Set<string>()

    if (selected.type === "live") {
      data.roleLinks
        .filter(link => link.parent_user_id === selected.id)
        .forEach(link => organiserIds.add(link.child_user_id))

      data.draftLinks
        .filter(link => link.lead_user_id === selected.id)
        .forEach(link => pendingOrganiserIds.add(link.pending_user_id))

      data.leadAssignments
        .filter(assignment => assignment.lead_organiser_id === selected.id)
        .forEach(assignment => patchIds.add(assignment.patch_id))
    } else {
      data.draftLeadLinks
        .filter(link => link.draft_lead_pending_user_id === selected.id)
        .forEach(link => {
          if (link.organiser_user_id) organiserIds.add(link.organiser_user_id)
          if (link.organiser_pending_user_id) pendingOrganiserIds.add(link.organiser_pending_user_id)
        })
    }

    data.organiserAssignments
      .filter(assignment => organiserIds.has(assignment.organiser_id))
      .forEach(assignment => patchIds.add(assignment.patch_id))

    data.pendingUsers
      .filter(user => pendingOrganiserIds.has(user.id))
      .forEach(user => {
        ;(user.assigned_patch_ids || []).forEach(patchId => patchIds.add(patchId))
      })

    return {
      organiserCount: organiserIds.size + pendingOrganiserIds.size,
      patchCount: patchIds.size
    }
  }, [data, selected])

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle>{title || "Coordinator patch rollup"}</CardTitle>
        <CardDescription>
          {description || "Includes live and draft organisers assigned to the coordinator."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_auto] md:items-center">
          <Select
            value={selected ? `${selected.type}:${selected.id}` : undefined}
            onValueChange={(value) => {
              const [type, id] = value.split(":")
              const next = options.find(option => option.id === id && option.type === (type as "live" | "draft"))
              if (next) setSelected(next)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select coordinator" />
            </SelectTrigger>
            <SelectContent>
              {options.map(option => (
                <SelectItem key={`${option.type}-${option.id}`} value={`${option.type}:${option.id}`}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            {selected && (
              <Badge variant={selected.type === "draft" ? "secondary" : "default"}>
                {selected.type === "draft" ? "Draft" : "Live"}
              </Badge>
            )}
            <Badge variant="outline">Effective {effectiveDateValue}</Badge>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoadingSpinner size={16} />
            Loading rollup...
          </div>
        ) : rollup ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-md border px-4 py-3">
              <div className="text-xs uppercase text-muted-foreground">Organisers</div>
              <div className="text-2xl font-semibold">{rollup.organiserCount}</div>
            </div>
            <div className="rounded-md border px-4 py-3">
              <div className="text-xs uppercase text-muted-foreground">Patches in rollup</div>
              <div className="text-2xl font-semibold">{rollup.patchCount}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Select a coordinator to view rollup data.</div>
        )}
      </CardContent>
    </Card>
  )
}

export default CoordinatorRollupSummary
