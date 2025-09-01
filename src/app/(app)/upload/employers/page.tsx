"use client"
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

type PendingEmployer = {
  id: string
  created_at: string
  company_name: string
  csv_role: string | null
  source: string | null
  raw: any
}

export default function PendingEmployersPage() {
  const supabase = getSupabaseBrowserClient()
  const [rows, setRows] = useState<PendingEmployer[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState("")

  const fetchRows = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('pending_employers')
        .select('id, created_at, company_name, csv_role, source, raw')
        .order('created_at', { ascending: false })
      if (error) throw error
      setRows((data || []) as any)
    } catch (e) {
      console.error('Failed to load pending_employers', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRows() }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter(r => r.company_name.toLowerCase().includes(s) || String(r.csv_role || '').toLowerCase().includes(s))
  }, [rows, q])

  const removeRow = async (id: string) => {
    try {
      const { error } = await supabase.from('pending_employers').delete().eq('id', id)
      if (error) throw error
      setRows(prev => prev.filter(r => r.id !== id))
    } catch (e) {
      console.error('Failed to remove row', e)
    }
  }

  const createEmployer = async (row: PendingEmployer) => {
    try {
      const raw = row.raw || {}
      const payload: any = { name: row.company_name, employer_type: 'small_contractor' }
      if (raw.companyStreet) payload.address_line_1 = raw.companyStreet
      if (raw.companyTown) payload.suburb = raw.companyTown
      if (raw.companyState) payload.state = raw.companyState
      if (raw.companyPostcode) payload.postcode = raw.companyPostcode
      if (raw.companyPhone) payload.phone = raw.companyPhone
      if (raw.companyEmail) payload.email = raw.companyEmail
      const { data: created, error } = await supabase.from('employers').insert(payload).select('id').single()
      if (error) throw error
      await removeRow(row.id)
      window.open(`/employers?view=list&q=${encodeURIComponent(row.company_name)}`, '_blank')
    } catch (e) {
      console.error('Failed to create employer', e)
    }
  }

  const openMatch = (row: PendingEmployer) => {
    const url = `/employers?view=list&q=${encodeURIComponent(row.company_name)}`
    window.open(url, '_blank')
  }

  const clearAll = async () => {
    try {
      const { error } = await supabase.from('pending_employers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (error) throw error
      setRows([])
    } catch (e) {
      console.error('Failed to clear all', e)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pending Employers</h1>
        <div className="flex items-center gap-2">
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button variant="outline" onClick={fetchRows} disabled={loading}>Refresh</Button>
          <Button variant="destructive" onClick={clearAll} disabled={rows.length === 0}>Clear All</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employers queued for import <Badge variant="secondary">{rows.length}</Badge></CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground">No pending employers.</div>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">{r.company_name}</div>
                    {r.csv_role && <div className="text-xs text-muted-foreground">Role: {r.csv_role}</div>}
                    <div className="text-xs text-muted-foreground">Added: {new Date(r.created_at).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => openMatch(r)}>Search & Match</Button>
                    <Button size="sm" onClick={() => createEmployer(r)}>Create Employer</Button>
                    <Button size="sm" variant="ghost" onClick={() => removeRow(r.id)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


