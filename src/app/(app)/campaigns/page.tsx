"use client"
export const dynamic = 'force-dynamic'

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState } from "react"
import { format } from "date-fns"
import DateInput from "@/components/ui/date-input"
import RoleGuard from "@/components/guards/RoleGuard"
import { Dialog, DialogContent, DialogFooter, DialogHeader as UIDialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import CampaignActivityList from "@/components/activities/CampaignActivityList"
import CampaignActivityBuilder from "@/components/activities/CampaignActivityBuilder"

type Campaign = {
  id: string
  name: string
  type: 'compliance_blitz' | 'general'
  start_date: string
  end_date: string
  status: 'planned' | 'active' | 'completed' | 'paused'
}

export default function CampaignsPage() {
  const qc = useQueryClient()
  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["campaigns-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, type, start_date, end_date, status")
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data as Campaign[]) || []
    }
  })

  const [name, setName] = useState("")
  const [type, setType] = useState<'compliance_blitz' | 'general' | ''>('')
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")

  const createCampaign = useMutation({
    mutationFn: async () => {
      if (!name || !type || !start || !end) throw new Error("Fill all fields")
      const { data: userData } = await supabase.auth.getUser()
      const createdBy = userData.user?.id ?? null
      const { error } = await supabase.from("campaigns").insert({
        name,
        type,
        start_date: start,
        end_date: end,
        status: 'planned',
        created_by: createdBy,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      setName("")
      setType('')
      setStart("")
      setEnd("")
      await qc.invalidateQueries({ queryKey: ["campaigns-list"] })
    }
  })

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["campaigns-list"] })
    }
  })

  const [editing, setEditing] = useState<Campaign | null>(null)
  const [editName, setEditName] = useState("")
  const [editType, setEditType] = useState<'compliance_blitz' | 'general' | ''>('')
  const [editStart, setEditStart] = useState("")
  const [editEnd, setEditEnd] = useState("")

  const updateCampaign = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Nothing to update")
      if (!editName || !editType || !editStart || !editEnd) throw new Error("Fill all fields")
      const { error } = await supabase
        .from("campaigns")
        .update({ name: editName, type: editType, start_date: editStart, end_date: editEnd })
        .eq("id", editing.id)
      if (error) throw error
    },
    onSuccess: async () => {
      setEditing(null)
      await qc.invalidateQueries({ queryKey: ["campaigns-list"] })
    }
  })

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Campaigns</h1>

      <Card>
        <CardHeader>
          <CardTitle>Create Campaign</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compliance_blitz">Compliance Blitz</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
            <DateInput value={start} onChange={(e) => setStart(e.target.value)} />
            <DateInput value={end} onChange={(e) => setEnd(e.target.value)} />
            <Button onClick={() => createCampaign.mutate()} disabled={createCampaign.isPending}>Create</Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2"><img src="/spinner.gif" alt="Loading" className="h-4 w-4" /> Loading…</p>
      ) : campaigns.length === 0 ? (
        <p className="text-sm text-muted-foreground">No campaigns yet.</p>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <Card key={c.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{c.name}</CardTitle>
                  <RoleGuard allow={["admin", "lead_organiser"]} fallback={null}>
                    <div className="flex items-center gap-2">
                      <Dialog
                        onOpenChange={(open) => {
                          if (open) {
                            setEditing(c)
                            setEditName(c.name)
                            setEditType(c.type)
                            setEditStart(c.start_date)
                            setEditEnd(c.end_date)
                          } else if (editing?.id === c.id) {
                            setEditing(null)
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">Edit</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <UIDialogHeader>
                            <DialogTitle>Edit Campaign</DialogTitle>
                          </UIDialogHeader>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input placeholder="Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
                            <Select value={editType} onValueChange={(v: any) => setEditType(v)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="compliance_blitz">Compliance Blitz</SelectItem>
                                <SelectItem value="general">General</SelectItem>
                              </SelectContent>
                            </Select>
                            <DateInput value={editStart} onChange={(e) => setEditStart(e.target.value)} />
                            <DateInput value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
                          </div>
                          <DialogFooter>
                            <Button onClick={() => updateCampaign.mutate()} disabled={updateCampaign.isPending}>Save</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Button variant="destructive" size="sm" onClick={() => deleteCampaign.mutate(c.id)} disabled={deleteCampaign.isPending}>Delete</Button>
                    </div>
                  </RoleGuard>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <div>Type: {c.type.replace("_"," ")}</div>
                  <div>Dates: {format(new Date(c.start_date), 'dd/MM/yyyy')} → {format(new Date(c.end_date), 'dd/MM/yyyy')}</div>
                  <div>Status: {c.status}</div>
                </div>
                <div className="mt-4 space-y-3">
                  {/* Campaign Activities */}
                  {/* Lazy import to avoid circular issues */}
                  {/* @ts-ignore */}
                  <CampaignActivities campaignId={c.id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// Inline subcomponent wrapper to host list and builder
function CampaignActivities({ campaignId }: { campaignId: string }) {
	const [open, setOpen] = useState(false)
	return (
		<div className="space-y-3">
			<CampaignActivityList campaignId={campaignId} onCreateClick={() => setOpen(true)} />
			<CampaignActivityBuilder campaignId={campaignId} open={open} onOpenChange={setOpen} />
		</div>
	)
}

