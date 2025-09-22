"use client"

import React from "react"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface CfmeuEbaBadgeProps {
  /**
   * Whether the builder/main contractor has an active EBA
   */
  hasActiveEba?: boolean | null
  
  /**
   * Builder/contractor name for tooltip
   */
  builderName?: string
  
  /**
   * Size variant for the badge
   */
  size?: "sm" | "md" | "lg"
  
  /**
   * Additional CSS classes
   */
  className?: string
  
  /**
   * Show text alongside the logo
   */
  showText?: boolean
}

const sizeConfig = {
  sm: {
    logo: { width: 20, height: 14 }, // Increased for better visibility
    badge: "h-6 px-2 py-1 text-xs",
    text: "text-xs"
  },
  md: {
    logo: { width: 24, height: 16 }, // Increased for better visibility  
    badge: "h-7 px-3 py-1 text-sm",
    text: "text-sm"
  },
  lg: {
    logo: { width: 28, height: 20 }, // Increased for better visibility
    badge: "h-8 px-4 py-2 text-sm",
    text: "text-base"
  }
}

export function CfmeuEbaBadge({ 
  hasActiveEba, 
  builderName,
  size = "md",
  className,
  showText = true
}: CfmeuEbaBadgeProps) {
  // Don't show badge if EBA status is explicitly false or null
  if (hasActiveEba !== true) {
    return null
  }

  const config = sizeConfig[size]
  
  const badge = (
    <Badge 
      variant="default" 
      className={cn(
        "inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white border-blue-600",
        config.badge,
        className
      )}
    >
      <Image 
        src="/eurekaflag.gif" 
        alt="Eureka Flag - EBA" 
        width={config.logo.width}
        height={config.logo.height}
        className="object-contain flex-shrink-0"
      />
      {showText && (
        <span className={cn("font-medium", config.text)}>
          EBA
        </span>
      )}
    </Badge>
  )

  const tooltipText = builderName 
    ? `${builderName} has an active Enterprise Bargaining Agreement with CFMEU`
    : "Builder/Contractor has an active Enterprise Bargaining Agreement with CFMEU"

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-64">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Helper function to determine if a project has an active EBA based on builder/contractor data
 */
export function getProjectEbaStatus(project: any): { hasActiveEba: boolean; builderName?: string } {
  if (!project) {
    return { hasActiveEba: false }
  }

  // Handle both array and object formats from different queries
  const assignments = project.project_assignments || []

  // Find builder/main contractor assignments
  const builderAssignments = assignments.filter((pa: any) => {
    if (pa.assignment_type !== 'contractor_role') return false
    
    // Handle both single object and array formats
    const roleTypes = Array.isArray(pa.contractor_role_types) 
      ? pa.contractor_role_types 
      : pa.contractor_role_types 
        ? [pa.contractor_role_types] 
        : []
    
    return roleTypes.some((rt: any) => 
      rt?.code === 'builder' || rt?.code === 'head_contractor'
    )
  })

  // Check if any builder has active EBA
  for (const assignment of builderAssignments) {
    // Handle both single object and array formats for employers
    const employers = Array.isArray(assignment.employers) 
      ? assignment.employers 
      : assignment.employers 
        ? [assignment.employers] 
        : []

    for (const employer of employers) {
      const hasEba = employer?.enterprise_agreement_status === true
      if (hasEba) {
        return { 
          hasActiveEba: true,
          builderName: employer?.name || undefined
        }
      }
    }
  }

  return { hasActiveEba: false }
}
