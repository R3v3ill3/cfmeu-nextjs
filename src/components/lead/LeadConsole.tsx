"use client"
import { useMemo, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

export default function LeadConsole() {
  const qc = useQueryClient()
  const { toast } = useToast()

  const { data: me } = useQuery({
    queryKey: ["lead-me"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser()
      const id = (auth as any)?.user?.id
      const { data: prof } = await supabase.from('profiles').select('id, full_name, role').eq('id', id).single()
      return prof || null
    }
  })

  const { data: patches = [] } = useQuery({
    queryKey: ["lead-patches"],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('lead_organiser_patch_assignments')
        .select('patches:patch_id(id,name)')
        .is('effective_to', null)
        .eq('lead_organiser_id', (me as any)?.id)
      return (((data as any[]) || []).map(r => r.patches).filter(Boolean))
    }
  })

  const { data: organisers = [] } = useQuery({
    queryKey: ["lead-organisers"],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'organiser')
        .order('full_name')
      return (data || [])
    }
  })

  const { data: orgPatchLinks = [] } = useQuery({
    queryKey: ["lead-org-patch-links"],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('organiser_patch_assignments')
        .select('id, organiser_id, patch_id')
        .is('effective_to', null)
      return data || []
    }
  })

  // Simple list management: move organiser between patches
  const [selectedOrganiser, setSelectedOrganiser] = useState<string>("")
  const [selectedPatch, setSelectedPatch] = useState<string>("")
  const assignOrganiser = useMutation({
    mutationFn: async () => {
      await (supabase as any).rpc('upsert_organiser_patch', { p_org: selectedOrganiser, p_patch: selectedPatch })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-org-patch-links"] })
      toast({ title: "Organiser assigned" })
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || 'Failed to assign organiser', variant: 'destructive' })
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead Console</CardTitle>
        <CardDescription>Manage organisers across your patches</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="text-sm mb-1">Organiser</div>
            <Select value={selectedOrganiser} onValueChange={setSelectedOrganiser}>
              <SelectTrigger>
                <SelectValue placeholder="Select organiser" />
              </SelectTrigger>
              <SelectContent>
                {(organisers as any[]).map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.full_name || o.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-sm mb-1">Patch</div>
            <Select value={selectedPatch} onValueChange={setSelectedPatch}>
              <SelectTrigger>
                <SelectValue placeholder="Select patch" />
              </SelectTrigger>
              <SelectContent>
                {(patches as any[]).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button className="w-full" disabled={!selectedOrganiser || !selectedPatch} onClick={() => assignOrganiser.mutate()}>Assign</Button>
          </div>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organiser</TableHead>
                <TableHead>Patch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(orgPatchLinks as any[]).map((l: any) => {
                const org = (organisers as any[]).find((o: any) => o.id === l.organiser_id)
                const patch = (patches as any[]).find((p: any) => p.id === l.patch_id)
                return (
                  <TableRow key={l.id}>
                    <TableCell>{org?.full_name || l.organiser_id}</TableCell>
                    <TableCell>{patch?.name || l.patch_id}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

