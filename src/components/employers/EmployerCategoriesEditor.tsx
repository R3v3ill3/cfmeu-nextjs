"use client"

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

type CategoryRef = { category_type: 'contractor_role' | 'trade'; category_code: string; category_name: string }
type EmployerCategory = { code: string; name: string; manual: boolean; derived: boolean; is_current: boolean }

export function EmployerCategoriesEditor({ employerId }: { employerId: string }) {
  const queryClient = useQueryClient()
  const [type, setType] = useState<'contractor_role' | 'trade'>('contractor_role')
  const [code, setCode] = useState<string>('')
  const [busy, setBusy] = useState(false)

  // Reference categories for dropdown
  const { data: refCategories = [], isFetching: refLoading } = useQuery({
    queryKey: ['eba-categories', type],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('type', type)
      const res = await fetch(`/api/eba/categories?${params.toString()}`)
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      return (json.data || []) as Array<{ category_type: 'contractor_role' | 'trade'; category_code: string; category_name: string }>
    }
  })

  useEffect(() => {
    if (refCategories.length > 0) {
      if (!code || !refCategories.some((c) => c.category_code === code)) setCode(refCategories[0].category_code)
    } else {
      setCode('')
    }
  }, [refCategories])

  // Current employer categories (derived + manual)
  const { data: current, isFetching } = useQuery({
    queryKey: ['employer-categories', employerId],
    enabled: !!employerId,
    queryFn: async () => {
      const res = await fetch(`/api/eba/employers/${employerId}/categories`)
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      return json.data as { roles: EmployerCategory[]; trades: EmployerCategory[]; projects: Array<{ id: string; name: string }> }
    }
  })

  const roles = current?.roles || []
  const trades = current?.trades || []
  const projects = current?.projects || []

  const addCategory = async () => {
    if (!employerId || !code) return
    setBusy(true)
    try {
      const res = await fetch(`/api/eba/employers/${employerId}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, code }),
      })
      if (!res.ok) throw new Error(await res.text())
      await queryClient.invalidateQueries({ queryKey: ['employer-categories', employerId] })
    } finally {
      setBusy(false)
    }
  }

  const removeCategory = async (t: 'contractor_role' | 'trade', c: string) => {
    if (!employerId || !c) return
    setBusy(true)
    try {
      const res = await fetch(`/api/eba/employers/${employerId}/categories`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: t, code: c }),
      })
      if (!res.ok) throw new Error(await res.text())
      await queryClient.invalidateQueries({ queryKey: ['employer-categories', employerId] })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categories & Projects</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="mb-2 text-sm font-medium text-muted-foreground">Roles</div>
            <div className="flex flex-wrap gap-2">
              {roles.length > 0 ? roles.map((r) => (
                <Badge key={r.code} variant={r.manual ? 'default' : 'secondary'} className="gap-2">
                  {r.name}
                  {r.manual && (
                    <button className="ml-1 text-xs underline" disabled={busy} onClick={() => removeCategory('contractor_role', r.code)}>remove</button>
                  )}
                </Badge>
              )) : <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium text-muted-foreground">Trades</div>
            <div className="flex flex-wrap gap-2">
              {trades.length > 0 ? trades.map((t) => (
                <Badge key={t.code} variant={t.manual ? 'default' : 'secondary'} className="gap-2">
                  {t.name}
                  {t.manual && (
                    <button className="ml-1 text-xs underline" disabled={busy} onClick={() => removeCategory('trade', t.code)}>remove</button>
                  )}
                </Badge>
              )) : <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <div className="text-sm font-medium text-muted-foreground">Type</div>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contractor_role">Contractor Role</SelectItem>
                <SelectItem value="trade">Trade</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <div className="text-sm font-medium text-muted-foreground">Category</div>
            <Select value={code} onValueChange={setCode} disabled={refLoading || refCategories.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={refLoading ? 'Loading…' : (refCategories.length ? 'Select category' : 'No categories')} />
              </SelectTrigger>
              <SelectContent>
                {refCategories.map((c) => (
                  <SelectItem key={c.category_code} value={c.category_code}>{c.category_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Button onClick={addCategory} disabled={!code || busy}>Add</Button>
          </div>
        </div>

        <Separator />

        <div>
          <div className="mb-2 text-sm font-medium text-muted-foreground">Current Projects</div>
          <div className="flex flex-wrap gap-2">
            {projects.length > 0 ? projects.map((p) => (
              <Badge key={p.id} variant="secondary">{p.name}</Badge>
            )) : <span className="text-sm text-muted-foreground">—</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}


