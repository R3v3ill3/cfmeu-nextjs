"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { useToast } from "@/hooks/use-toast"

type PatchTeam = {
  id: string
  name: string
  sort_order: number | null
}

type PatchTeamMembership = {
  patch_id: string
  team_id: string
  is_active: boolean
}

type PatchTeamCoordinator = {
  team_id: string
  coordinator_profile_id: string | null
  coordinator_pending_user_id: string | null
  is_active: boolean
}

type PatchRow = { id: string; name: string; code: string | null }

type ProfileRow = { id: string; full_name: string | null; email: string | null; role: string | null }

type PendingUserRow = { id: string; full_name: string | null; email: string | null; role: string | null; status: string | null }

type RoleHierarchyLink = { parent_user_id: string; child_user_id: string; is_active: boolean | null; end_date: string | null; start_date: string }
type LeadDraftOrganiserLink = { lead_user_id: string; pending_user_id: string; is_active: boolean | null; end_date: string | null; start_date: string }
type DraftLeadOrganiserLink = {
  draft_lead_pending_user_id: string
  organiser_user_id: string | null
  organiser_pending_user_id: string | null
  is_active: boolean | null
  end_date: string | null
  start_date: string
}
type OrganiserPatchAssignment = { organiser_id: string; patch_id: string; effective_to: string | null }

const formatLabel = (row?: { full_name: string | null; email: string | null; id: string }) =>
  row?.full_name?.trim() || row?.email?.trim() || row?.id || "Unknown"

const compareLabels = (a: string, b: string) => {
  const primary = a.localeCompare(b, undefined, { sensitivity: "base" })
  if (primary !== 0) return primary
  return a.localeCompare(b)
}

export default function PatchTeamsManager() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const effectiveDateValue = new Date().toISOString().slice(0, 10)
  const [newTeamName, setNewTeamName] = useState("")
  const [editing, setEditing] = useState<Record<string, { name: string; sort_order: number }>>({})

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ["admin-patch-teams"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("patch_teams")
        .select("id,name,sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
      if (error) throw error
      return (data || []) as PatchTeam[]
    }
  })

  const { data: memberships = [], isLoading: membershipsLoading } = useQuery({
    queryKey: ["admin-patch-team-memberships"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("patch_team_memberships")
        .select("patch_id, team_id, is_active")
        .eq("is_active", true)
      if (error) throw error
      return (data || []) as PatchTeamMembership[]
    }
  })

  const { data: coordinators = [], isLoading: coordinatorsLoading } = useQuery({
    queryKey: ["admin-patch-team-coordinators"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("patch_team_coordinators")
        .select("team_id, coordinator_profile_id, coordinator_pending_user_id, is_active")
        .eq("is_active", true)
      if (error) throw error
      return (data || []) as PatchTeamCoordinator[]
    }
  })

  const { data: patches = [], isLoading: patchesLoading } = useQuery({
    queryKey: ["admin-patch-team-patches"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("patches")
        .select("id,name,code")
        .order("code", { ascending: true })
        .order("name", { ascending: true })
      if (error) throw error
      return (data || []) as PatchRow[]
    }
  })

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["admin-patch-team-leads"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id,full_name,email,role")
        .in("role", ["lead_organiser", "admin"])
        .order("full_name", { ascending: true })
      if (error) throw error
      return (data || []) as ProfileRow[]
    }
  })

  const { data: pendingLeads = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["admin-patch-team-pending-leads"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pending_users")
        .select("id,full_name,email,role,status")
        .in("role", ["lead_organiser", "admin"])
        .in("status", ["draft", "invited"])
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data || []) as PendingUserRow[]
    }
  })

  const { data: pendingOrganisers = [], isLoading: pendingOrganisersLoading } = useQuery({
    queryKey: ["admin-patch-team-pending-organisers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pending_users")
        .select("id,full_name,email,role,status,assigned_patch_ids")
        .in("role", ["organiser"])
        .in("status", ["draft", "invited"])
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data || []) as Array<PendingUserRow & { assigned_patch_ids?: string[] | null }>
    }
  })

  const { data: organiserAssignments = [], isLoading: organiserAssignmentsLoading } = useQuery({
    queryKey: ["admin-patch-team-organiser-assignments"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("organiser_patch_assignments")
        .select("organiser_id, patch_id, effective_to")
        .is("effective_to", null)
      if (error) throw error
      return (data || []) as OrganiserPatchAssignment[]
    }
  })

  const { data: roleHierarchyLinks = [], isLoading: hierarchyLoading } = useQuery({
    queryKey: ["admin-patch-team-role-hierarchy"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("role_hierarchy")
        .select("parent_user_id, child_user_id, is_active, end_date, start_date")
        .eq("is_active", true)
        .lte("start_date", effectiveDateValue)
        .or(`end_date.is.null,end_date.gte.${effectiveDateValue}`)
      if (error) throw error
      return (data || []) as RoleHierarchyLink[]
    }
  })

  const { data: leadDraftLinks = [], isLoading: leadDraftLoading } = useQuery({
    queryKey: ["admin-patch-team-lead-draft-links"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("lead_draft_organiser_links")
        .select("lead_user_id, pending_user_id, is_active, end_date, start_date")
        .eq("is_active", true)
        .lte("start_date", effectiveDateValue)
        .or(`end_date.is.null,end_date.gte.${effectiveDateValue}`)
      if (error) throw error
      return (data || []) as LeadDraftOrganiserLink[]
    }
  })

  const { data: draftLeadLinks = [], isLoading: draftLeadLoading } = useQuery({
    queryKey: ["admin-patch-team-draft-lead-links"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("draft_lead_organiser_links")
        .select("draft_lead_pending_user_id, organiser_user_id, organiser_pending_user_id, is_active, end_date, start_date")
        .eq("is_active", true)
        .lte("start_date", effectiveDateValue)
        .or(`end_date.is.null,end_date.gte.${effectiveDateValue}`)
      if (error) throw error
      return (data || []) as DraftLeadOrganiserLink[]
    }
  })

  useEffect(() => {
    if (teams.length > 0) {
      const next: Record<string, { name: string; sort_order: number }> = {}
      teams.forEach((team) => {
        next[team.id] = { name: team.name, sort_order: team.sort_order ?? 0 }
      })
      setEditing(next)
    }
  }, [teams])

  const membershipMap = useMemo(() => {
    const map = new Map<string, string>()
    memberships.forEach((row) => map.set(row.patch_id, row.team_id))
    return map
  }, [memberships])

  const roleHierarchyMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    roleHierarchyLinks.forEach((link) => {
      if (!map.has(link.child_user_id)) map.set(link.child_user_id, new Set())
      map.get(link.child_user_id)!.add(link.parent_user_id)
    })
    return map
  }, [roleHierarchyLinks])

  const leadDraftMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    leadDraftLinks.forEach((link) => {
      if (!map.has(link.pending_user_id)) map.set(link.pending_user_id, new Set())
      map.get(link.pending_user_id)!.add(link.lead_user_id)
    })
    return map
  }, [leadDraftLinks])

  const draftLeadForPendingMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    draftLeadLinks.forEach((link) => {
      if (!link.organiser_pending_user_id) return
      if (!map.has(link.organiser_pending_user_id)) map.set(link.organiser_pending_user_id, new Set())
      map.get(link.organiser_pending_user_id)!.add(link.draft_lead_pending_user_id)
    })
    return map
  }, [draftLeadLinks])

  const draftLeadForLiveMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    draftLeadLinks.forEach((link) => {
      if (!link.organiser_user_id) return
      if (!map.has(link.organiser_user_id)) map.set(link.organiser_user_id, new Set())
      map.get(link.organiser_user_id)!.add(link.draft_lead_pending_user_id)
    })
    return map
  }, [draftLeadLinks])

  const coordinatorMap = useMemo(() => {
    const map = new Map<string, PatchTeamCoordinator>()
    coordinators.forEach((row) => map.set(row.team_id, row))
    return map
  }, [coordinators])

  const profileMap = useMemo(() => {
    const map = new Map<string, ProfileRow>()
    leads.forEach((lead) => map.set(lead.id, lead))
    return map
  }, [leads])

  const pendingLeadMap = useMemo(() => {
    const map = new Map<string, PendingUserRow>()
    pendingLeads.forEach((lead) => map.set(lead.id, lead))
    return map
  }, [pendingLeads])

  const organiserByPatch = useMemo(() => {
    const map = new Map<string, string[]>()
    organiserAssignments.forEach((row) => {
      if (!map.has(row.patch_id)) map.set(row.patch_id, [])
      map.get(row.patch_id)!.push(row.organiser_id)
    })
    return map
  }, [organiserAssignments])

  const pendingOrganiserByPatch = useMemo(() => {
    const map = new Map<string, string[]>()
    pendingOrganisers.forEach((pending) => {
      const ids = Array.isArray(pending.assigned_patch_ids) ? pending.assigned_patch_ids : []
      ids.forEach((patchId) => {
        if (!map.has(patchId)) map.set(patchId, [])
        map.get(patchId)!.push(pending.id)
      })
    })
    return map
  }, [pendingOrganisers])

  const isLoading =
    teamsLoading ||
    membershipsLoading ||
    coordinatorsLoading ||
    patchesLoading ||
    leadsLoading ||
    pendingLoading ||
    pendingOrganisersLoading ||
    organiserAssignmentsLoading ||
    hierarchyLoading ||
    leadDraftLoading ||
    draftLeadLoading

  const getPrimaryLead = (candidates: Array<{ type: "live" | "pending"; id: string; label: string }>) => {
    if (candidates.length === 0) return null
    const sorted = [...candidates].sort((a, b) => {
      const labelCompare = compareLabels(a.label, b.label)
      if (labelCompare !== 0) return labelCompare
      return a.id.localeCompare(b.id)
    })
    return sorted[0]
  }

  const resolvePrimaryLeadForLiveOrganiser = (organiserId: string) => {
    const candidates: Array<{ type: "live" | "pending"; id: string; label: string }> = []
    const liveLeadIds = roleHierarchyMap.get(organiserId) || new Set<string>()
    liveLeadIds.forEach((leadId) => {
      candidates.push({
        type: "live",
        id: leadId,
        label: formatLabel(profileMap.get(leadId))
      })
    })
    const pendingLeadIds = draftLeadForLiveMap.get(organiserId) || new Set<string>()
    pendingLeadIds.forEach((leadId) => {
      candidates.push({
        type: "pending",
        id: leadId,
        label: formatLabel(pendingLeadMap.get(leadId))
      })
    })
    return getPrimaryLead(candidates)
  }

  const resolvePrimaryLeadForPendingOrganiser = (pendingId: string) => {
    const candidates: Array<{ type: "live" | "pending"; id: string; label: string }> = []
    const liveLeadIds = leadDraftMap.get(pendingId) || new Set<string>()
    liveLeadIds.forEach((leadId) => {
      candidates.push({
        type: "live",
        id: leadId,
        label: formatLabel(profileMap.get(leadId))
      })
    })
    const pendingLeadIds = draftLeadForPendingMap.get(pendingId) || new Set<string>()
    pendingLeadIds.forEach((leadId) => {
      candidates.push({
        type: "pending",
        id: leadId,
        label: formatLabel(pendingLeadMap.get(leadId))
      })
    })
    return getPrimaryLead(candidates)
  }

  const handleTeamSave = async (teamId: string) => {
    const values = editing[teamId]
    if (!values?.name?.trim()) {
      toast({ title: "Team name required", variant: "destructive" })
      return
    }
    const { error } = await (supabase as any)
      .from("patch_teams")
      .update({ name: values.name.trim(), sort_order: values.sort_order })
      .eq("id", teamId)
    if (error) {
      toast({ title: "Failed to update team", description: error.message, variant: "destructive" })
      return
    }
    qc.invalidateQueries({ queryKey: ["admin-patch-teams"] })
    toast({ title: "Team updated" })
  }

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) {
      toast({ title: "Team name required", variant: "destructive" })
      return
    }
    const maxSort = teams.reduce((max, team) => Math.max(max, team.sort_order ?? 0), 0)
    const { error } = await (supabase as any)
      .from("patch_teams")
      .insert({ name: newTeamName.trim(), sort_order: maxSort + 1 })
    if (error) {
      toast({ title: "Failed to create team", description: error.message, variant: "destructive" })
      return
    }
    setNewTeamName("")
    qc.invalidateQueries({ queryKey: ["admin-patch-teams"] })
    toast({ title: "Team created" })
  }

  const handleSetCoordinator = async (teamId: string, value: string) => {
    const { error: clearError } = await (supabase as any)
      .from("patch_team_coordinators")
      .update({ is_active: false })
      .eq("team_id", teamId)
      .eq("is_active", true)
    if (clearError) {
      toast({ title: "Failed to update coordinator", description: clearError.message, variant: "destructive" })
      return
    }

    if (value !== "none") {
      const [kind, id] = value.split(":")
      const payload: any = { team_id: teamId }
      if (kind === "live") payload.coordinator_profile_id = id
      if (kind === "pending") payload.coordinator_pending_user_id = id
      const { error } = await (supabase as any).from("patch_team_coordinators").insert(payload)
      if (error) {
        toast({ title: "Failed to set coordinator", description: error.message, variant: "destructive" })
        return
      }
    }

    qc.invalidateQueries({ queryKey: ["admin-patch-team-coordinators"] })
    toast({ title: "Coordinator updated" })
  }

  const handleSetMembership = async (patchId: string, value: string) => {
    const { error: clearError } = await (supabase as any)
      .from("patch_team_memberships")
      .update({ is_active: false })
      .eq("patch_id", patchId)
      .eq("is_active", true)
    if (clearError) {
      toast({ title: "Failed to update membership", description: clearError.message, variant: "destructive" })
      return
    }

    if (value !== "none") {
      const { error } = await (supabase as any)
        .from("patch_team_memberships")
        .insert({ patch_id: patchId, team_id: value })
      if (error) {
        toast({ title: "Failed to set team", description: error.message, variant: "destructive" })
        return
      }
    }

    qc.invalidateQueries({ queryKey: ["admin-patch-team-memberships"] })
    toast({ title: "Patch team updated" })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Patch Teams</CardTitle>
        <CardDescription>Define team groupings and coordinators for the patch summary.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <LoadingSpinner size={16} />
            Loading patch teams…
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[220px]">
                  <div className="text-sm mb-1">New team name</div>
                  <Input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="e.g. Sydney Central" />
                </div>
                <Button onClick={handleCreateTeam}>Add team</Button>
              </div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead className="w-28">Sort</TableHead>
                      <TableHead>Coordinator</TableHead>
                      <TableHead className="text-right w-28">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teams.map((team) => {
                      const values = editing[team.id] || { name: team.name, sort_order: team.sort_order ?? 0 }
                      const coordinator = coordinatorMap.get(team.id)
                      const coordinatorValue = coordinator?.coordinator_profile_id
                        ? `live:${coordinator.coordinator_profile_id}`
                        : coordinator?.coordinator_pending_user_id
                          ? `pending:${coordinator.coordinator_pending_user_id}`
                          : "none"
                      return (
                        <TableRow key={team.id}>
                          <TableCell>
                            <Input
                              value={values.name}
                              onChange={(e) =>
                                setEditing((prev) => ({
                                  ...prev,
                                  [team.id]: { ...values, name: e.target.value }
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={values.sort_order}
                              onChange={(e) =>
                                setEditing((prev) => ({
                                  ...prev,
                                  [team.id]: { ...values, sort_order: Number(e.target.value || 0) }
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <select
                              className="border rounded h-10 w-full px-2"
                              value={coordinatorValue}
                              onChange={(e) => handleSetCoordinator(team.id, e.target.value)}
                            >
                              <option value="none">Unassigned</option>
                              {leads.map((lead) => (
                                <option key={`live-${lead.id}`} value={`live:${lead.id}`}>
                                  {formatLabel(lead)}
                                </option>
                              ))}
                              {pendingLeads.map((lead) => (
                                <option key={`pending-${lead.id}`} value={`pending:${lead.id}`}>
                                  {formatLabel(lead)} (pending)
                                </option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => handleTeamSave(team.id)}>
                              Save
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Patch assignments</div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Code</TableHead>
                      <TableHead>Patch</TableHead>
                      <TableHead>Team</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patches.map((patch) => {
                      const teamId = membershipMap.get(patch.id) || "none"
                      const teamCoordinator = teamId !== "none" ? coordinatorMap.get(teamId) : null
                      const coordinatorIdentity = teamCoordinator?.coordinator_profile_id
                        ? { type: "live" as const, id: teamCoordinator.coordinator_profile_id }
                        : teamCoordinator?.coordinator_pending_user_id
                          ? { type: "pending" as const, id: teamCoordinator.coordinator_pending_user_id }
                          : null
                      const liveOrganiserIds = organiserByPatch.get(patch.id) || []
                      const pendingOrganiserIds = pendingOrganiserByPatch.get(patch.id) || []
                      let mismatch = false

                      if (coordinatorIdentity) {
                        liveOrganiserIds.forEach((organiserId) => {
                          const primaryLead = resolvePrimaryLeadForLiveOrganiser(organiserId)
                          if (primaryLead && (primaryLead.type !== coordinatorIdentity.type || primaryLead.id !== coordinatorIdentity.id)) {
                            mismatch = true
                          }
                        })
                        pendingOrganiserIds.forEach((pendingId) => {
                          const primaryLead = resolvePrimaryLeadForPendingOrganiser(pendingId)
                          if (primaryLead && (primaryLead.type !== coordinatorIdentity.type || primaryLead.id !== coordinatorIdentity.id)) {
                            mismatch = true
                          }
                        })
                      }
                      return (
                        <TableRow key={patch.id}>
                          <TableCell>{patch.code || "—"}</TableCell>
                          <TableCell className="font-medium">{patch.name}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <select
                                className="border rounded h-10 w-full px-2"
                                value={teamId}
                                onChange={(e) => handleSetMembership(patch.id, e.target.value)}
                              >
                                <option value="none">Unassigned</option>
                                {teams.map((team) => (
                                  <option key={team.id} value={team.id}>
                                    {team.name}
                                  </option>
                                ))}
                              </select>
                              {mismatch && (
                                <div className="text-xs text-amber-700">
                                  Hierarchy mismatch.{" "}
                                  <a className="underline" href="/admin?tab=hierarchy">
                                    Fix hierarchy
                                  </a>{" "}
                                  |{" "}
                                  <a className="underline" href="/admin?tab=patches#patch-teams">
                                    Fix team
                                  </a>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
