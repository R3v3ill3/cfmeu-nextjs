"use client"
export const dynamic = 'force-dynamic'

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export default function ActivitiesPage() {
  const [open, setOpen] = useState(false)
  const [topic, setTopic] = useState("")
  const [details, setDetails] = useState("")

  const qc = useQueryClient()
  const { data: rows = [], isFetching } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      // Use ratings as a proxy for recents, until an anchor table is created
      const { data: rat, error: ratErr } = await (supabase as any)
        .from("worker_activity_ratings")
        .select("id, created_at, rating_type, rating_value, workers(first_name,surname), employers(name), job_sites(name)")
        .order("created_at", { ascending: false })
        .limit(200)
      if (ratErr) throw ratErr
      return rat || []
    }
  })

  const createActivityAnchor = useMutation({
    // Create a minimal anchor table if truly needed; for now, no-op to avoid schema changes
    mutationFn: async () => {},
    onSuccess: () => {
      setOpen(false)
      setTopic("")
      setDetails("")
      qc.invalidateQueries({ queryKey: ["activities"] })
    }
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Activities</h1>
        <Button onClick={() => setOpen(true)}>New Activity</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Worker</TableHead>
                  <TableHead>Employer</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Topic</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows as any[]).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                    <TableCell>{`${r.workers?.first_name ?? ''} ${r.workers?.surname ?? ''}`.trim() || '—'}</TableCell>
                    <TableCell>{r.employers?.name || '—'}</TableCell>
                    <TableCell>{r.job_sites?.name || '—'}</TableCell>
                    <TableCell className="max-w-[380px] truncate">{r.topic || r.notes || ''}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">{isFetching ? "Loading…" : "No activities yet."}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Activity</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Input placeholder="Topic (optional)" value={topic} onChange={(e) => setTopic(e.target.value)} />
            <Textarea placeholder="Details" value={details} onChange={(e) => setDetails(e.target.value)} className="min-h-[120px]" />
            <div className="flex justify-end">
              <Button onClick={() => createActivityAnchor.mutate()}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

