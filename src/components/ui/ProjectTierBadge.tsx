import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ProjectTierBadgeProps {
  tier: string | null
  size?: "sm" | "md" | "lg"
  variant?: "default" | "outline"
  className?: string
}

const tierConfig = {
  tier_1: {
    label: "Tier 1",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: "🏗️"
  },
  tier_2: {
    label: "Tier 2", 
    color: "bg-orange-100 text-orange-800 border-orange-200",
    icon: "🏢"
  },
  tier_3: {
    label: "Tier 3",
    color: "bg-blue-100 text-blue-800 border-blue-200", 
    icon: "🏠"
  }
}

export function ProjectTierBadge({ 
  tier, 
  size = "md", 
  variant = "default",
  className 
}: ProjectTierBadgeProps) {
  if (!tier) return null
  
  const config = tierConfig[tier as keyof typeof tierConfig]
  if (!config) return null

  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5"
  }

  return (
    <Badge 
      variant={variant}
      className={cn(
        sizeClasses[size],
        variant === "default" ? config.color : "",
        "font-medium inline-flex items-center gap-1.5",
        className
      )}
    >
      <span>{config.icon}</span>
      {config.label}
    </Badge>
  )
}
