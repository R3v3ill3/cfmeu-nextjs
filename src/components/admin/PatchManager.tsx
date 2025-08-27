"use client"
import FileUpload from "@/components/upload/FileUpload"
import ColumnMapper from "@/components/upload/ColumnMapper"
import PatchImport from "@/components/upload/PatchImport"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Plus } from "lucide-react"
import { AddDraftUserDialog } from "@/components/admin/AddDraftUserDialog"
import { useMemo, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

type Patch = { id: string; name: string; status: string | null }
type ProfileUser = { id: string; full_name: string | null; email: string | null; role: string | null; is_active: boolean | null }
type PendingUser = { id: string; email: string; full_name: string | null; role: string; status: string; assigned_patch_ids?: string[] | null }

export default function PatchManager() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [typeValue, setTypeValue] = useState<string>("geo")
  const [description, setDescription] = useState("")
  const [subSectorsInput, setSubSectorsInput] = useState("")
  const [importOpen, setImportOpen] = useState(false)
  const [importStep, setImportStep] = useState<"upload" | "map" | "import">("upload")
  const [csv, setCsv] = useState<{ headers: string[]; rows: Record<string, any>[]; filename?: string } | null>(null)
  const [mappedRows, setMappedRows] = useState<Record<string, any>[]>([])
  const [assignDialogPatchId, setAssignDialogPatchId] = useState<string | null>(null)
  const [draftDialogOpen, setDraftDialogOpen] = useState(false)
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set())
  const [selectedPatchIds, setSelectedPatchIds] = useState<Set<string>>(new Set())

  const { data: patches = [], isLoading } = useQuery({
    queryKey: ["admin-patches"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("patches")
        .select("id,name,status")
        .order("name")
      if (error) throw error
      return (data || []) as Patch[]
    }
  })

  const { data: organisers = [] } = useQuery({
    queryKey: ["admin-patch-organisers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, email, role, is_active")
        .in("role", ["organiser", "lead_organiser"]) 
        .order("full_name")
      if (error) throw error
      return (data || []) as ProfileUser[]
    }
  })
  const activeOrganisers = useMemo(() => (organisers as ProfileUser[]).filter(u => u.role === "organiser"), [organisers])
  const activeLeads = useMemo(() => (organisers as ProfileUser[]).filter(u => u.role === "lead_organiser"), [organisers])

  const { data: pendingUsers = [], refetch: refetchPending } = useQuery({
    queryKey: ["admin-patch-pending-users"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pending_users")
        .select("id,email,full_name,role,status,assigned_patch_ids")
        .in("role", ["organiser", "lead_organiser"]) 
        .in("status", ["draft", "invited"]) 
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data || []) as PendingUser[]
    }
  })

  const deleteDrafts = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return
      const { error } = await (supabase as any)
        .from("pending_users")
        .delete()
        .in("id", ids)
        .eq("status", "draft")
      if (error) throw error
    },
    onSuccess: () => {
      setSelectedDraftIds(new Set())
      refetchPending()
      toast({ title: "Draft organisers deleted" })
    },
    onError: (e) => toast({ title: "Failed to delete", description: (e as any)?.message || String(e), variant: "destructive" })
  })

  const { data: assignmentsByPatch = {} } = useQuery({
    queryKey: ["admin-patch-assignments"],
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
  const { data: leadAssignmentsByPatch = {} } = useQuery({
    queryKey: ["admin-patch-lead-assignments"],
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

  const createPatch = useMutation({
    mutationFn: async () => {
      if (!code.trim()) throw new Error("Enter a code")
      if (!name.trim()) throw new Error("Enter a name")
      const { data: auth } = await (supabase as any).auth.getUser()
      const createdBy = (auth as any)?.user?.id ?? null
      const payload: any = {
        code: code.trim(),
        name: name.trim(),
        type: (typeValue || "geo").trim(),
        created_by: createdBy,
      }
      if (description.trim()) payload.description = description.trim()
      const subs = subSectorsInput.split(',').map(s => s.trim()).filter(Boolean)
      if (subs.length > 0) payload.sub_sectors = subs
      const { error } = await (supabase as any)
        .from("patches")
        .insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      setCreateOpen(false)
      setName("")
      setCode("")
      setTypeValue("geo")
      setDescription("")
      setSubSectorsInput("")
      qc.invalidateQueries({ queryKey: ["admin-patches"] })
      toast({ title: "Patch created" })
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to create patch", variant: "destructive" })
  })

  const deletePatches = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return
      const { error } = await (supabase as any)
        .from("patches")
        .delete()
        .in("id", ids)
      if (error) throw error
    },
    onSuccess: () => {
      setSelectedPatchIds(new Set())
      qc.invalidateQueries({ queryKey: ["admin-patches"] })
      toast({ title: "Patches deleted" })
    },
    onError: (e) => toast({ title: "Failed to delete patches", description: (e as any)?.message || String(e), variant: "destructive" })
  })

  const assignToOrganiser = useMutation({
    mutationFn: async ({ organiserId, patchId, assigned }: { organiserId: string; patchId: string; assigned: boolean }) => {
      if (assigned) {
        await (supabase as any).rpc("upsert_organiser_patch", { p_org: organiserId, p_patch: patchId })
      } else {
        await (supabase as any).rpc("close_organiser_patch", { p_org: organiserId, p_patch: patchId })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-patch-assignments"] })
      toast({ title: "Assignments updated" })
    },
    onError: (e) => toast({ title: "Failed to update", description: (e as any)?.message || String(e), variant: "destructive" })
  })

  const assignToLead = useMutation({
    mutationFn: async ({ leadId, patchId, assigned }: { leadId: string; patchId: string; assigned: boolean }) => {
      if (assigned) {
        await (supabase as any).rpc("upsert_lead_patch", { p_lead: leadId, p_patch: patchId })
      } else {
        await (supabase as any).rpc("close_lead_patch", { p_lead: leadId, p_patch: patchId })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-patch-lead-assignments"] })
      toast({ title: "Lead assignments updated" })
    },
    onError: (e) => toast({ title: "Failed to update lead", description: (e as any)?.message || String(e), variant: "destructive" })
  })

  const updatePendingAllocations = useMutation({
    mutationFn: async ({ pendingId, patchId, add }: { pendingId: string; patchId: string; add: boolean }) => {
      const pending = (pendingUsers as PendingUser[]).find(p => p.id === pendingId)
      const current = new Set<string>(pending?.assigned_patch_ids || [])
      if (add) current.add(patchId); else current.delete(patchId)
      const next = Array.from(current)
      const { error } = await (supabase as any)
        .from("pending_users")
        .update({ assigned_patch_ids: next })
        .eq("id", pendingId)
      if (error) throw error
    },
    onSuccess: () => {
      refetchPending()
      toast({ title: "Draft allocations updated" })
    },
    onError: (e) => toast({ title: "Failed to update draft", description: (e as any)?.message || String(e), variant: "destructive" })
  })

  const openAssignDialog = (patchId: string) => setAssignDialogPatchId(patchId)
  const closeAssignDialog = () => setAssignDialogPatchId(null)

  const onFileUploaded = (parsed: { headers: string[]; rows: Record<string, any>[]; filename?: string }) => {
    setCsv(parsed)
    setImportStep("map")
  }

  const onMappingComplete = (_table: string, mappings: any[]) => {
    if (!csv) return
    const output = csv.rows.map((row) => {
      const out: Record<string, any> = {}
      mappings.forEach((m: any) => {
        if (m.action !== 'skip' && m.dbColumn) {
          out[m.dbColumn] = row[m.csvColumn]
        }
      })
      return out
    })
    setMappedRows(output)
    setImportStep("import")
  }

  const resetImport = () => {
    setImportStep("upload")
    setCsv(null)
    setMappedRows([])
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Patches</CardTitle>
        <CardDescription>Manage patches, then edit contents and allocations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{isLoading ? (<span className="inline-flex items-center gap-2"><img src="/spinner.gif" alt="Loading" className="h-4 w-4" /> Loading…</span>) : `${(patches as any[]).length} patches`}</div>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              disabled={Array.from(selectedPatchIds).length === 0}
              onClick={() => deletePatches.mutate(Array.from(selectedPatchIds))}
            >
              Delete selected
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>Import CSV</Button>
            <Button onClick={() => setCreateOpen(true)}>Create Patch</Button>
          </div>
        </div>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={(patches as Patch[]).length > 0 && Array.from(selectedPatchIds).length === (patches as Patch[]).length}
                    onCheckedChange={(v) => {
                      if (Boolean(v)) setSelectedPatchIds(new Set((patches as Patch[]).map(p => p.id)))
                      else setSelectedPatchIds(new Set())
                    }}
                    aria-label="Select all patches"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Organisers</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(patches as Patch[]).map(p => (
                <TableRow key={p.id}>
                  <TableCell className="w-10">
                    <Checkbox
                      checked={selectedPatchIds.has(p.id)}
                      onCheckedChange={(v) => {
                        setSelectedPatchIds(prev => {
                          const next = new Set(prev)
                          if (Boolean(v)) next.add(p.id); else next.delete(p.id)
                          return next
                        })
                      }}
                      aria-label={`Select patch ${p.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.status}</TableCell>
                  <TableCell className="max-w-[280px]">
                    <div className="flex flex-wrap gap-1">
                      {(assignmentsByPatch as Record<string, string[]>)[p.id]?.map(orgId => {
                        const user = (organisers as ProfileUser[]).find(u => u.id === orgId)
                        const label = user?.full_name || user?.email || orgId
                        return (
                          <Badge key={orgId} variant="secondary">{label}</Badge>
                        )
                      }) || null}
                      {(pendingUsers as PendingUser[]).filter(po => (po.assigned_patch_ids || []).includes(p.id) && po.role === 'organiser').map(po => (
                        <Badge key={`pending-${po.id}`} variant="outline">{po.full_name || po.email} <span className="ml-1">(pending)</span></Badge>
                      ))}
                      {(leadAssignmentsByPatch as Record<string, string[]>)[p.id]?.map(leadId => {
                        const user = (organisers as ProfileUser[]).find(u => u.id === leadId)
                        const label = user?.full_name || user?.email || leadId
                        return (
                          <Badge key={`lead-${leadId}`} variant="default">{label} <span className="ml-1">(lead)</span></Badge>
                        )
                      }) || null}
                      {(pendingUsers as PendingUser[]).filter(po => (po.assigned_patch_ids || []).includes(p.id) && po.role === 'lead_organiser').map(po => (
                        <Badge key={`pending-lead-${po.id}`} variant="default">{po.full_name || po.email} <span className="ml-1">(lead, pending)</span></Badge>
                      ))}
                      {!(assignmentsByPatch as Record<string, string[]>)[p.id]?.length && !(pendingUsers as PendingUser[]).some(po => (po.assigned_patch_ids || []).includes(p.id)) && (
                        <span className="text-sm text-muted-foreground">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => openAssignDialog(p.id)}>Manage</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Patch</DialogTitle>
              <DialogDescription>Define patch code, name, type, and optional details.</DialogDescription>

            </DialogHeader>
            <div className="space-y-3">
              <div>
                <div className="text-sm mb-1">Code</div>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 100" />
              </div>
              <div>
                <div className="text-sm mb-1">Name</div>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. North East" />
              </div>
              <div>
                <div className="text-sm mb-1">Type</div>
                <select className="border rounded h-10 w-full px-2" value={typeValue} onChange={(e) => setTypeValue(e.target.value)}>
                  <option value="geo">geo</option>
                  <option value="trade">trade</option>
                  <option value="sub-sector">sub-sector</option>
                </select>
              </div>
              <div>
                <div className="text-sm mb-1">Description</div>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
              </div>
              <div>
                <div className="text-sm mb-1">Sub-sectors (comma-separated)</div>
                <Input value={subSectorsInput} onChange={(e) => setSubSectorsInput(e.target.value)} placeholder="e.g. scaffolding, steel, electrical" />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => createPatch.mutate()} disabled={!code.trim() || !name.trim()}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) resetImport() }}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Import patches from CSV</DialogTitle>
              <DialogDescription>Upload a CSV, map its columns, and import patches with organiser links.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {importStep === "upload" && (
                <FileUpload onFileUploaded={onFileUploaded} />
              )}
              {importStep === "map" && csv && (
                <ColumnMapper
                  parsedCSV={csv}
                  onBack={() => setImportStep("upload")}
                  onMappingComplete={onMappingComplete}
                  defaultTable="patches"
                />
              )}
              {importStep === "import" && csv && (
                <Card>
                  <CardHeader>
                    <CardTitle>Import Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PatchImport
                      csvData={mappedRows.length > 0 ? mappedRows : (csv?.rows || [])}
                      onImportComplete={() => { resetImport(); setImportOpen(false); qc.invalidateQueries({ queryKey: ["admin-patches"] }) }}
                      onBack={() => setImportStep("map")}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!assignDialogPatchId} onOpenChange={(o) => { if (!o) closeAssignDialog() }}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage organisers for this patch</DialogTitle>
              <DialogDescription>Toggle active organiser assignments and plan allocations for draft/invited users.</DialogDescription>
            </DialogHeader>
            {assignDialogPatchId && (
              <div className="space-y-6">
                <div>
                  <div className="text-sm font-medium mb-2">Active organisers</div>
                  <div className="rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Organiser</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Assigned</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(activeOrganisers as ProfileUser[]).map(u => {
                          const assigned = Boolean((assignmentsByPatch as Record<string, string[]>)[assignDialogPatchId!]?.includes(u.id))
                          return (
                            <TableRow key={u.id}>
                              <TableCell>{u.full_name || u.email || u.id}</TableCell>
                              <TableCell>
                                <Badge variant={u.is_active ? "default" : "secondary"}>{u.is_active ? "Active" : "Inactive"}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Checkbox
                                  checked={assigned}
                                  onCheckedChange={(v) => assignToOrganiser.mutate({ organiserId: u.id, patchId: assignDialogPatchId!, assigned: Boolean(v) })}
                                />
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Lead organisers</div>
                  <div className="rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lead organiser</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Assigned</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(activeLeads as ProfileUser[]).map(u => {
                          const assigned = Boolean((leadAssignmentsByPatch as Record<string, string[]>)[assignDialogPatchId!]?.includes(u.id))
                          return (
                            <TableRow key={u.id}>
                              <TableCell>{u.full_name || u.email || u.id}</TableCell>
                              <TableCell>
                                <Badge variant={u.is_active ? "default" : "secondary"}>{u.is_active ? "Active" : "Inactive"}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Checkbox
                                  checked={assigned}
                                  onCheckedChange={(v) => assignToLead.mutate({ leadId: u.id, patchId: assignDialogPatchId!, assigned: Boolean(v) })}
                                />
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">Draft and invited organisers</div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={Array.from(selectedDraftIds).length === 0}
                        onClick={() => deleteDrafts.mutate(Array.from(selectedDraftIds))}
                      >
                        Delete selected
                      </Button>
                      <Button size="sm" onClick={() => setDraftDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Add draft organiser</Button>
                    </div>
                  </div>
                  <div className="rounded border max-h-80 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Organiser</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Planned assignment</TableHead>
                          <TableHead className="text-right">Select</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(pendingUsers as PendingUser[]).map(pu => {
                          const planned = Boolean((pu.assigned_patch_ids || []).includes(assignDialogPatchId!))
                          return (
                            <TableRow key={pu.id}>
                              <TableCell>{pu.full_name || pu.email}</TableCell>
                              <TableCell>
                                <Badge variant={pu.role === 'lead_organiser' ? 'default' : 'secondary'}>{pu.role === 'lead_organiser' ? 'Lead' : 'Organiser'}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={pu.status === 'draft' ? 'secondary' : 'default'}>{pu.status === 'draft' ? 'Not-invited' : 'Pending'}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Checkbox
                                  checked={planned}
                                  onCheckedChange={(v) => updatePendingAllocations.mutate({ pendingId: pu.id, patchId: assignDialogPatchId!, add: Boolean(v) })}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Checkbox
                                  checked={selectedDraftIds.has(pu.id)}
                                  disabled={pu.status !== 'draft'}
                                  onCheckedChange={(v) => {
                                    setSelectedDraftIds(prev => {
                                      const next = new Set(prev)
                                      if (Boolean(v)) next.add(pu.id); else next.delete(pu.id)
                                      return next
                                    })
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AddDraftUserDialog open={draftDialogOpen} onOpenChange={(o) => { setDraftDialogOpen(o); if (!o) refetchPending() }} onSuccess={() => { refetchPending() }} />
      </CardContent>
    </Card>
  )
}