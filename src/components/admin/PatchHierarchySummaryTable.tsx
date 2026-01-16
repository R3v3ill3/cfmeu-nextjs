"use client"

import { useMemo } from "react"
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

type ProjectRow = {
  id: string | null
  name: string | null
  tier: string | null
  organising_universe: string | null
}

type PatchProjectRow = {
  patch_id: string | null
  project_id: string | null
  projects: ProjectRow | null
}

const REPORTS_TO_LABEL = "Karma Lord"

const formatProfileLabel = (profile?: ProfileRow) =>
  profile?.full_name?.trim() || profile?.email?.trim() || profile?.id || "Unknown"

const formatPendingLabel = (pending?: PendingUserRow) =>
  pending?.full_name?.trim() || pending?.email?.trim() || pending?.id || "Unknown"

export default function PatchHierarchySummaryTable() {
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
      if (error) throw error
      return (data || []) as PendingUserRow[]
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

  const { data: patchProjects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["admin-patch-summary", "patch-projects"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("patch_project_mapping_view")
        .select("patch_id, project_id, projects ( id, name, tier, organising_universe )")
      if (error) throw error
      return (data || []) as PatchProjectRow[]
    }
  })

  const isLoading = patchesLoading || profilesLoading || pendingLoading || assignmentsLoading || leadAssignmentsLoading || projectsLoading

  const profileMap = useMemo(() => {
    const map = new Map<string, ProfileRow>()
    profiles.forEach((profile) => map.set(profile.id, profile))
    return map
  }, [profiles])

  const patchProjectsMap = useMemo(() => {
    const map = new Map<string, Map<string, ProjectRow>>()
    patchProjects.forEach((row) => {
      if (!row.patch_id || !row.project_id || !row.projects?.id) return
      if (!map.has(row.patch_id)) map.set(row.patch_id, new Map())
      const projectsByPatch = map.get(row.patch_id)!
      if (!projectsByPatch.has(row.project_id)) {
        projectsByPatch.set(row.project_id, row.projects)
      }
    })
    return map
  }, [patchProjects])

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

      const organiserLabelParts = [
        ...organiserIds.map((id) => formatProfileLabel(profileMap.get(id))),
        ...pendingOrganisers.map((pending) => `${formatPendingLabel(pending)} (pending)`)
      ].filter(Boolean)
      const leadLabelParts = [
        ...leadIds.map((id) => formatProfileLabel(profileMap.get(id))),
        ...pendingLeads.map((pending) => `${formatPendingLabel(pending)} (pending)`)
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
        tier3Count: tier3Active.size
      }
    })
  }, [patches, organiserAssignments, leadAssignments, patchProjectsMap, profileMap, pendingUsers])

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
                  <TableHead>Area Coordinator</TableHead>
                  <TableHead>Reports to</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.patchId}>
                    <TableCell className="align-top">{row.organiserLabels}</TableCell>
                    <TableCell className="align-top">{row.patchCode}</TableCell>
                    <TableCell className="align-top font-medium">{row.patchName}</TableCell>
                    <TableCell className="align-top text-sm text-muted-foreground whitespace-normal">
                      {row.tier1List}
                    </TableCell>
                    <TableCell className="align-top text-right">{row.tier2Count}</TableCell>
                    <TableCell className="align-top text-right">{row.tier3Count}</TableCell>
                    <TableCell className="align-top">{row.leadLabels}</TableCell>
                    <TableCell className="align-top">{REPORTS_TO_LABEL}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
