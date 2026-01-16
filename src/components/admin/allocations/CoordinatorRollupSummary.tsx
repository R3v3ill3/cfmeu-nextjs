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

const DEFAULT_TIMEOUT_MS = 15000

const withTimeout = async <T,>(promise: Promise<T>, label: string, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timed out loading ${label}`))
    }, timeoutMs)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export function CoordinatorRollupSummary({ effectiveDate, title, description }: CoordinatorRollupSummaryProps) {
  const effectiveDateValue = effectiveDate || new Date().toISOString().slice(0, 10)
  const effectiveDateTime = `${effectiveDateValue}T00:00:00.000Z`
  const [selected, setSelected] = useState<CoordinatorOption | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-coordinator-rollup", effectiveDateValue],
    queryFn: async () => {
      const queries = [
        withTimeout(
          (supabase as any)
            .from("profiles")
            .select("id,full_name,email,role")
            .in("role", ["lead_organiser", "admin"])
            .order("full_name"),
          "coordinator users"
        ),
        withTimeout(
          (supabase as any)
            .from("pending_users")
            .select("id,full_name,email,role,status,assigned_patch_ids")
            .in("role", ["lead_organiser", "admin", "organiser"])
            .in("status", ["draft", "invited"])
            .order("created_at", { ascending: false }),
          "draft users"
        ),
        withTimeout(
          (supabase as any)
            .from("role_hierarchy")
            .select("parent_user_id,child_user_id,start_date,end_date")
            .eq("is_active", true)
            .lte("start_date", effectiveDateValue)
            .or(`end_date.is.null,end_date.gte.${effectiveDateValue}`),
          "role hierarchy"
        ),
        withTimeout(
          (supabase as any)
            .from("lead_draft_organiser_links")
            .select("lead_user_id,pending_user_id,start_date,end_date")
            .eq("is_active", true)
            .lte("start_date", effectiveDateValue)
            .or(`end_date.is.null,end_date.gte.${effectiveDateValue}`),
          "draft organiser links"
        ),
        withTimeout(
          (supabase as any)
            .from("draft_lead_organiser_links")
            .select("draft_lead_pending_user_id,organiser_user_id,organiser_pending_user_id,start_date,end_date")
            .eq("is_active", true)
            .lte("start_date", effectiveDateValue)
            .or(`end_date.is.null,end_date.gte.${effectiveDateValue}`),
          "draft lead links"
        ),
        withTimeout(
          (supabase as any)
            .from("organiser_patch_assignments")
            .select("organiser_id,patch_id,effective_from,effective_to")
            .lte("effective_from", effectiveDateTime)
            .or(`effective_to.is.null,effective_to.gte.${effectiveDateTime}`),
          "organiser patch assignments"
        ),
        withTimeout(
          (supabase as any)
            .from("lead_organiser_patch_assignments")
            .select("lead_organiser_id,patch_id,effective_from,effective_to")
            .lte("effective_from", effectiveDateTime)
            .or(`effective_to.is.null,effective_to.gte.${effectiveDateTime}`),
          "coordinator patch assignments"
        )
      ]

      const results = await Promise.allSettled(queries)
      const warnings: string[] = []

      const extract = <T,>(index: number, label: string) => {
        const result = results[index]
        if (result.status === "fulfilled") {
          const { data: payload, error: queryError } = result.value as any
          if (queryError) {
            warnings.push(`${label}: ${queryError.message || "query failed"}`)
            return [] as T[]
          }
          return (payload || []) as T[]
        }
        warnings.push(`${label}: ${result.reason?.message || "query failed"}`)
        return [] as T[]
      }

      return {
        liveUsers: extract<LiveUser>(0, "coordinator users"),
        pendingUsers: extract<PendingUser>(1, "draft users"),
        roleLinks: extract<RoleLink>(2, "role hierarchy"),
        draftLinks: extract<DraftLink>(3, "draft organiser links"),
        draftLeadLinks: extract<DraftLeadLink>(4, "draft lead links"),
        organiserAssignments: extract<Assignment>(5, "organiser patch assignments"),
        leadAssignments: extract<LeadAssignment>(6, "coordinator patch assignments"),
        warnings
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

  const patchCoverage = useMemo(() => {
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
        <CardTitle>{title || "Coordinator patch coverage"}</CardTitle>
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
            Loading patch coverage...
          </div>
        ) : error ? (
          <div className="space-y-2 text-sm">
            <div className="text-red-600">Failed to load patch coverage data.</div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : patchCoverage ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-md border px-4 py-3">
              <div className="text-xs uppercase text-muted-foreground">Organisers</div>
              <div className="text-2xl font-semibold">{patchCoverage.organiserCount}</div>
            </div>
            <div className="rounded-md border px-4 py-3">
              <div className="text-xs uppercase text-muted-foreground">Patches in coverage</div>
              <div className="text-2xl font-semibold">{patchCoverage.patchCount}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Select a coordinator to view patch coverage.</div>
        )}

        {!!data?.warnings?.length && !error && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <div className="font-medium">Some patch coverage data could not be loaded:</div>
            <ul className="list-disc pl-4">
              {data.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default CoordinatorRollupSummary
