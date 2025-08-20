"use client"
import { useMemo, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

type Patch = { id: string; name: string; type: string; status: string }

export default function PatchManager() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [type, setType] = useState<"geo" | "trade">("geo")

  const { data: patches = [], isLoading } = useQuery({
    queryKey: ["admin-patches"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("patches")
        .select("id,name,type,status")
        .order("name")
      if (error) throw error
      return (data || []) as Patch[]
    }
  })

  const createPatch = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any)
        .from("patches")
        .insert({ name, type })
        .select("id")
        .single()
      if (error) throw error
      return data as { id: string }
    },
    onSuccess: () => {
      setCreateOpen(false)
      setName("")
      setType("geo")
      qc.invalidateQueries({ queryKey: ["admin-patches"] })
      toast({ title: "Patch created" })
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to create patch", variant: "destructive" })
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Patches</CardTitle>
        <CardDescription>Manage patches, then edit contents and allocations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{isLoading ? "Loading…" : `${(patches as any[]).length} patches`}</div>
          <Button onClick={() => setCreateOpen(true)}>Create Patch</Button>
        </div>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(patches as Patch[]).map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.type}</TableCell>
                  <TableCell>{p.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Patch</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <div className="text-sm mb-1">Name</div>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. North East" />
              </div>
              <div>
                <div className="text-sm mb-1">Type</div>
                <Select value={type} onValueChange={(v: any) => setType(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geo">Geographic</SelectItem>
                    <SelectItem value="trade">Trade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => createPatch.mutate()} disabled={!name.trim()}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

