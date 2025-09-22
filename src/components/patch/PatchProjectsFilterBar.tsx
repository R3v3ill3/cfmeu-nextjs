"use client"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { PROJECT_TIER_LABELS, ProjectTier } from "@/components/projects/types"
import { ArrowDownNarrowWide, ArrowUpNarrowWide, Filter } from "lucide-react"

export type PatchProjectFilters = {
  patchId: string | null
  q: string
  tier: "all" | ProjectTier
  universe: "all" | "active" | "potential" | "excluded"
  stage: "all" | "future" | "pre_construction" | "construction" | "archived"
  eba: "all" | "eba_active" | "eba_inactive" | "builder_unknown"
  sort: "name" | "value" | "tier" | "workers" | "members" | "delegates" | "eba_coverage" | "employers"
  dir: "asc" | "desc"
}

interface PatchProjectsFilterBarProps {
  patchOptions: { value: string; label: string }[]
  filters: PatchProjectFilters
  onFiltersChange: (changes: Partial<PatchProjectFilters>) => void
  onClear?: () => void
  disablePatchSelect?: boolean
}

const universeOptions: Array<{ value: PatchProjectFilters["universe"]; label: string }> = [
  { value: "all", label: "All universes" },
  { value: "active", label: "Active" },
  { value: "potential", label: "Potential" },
  { value: "excluded", label: "Excluded" }
]

const stageOptions: Array<{ value: PatchProjectFilters["stage"]; label: string }> = [
  { value: "all", label: "All stages" },
  { value: "future", label: "Future" },
  { value: "pre_construction", label: "Pre-construction" },
  { value: "construction", label: "Construction" },
  { value: "archived", label: "Archived" }
]

const ebaOptions: Array<{ value: PatchProjectFilters["eba"]; label: string }> = [
  { value: "all", label: "EBA: All" },
  { value: "eba_active", label: "EBA: Builder Active" },
  { value: "eba_inactive", label: "EBA: Builder Inactive" },
  { value: "builder_unknown", label: "EBA: Builder Unknown" }
]

const sortOptions: Array<{ value: PatchProjectFilters["sort"]; label: string }> = [
  { value: "name", label: "Name" },
  { value: "tier", label: "Tier" },
  { value: "value", label: "Project value" },
  { value: "workers", label: "Workers" },
  { value: "members", label: "Members" },
  { value: "delegates", label: "Delegates" },
  { value: "eba_coverage", label: "EBA coverage" },
  { value: "employers", label: "Employers" }
]

export function PatchProjectsFilterBar({ patchOptions, filters, onFiltersChange, onClear, disablePatchSelect }: PatchProjectsFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border bg-white/60 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Filter className="h-4 w-4" />
        Filters
      </div>

      {disablePatchSelect ? (
        <div className="min-w-[180px] text-sm font-medium text-primary">
          {patchOptions.find((option) => option.value === filters.patchId)?.label || "Your patch"}
        </div>
      ) : (
        <Select
          value={filters.patchId ?? ""}
          onValueChange={(value) => onFiltersChange({ patchId: value || null })}
        >
          <SelectTrigger className="min-w-[180px]">
            <SelectValue placeholder="Select patch" />
          </SelectTrigger>
          <SelectContent>
            {patchOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Input
        placeholder="Search projects..."
        className="w-60"
        value={filters.q}
        onChange={(event) => onFiltersChange({ q: event.target.value })}
      />

      <Select value={filters.tier} onValueChange={(value) => onFiltersChange({ tier: value as PatchProjectFilters["tier"] })}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Tier" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All tiers</SelectItem>
          {Object.entries(PROJECT_TIER_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.universe} onValueChange={(value) => onFiltersChange({ universe: value as PatchProjectFilters["universe"] })}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Universe" />
        </SelectTrigger>
        <SelectContent>
          {universeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.stage} onValueChange={(value) => onFiltersChange({ stage: value as PatchProjectFilters["stage"] })}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Stage" />
        </SelectTrigger>
        <SelectContent>
          {stageOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.eba} onValueChange={(value) => onFiltersChange({ eba: value as PatchProjectFilters["eba"] })}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="EBA" />
        </SelectTrigger>
        <SelectContent>
          {ebaOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.sort} onValueChange={(value) => onFiltersChange({ sort: value as PatchProjectFilters["sort"] })}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onFiltersChange({ dir: filters.dir === "asc" ? "desc" : "asc" })}
      >
        {filters.dir === "asc" ? <ArrowUpNarrowWide className="h-4 w-4 mr-1" /> : <ArrowDownNarrowWide className="h-4 w-4 mr-1" />}
        {filters.dir === "asc" ? "Asc" : "Desc"}
      </Button>

      {onClear && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      )}
    </div>
  )
}
