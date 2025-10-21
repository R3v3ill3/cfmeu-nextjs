"use client"
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"

type CategoryRow = {
  category_type: 'contractor_role' | 'trade'
  category_code: string
  category_name: string
  current_employers: number
  total_employers: number
}

type EmployerRow = {
  employer_id: string
  employer_name: string
  projects: Array<{ id: string; name: string }>
}

export default function EbaEmployersPage() {
  const [type, setType] = useState<'contractor_role' | 'trade'>('contractor_role')
  const [code, setCode] = useState<string>('')
  const [query, setQuery] = useState('')
  const [currentOnly, setCurrentOnly] = useState(true)
  const [includeDerived, setIncludeDerived] = useState(true)
  const [includeManual, setIncludeManual] = useState(true)
  const [keyOnly, setKeyOnly] = useState(false)
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null)
  const { startNavigation } = useNavigationLoading()

  // Load categories for the selected type
  const { data: categories = [], isFetching: loadingCats } = useQuery({
    queryKey: ['eba-categories', type, keyOnly],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('type', type)
      if (keyOnly) params.set('keyOnly', 'true')
      const res = await fetch(`/api/eba/categories?${params.toString()}`)
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      return (json.data || []) as CategoryRow[]
    },
  })

  // Auto-select first category when list refreshes
  useEffect(() => {
    if (categories.length > 0) {
      if (!code || !categories.some((c) => c.category_code === code)) {
        setCode(categories[0].category_code)
      }
    } else {
      setCode('')
    }
  }, [categories])

  // Load employers for the selected category
  const { data: employers = [], isFetching } = useQuery({
    queryKey: ['eba-employers', type, code, currentOnly, includeDerived, includeManual, keyOnly],
    enabled: !!code,
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('type', type)
      params.set('code', code)
      if (currentOnly) params.set('currentOnly', 'true')
      if (!includeDerived) params.set('includeDerived', 'false')
      if (!includeManual) params.set('includeManual', 'false')
      if (keyOnly) params.set('keyOnly', 'true')
      const res = await fetch(`/api/eba/employers?${params.toString()}`)
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      return (json.data || []) as EmployerRow[]
    },
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (employers || []).filter((e) => !q || e.employer_name.toLowerCase().includes(q))
  }, [employers, query])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">EBA Employers</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Category Type</label>
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

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Category</label>
              <Select value={code} onValueChange={setCode} disabled={loadingCats || categories.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingCats ? 'Loading…' : (categories.length ? 'Select category' : 'No categories')} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.category_code} value={c.category_code}>
                      {c.category_name} <span className="text-muted-foreground">({c.current_employers})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Search employer</label>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type a name" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="currentOnly" checked={currentOnly} onCheckedChange={(v) => setCurrentOnly(Boolean(v))} />
                <label htmlFor="currentOnly" className="text-sm">Current only</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="includeDerived" checked={includeDerived} onCheckedChange={(v) => setIncludeDerived(Boolean(v))} />
                <label htmlFor="includeDerived" className="text-sm">Include derived</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="includeManual" checked={includeManual} onCheckedChange={(v) => setIncludeManual(Boolean(v))} />
                <label htmlFor="includeManual" className="text-sm">Include manual</label>
              </div>
              {type === 'trade' && (
                <div className="flex items-center gap-2">
                  <Checkbox id="keyOnly" checked={keyOnly} onCheckedChange={(v) => setKeyOnly(Boolean(v))} />
                  <label htmlFor="keyOnly" className="text-sm">Key contractors only</label>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%] max-w-[400px]">Employer</TableHead>
                  <TableHead className="w-[55%]">Projects</TableHead>
                  <TableHead className="w-[15%] min-w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.employer_id}>
                    <TableCell className="font-medium max-w-[400px]">
                      <Button 
                        variant="link" 
                        onClick={() => setSelectedEmployerId(row.employer_id)} 
                        className="px-0 text-left truncate max-w-full block"
                        title={row.employer_name}
                      >
                        {row.employer_name}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {row.projects.length > 0 ? (
                          row.projects.map((p) => (
                            <Badge
                              key={p.id}
                              variant="secondary"
                              className="cursor-pointer whitespace-nowrap"
                              onClick={() => {
                                startNavigation(`/projects/${p.id}`)
                                setTimeout(() => { window.location.href = `/projects/${p.id}` }, 50)
                              }}
                              title={p.name}
                            >
                              {p.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setSelectedEmployerId(row.employer_id)}>
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      {isFetching ? 'Loading…' : 'No employers found.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <EmployerDetailModal employerId={selectedEmployerId} isOpen={!!selectedEmployerId} onClose={() => setSelectedEmployerId(null)} />
    </div>
  )
}


