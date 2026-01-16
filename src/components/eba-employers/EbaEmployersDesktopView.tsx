"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"
import { useLocalStorage } from "react-use"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { EyeOff, Eye, FileText, ChevronDown, ChevronUp } from "lucide-react"
import { ProjectDisplayCell } from "./ProjectDisplayCell"
import { PatchOrganiserDisplayCell } from "./PatchOrganiserDisplayCell"
import { EbaEmployerRatingCell } from "./EbaEmployerRatingCell"
import { EbaEmployerActions } from "./EbaEmployerActions"
import { CorrelationAnalytics } from "./CorrelationAnalytics"

type CategoryRow = {
  category_type: 'contractor_role' | 'trade'
  category_code: string
  category_name: string
  current_employers: number
  total_employers: number
}

type PatchAssignment = {
  patch_id: string
  patch_name: string
  organiser_names: string[]
}

export type EmployerRow = {
  employer_id: string
  employer_name: string
  projects: Array<{ 
    id: string
    name: string
    tier?: string | null
    full_address?: string | null
    builder_name?: string | null
  }>
  patch_assignments?: PatchAssignment[]
}

export type ProjectDisplayMode = 'hide' | 'show' | 'detail'
type PatchDisplayMode = 'hide' | 'show'

export function EbaEmployersDesktopView() {
  const [type, setType] = useState<'contractor_role' | 'trade'>('contractor_role')
  const [code, setCode] = useState<string>('')
  const [query, setQuery] = useState('')
  const [currentOnly, setCurrentOnly] = useState(true)
  const [includeDerived, setIncludeDerived] = useState(true)
  const [includeManual, setIncludeManual] = useState(true)
  const [keyOnly, setKeyOnly] = useState(false)
  const [showNonEba, setShowNonEba] = useState(false)
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null)
  const { startNavigation } = useNavigationLoading()
  
  // Project display mode with localStorage persistence
  const [projectDisplayMode, setProjectDisplayMode] = useLocalStorage<ProjectDisplayMode>(
    'eba-employers-project-view',
    'show'
  )
  const [patchDisplayMode, setPatchDisplayMode] = useLocalStorage<PatchDisplayMode>(
    'eba-employers-patch-display',
    'hide'
  )
  
  // Analytics section state
  const [analyticsExpanded, setAnalyticsExpanded] = useLocalStorage(
    'eba-employers-analytics-expanded',
    false
  )

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

  // Determine if we need extended data based on display mode
  const effectivePatchDisplayMode = patchDisplayMode ?? 'hide'
  const showPatchColumn = effectivePatchDisplayMode === 'show'

  const needsExtendedData = projectDisplayMode === 'detail'
  const needsPatchData = showPatchColumn

  // Load employers for the selected category
  const { data: employers = [], isFetching } = useQuery({
    queryKey: ['eba-employers', type, code, currentOnly, includeDerived, includeManual, keyOnly, needsExtendedData, needsPatchData],
    enabled: !!code,
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('type', type)
      params.set('code', code)
      if (currentOnly) params.set('currentOnly', 'true')
      if (!includeDerived) params.set('includeDerived', 'false')
      if (!includeManual) params.set('includeManual', 'false')
      if (keyOnly) params.set('keyOnly', 'true')
      if (needsExtendedData) params.set('includeExtendedData', 'true')
      if (needsPatchData) params.set('includePatchData', 'true')
      const res = await fetch(`/api/eba/employers?${params.toString()}`)
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      return (json.data || []) as EmployerRow[]
    },
  })

  const { data: nonEbaEmployers = [], isFetching: isFetchingNonEba } = useQuery({
    queryKey: ['eba-employers-non-eba', type, code, currentOnly, includeDerived, includeManual, keyOnly, needsExtendedData, needsPatchData],
    enabled: showNonEba && !!code,
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('type', type)
      params.set('code', code)
      if (currentOnly) params.set('currentOnly', 'true')
      if (!includeDerived) params.set('includeDerived', 'false')
      if (!includeManual) params.set('includeManual', 'false')
      if (keyOnly) params.set('keyOnly', 'true')
      if (needsExtendedData) params.set('includeExtendedData', 'true')
      if (needsPatchData) params.set('includePatchData', 'true')
      const res = await fetch(`/api/eba/employers/non-eba?${params.toString()}`)
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      return (json.data || []) as EmployerRow[]
    },
  })

  // Fetch ratings for visible employers
  const employerIds = useMemo(() => {
    const ids = new Set<string>()
    ;(employers || []).forEach((e) => ids.add(e.employer_id))
    if (showNonEba) {
      ;(nonEbaEmployers || []).forEach((e) => ids.add(e.employer_id))
    }
    return Array.from(ids)
  }, [employers, nonEbaEmployers, showNonEba])
  
  const { data: ratingsData } = useQuery({
    queryKey: ['eba-employer-ratings', employerIds],
    enabled: employerIds.length > 0,
    queryFn: async () => {
      const res = await fetch('/api/employers/ratings/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employerIds })
      })
      if (!res.ok) throw new Error('Failed to fetch ratings')
      const json = await res.json()
      return json.ratings || {}
    },
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (employers || []).filter((e) => !q || e.employer_name.toLowerCase().includes(q))
  }, [employers, query])

  const filteredNonEba = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (nonEbaEmployers || []).filter((e) => !q || e.employer_name.toLowerCase().includes(q))
  }, [nonEbaEmployers, query])

  const totalColumns = 3 + (projectDisplayMode !== 'hide' ? 1 : 0) + (showPatchColumn ? 1 : 0)
  const showNonEbaToggle = Boolean(code)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">EBA Employers</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              {showNonEbaToggle && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="showNonEba"
                    checked={showNonEba}
                    onCheckedChange={(v) => setShowNonEba(Boolean(v))}
                  />
                  <label htmlFor="showNonEba" className="text-sm">Show non‑EBA employers</label>
                </div>
              )}
            </div>
          </div>

          {/* Project Display Mode Toggle */}
          <div className="pt-3 border-t">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Project Display</label>
            <ToggleGroup 
              type="single" 
              value={projectDisplayMode || 'show'} 
              onValueChange={(value) => value && setProjectDisplayMode(value as ProjectDisplayMode)}
              className="justify-start"
            >
              <ToggleGroupItem value="hide" aria-label="Hide projects" className="gap-2">
                <EyeOff className="h-4 w-4" />
                Hide Projects
              </ToggleGroupItem>
              <ToggleGroupItem value="show" aria-label="Show projects" className="gap-2">
                <Eye className="h-4 w-4" />
                Show Projects
              </ToggleGroupItem>
              <ToggleGroupItem value="detail" aria-label="Show project details" className="gap-2">
                <FileText className="h-4 w-4" />
                Show Detail
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="pt-3 border-t">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Patch &amp; Organiser Display</label>
            <ToggleGroup
              type="single"
              value={effectivePatchDisplayMode}
              onValueChange={(value) => value && setPatchDisplayMode(value as PatchDisplayMode)}
              className="justify-start"
            >
              <ToggleGroupItem value="hide" aria-label="Hide patch assignments" className="gap-2">
                <EyeOff className="h-4 w-4" />
                Hide Column
              </ToggleGroupItem>
              <ToggleGroupItem value="show" aria-label="Show patch assignments" className="gap-2">
                <Eye className="h-4 w-4" />
                Show Column
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employers ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[25%] max-w-[300px]">Employer</TableHead>
                  <TableHead className="w-[15%]">Rating</TableHead>
                  {showPatchColumn && (
                    <TableHead className="w-[20%] min-w-[220px]">Patches &amp; Organisers</TableHead>
                  )}
                  {projectDisplayMode !== 'hide' && (
                    <TableHead className={projectDisplayMode === 'detail' ? 'w-[45%]' : 'w-[45%]'}>
                      Projects
                    </TableHead>
                  )}
                  <TableHead className="w-[15%] min-w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.employer_id}>
                    <TableCell className="font-medium max-w-[300px]">
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
                      <EbaEmployerRatingCell
                        employerId={row.employer_id}
                        employerName={row.employer_name}
                        rating={ratingsData?.[row.employer_id]}
                      />
                    </TableCell>

                    {showPatchColumn && (
                      <TableCell>
                        <PatchOrganiserDisplayCell assignments={row.patch_assignments ?? []} />
                      </TableCell>
                    )}
                    
                    {projectDisplayMode !== 'hide' && (
                      <TableCell>
                        <ProjectDisplayCell 
                          projects={row.projects}
                          displayMode={projectDisplayMode || 'show'}
                        />
                      </TableCell>
                    )}
                    
                    <TableCell>
                      <EbaEmployerActions
                        employerId={row.employer_id}
                        employerName={row.employer_name}
                        projects={row.projects}
                        onViewDetails={() => setSelectedEmployerId(row.employer_id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={totalColumns} className="text-center text-sm text-muted-foreground py-8">
                      {isFetching ? 'Loading…' : 'No employers found.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {showNonEba && (
        <Card>
          <CardHeader>
            <CardTitle>Non‑EBA Employers ({filteredNonEba.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[25%] max-w-[300px]">Employer</TableHead>
                    <TableHead className="w-[15%]">Rating</TableHead>
                    {showPatchColumn && (
                      <TableHead className="w-[20%] min-w-[220px]">Patches &amp; Organisers</TableHead>
                    )}
                    {projectDisplayMode !== 'hide' && (
                      <TableHead className={projectDisplayMode === 'detail' ? 'w-[45%]' : 'w-[45%]'}>
                        Projects
                      </TableHead>
                    )}
                    <TableHead className="w-[15%] min-w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNonEba.map((row) => (
                    <TableRow key={row.employer_id}>
                      <TableCell className="font-medium max-w-[300px]">
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
                        <EbaEmployerRatingCell
                          employerId={row.employer_id}
                          employerName={row.employer_name}
                          rating={ratingsData?.[row.employer_id]}
                        />
                      </TableCell>

                      {showPatchColumn && (
                        <TableCell>
                          <PatchOrganiserDisplayCell assignments={row.patch_assignments ?? []} />
                        </TableCell>
                      )}

                      {projectDisplayMode !== 'hide' && (
                        <TableCell>
                          <ProjectDisplayCell
                            projects={row.projects}
                            displayMode={projectDisplayMode || 'show'}
                          />
                        </TableCell>
                      )}

                      <TableCell>
                        <EbaEmployerActions
                          employerId={row.employer_id}
                          employerName={row.employer_name}
                          projects={row.projects}
                          onViewDetails={() => setSelectedEmployerId(row.employer_id)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredNonEba.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={totalColumns} className="text-center text-sm text-muted-foreground py-8">
                        {isFetchingNonEba ? 'Loading…' : 'No non‑EBA employers found.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Correlation Analytics Section */}
      <Card>
        <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setAnalyticsExpanded(!analyticsExpanded)}>
          <div className="flex items-center justify-between">
            <CardTitle>Analytics & Correlations</CardTitle>
            <Button variant="ghost" size="sm">
              {analyticsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {analyticsExpanded && (
          <CardContent>
            <CorrelationAnalytics
              categoryType={type}
              categoryCode={code}
              currentOnly={currentOnly}
              includeDerived={includeDerived}
              includeManual={includeManual}
            />
          </CardContent>
        )}
      </Card>

      <EmployerDetailModal 
        employerId={selectedEmployerId} 
        isOpen={!!selectedEmployerId} 
        onClose={() => setSelectedEmployerId(null)} 
      />
    </div>
  )
}






