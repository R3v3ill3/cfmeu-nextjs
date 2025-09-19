"use client"

import { Badge } from "@/components/ui/badge"
import { ShieldCheck, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"

type BadgeSize = "sm" | "md"

const sizeClasses: Record<BadgeSize, string> = {
  sm: "h-6 px-2 text-xs gap-1",
  md: "h-7 px-3 text-sm gap-1.5",
}

export function IncolinkBadge({ className, size = "sm" }: { className?: string; size?: BadgeSize }) {
  return (
    <Badge
      variant="secondary"
      className={cn("inline-flex items-center border border-sky-400 text-sky-700 bg-sky-50", sizeClasses[size], className)}
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      <span>Incolink</span>
    </Badge>
  )
}

export function ActiveProjectBadge({ className, size = "sm", count }: { className?: string; size?: BadgeSize; count?: number }) {
  const label = count && count > 1 ? `${count} Active Projects` : "Active Project"
  return (
    <Badge
      variant="outline"
      className={cn("inline-flex items-center border border-emerald-400 text-emerald-700 bg-emerald-50", sizeClasses[size], className)}
    >
      <Building2 className="h-3.5 w-3.5" />
      <span>{label}</span>
    </Badge>
  )
}
