"use client"
import FileUpload from "@/components/upload/FileUpload"
import ColumnMapper from "@/components/upload/ColumnMapper"
import PatchImport from "@/components/upload/PatchImport"
import GeoJSONPatchUpload from "@/components/upload/GeoJSONPatchUpload"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Plus, MapPin, Globe } from "lucide-react"
import { AddDraftUserDialog } from "@/components/admin/AddDraftUserDialog"
import { useMemo, useState } from "react"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { PatchMapViewer } from "./PatchMapViewer"

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
  const [geojsonUploadOpen, setGeojsonUploadOpen] = useState(false)
  const [mapViewerOpen, setMapViewerOpen] = useState(false)
  const [updatingOrganiser, setUpdatingOrganiser] = useState<{ organiserId: string; patchId: string } | null>(null)
  const [updatingLead, setUpdatingLead] = useState<{ leadId: string; patchId: string } | null>(null)
  const [updatingPending, setUpdatingPending] = useState<{ pendingId: string; patchId: string } | null>(null)

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
      console.log('assignToOrganiser mutation called:', { organiserId, patchId, assigned })
      setUpdatingOrganiser({ organiserId, patchId })
      try {
        if (!organiserId || !patchId) {
          throw new Error("Organiser ID and Patch ID are required")
        }
        
        console.log('Calling RPC:', assigned ? 'upsert_organiser_patch' : 'close_organiser_patch', { p_org: organiserId, p_patch: patchId })
        
        if (assigned) {
          const { data, error } = await (supabase as any).rpc("upsert_organiser_patch", { p_org: organiserId, p_patch: patchId })
          console.log('RPC response:', { data, error })
          if (error) {
            console.error('RPC error:', error)
            throw new Error(error.message || 'Failed to assign organiser')
          }
        } else {
          // For removal, first verify the assignment exists
          const { data: existingAssignment, error: checkError } = await (supabase as any)
            .from("organiser_patch_assignments")
            .select("id")
            .eq("organiser_id", organiserId)
            .eq("patch_id", patchId)
            .is("effective_to", null)
            .maybeSingle()
          
          console.log('Existing assignment check:', { existingAssignment, checkError })
          
          if (checkError) {
            console.error('Check error:', checkError)
            throw new Error(checkError.message || 'Failed to verify assignment exists')
          }
          
          if (!existingAssignment) {
            console.warn('Assignment not found - may have already been removed')
            // Don't throw error, just log - assignment might have been removed already
          } else {
            console.log('Found existing assignment to close:', existingAssignment)
            
            // Try RPC first
            const { data: rpcData, error: rpcError } = await (supabase as any).rpc("close_organiser_patch", { p_org: organiserId, p_patch: patchId })
            console.log('RPC response:', { rpcData, rpcError, rpcDataString: JSON.stringify(rpcData), rpcErrorString: JSON.stringify(rpcError) })
            
            // Always verify and use direct update if RPC didn't work
            // Check if assignment still exists after RPC call
            const { data: verifyAfterRpc } = await (supabase as any)
              .from("organiser_patch_assignments")
              .select("id, effective_to")
              .eq("organiser_id", organiserId)
              .eq("patch_id", patchId)
              .is("effective_to", null)
              .maybeSingle()
            
            console.log('Verification after RPC:', { verifyAfterRpc })
            
            // If assignment still exists, try direct update
            if (verifyAfterRpc || rpcError) {
              console.log('RPC did not remove assignment, trying direct update...')
              const { data: updateData, error: updateError } = await (supabase as any)
                .from("organiser_patch_assignments")
                .update({ effective_to: new Date().toISOString() })
                .eq("organiser_id", organiserId)
                .eq("patch_id", patchId)
                .is("effective_to", null)
              
              console.log('Direct update response:', { 
                updateData, 
                updateError,
                updateDataString: JSON.stringify(updateData),
                updateErrorString: JSON.stringify(updateError)
              })
              
              if (updateError) {
                console.error('Direct update error:', updateError)
                throw new Error(updateError.message || 'Failed to remove organiser')
              }
            }
            
            // Final verification
            const { data: finalVerify } = await (supabase as any)
              .from("organiser_patch_assignments")
              .select("id, effective_to")
              .eq("organiser_id", organiserId)
              .eq("patch_id", patchId)
              .is("effective_to", null)
              .maybeSingle()
            
            console.log('Final verification:', { finalVerify })
            
            if (finalVerify) {
              console.error('Assignment still exists after all attempts:', finalVerify)
              throw new Error('Failed to remove organiser assignment - assignment still exists after update attempts')
            }
          }
        }
      } finally {
        setUpdatingOrganiser(null)
      }
    },
    onSuccess: () => {
      // Invalidate all queries that depend on patch-organiser assignments
      qc.invalidateQueries({ queryKey: ["admin-patch-assignments"] })
      qc.invalidateQueries({ queryKey: ["patch-organisers-live"] })
      qc.invalidateQueries({ queryKey: ["patch-organisers-draft"] })
      qc.invalidateQueries({ queryKey: ["accessible-patches"] })
      qc.invalidateQueries({ queryKey: ["patch-info"] })
      qc.invalidateQueries({ queryKey: ["patch-summary"] })
      qc.invalidateQueries({ queryKey: ["project-patch-ids"] })
      qc.invalidateQueries({ queryKey: ["admin-patch-pending-users"] })
      toast({ title: "Assignments updated", description: "Organiser assignment changes will be reflected across the platform" })
    },
    onError: (e: any) => {
      const errorMessage = e?.message || String(e) || "Failed to update organiser assignment"
      toast({ 
        title: "Failed to update assignment", 
        description: errorMessage,
        variant: "destructive" 
      })
    }
  })

  const assignToLead = useMutation({
    mutationFn: async ({ leadId, patchId, assigned }: { leadId: string; patchId: string; assigned: boolean }) => {
      console.log('assignToLead mutation called:', { leadId, patchId, assigned })
      setUpdatingLead({ leadId, patchId })
      try {
        if (!leadId || !patchId) {
          throw new Error("Lead ID and Patch ID are required")
        }
        
        console.log('Calling RPC:', assigned ? 'upsert_lead_patch' : 'close_lead_patch', { p_lead: leadId, p_patch: patchId })
        const { data, error } = assigned
          ? await (supabase as any).rpc("upsert_lead_patch", { p_lead: leadId, p_patch: patchId })
          : await (supabase as any).rpc("close_lead_patch", { p_lead: leadId, p_patch: patchId })
        
        console.log('RPC response:', { data, error })
        
        if (error) {
          console.error('RPC error:', error)
          throw new Error(error.message || `Failed to ${assigned ? 'assign' : 'remove'} lead organiser`)
        }
      } finally {
        setUpdatingLead(null)
      }
    },
    onSuccess: () => {
      // Invalidate all queries that depend on lead-organiser patch assignments
      qc.invalidateQueries({ queryKey: ["admin-patch-lead-assignments"] })
      qc.invalidateQueries({ queryKey: ["patch-organisers-live"] })
      qc.invalidateQueries({ queryKey: ["patch-organisers-draft"] })
      qc.invalidateQueries({ queryKey: ["accessible-patches"] })
      qc.invalidateQueries({ queryKey: ["patch-info"] })
      qc.invalidateQueries({ queryKey: ["patch-summary"] })
      qc.invalidateQueries({ queryKey: ["project-patch-ids"] })
      qc.invalidateQueries({ queryKey: ["admin-patch-pending-users"] })
      toast({ title: "Lead assignments updated", description: "Lead organiser assignment changes will be reflected across the platform" })
    },
    onError: (e: any) => {
      const errorMessage = e?.message || String(e) || "Failed to update lead organiser assignment"
      toast({ 
        title: "Failed to update lead assignment", 
        description: errorMessage,
        variant: "destructive" 
      })
    }
  })

  const updatePendingAllocations = useMutation({
    mutationFn: async ({ pendingId, patchId, add }: { pendingId: string; patchId: string; add: boolean }) => {
      console.log('updatePendingAllocations mutation called:', { pendingId, patchId, add })
      setUpdatingPending({ pendingId, patchId })
      try {
        if (!pendingId || !patchId) {
          throw new Error("Pending user ID and Patch ID are required")
        }
        
        const pending = (pendingUsers as PendingUser[]).find(p => p.id === pendingId)
        if (!pending) {
          throw new Error("Pending user not found")
        }
        
        const current = new Set<string>(pending?.assigned_patch_ids || [])
        if (add) {
          current.add(patchId)
        } else {
          current.delete(patchId)
        }
        const next = Array.from(current)
        
        console.log('Updating pending_users:', { id: pendingId, assigned_patch_ids: next })
        const { data, error } = await (supabase as any)
          .from("pending_users")
          .update({ assigned_patch_ids: next })
          .eq("id", pendingId)
        
        console.log('Update response:', { data, error })
        
        if (error) {
          console.error('Update error:', error)
          throw new Error(error.message || `Failed to ${add ? 'add' : 'remove'} planned assignment`)
        }
      } finally {
        setUpdatingPending(null)
      }
    },
    onSuccess: () => {
      // Invalidate all queries that depend on pending user patch assignments
      refetchPending()
      qc.invalidateQueries({ queryKey: ["admin-patch-pending-users"] })
      qc.invalidateQueries({ queryKey: ["patch-organisers-live"] })
      qc.invalidateQueries({ queryKey: ["patch-organisers-draft"] })
      qc.invalidateQueries({ queryKey: ["accessible-patches"] })
      qc.invalidateQueries({ queryKey: ["patch-info"] })
      qc.invalidateQueries({ queryKey: ["patch-summary"] })
      qc.invalidateQueries({ queryKey: ["project-patch-ids"] })
      qc.invalidateQueries({ queryKey: ["admin-patch-assignments"] })
      toast({ title: "Draft allocations updated", description: "Planned assignment changes will be reflected across the platform" })
    },
    onError: (e: any) => {
      const errorMessage = e?.message || String(e) || "Failed to update planned assignment"
      toast({ 
        title: "Failed to update planned assignment", 
        description: errorMessage,
        variant: "destructive" 
      })
    }
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
          <div className="text-sm text-muted-foreground">{isLoading ? (<span className="inline-flex items-center gap-2"><LoadingSpinner size={16} /> Loading…</span>) : `${(patches as any[]).length} patches`}</div>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              disabled={Array.from(selectedPatchIds).length === 0}
              onClick={() => deletePatches.mutate(Array.from(selectedPatchIds))}
            >
              Delete selected
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>Import CSV</Button>
            <Button variant="outline" onClick={() => setGeojsonUploadOpen(true)}>
              <MapPin className="mr-2 h-4 w-4" />
              Upload GeoJSON
            </Button>
            <Button variant="outline" onClick={() => setMapViewerOpen(true)}>
              <Globe className="mr-2 h-4 w-4" />
              View Patch Maps
            </Button>
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
                                <div onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={assigned}
                                    disabled={updatingOrganiser?.organiserId === u.id && updatingOrganiser?.patchId === assignDialogPatchId}
                                    onCheckedChange={(v) => {
                                      console.log('Organiser checkbox clicked:', { organiserId: u.id, patchId: assignDialogPatchId, checked: v, assigned })
                                      const newAssigned = v === true
                                      assignToOrganiser.mutate({ organiserId: u.id, patchId: assignDialogPatchId!, assigned: newAssigned })
                                    }}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Co-ordinators</div>
                  <div className="rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Co-ordinator</TableHead>
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
                                <div onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={assigned}
                                    disabled={updatingLead?.leadId === u.id && updatingLead?.patchId === assignDialogPatchId}
                                    onCheckedChange={(v) => {
                                      console.log('Lead checkbox clicked:', { leadId: u.id, patchId: assignDialogPatchId, checked: v, assigned })
                                      const newAssigned = v === true
                                      assignToLead.mutate({ leadId: u.id, patchId: assignDialogPatchId!, assigned: newAssigned })
                                    }}
                                  />
                                </div>
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
                                <div onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={planned}
                                    disabled={updatingPending?.pendingId === pu.id && updatingPending?.patchId === assignDialogPatchId}
                                    onCheckedChange={(v) => {
                                      console.log('Pending checkbox clicked:', { pendingId: pu.id, patchId: assignDialogPatchId, checked: v, planned })
                                      const shouldAdd = v === true
                                      updatePendingAllocations.mutate({ pendingId: pu.id, patchId: assignDialogPatchId!, add: shouldAdd })
                                    }}
                                  />
                                </div>
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

        {/* GeoJSON Upload Dialog */}
        <Dialog open={geojsonUploadOpen} onOpenChange={setGeojsonUploadOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <GeoJSONPatchUpload
              onUploadComplete={() => {
                setGeojsonUploadOpen(false);
                qc.invalidateQueries({ queryKey: ["admin-patches"] });
                toast({ title: "GeoJSON patches imported successfully" });
              }}
              onBack={() => setGeojsonUploadOpen(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Patch Map Viewer Dialog */}
        <PatchMapViewer
          open={mapViewerOpen}
          onOpenChange={setMapViewerOpen}
        />
      </CardContent>
    </Card>
  )
}