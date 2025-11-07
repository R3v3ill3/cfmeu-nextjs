"use client"

import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"
import { FileText } from "lucide-react"
import { useMemo } from "react"

interface MappingStatusBadgeProps {
  projectId: string
  mappingStatus?: 'no_roles' | 'no_trades' | 'bci_only' | 'has_manual'
  variant?: 'default' | 'compact'
  className?: string
}

const STATUS_CONFIG = {
  no_roles: {
    label: 'Not mapped',
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    description: 'No employers mapped to contractor roles'
  },
  no_trades: {
    label: 'No Trades',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    description: 'No subcontractor/trade type assignments'
  },
  bci_only: {
    label: 'BCI Only',
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    description: 'Only BCI imported employers'
  },
  has_manual: {
    label: 'Has Manual',
    color: 'bg-green-100 text-green-700 border-green-300',
    description: 'Non-BCI imported employers added'
  }
}

export function MappingStatusBadge({ 
  projectId, 
  mappingStatus,
  variant = 'default',
  className = ''
}: MappingStatusBadgeProps) {
  const router = useRouter()
  const { startNavigation } = useNavigationLoading()

  const config = useMemo(() => {
    if (!mappingStatus) return null
    return STATUS_CONFIG[mappingStatus] || STATUS_CONFIG.no_roles
  }, [mappingStatus])

  if (!config) {
    return null
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const ua = navigator.userAgent.toLowerCase()
      const isMobile = /iphone|ipad|ipod|android/.test(ua)
      const href = isMobile 
        ? `/projects/${projectId}/mappingsheets-mobile` 
        : `/projects/${projectId}?tab=mappingsheets`
      startNavigation(href)
      setTimeout(() => router.push(href), 50)
    } catch {
      // Fallback to desktop route if user agent check fails
      const href = `/projects/${projectId}?tab=mappingsheets`
      startNavigation(href)
      setTimeout(() => router.push(href), 50)
    }
  }

  if (variant === 'compact') {
    return (
      <Badge
        variant="outline"
        className={`text-xs cursor-pointer hover:opacity-80 transition-opacity ${config.color} ${className}`}
        onClick={handleClick}
        title={`${config.description} - Click to view mapping`}
      >
        <FileText className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={`cursor-pointer hover:opacity-80 transition-opacity ${config.color} ${className}`}
      onClick={handleClick}
      title={`${config.description} - Click to view mapping`}
    >
      <FileText className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  )
}

