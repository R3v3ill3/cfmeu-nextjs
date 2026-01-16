"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { Button } from "@/components/ui/button"

type CoordinatorType = "live" | "draft"
type OrganiserType = "live" | "draft"

type LiveUser = { id: string; full_name: string | null; email: string | null; role: string | null }
type PendingUser = {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
  status: string | null
  assigned_patch_ids?: string[] | null
}
type Patch = { id: string; name: string }

type RoleLink = { parent_user_id: string; child_user_id: string; start_date: string; end_date: string | null }
type DraftLink = { lead_user_id: string; pending_user_id: string; start_date: string; end_date: string | null }
type DraftLeadLink = {
  draft_lead_pending_user_id: string
  organiser_user_id: string | null
  organiser_pending_user_id: string | null
  start_date: string
  end_date: string | null
}
type Assignment = { organiser_id: string; patch_id: string; effective_from: string; effective_to: string | null }
type LeadAssignment = { lead_organiser_id: string; patch_id: string; effective_from: string; effective_to: string | null }

export type CoordinatorKey = `${CoordinatorType}:${string}`
export type OrganiserKey = `${OrganiserType}:${string}`

export type CoordinatorInfo = { key: CoordinatorKey; id: string; label: string; type: CoordinatorType }
export type OrganiserInfo = { key: OrganiserKey; id: string; label: string; type: OrganiserType; currentCoordinatorKey?: CoordinatorKey | null }
export type PatchInfo = { id: string; name: string; currentCoordinatorKeys: CoordinatorKey[] }

export type StagingData = {
  coordinators: CoordinatorInfo[]
  organisers: OrganiserInfo[]
  patches: PatchInfo[]
  organiserAssignments: Record<OrganiserKey, string[]>
  coordinatorLabels: Record<CoordinatorKey, string>
  organiserCoordinatorMap: Record<OrganiserKey, CoordinatorKey | null>
  leadPatchAssignments: Record<CoordinatorKey, string[]>
}

interface AllocationStagingBoardProps {
  effectiveDate: string
  organiserTargets: Record<OrganiserKey, CoordinatorKey | null>
  patchTargets: Record<string, CoordinatorKey | null>
  onOrganiserTargetsChange: (next: Record<OrganiserKey, CoordinatorKey | null>) => void
  onPatchTargetsChange: (next: Record<string, CoordinatorKey | null>) => void
  onDataChange?: (data: StagingData | null) => void
  defaultTargetCoordinatorKey?: CoordinatorKey | null
  sourceCoordinatorKey?: CoordinatorKey | null
  destinationCoordinatorKey?: CoordinatorKey | null
  allocationBasis?: "organiser" | "patch"
}

const buildCoordinatorKey = (type: CoordinatorType, id: string) => `${type}:${id}` as CoordinatorKey
const buildOrganiserKey = (type: OrganiserType, id: string) => `${type}:${id}` as OrganiserKey

export function AllocationStagingBoard({
  effectiveDate,
  organiserTargets,
  patchTargets,
  onOrganiserTargetsChange,
  onPatchTargetsChange,
  onDataChange,
  defaultTargetCoordinatorKey,
  sourceCoordinatorKey,
  destinationCoordinatorKey,
  allocationBasis = "organiser"
}: AllocationStagingBoardProps) {
  const effectiveDateValue = effectiveDate || new Date().toISOString().slice(0, 10)
  const effectiveDateTime = `${effectiveDateValue}T00:00:00.000Z`

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reallocation-staging", effectiveDateValue],
    queryFn: async () => {
      const [
        { data: liveUsers, error: liveError },
        { data: pendingUsers, error: pendingError },
        { data: patches, error: patchError },
        { data: roleLinks, error: roleError },
        { data: draftLinks, error: draftError },
        { data: draftLeadLinks, error: draftLeadError },
        { data: organiserAssignments, error: organiserAssignmentError },
        { data: leadAssignments, error: leadAssignmentError }
      ] = await Promise.all([
        (supabase as any)
          .from("profiles")
          .select("id,full_name,email,role")
          .in("role", ["lead_organiser", "admin", "organiser"])
          .order("full_name"),
        (supabase as any)
          .from("pending_users")
          .select("id,full_name,email,role,status,assigned_patch_ids")
          .in("role", ["lead_organiser", "admin", "organiser"])
          .in("status", ["draft", "invited"])
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("patches")
          .select("id,name")
          .order("name"),
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
      if (patchError) throw patchError
      if (roleError) throw roleError
      if (draftError) throw draftError
      if (draftLeadError) throw draftLeadError
      if (organiserAssignmentError) throw organiserAssignmentError
      if (leadAssignmentError) throw leadAssignmentError

      return {
        liveUsers: (liveUsers || []) as LiveUser[],
        pendingUsers: (pendingUsers || []) as PendingUser[],
        patches: (patches || []) as Patch[],
        roleLinks: (roleLinks || []) as RoleLink[],
        draftLinks: (draftLinks || []) as DraftLink[],
        draftLeadLinks: (draftLeadLinks || []) as DraftLeadLink[],
        organiserAssignments: (organiserAssignments || []) as Assignment[],
        leadAssignments: (leadAssignments || []) as LeadAssignment[]
      }
    }
  })

  const stagingData = useMemo<StagingData | null>(() => {
    if (!data) return null

    const coordinatorLabels: Record<CoordinatorKey, string> = {}
    const coordinators: CoordinatorInfo[] = []
    const organisers: OrganiserInfo[] = []
    const organiserAssignments: Record<OrganiserKey, string[]> = {}
    const organiserCoordinatorMap: Record<OrganiserKey, CoordinatorKey | null> = {}
    const leadPatchAssignments: Record<CoordinatorKey, string[]> = {}

    const liveCoordinatorUsers = data.liveUsers.filter(user => user.role === "lead_organiser" || user.role === "admin")
    liveCoordinatorUsers.forEach(user => {
      const key = buildCoordinatorKey("live", user.id)
      const label = user.full_name || user.email || user.id
      coordinators.push({ key, id: user.id, label, type: "live" })
      coordinatorLabels[key] = label
      leadPatchAssignments[key] = []
    })

    const draftCoordinatorUsers = data.pendingUsers.filter(user => user.role === "lead_organiser" || user.role === "admin")
    draftCoordinatorUsers.forEach(user => {
      const key = buildCoordinatorKey("draft", user.id)
      const label = `${user.full_name || user.email || user.id} (draft)`
      coordinators.push({ key, id: user.id, label, type: "draft" })
      coordinatorLabels[key] = label
      leadPatchAssignments[key] = (user.assigned_patch_ids || []).map(String)
    })

    const liveOrganisers = data.liveUsers.filter(user => user.role === "organiser")
    liveOrganisers.forEach(user => {
      const key = buildOrganiserKey("live", user.id)
      organisers.push({
        key,
        id: user.id,
        label: user.full_name || user.email || user.id,
        type: "live"
      })
      organiserAssignments[key] = []
    })

    const draftOrganisers = data.pendingUsers.filter(user => user.role === "organiser")
    draftOrganisers.forEach(user => {
      const key = buildOrganiserKey("draft", user.id)
      organisers.push({
        key,
        id: user.id,
        label: `${user.full_name || user.email || user.id} (draft)`,
        type: "draft"
      })
      organiserAssignments[key] = (user.assigned_patch_ids || []).map(String)
    })

    const liveOrganiserAssignments = new Map<string, string[]>()
    data.organiserAssignments.forEach(row => {
      const list = liveOrganiserAssignments.get(row.organiser_id) || []
      list.push(row.patch_id)
      liveOrganiserAssignments.set(row.organiser_id, list)
    })
    Object.entries(organiserAssignments).forEach(([key]) => {
      if (!key.startsWith("live:")) return
      const organiserId = key.split(":")[1]
      organiserAssignments[key as OrganiserKey] = (liveOrganiserAssignments.get(organiserId) || []).map(String)
    })

    data.leadAssignments.forEach(row => {
      const key = buildCoordinatorKey("live", row.lead_organiser_id)
      if (!leadPatchAssignments[key]) leadPatchAssignments[key] = []
      leadPatchAssignments[key].push(String(row.patch_id))
    })

    const roleMap = new Map<string, string>()
    data.roleLinks.forEach(link => {
      roleMap.set(link.child_user_id, link.parent_user_id)
    })

    const draftLinkMap = new Map<string, string>()
    data.draftLinks.forEach(link => {
      draftLinkMap.set(link.pending_user_id, link.lead_user_id)
    })

    const draftLeadToOrganiser = new Map<string, string>()
    const draftLeadToPendingOrganiser = new Map<string, string>()
    data.draftLeadLinks.forEach(link => {
      if (link.organiser_user_id) {
        draftLeadToOrganiser.set(link.organiser_user_id, link.draft_lead_pending_user_id)
      }
      if (link.organiser_pending_user_id) {
        draftLeadToPendingOrganiser.set(link.organiser_pending_user_id, link.draft_lead_pending_user_id)
      }
    })

    organisers.forEach(organiser => {
      if (organiser.type === "live") {
        const liveCoordinatorId = roleMap.get(organiser.id)
        if (liveCoordinatorId) {
          organiser.currentCoordinatorKey = buildCoordinatorKey("live", liveCoordinatorId)
        } else {
          const draftCoordinatorId = draftLeadToOrganiser.get(organiser.id)
          organiser.currentCoordinatorKey = draftCoordinatorId ? buildCoordinatorKey("draft", draftCoordinatorId) : null
        }
      } else {
        const liveCoordinatorId = draftLinkMap.get(organiser.id)
        if (liveCoordinatorId) {
          organiser.currentCoordinatorKey = buildCoordinatorKey("live", liveCoordinatorId)
        } else {
          const draftCoordinatorId = draftLeadToPendingOrganiser.get(organiser.id)
          organiser.currentCoordinatorKey = draftCoordinatorId ? buildCoordinatorKey("draft", draftCoordinatorId) : null
        }
      }
      organiserCoordinatorMap[organiser.key] = organiser.currentCoordinatorKey || null
    })

    const patchCoverageMap = new Map<string, Set<CoordinatorKey>>()
    const addCoverage = (coordinatorKey: CoordinatorKey | null | undefined, patchId: string) => {
      if (!coordinatorKey) return
      const set = patchCoverageMap.get(patchId) || new Set<CoordinatorKey>()
      set.add(coordinatorKey)
      patchCoverageMap.set(patchId, set)
    }

    Object.entries(organiserAssignments).forEach(([organiserKey, patchIds]) => {
      const coordinatorKey = organiserCoordinatorMap[organiserKey as OrganiserKey] || null
      patchIds.forEach(patchId => addCoverage(coordinatorKey, patchId))
    })

    Object.entries(leadPatchAssignments).forEach(([coordinatorKey, patchIds]) => {
      patchIds.forEach(patchId => addCoverage(coordinatorKey as CoordinatorKey, patchId))
    })

    const patches: PatchInfo[] = data.patches.map(patch => ({
      id: patch.id,
      name: patch.name,
      currentCoordinatorKeys: Array.from(patchCoverageMap.get(patch.id) || [])
    }))

    return {
      coordinators,
      organisers,
      patches,
      organiserAssignments,
      coordinatorLabels,
      organiserCoordinatorMap,
      leadPatchAssignments
    }
  }, [data])

  useEffect(() => {
    if (onDataChange) onDataChange(stagingData)
  }, [onDataChange, stagingData])

  const [organiserFilter, setOrganiserFilter] = useState("")
  const [patchFilter, setPatchFilter] = useState("")

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stage reallocation moves</CardTitle>
          <CardDescription>Loading current coordinator coverage...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoadingSpinner size={16} />
          Loading staging data...
        </CardContent>
      </Card>
    )
  }

  if (!stagingData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stage reallocation moves</CardTitle>
          <CardDescription>Unable to load staging data.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Try refreshing the page to reload allocation data.
        </CardContent>
      </Card>
    )
  }

  const coordinatorOptions = stagingData.coordinators
  const coordinatorLabel = (key?: CoordinatorKey | null) => (key ? stagingData.coordinatorLabels[key] || key : "Unassigned")
  const resolveOrganiserDefault = (organiser: OrganiserInfo) => {
    const explicit = organiserTargets[organiser.key]
    if (explicit) return explicit
    if (
      sourceCoordinatorKey &&
      destinationCoordinatorKey &&
      organiser.currentCoordinatorKey === sourceCoordinatorKey
    ) {
      return destinationCoordinatorKey
    }
    return organiser.currentCoordinatorKey || defaultTargetCoordinatorKey || null
  }
  const resolvePatchDefault = (patch: PatchInfo) => {
    const explicit = patchTargets[patch.id]
    if (explicit) return explicit
    if (patch.currentCoordinatorKeys.length === 1) {
      const current = patch.currentCoordinatorKeys[0]
      if (sourceCoordinatorKey && destinationCoordinatorKey && current === sourceCoordinatorKey) {
        return destinationCoordinatorKey
      }
      return current
    }
    return defaultTargetCoordinatorKey || null
  }

  const [lastOrganiserTargets, setLastOrganiserTargets] = useState<Record<OrganiserKey, CoordinatorKey | null> | null>(null)
  const [lastPatchTargets, setLastPatchTargets] = useState<Record<string, CoordinatorKey | null> | null>(null)

  const organiserCounts = useMemo(() => {
    const current = new Map<CoordinatorKey, number>()
    const proposed = new Map<CoordinatorKey, number>()
    const changing = new Map<CoordinatorKey, number>()

    stagingData.organisers.forEach(organiser => {
      const currentKey = organiser.currentCoordinatorKey || null
      const proposedKey = resolveOrganiserDefault(organiser)

      if (currentKey) {
        current.set(currentKey, (current.get(currentKey) || 0) + 1)
      }
      if (proposedKey) {
        proposed.set(proposedKey, (proposed.get(proposedKey) || 0) + 1)
      }
      if (currentKey !== proposedKey) {
        if (currentKey) changing.set(currentKey, (changing.get(currentKey) || 0) + 1)
        if (proposedKey) changing.set(proposedKey, (changing.get(proposedKey) || 0) + 1)
      }
    })

    return { current, proposed, changing }
  }, [resolveOrganiserDefault, stagingData.organisers])

  const patchCounts = useMemo(() => {
    const current = new Map<CoordinatorKey, number>()
    const proposed = new Map<CoordinatorKey, number>()
    const changing = new Map<CoordinatorKey, number>()

    stagingData.patches.forEach(patch => {
      patch.currentCoordinatorKeys.forEach(key => {
        current.set(key, (current.get(key) || 0) + 1)
      })
      const proposedKey = resolvePatchDefault(patch)
      if (proposedKey) {
        proposed.set(proposedKey, (proposed.get(proposedKey) || 0) + 1)
      } else {
        patch.currentCoordinatorKeys.forEach(key => {
          proposed.set(key, (proposed.get(key) || 0) + 1)
        })
      }

      const currentKeys = patch.currentCoordinatorKeys
      if (proposedKey && !currentKeys.includes(proposedKey)) {
        if (proposedKey) changing.set(proposedKey, (changing.get(proposedKey) || 0) + 1)
        currentKeys.forEach(key => changing.set(key, (changing.get(key) || 0) + 1))
      }
    })

    return { current, proposed, changing }
  }, [resolvePatchDefault, stagingData.patches])

  return (
    <div className="space-y-6">
      {defaultTargetCoordinatorKey && (
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">Quick apply destination</CardTitle>
            <CardDescription>
              Apply the destination coordinator to items currently assigned to the source coordinator.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!sourceCoordinatorKey) return
                setLastOrganiserTargets(organiserTargets)
                const next: Record<OrganiserKey, CoordinatorKey | null> = { ...organiserTargets }
                stagingData.organisers.forEach(organiser => {
                  if (organiser.currentCoordinatorKey === sourceCoordinatorKey) {
                    next[organiser.key] = defaultTargetCoordinatorKey
                  }
                })
                onOrganiserTargetsChange(next)
              }}
              disabled={!sourceCoordinatorKey}
            >
              Apply to source organisers
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!sourceCoordinatorKey) return
                setLastPatchTargets(patchTargets)
                const next: Record<string, CoordinatorKey | null> = { ...patchTargets }
                stagingData.patches.forEach(patch => {
                  if (patch.currentCoordinatorKeys.includes(sourceCoordinatorKey)) {
                    next[patch.id] = defaultTargetCoordinatorKey
                  }
                })
                onPatchTargetsChange(next)
              }}
              disabled={!sourceCoordinatorKey}
            >
              Apply to source patches
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (lastOrganiserTargets) {
                  onOrganiserTargetsChange(lastOrganiserTargets)
                  setLastOrganiserTargets(null)
                }
                if (lastPatchTargets) {
                  onPatchTargetsChange(lastPatchTargets)
                  setLastPatchTargets(null)
                }
              }}
              disabled={!lastOrganiserTargets && !lastPatchTargets}
            >
              Undo bulk apply
            </Button>
            {!sourceCoordinatorKey && (
              <span className="text-xs text-muted-foreground">
                Select a source coordinator to enable bulk actions.
              </span>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {coordinatorOptions.map(coordinator => {
          const stagedOrganisers = Object.entries(organiserTargets).filter(
            ([, target]) => target === coordinator.key
          ).length
          const stagedPatches = Object.entries(patchTargets).filter(([, target]) => target === coordinator.key).length
          const existingOrganisers = organiserCounts.current.get(coordinator.key) || 0
          const existingPatches = patchCounts.current.get(coordinator.key) || 0
          const changingOrganisers = organiserCounts.changing.get(coordinator.key) || 0
          const changingPatches = patchCounts.changing.get(coordinator.key) || 0
          const resultingOrganisers = organiserCounts.proposed.get(coordinator.key) || 0
          const resultingPatches = patchCounts.proposed.get(coordinator.key) || 0
          return (
            <Card key={coordinator.key}>
              <CardHeader className="space-y-1">
                <CardTitle className="text-base">{coordinator.label}</CardTitle>
                <CardDescription>Staged items</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{stagedOrganisers} staged organisers</Badge>
                  <Badge variant="outline">{stagedPatches} staged patches</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Existing: {existingOrganisers} organisers, {existingPatches} patches
                </div>
                <div className="text-xs text-muted-foreground">
                  Changing: {changingOrganisers} organisers, {changingPatches} patches
                </div>
                <div className="text-xs font-medium text-foreground">
                  Resulting: {resultingOrganisers} organisers, {resultingPatches} patches
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {allocationBasis === "organiser" && (
        <Card>
        <CardHeader>
          <CardTitle>Stage organisers</CardTitle>
          <CardDescription>Assign organisers to target coordinators for this reshuffle.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Filter organisers"
            value={organiserFilter}
            onChange={(event) => setOrganiserFilter(event.target.value)}
            className="max-w-[280px]"
          />
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organiser</TableHead>
                  <TableHead>Current coordinator</TableHead>
                  <TableHead className="text-right">Target coordinator</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stagingData.organisers
                  .filter(organiser => organiser.label.toLowerCase().includes(organiserFilter.toLowerCase()))
                  .map(organiser => {
                  const currentTarget = resolveOrganiserDefault(organiser)
                  const currentCoordinator = organiser.currentCoordinatorKey
                  return (
                    <TableRow key={organiser.key}>
                      <TableCell>
                        <div className="font-medium">{organiser.label}</div>
                        <Badge variant={organiser.type === "draft" ? "secondary" : "outline"}>
                          {organiser.type === "draft" ? "Draft" : "Live"}
                        </Badge>
                      </TableCell>
                      <TableCell>{coordinatorLabel(currentCoordinator)}</TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={currentTarget || ""}
                          onValueChange={(value) => {
                            const next = { ...organiserTargets, [organiser.key]: value as CoordinatorKey }
                            onOrganiserTargetsChange(next)
                          }}
                        >
                          <SelectTrigger className="min-w-[220px]">
                            <SelectValue placeholder="Select target" />
                          </SelectTrigger>
                          <SelectContent>
                            {coordinatorOptions.map(option => (
                              <SelectItem key={option.key} value={option.key}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      )}

      {allocationBasis === "patch" && (
        <Card>
        <CardHeader>
          <CardTitle>Stage patches</CardTitle>
          <CardDescription>Assign patches to target coordinators for complex reshuffles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Filter patches"
            value={patchFilter}
            onChange={(event) => setPatchFilter(event.target.value)}
            className="max-w-[280px]"
          />
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patch</TableHead>
                  <TableHead>Current coverage</TableHead>
                  <TableHead className="text-right">Target coordinator</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stagingData.patches
                  .filter(patch => patch.name.toLowerCase().includes(patchFilter.toLowerCase()))
                  .map(patch => {
                  const currentTarget = resolvePatchDefault(patch)
                  const currentCoverage =
                    patch.currentCoordinatorKeys.length === 0
                      ? "Unassigned"
                      : patch.currentCoordinatorKeys.length === 1
                      ? coordinatorLabel(patch.currentCoordinatorKeys[0])
                      : `${patch.currentCoordinatorKeys.length} coordinators`
                  return (
                    <TableRow key={patch.id}>
                      <TableCell className="font-medium">{patch.name}</TableCell>
                      <TableCell>{currentCoverage}</TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={currentTarget || ""}
                          onValueChange={(value) => {
                            const next = { ...patchTargets, [patch.id]: value as CoordinatorKey }
                            onPatchTargetsChange(next)
                          }}
                        >
                          <SelectTrigger className="min-w-[220px]">
                            <SelectValue placeholder="Select target" />
                          </SelectTrigger>
                          <SelectContent>
                            {coordinatorOptions.map(option => (
                              <SelectItem key={option.key} value={option.key}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  )
}

export default AllocationStagingBoard
