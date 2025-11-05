"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal"
import { EbaEmployerMobileCard } from "./EbaEmployerMobileCard"
import { Loader2 } from "lucide-react"

type CategoryRow = {
  category_type: 'contractor_role' | 'trade'
  category_code: string
  category_name: string
  current_employers: number
  total_employers: number
}

export type EmployerRow = {
  employer_id: string
  employer_name: string
  projects: Array<{ 
    id: string
    name: string
  }>
}

export function EbaEmployersMobileView() {
  const [type, setType] = useState<'contractor_role' | 'trade'>('contractor_role')
  const [code, setCode] = useState<string>('')
  const [query, setQuery] = useState('')
  const [currentOnly, setCurrentOnly] = useState(true)
  const [includeDerived, setIncludeDerived] = useState(true)
  const [includeManual, setIncludeManual] = useState(true)
  const [keyOnly, setKeyOnly] = useState(false)
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null)

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

  // Load employers for the selected category (basic data only for mobile)
  const { data: employers = [], isFetching } = useQuery({
    queryKey: ['eba-employers-mobile', type, code, currentOnly, includeDerived, includeManual, keyOnly],
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

  // Fetch ratings for visible employers
  const employerIds = employers.map(e => e.employer_id)
  
  const { data: ratingsData } = useQuery({
    queryKey: ['eba-employer-ratings-mobile', employerIds],
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

  // Filter employers by search query
  const filtered = employers.filter((e) => {
    const q = query.trim().toLowerCase()
    return !q || e.employer_name.toLowerCase().includes(q)
  })

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      {/* Sticky Header with Filters */}
      <div className="sticky top-0 z-10 bg-background border-b shadow-sm">
        <div className="p-4 space-y-3">
          <h1 className="text-xl font-semibold">EBA Employers</h1>
          
          {/* Category Type & Category Selection */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contractor_role">Role</SelectItem>
                  <SelectItem value="trade">Trade</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <Select value={code} onValueChange={setCode} disabled={loadingCats || categories.length === 0}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={loadingCats ? 'Loading…' : 'Select'} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.category_code} value={c.category_code}>
                      {c.category_name} ({c.current_employers})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Search */}
          <div className="space-y-1">
            <Input 
              value={query} 
              onChange={(e) => setQuery(e.target.value)} 
              placeholder="Search employers..." 
              className="h-9"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Checkbox 
                id="mobile-currentOnly" 
                checked={currentOnly} 
                onCheckedChange={(v) => setCurrentOnly(Boolean(v))}
                className="h-4 w-4"
              />
              <span>Current only</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Checkbox 
                id="mobile-includeDerived" 
                checked={includeDerived} 
                onCheckedChange={(v) => setIncludeDerived(Boolean(v))}
                className="h-4 w-4"
              />
              <span>Derived</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Checkbox 
                id="mobile-includeManual" 
                checked={includeManual} 
                onCheckedChange={(v) => setIncludeManual(Boolean(v))}
                className="h-4 w-4"
              />
              <span>Manual</span>
            </label>
            {type === 'trade' && (
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox 
                  id="mobile-keyOnly" 
                  checked={keyOnly} 
                  onCheckedChange={(v) => setKeyOnly(Boolean(v))}
                  className="h-4 w-4"
                />
                <span>Key only</span>
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 space-y-3">
        {/* Results Count */}
        <div className="text-sm text-muted-foreground">
          {isFetching ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : (
            <span>{filtered.length} employer{filtered.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {/* Employer Cards */}
        {filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((employer) => (
              <EbaEmployerMobileCard
                key={employer.employer_id}
                employer={employer}
                rating={ratingsData?.[employer.employer_id]}
                onViewDetails={() => setSelectedEmployerId(employer.employer_id)}
              />
            ))}
          </div>
        ) : !isFetching && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No employers found
            </CardContent>
          </Card>
        )}
      </div>

      <EmployerDetailModal 
        employerId={selectedEmployerId} 
        isOpen={!!selectedEmployerId} 
        onClose={() => setSelectedEmployerId(null)} 
      />
    </div>
  )
}




