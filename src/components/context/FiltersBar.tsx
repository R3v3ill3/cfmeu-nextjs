"use client"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMemo } from "react"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type FiltersBarProps = {
  roleOptions?: { value: string; label: string }[]
  patchOptions?: { value: string; label: string }[]
  statusOptions?: { value: string; label: string }[]
}

export function FiltersBar({ roleOptions, patchOptions, statusOptions }: FiltersBarProps) {
  const pathname = usePathname()
  const params = useSearchParams()
  const router = useRouter()

  const role = params.get("role") || ""
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
        <div className="w-40">
          <Select value={role} onValueChange={(v) => setParam("role", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              {(roleOptions || [
                { value: "organiser", label: "Organiser" },
                { value: "lead_organiser", label: "Lead" },
                { value: "admin", label: "Admin" },
              ]).map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Select value={patch} onValueChange={(v) => setParam("patch", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Patch" />
            </SelectTrigger>
            <SelectContent>
              {(patchOptions || [
                { value: "north", label: "North" },
                { value: "south", label: "South" },
              ]).map(o => (
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
                { value: "active", label: "Active" },
                { value: "paused", label: "Paused" },
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

