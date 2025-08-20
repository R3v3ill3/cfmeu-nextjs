"use client"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMemo } from "react"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

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

  // Dynamic patch options derived from job sites' patch field or projects if available
  const { data: dynamicPatches = [] } = useQuery({
    queryKey: ["filtersbar-patches"],
    queryFn: async () => {
      // Try job_sites.patch first; fallback to projects.region or name groupings
      const { data: sites } = await (supabase as any)
        .from("job_sites")
        .select("id, patch")
        .limit(2000)
      const set = new Set<string>()
      ;(sites as any[] || []).forEach((s) => {
        const val = (s as any).patch
        if (typeof val === "string" && val.trim() !== "") set.add(val.trim())
      })
      // If none found, attempt from projects table (optional region/name prefix)
      if (set.size === 0) {
        const { data: projects } = await (supabase as any)
          .from("projects")
          .select("id, region")
          .limit(2000)
        ;(projects as any[] || []).forEach((p) => {
          const val = (p as any).region
          if (typeof val === "string" && val.trim() !== "") set.add(val.trim())
        })
      }
      return Array.from(set).sort().map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }))
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
      </div>
    </div>
  )
}

