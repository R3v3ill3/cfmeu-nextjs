"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import RoleHierarchyManager from "@/components/admin/RoleHierarchyManager"
import PatchManager from "@/components/admin/PatchManager"
import OrganiserScopeManager from "@/components/admin/OrganiserScopeManager"
import AllocationStagingBoard, {
  type CoordinatorKey,
  type OrganiserKey,
  type StagingData
} from "@/components/admin/allocations/staging/AllocationStagingBoard"
import PatchCoveragePreview from "@/components/admin/allocations/staging/PatchCoveragePreview"

type WizardStep = 0 | 1 | 2

const scenarios = [
  {
    id: "swap-coordinators",
    title: "Swap coordinators (keep organisers + patches)",
    description: "Reassign organisers to a new coordinator without changing patch allocations."
  },
  {
    id: "swap-and-reallocate",
    title: "Swap coordinators + reallocate organisers",
    description: "Move organisers between coordinators and update patch allocations if needed."
  },
  {
    id: "move-within-team",
    title: "Move organisers within a team",
    description: "Swap or move patches between organisers inside one coordinator team."
  },
  {
    id: "move-across-teams",
    title: "Move patches across teams",
    description: "Move patches between organisers in different teams while preserving patch coverage."
  }
]

interface ReallocationWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReallocationWizard({ open, onOpenChange }: ReallocationWizardProps) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [step, setStep] = useState<WizardStep>(0)
  const [scenario, setScenario] = useState<string>(scenarios[0].id)
  const [effectiveDate, setEffectiveDate] = useState<string>(today)
  const [sourceCoordinator, setSourceCoordinator] = useState<CoordinatorKey | "">( "")
  const [destinationCoordinator, setDestinationCoordinator] = useState<CoordinatorKey | "">( "")
  const [organiserTargets, setOrganiserTargets] = useState<Record<OrganiserKey, CoordinatorKey | null>>({})
  const [patchTargets, setPatchTargets] = useState<Record<string, CoordinatorKey | null>>({})
  const [stagingData, setStagingData] = useState<StagingData | null>(null)
  const [allocationBasis, setAllocationBasis] = useState<"organiser" | "patch">("organiser")

  const currentScenario = scenarios.find(item => item.id === scenario)
  const canRenderPatchCoverage = typeof PatchCoveragePreview === "function"
  const canRenderRoleHierarchy = typeof RoleHierarchyManager === "function"
  const canRenderPatchManager = typeof PatchManager === "function"
  const canRenderScopeManager = typeof OrganiserScopeManager === "function"

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .order("full_name")
      if (error) throw error
      return data || []
    }
  })

  const { data: draftCoordinators = [] } = useQuery({
    queryKey: ["admin-draft-coordinators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_users")
        .select("id, full_name, email, role, status")
        .in("role", ["lead_organiser", "admin"])
        .in("status", ["draft", "invited"])
        .order("created_at", { ascending: false })
      if (error) throw error
      return data || []
    }
  })

  const coordinatorOptions = useMemo(() => {
    const live = users
      .filter(user => user.role === "lead_organiser" || user.role === "admin")
      .map(user => ({
        key: `live:${user.id}` as CoordinatorKey,
        label: user.full_name || user.email || user.id
      }))
    const drafts = (draftCoordinators as any[]).map(user => ({
      key: `draft:${user.id}` as CoordinatorKey,
      label: `${user.full_name || user.email || user.id} (draft)`
    }))
    return [...live, ...drafts]
  }, [draftCoordinators, users])

  const nextStep = () => setStep(prev => (prev < 2 ? ((prev + 1) as WizardStep) : prev))
  const previousStep = () => setStep(prev => (prev > 0 ? ((prev - 1) as WizardStep) : prev))

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) setStep(0)
      }}
    >
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reallocation wizard</DialogTitle>
          <DialogDescription>
            Guided workflow for coordinator, organiser, and patch changes with draft users included.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>Step {step + 1} of 3</div>
            <div>{currentScenario?.title}</div>
          </div>

          <Separator />

          {step === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Select a restructure scenario</CardTitle>
                <CardDescription>Choose the workflow that best matches your change.</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={scenario} onValueChange={setScenario} className="space-y-4">
                  {scenarios.map(item => (
                    <div key={item.id} className="flex items-start gap-3 rounded-md border p-4">
                      <RadioGroupItem value={item.id} id={item.id} className="mt-1" />
                      <label htmlFor={item.id} className="space-y-1">
                        <div className="text-sm font-medium">{item.title}</div>
                        <div className="text-sm text-muted-foreground">{item.description}</div>
                      </label>
                    </div>
                  ))}
                </RadioGroup>

                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr] md:items-center">
                    <div className="text-sm font-medium">Effective date</div>
                    <Input
                      type="date"
                      value={effectiveDate}
                      onChange={(event) => setEffectiveDate(event.target.value)}
                      className="max-w-[220px]"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Coordinator links update from the effective date forward. Patch assignments remain immediate.
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Stage reallocation moves</CardTitle>
                  <CardDescription>
                    Stage organisers and patches into coordinator buckets. This supports complex reshuffles across multiple coordinators.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(scenario === "swap-coordinators" || scenario === "swap-and-reallocate") && (
                    <div className="mb-6 space-y-3">
                      <div className="text-sm font-medium">Reallocation basis</div>
                      <RadioGroup
                        value={allocationBasis}
                        onValueChange={(value) => setAllocationBasis(value as "organiser" | "patch")}
                        className="grid grid-cols-1 gap-2 md:grid-cols-2"
                      >
                        <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
                          <RadioGroupItem value="organiser" className="mt-1" />
                          <span>
                            <div className="font-medium">Organiser-based reallocation</div>
                            <div className="text-xs text-muted-foreground">
                              Move organisers between coordinators; patch coverage follows organisers.
                            </div>
                          </span>
                        </label>
                        <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
                          <RadioGroupItem value="patch" className="mt-1" />
                          <span>
                            <div className="font-medium">Patch-based reallocation</div>
                            <div className="text-xs text-muted-foreground">
                              Move patches directly; organiser links stay unless you adjust them later.
                            </div>
                          </span>
                        </label>
                      </RadioGroup>
                      <div className="text-xs text-muted-foreground">
                        Use only one basis at a time to avoid conflicting changes.
                      </div>
                    </div>
                  )}
                  {(scenario === "swap-coordinators" || scenario === "swap-and-reallocate") && (
                    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Source coordinator</div>
                        <select
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={sourceCoordinator}
                          onChange={(event) => setSourceCoordinator(event.target.value as CoordinatorKey)}
                        >
                          <option value="">Select coordinator</option>
                          {coordinatorOptions.map(option => (
                            <option key={`source-${option.key}`} value={option.key}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <div className="text-xs text-muted-foreground">
                          This is the coordinator you want to replace.
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Destination coordinator</div>
                        <select
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={destinationCoordinator}
                          onChange={(event) => setDestinationCoordinator(event.target.value as CoordinatorKey)}
                        >
                          <option value="">Select coordinator</option>
                          {coordinatorOptions.map(option => (
                            <option key={`dest-${option.key}`} value={option.key}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <div className="text-xs text-muted-foreground">
                          This coordinator will inherit the team scope or organisers you stage.
                        </div>
                      </div>
                    </div>
                  )}
                  <AllocationStagingBoard
                    effectiveDate={effectiveDate}
                    organiserTargets={organiserTargets}
                    patchTargets={patchTargets}
                    onOrganiserTargetsChange={setOrganiserTargets}
                    onPatchTargetsChange={setPatchTargets}
                    onDataChange={setStagingData}
                    defaultTargetCoordinatorKey={destinationCoordinator || null}
                    sourceCoordinatorKey={sourceCoordinator || null}
                    destinationCoordinatorKey={destinationCoordinator || null}
                    allocationBasis={allocationBasis}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Preview and apply changes</CardTitle>
                  <CardDescription>
                    Review patch coverage impacts, then apply changes using the allocation tools below. Draft users are included.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div>Scenario: {currentScenario?.title}</div>
                  <div>Effective date: {effectiveDate}</div>
                </CardContent>
              </Card>

              {canRenderPatchCoverage ? (
                <PatchCoveragePreview
                  stagingData={stagingData}
                  organiserTargets={organiserTargets}
                  patchTargets={patchTargets}
                />
              ) : (
                <div className="rounded-md border px-4 py-3 text-sm text-muted-foreground">
                  Patch coverage preview is temporarily unavailable.
                </div>
              )}

              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Changes across coordinator teams will affect dashboard totals going forward from the effective date.
                Patch assignments update immediately even when coordinator links are future-dated.
              </div>

              {canRenderRoleHierarchy && (
                <RoleHierarchyManager effectiveDate={effectiveDate} users={users} />
              )}
              {canRenderPatchManager && <PatchManager />}
              {canRenderScopeManager && <OrganiserScopeManager />}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={previousStep} disabled={step === 0}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={nextStep} disabled={step === 2}>
                Next
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ReallocationWizard
