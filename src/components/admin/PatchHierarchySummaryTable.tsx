"use client"

import { Fragment, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"

type PatchRow = {
  id: string
  name: string
  code: string | null
}

type ProfileRow = {
  id: string
  full_name: string | null
  email: string | null
}

type PendingUserRow = {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
  status: string | null
  assigned_patch_ids?: string[] | null
}

type LeadDraftOrganiserLink = {
  lead_user_id: string
  pending_user_id: string
  is_active: boolean | null
  end_date: string | null
}

type DraftLeadOrganiserLink = {
  draft_lead_pending_user_id: string
  organiser_pending_user_id: string | null
  organiser_user_id: string | null
  is_active: boolean | null
  end_date: string | null
}

type RoleHierarchyLink = {
  parent_user_id: string
  child_user_id: string
  is_active: boolean | null
  end_date: string | null
}

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

type ProjectRow = {
  id: string | null
  name: string | null
  tier: string | null
  organising_universe: string | null
}

type PatchProjectMappingRow = {
  patch_id: string | null
  project_id: string | null
}

const REPORTS_TO_LABEL = "Karma Lord"

const formatProfileLabel = (profile?: ProfileRow) =>
  profile?.full_name?.trim() || profile?.email?.trim() || profile?.id || "Unknown"

const formatPendingLabel = (pending?: PendingUserRow) =>
  pending?.full_name?.trim() || pending?.email?.trim() || pending?.id || "Unknown"

const compareLabels = (a: string, b: string) => {
  const primary = a.localeCompare(b, undefined, { sensitivity: "base" })
  if (primary !== 0) return primary
  return a.localeCompare(b)
}

const chunkArray = <T,>(values: T[], size: number) => {
  const chunks: T[][] = []
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size))
  }
  return chunks
}

export default function PatchHierarchySummaryTable() {
  const effectiveDateValue = new Date().toISOString().slice(0, 10)
  const { data: patches = [], isLoading: patchesLoading } = useQuery({
    queryKey: ["admin-patch-summary", "patches"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("patches")
        .select("id,name,code")
      if (error) throw error
      return (data || []) as PatchRow[]
    }
  })

  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["admin-patch-summary", "profiles"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id,full_name,email")
      if (error) throw error
      return (data || []) as ProfileRow[]
    }
  })

  const { data: pendingUsers = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["admin-patch-summary", "pending-users"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pending_users")
        .select("id, full_name, email, role, status, assigned_patch_ids")
        .in("role", ["organiser", "lead_organiser"])
        .in("status", ["draft", "invited"])
      if (error) throw error
      return (data || []) as PendingUserRow[]
    }
  })

  const { data: leadDraftLinks = [], isLoading: leadDraftLoading } = useQuery({
    queryKey: ["admin-patch-summary", "lead-draft-links"],
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
    queryKey: ["admin-patch-summary", "draft-lead-links"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("draft_lead_organiser_links")
        .select("draft_lead_pending_user_id, organiser_pending_user_id, organiser_user_id, is_active, end_date, start_date")
        .eq("is_active", true)
        .lte("start_date", effectiveDateValue)
        .or(`end_date.is.null,end_date.gte.${effectiveDateValue}`)
      if (error) throw error
      return (data || []) as DraftLeadOrganiserLink[]
    }
  })

  const { data: roleHierarchyLinks = [], isLoading: hierarchyLoading } = useQuery({
    queryKey: ["admin-patch-summary", "role-hierarchy"],
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

  const { data: patchTeams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ["admin-patch-summary", "patch-teams"],
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

  const { data: patchTeamMemberships = [], isLoading: membershipsLoading } = useQuery({
    queryKey: ["admin-patch-summary", "patch-team-memberships"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("patch_team_memberships")
        .select("patch_id, team_id, is_active")
        .eq("is_active", true)
      if (error) throw error
      return (data || []) as PatchTeamMembership[]
    }
  })

  const { data: patchTeamCoordinators = [], isLoading: coordinatorsLoading } = useQuery({
    queryKey: ["admin-patch-summary", "patch-team-coordinators"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("patch_team_coordinators")
        .select("team_id, coordinator_profile_id, coordinator_pending_user_id, is_active")
        .eq("is_active", true)
      if (error) throw error
      return (data || []) as PatchTeamCoordinator[]
    }
  })

  const { data: organiserAssignments = {}, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["admin-patch-summary", "organiser-assignments"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("organiser_patch_assignments")
        .select("organiser_id, patch_id, effective_to")
        .is("effective_to", null)
      if (error) throw error
      const map: Record<string, string[]> = {}
      ;(data as any[]).forEach((row: any) => {
        if (!map[row.patch_id]) map[row.patch_id] = []
        map[row.patch_id].push(row.organiser_id)
      })
      return map
    }
  })

  const { data: leadAssignments = {}, isLoading: leadAssignmentsLoading } = useQuery({
    queryKey: ["admin-patch-summary", "lead-assignments"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("lead_organiser_patch_assignments")
        .select("lead_organiser_id, patch_id, effective_to")
        .is("effective_to", null)
      if (error) throw error
      const map: Record<string, string[]> = {}
      ;(data as any[]).forEach((row: any) => {
        if (!map[row.patch_id]) map[row.patch_id] = []
        map[row.patch_id].push(row.lead_organiser_id)
      })
      return map
    }
  })

  const { data: patchProjectMappings = [], isLoading: mappingLoading } = useQuery({
    queryKey: ["admin-patch-summary", "patch-project-mappings"],
    queryFn: async () => {
      let { data, error } = await (supabase as any)
        .from("patch_project_mapping_view")
        .select("patch_id, project_id")

      if (error) throw error

      if (!data || data.length === 0) {
        const fallback = await (supabase as any)
          .from("job_sites")
          .select("patch_id, project_id")
          .not("project_id", "is", null)
        if (fallback.error) throw fallback.error
        data = fallback.data || []
      }

      return (data || []) as PatchProjectMappingRow[]
    }
  })

  const projectIds = useMemo(() => {
    const ids = new Set<string>()
    patchProjectMappings.forEach((row) => {
      if (row.project_id) ids.add(row.project_id)
    })
    return Array.from(ids)
  }, [patchProjectMappings])

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["admin-patch-summary", "projects", projectIds],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const chunks = chunkArray(projectIds, 500)
      const results = await Promise.all(
        chunks.map((chunk) =>
          (supabase as any)
            .from("project_list_comprehensive_view")
            .select("id, name, tier, organising_universe")
            .in("id", chunk)
        )
      )
      const combined: ProjectRow[] = []
      results.forEach((result) => {
        if (result.error) throw result.error
        combined.push(...((result.data || []) as ProjectRow[]))
      })
      return combined
    }
  })

  const isLoading =
    patchesLoading ||
    profilesLoading ||
    pendingLoading ||
    leadDraftLoading ||
    draftLeadLoading ||
    hierarchyLoading ||
    teamsLoading ||
    membershipsLoading ||
    coordinatorsLoading ||
    assignmentsLoading ||
    leadAssignmentsLoading ||
    mappingLoading ||
    projectsLoading

  const profileMap = useMemo(() => {
    const map = new Map<string, ProfileRow>()
    profiles.forEach((profile) => map.set(profile.id, profile))
    return map
  }, [profiles])

  const pendingLeadMap = useMemo(() => {
    const map = new Map<string, PendingUserRow>()
    pendingUsers
      .filter((pending) => pending.role === "lead_organiser" || pending.role === "admin")
      .forEach((pending) => map.set(pending.id, pending))
    return map
  }, [pendingUsers])

  const leadDraftMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    leadDraftLinks.forEach((link) => {
      if (!link.pending_user_id || !link.lead_user_id) return
      if (!map.has(link.pending_user_id)) map.set(link.pending_user_id, new Set())
      map.get(link.pending_user_id)!.add(link.lead_user_id)
    })
    return map
  }, [leadDraftLinks])

  const draftLeadForPendingMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    draftLeadLinks.forEach((link) => {
      if (!link.organiser_pending_user_id || !link.draft_lead_pending_user_id) return
      if (!map.has(link.organiser_pending_user_id)) map.set(link.organiser_pending_user_id, new Set())
      map.get(link.organiser_pending_user_id)!.add(link.draft_lead_pending_user_id)
    })
    return map
  }, [draftLeadLinks])

  const draftLeadForLiveMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    draftLeadLinks.forEach((link) => {
      if (!link.organiser_user_id || !link.draft_lead_pending_user_id) return
      if (!map.has(link.organiser_user_id)) map.set(link.organiser_user_id, new Set())
      map.get(link.organiser_user_id)!.add(link.draft_lead_pending_user_id)
    })
    return map
  }, [draftLeadLinks])

  const roleHierarchyMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    roleHierarchyLinks.forEach((link) => {
      if (!link.child_user_id || !link.parent_user_id) return
      if (!map.has(link.child_user_id)) map.set(link.child_user_id, new Set())
      map.get(link.child_user_id)!.add(link.parent_user_id)
    })
    return map
  }, [roleHierarchyLinks])

  const patchProjectsMap = useMemo(() => {
    const map = new Map<string, Map<string, ProjectRow>>()
    const projectMap = new Map<string, ProjectRow>()
    projects.forEach((project) => {
      if (project.id) projectMap.set(project.id, project)
    })
    patchProjectMappings.forEach((row) => {
      if (!row.patch_id || !row.project_id) return
      const project = projectMap.get(row.project_id)
      if (!project) return
      if (!map.has(row.patch_id)) map.set(row.patch_id, new Map())
      const projectsByPatch = map.get(row.patch_id)!
      if (!projectsByPatch.has(row.project_id)) projectsByPatch.set(row.project_id, project)
    })
    return map
  }, [patchProjectMappings, projects])

  const patchTeamMembershipMap = useMemo(() => {
    const map = new Map<string, string>()
    patchTeamMemberships.forEach((row) => map.set(row.patch_id, row.team_id))
    return map
  }, [patchTeamMemberships])

  const patchTeamCoordinatorMap = useMemo(() => {
    const map = new Map<string, PatchTeamCoordinator>()
    patchTeamCoordinators.forEach((row) => map.set(row.team_id, row))
    return map
  }, [patchTeamCoordinators])

  const rows = useMemo(() => {
    const sortedPatches = [...patches].sort((a, b) => {
      const aCode = a.code?.trim() || ""
      const bCode = b.code?.trim() || ""
      if (aCode && bCode) return aCode.localeCompare(bCode, undefined, { numeric: true })
      if (aCode) return -1
      if (bCode) return 1
      return a.name.localeCompare(b.name)
    })

    return sortedPatches.map((patch) => {
      const organiserIds = (organiserAssignments as Record<string, string[]>)[patch.id] || []
      const leadIds = (leadAssignments as Record<string, string[]>)[patch.id] || []
      const pendingOrganisers = pendingUsers.filter(
        (pending) =>
          pending.role === "organiser" &&
          (pending.assigned_patch_ids || []).includes(patch.id)
      )
      const pendingLeads = pendingUsers.filter(
        (pending) =>
          pending.role === "lead_organiser" &&
          (pending.assigned_patch_ids || []).includes(patch.id)
      )
      const pendingOrganiserIds = pendingOrganisers.map((pending) => pending.id)

      const leadLabelsFromLiveOrganisers = new Set<string>()
      organiserIds.forEach((organiserId) => {
        const leadIds = roleHierarchyMap.get(organiserId)
        leadIds?.forEach((leadId) => {
          leadLabelsFromLiveOrganisers.add(formatProfileLabel(profileMap.get(leadId)))
        })
        const draftLeadIds = draftLeadForLiveMap.get(organiserId)
        draftLeadIds?.forEach((leadId) => {
          const pendingLead = pendingLeadMap.get(leadId)
          leadLabelsFromLiveOrganisers.add(`${formatPendingLabel(pendingLead)} (pending)`)
        })
      })

      const leadLabelsFromPending = new Set<string>()
      pendingOrganisers.forEach((pending) => {
        const liveLeadIds = leadDraftMap.get(pending.id)
        liveLeadIds?.forEach((leadId) => {
          leadLabelsFromPending.add(formatProfileLabel(profileMap.get(leadId)))
        })
        const draftLeadIds = draftLeadForPendingMap.get(pending.id)
        draftLeadIds?.forEach((leadId) => {
          const pendingLead = pendingLeadMap.get(leadId)
          leadLabelsFromPending.add(`${formatPendingLabel(pendingLead)} (pending)`)
        })
      })

      const organiserLabelParts = [
        ...organiserIds.map((id) => formatProfileLabel(profileMap.get(id))),
        ...pendingOrganisers.map((pending) => `${formatPendingLabel(pending)} (pending)`)
      ].filter(Boolean)
      const leadLabelParts = [
        ...leadIds.map((id) => formatProfileLabel(profileMap.get(id))),
        ...pendingLeads.map((pending) => `${formatPendingLabel(pending)} (pending)`),
        ...Array.from(leadLabelsFromLiveOrganisers),
        ...Array.from(leadLabelsFromPending)
      ].filter(Boolean)

      const organiserLabels = organiserLabelParts.length ? organiserLabelParts.join(", ") : "Unassigned"
      const leadLabels = leadLabelParts.length ? leadLabelParts.join(", ") : "Unassigned"

      const projectsByPatch = patchProjectsMap.get(patch.id) || new Map()
      const tier1Names = new Set<string>()
      const tier2Active = new Set<string>()
      const tier3Active = new Set<string>()

      projectsByPatch.forEach((project, projectId) => {
        if (!project) return
        const tier = project.tier || ""
        const universe = project.organising_universe || ""
        if (tier === "tier_1" && project.name) tier1Names.add(project.name)
        if (tier === "tier_2" && universe === "active") tier2Active.add(projectId)
        if (tier === "tier_3" && universe === "active") tier3Active.add(projectId)
      })

      const tier1List = Array.from(tier1Names).sort((a, b) => a.localeCompare(b)).join(", ") || "None"

      return {
        patchId: patch.id,
        patchCode: patch.code || "—",
        patchName: patch.name,
        organiserLabels,
        leadLabels,
        tier1List,
        tier2Count: tier2Active.size,
        tier3Count: tier3Active.size,
        organiserIds,
        pendingOrganiserIds
      }
    })
  }, [
    patches,
    organiserAssignments,
    leadAssignments,
    patchProjectsMap,
    profileMap,
    pendingUsers,
    leadDraftMap,
    draftLeadForPendingMap,
    draftLeadForLiveMap,
    roleHierarchyMap,
    pendingLeadMap
  ])

  const groupedRows = useMemo(() => {
    const teamMap = new Map<string, { name: string; sort_order: number }>()
    patchTeams.forEach((team) => {
      teamMap.set(team.id, { name: team.name, sort_order: team.sort_order ?? 0 })
    })

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
          label: formatProfileLabel(profileMap.get(leadId))
        })
      })
      const pendingLeadIds = draftLeadForLiveMap.get(organiserId) || new Set<string>()
      pendingLeadIds.forEach((leadId) => {
        const pendingLead = pendingLeadMap.get(leadId)
        candidates.push({
          type: "pending",
          id: leadId,
          label: formatPendingLabel(pendingLead)
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
          label: formatProfileLabel(profileMap.get(leadId))
        })
      })
      const pendingLeadIds = draftLeadForPendingMap.get(pendingId) || new Set<string>()
      pendingLeadIds.forEach((leadId) => {
        const pendingLead = pendingLeadMap.get(leadId)
        candidates.push({
          type: "pending",
          id: leadId,
          label: formatPendingLabel(pendingLead)
        })
      })
      return getPrimaryLead(candidates)
    }

    const coordinatorLabelForTeam = (teamId: string) => {
      const row = patchTeamCoordinatorMap.get(teamId)
      if (!row) return "Unassigned"
      if (row.coordinator_profile_id) {
        return formatProfileLabel(profileMap.get(row.coordinator_profile_id))
      }
      if (row.coordinator_pending_user_id) {
        const pendingLead = pendingLeadMap.get(row.coordinator_pending_user_id)
        return `${formatPendingLabel(pendingLead)} (pending)`
      }
      return "Unassigned"
    }

    const coordinatorIdentityForTeam = (teamId: string) => {
      const row = patchTeamCoordinatorMap.get(teamId)
      if (!row) return null
      if (row.coordinator_profile_id) return { type: "live" as const, id: row.coordinator_profile_id }
      if (row.coordinator_pending_user_id) return { type: "pending" as const, id: row.coordinator_pending_user_id }
      return null
    }

    const groups = new Map<string, { teamName: string; sort_order: number; coordinator: string; items: typeof rows }>()

    rows.forEach((row) => {
      const teamId = patchTeamMembershipMap.get(row.patchId) || "unassigned"
      if (!groups.has(teamId)) {
        const teamInfo = teamMap.get(teamId)
        groups.set(teamId, {
          teamName: teamInfo?.name || "Unassigned",
          sort_order: teamInfo?.sort_order ?? 999,
          coordinator: teamId === "unassigned" ? "Unassigned" : coordinatorLabelForTeam(teamId),
          items: []
        })
      }
      const teamCoordinator = coordinatorIdentityForTeam(teamId)
      const organiserIds = row.organiserIds || []
      const pendingOrganiserIds = row.pendingOrganiserIds || []
      let mismatch = false

      if (teamCoordinator) {
        organiserIds.forEach((organiserId) => {
          const primaryLead = resolvePrimaryLeadForLiveOrganiser(organiserId)
          if (primaryLead && (primaryLead.type !== teamCoordinator.type || primaryLead.id !== teamCoordinator.id)) {
            mismatch = true
          }
        })
        pendingOrganiserIds.forEach((pendingId) => {
          const primaryLead = resolvePrimaryLeadForPendingOrganiser(pendingId)
          if (primaryLead && (primaryLead.type !== teamCoordinator.type || primaryLead.id !== teamCoordinator.id)) {
            mismatch = true
          }
        })
      }

      groups.get(teamId)!.items.push({ ...row, mismatch })
    })

    const teamOrder = Array.from(groups.entries()).sort((a, b) => {
      const aOrder = a[1].sort_order
      const bOrder = b[1].sort_order
      if (aOrder !== bOrder) return aOrder - bOrder
      return a[1].teamName.localeCompare(b[1].teamName)
    })

    return teamOrder.map(([teamId, data]) => ({
      teamId,
      teamName: data.teamName,
      coordinator: data.coordinator,
      items: data.items
    }))
  }, [
    rows,
    patchTeams,
    patchTeamMembershipMap,
    patchTeamCoordinatorMap,
    profileMap,
    pendingLeadMap,
    roleHierarchyMap,
    leadDraftMap,
    draftLeadForLiveMap,
    draftLeadForPendingMap
  ])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Patch Summary</CardTitle>
        <CardDescription>
          Allocation overview with Tier 1 projects and active Tier 2/3 project counts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <LoadingSpinner size={16} />
            Loading patch summary…
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Organiser</TableHead>
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead>Patch</TableHead>
                  <TableHead className="min-w-[240px]">Tier 1 projects</TableHead>
                  <TableHead className="text-right w-28">Tier 2 active</TableHead>
                  <TableHead className="text-right w-28">Tier 3 active</TableHead>
                  <TableHead>Reports to</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedRows.map((group) => (
                  <Fragment key={group.teamId}>
                    <TableRow key={`${group.teamId}-header`}>
                      <TableCell colSpan={7} className="text-center text-blue-700 text-base font-semibold">
                        {group.teamName.toUpperCase()} — {group.coordinator}
                      </TableCell>
                    </TableRow>
                    {group.items.map((row) => (
                      <TableRow key={row.patchId}>
                        <TableCell className="align-top">
                          <div>{row.organiserLabels}</div>
                          {row.mismatch && (
                            <div className="text-xs text-amber-700 mt-1">
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
                        </TableCell>
                        <TableCell className="align-top">{row.patchCode}</TableCell>
                        <TableCell className="align-top font-medium">{row.patchName}</TableCell>
                        <TableCell className="align-top text-sm text-muted-foreground whitespace-normal">
                          {row.tier1List}
                        </TableCell>
                        <TableCell className="align-top text-right">{row.tier2Count}</TableCell>
                        <TableCell className="align-top text-right">{row.tier3Count}</TableCell>
                        <TableCell className="align-top">{REPORTS_TO_LABEL}</TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
