"use client"

import type { MouseEventHandler } from 'react'
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Link2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface IncolinkBadgeProps {
  /**
   * Incolink ID if present
   */
  incolinkId?: string | number | null
  
  /**
   * Size variant for the badge
   */
  size?: "sm" | "md" | "lg"
  
  /**
   * Additional CSS classes
   */
  className?: string
  
  /**
   * Click handler for the badge
   */
  onClick?: MouseEventHandler<HTMLDivElement>
  
  /**
   * Whether the badge is clickable/interactive
   */
  clickable?: boolean
}

const sizeConfig = {
  sm: {
    badge: "h-6 px-2 py-1 text-xs",
    icon: "h-3 w-3",
  },
  md: {
    badge: "h-7 px-3 py-1 text-sm", 
    icon: "h-4 w-4",
  },
  lg: {
    badge: "h-8 px-4 py-2 text-sm",
    icon: "h-4 w-4",
  }
}

export function IncolinkBadge({ 
  incolinkId,
  size = "md",
  className,
  onClick,
  clickable = !!onClick
}: IncolinkBadgeProps) {
  const config = sizeConfig[size]
  const hasIncolinkId = !!incolinkId && String(incolinkId).trim() !== ""
  
  // Determine badge appearance based on whether incolink ID is present
  const badgeVariant = hasIncolinkId ? "default" : "outline"
  const badgeColor = hasIncolinkId 
    ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600" 
    : "border-gray-300 text-gray-600 hover:bg-gray-50"
  
  const badge = (
    <Badge 
      variant={badgeVariant}
      className={cn(
        "inline-flex items-center gap-1.5 transition-colors",
        config.badge,
        badgeColor,
        clickable && "cursor-pointer hover:shadow-sm",
        className
      )}
      onClick={clickable ? onClick : undefined}
    >
      {hasIncolinkId ? (
        <>
          <Link2 className={cn("flex-shrink-0", config.icon)} />
          <span className="font-medium">
            Incolink
          </span>
        </>
      ) : (
        <>
          <Plus className={cn("flex-shrink-0", config.icon)} />
          <span className="font-medium">
            Add Incolink
          </span>
        </>
      )}
    </Badge>
  )

  const tooltipText = hasIncolinkId 
    ? `Incolink ID: ${incolinkId}${clickable ? ' - Click to scrape data' : ''}`
    : `No Incolink ID${clickable ? ' - Click to add one' : ''}`

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            {badge}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-64">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
