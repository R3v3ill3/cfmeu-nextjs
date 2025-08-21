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
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            <Button onClick={() => createCampaign.mutate()} disabled={createCampaign.isPending}>Create</Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : campaigns.length === 0 ? (
        <p className="text-sm text-muted-foreground">No campaigns yet.</p>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <Card key={c.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{c.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <div>Type: {c.type.replace("_"," ")}</div>
                  <div>Dates: {format(new Date(c.start_date), 'd MMM yyyy')} → {format(new Date(c.end_date), 'd MMM yyyy')}</div>
                  <div>Status: {c.status}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

