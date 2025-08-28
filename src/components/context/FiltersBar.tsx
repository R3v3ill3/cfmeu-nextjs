"use client"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { PROJECT_TIER_LABELS, ProjectTier } from "@/components/projects/types"

type FiltersBarProps = {
  patchOptions?: { value: string; label: string }[]
  statusOptions?: { value: string; label: string }[]
}

export function FiltersBar({ patchOptions, statusOptions }: FiltersBarProps) {
  const pathname = usePathname()
  const params = useSearchParams()
  const router = useRouter()

  const patch = params.get("patch") || ""
  const status = params.get("status") || ""
  const q = params.get("q") || ""
  const [tierFilter, setTierFilter] = useState<ProjectTier | 'all'>('all')

  const segments = useMemo(() => pathname.split("/").filter(Boolean), [pathname])

  const setParam = (key: string, value?: string) => {
    const sp = new URLSearchParams(params.toString())
    if (!value) sp.delete(key)
    else sp.set(key, value)
    router.replace(`${pathname}?${sp.toString()}`)
  }

  const linkWithParams = (href: string) => {
    const sp = new URLSearchParams(params.toString())
    return `${href}?${sp.toString()}`
  }

  // Patch options: prefer dedicated patches table (scoped by user role), fallback to legacy job_sites.patch
  const { data: dynamicPatches = [] } = useQuery({
    queryKey: ["filtersbar-patches"],
    queryFn: async () => {
      // Determine user and role
      let userId: string | null = null
      let role: string | null = null
      try {
        const { data: auth } = await supabase.auth.getUser()
        userId = (auth as any)?.user?.id || null
        if (userId) {
          const { data: prof } = await (supabase as any)
            .from("profiles")
            .select("role")
            .eq("id", userId)
            .single()
          role = (prof as any)?.role || null
        }
      } catch {}

      // Attempt to read from patches with role-aware scoping
      try {
        let patchRows: any[] = []
        if (role === "admin") {
          const { data } = await (supabase as any)
            .from("patches")
            .select("id, name")
            .order("name")
          patchRows = (data as any[]) || []
        } else if (role === "lead_organiser") {
          // Patches assigned to lead organiser or to organisers they manage
          const [direct, team] = await Promise.all([
            (supabase as any)
              .from("lead_organiser_patch_assignments")
              .select("patches:patch_id(id,name)")
              .is("effective_to", null)
              .eq("lead_organiser_id", userId),
            (supabase as any)
              .from("organiser_patch_assignments")
              .select("patches:patch_id(id,name)")
              .is("effective_to", null)
          ])
          const list: any[] = []
          const pushRow = (r: any) => { if (r?.patches) list.push(r.patches) }
          ;(((direct as any)?.data as any[]) || []).forEach(pushRow)
          ;(((team as any)?.data as any[]) || []).forEach(pushRow)
          // De-dupe by id
          const seen = new Set<string>()
          patchRows = list.filter((p) => (p?.id && !seen.has(p.id) && seen.add(p.id)))
        } else if (role === "organiser") {
          const { data } = await (supabase as any)
            .from("organiser_patch_assignments")
            .select("patches:patch_id(id,name)")
            .is("effective_to", null)
            .eq("organiser_id", userId)
          patchRows = ((data as any[]) || []).map((r: any) => r.patches).filter(Boolean)
        }

        // If we have rows, return them as options
        if (Array.isArray(patchRows) && patchRows.length > 0) {
          return patchRows.map((p: any) => ({ value: p.id, label: p.name || p.id }))
        }
      } catch {
        // tables might not exist yet → fall back
      }
      // No patches available or tables missing
      return []
    }
  })

  return (
    <div className="sticky top-0 z-30 flex flex-col gap-3 border-b bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur p-3">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href={linkWithParams("/patch")}>Home</BreadcrumbLink>
          </BreadcrumbItem>
          {segments.map((seg, i) => {
            const href = "/" + segments.slice(0, i + 1).join("/")
            const isLast = i === segments.length - 1
            return (
              <span key={href} className="inline-flex items-center">
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="capitalize">{seg.replaceAll("-"," ")}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={linkWithParams(href)} className="capitalize">{seg.replaceAll("-"," ")}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </span>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="w-48">
          <Select value={patch} onValueChange={(v) => setParam("patch", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Patch" />
            </SelectTrigger>
            <SelectContent>
              {(patchOptions || dynamicPatches).map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-44">
          <Select value={status} onValueChange={(v) => setParam("status", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {(statusOptions || [
                { value: "stale", label: "Stale (7+ days since last visit)" },
              ]).map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[220px] flex-1">
          <Input placeholder="Search…" value={q} onChange={(e) => setParam("q", e.target.value)} />
        </div>
        {/* Tier Filter */}
        <Select value={tierFilter} onValueChange={(value) => setTierFilter(value as ProjectTier | 'all')}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            {Object.entries(PROJECT_TIER_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

