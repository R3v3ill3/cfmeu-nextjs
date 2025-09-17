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
      // Only show assignments for patches under this lead organiser
      const { data } = await (supabase as any)
        .from('organiser_patch_assignments')
        .select(`
          id, 
          organiser_id, 
          patch_id,
          patches!inner(id, name),
          profiles!inner(id, full_name, email)
        `)
        .is('effective_to', null)
      
      // Filter to only show assignments for patches managed by this lead organiser
      if (me?.role === 'lead_organiser') {
        const { data: leadPatches } = await (supabase as any)
          .from('lead_organiser_patch_assignments')
          .select('patch_id')
          .eq('lead_organiser_id', me.id)
          .is('effective_to', null)
        
        const leadPatchIds = leadPatches?.map(lp => lp.patch_id) || []
        return (data || []).filter((link: any) => leadPatchIds.includes(link.patch_id))
      }
      
      return data || []
    }
  })

  // Get summary statistics for the lead organiser
  const { data: summary } = useQuery({
    queryKey: ["lead-summary", me?.id],
    enabled: !!me && me.role === 'lead_organiser',
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_patch_summaries_for_user', {
        p_user_id: me.id,
        p_user_role: me.role,
        p_lead_organiser_id: null,
        p_filters: null
      })
      
      if (error) throw error
      
      // Calculate aggregated statistics
      const totalPatches = data?.length || 0
      const totalProjects = data?.reduce((sum: number, patch: any) => sum + (patch.project_count || 0), 0) || 0
      const totalOrganisers = new Set(
        orgPatchLinks.map((link: any) => link.organiser_id)
      ).size
      
      return {
        totalPatches,
        totalProjects,
        totalOrganisers,
        patches: data || []
      }
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
    <div className="space-y-6">
      {/* Summary Statistics */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary.totalPatches}</div>
              <p className="text-xs text-muted-foreground">
                Patches Managed
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary.totalOrganisers}</div>
              <p className="text-xs text-muted-foreground">
                Active Organisers
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary.totalProjects}</div>
              <p className="text-xs text-muted-foreground">
                Total Projects
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Organiser Assignment Tool */}
      <Card>
        <CardHeader>
          <CardTitle>Organiser Assignment</CardTitle>
          <CardDescription>Assign organisers to your patches</CardDescription>
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
              <Button 
                className="w-full" 
                disabled={!selectedOrganiser || !selectedPatch || assignOrganiser.isPending} 
                onClick={() => assignOrganiser.mutate()}
              >
                {assignOrganiser.isPending ? "Assigning..." : "Assign"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Assignments */}
      <Card>
        <CardHeader>
          <CardTitle>Current Assignments</CardTitle>
          <CardDescription>Organisers assigned to your patches</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organiser</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Patch</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(orgPatchLinks as any[]).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No organiser assignments yet
                    </TableCell>
                  </TableRow>
                ) : (
                  (orgPatchLinks as any[]).map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.profiles?.full_name || l.organiser_id}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.profiles?.email}</TableCell>
                      <TableCell>{l.patches?.name || l.patch_id}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            // TODO: Add remove assignment functionality
                            console.log('Remove assignment:', l.id)
                          }}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

