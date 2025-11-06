"use client"

import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"
import { ClipboardCheck } from "lucide-react"
import { useMemo } from "react"

interface AuditStatusBadgeProps {
  projectId: string
  hasComplianceChecks?: boolean
  lastComplianceCheckDate?: string | null
  variant?: 'default' | 'compact'
  className?: string
}

export function AuditStatusBadge({ 
  projectId, 
  hasComplianceChecks = false,
  lastComplianceCheckDate,
  variant = 'default',
  className = ''
}: AuditStatusBadgeProps) {
  const router = useRouter()
  const { startNavigation } = useNavigationLoading()

  const statusInfo = useMemo(() => {
    if (!hasComplianceChecks) {
      return {
        label: 'No Audit',
        color: 'bg-gray-100 text-gray-700 border-gray-300',
        description: 'No compliance checks conducted'
      }
    }

    if (!lastComplianceCheckDate) {
      return {
        label: 'Has Audit',
        color: 'bg-blue-100 text-blue-700 border-blue-300',
        description: 'Compliance checks exist'
      }
    }

    const checkDate = new Date(lastComplianceCheckDate)
    const now = new Date()
    const monthsAgo = (now.getTime() - checkDate.getTime()) / (1000 * 60 * 60 * 24 * 30)

    if (monthsAgo <= 3) {
      return {
        label: 'Recent Audit',
        color: 'bg-green-100 text-green-700 border-green-300',
        description: `Last check: ${Math.round(monthsAgo * 10) / 10} months ago`
      }
    } else if (monthsAgo <= 6) {
      return {
        label: 'Recent Audit',
        color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
        description: `Last check: ${Math.round(monthsAgo * 10) / 10} months ago`
      }
    } else if (monthsAgo <= 12) {
      return {
        label: 'Stale Audit',
        color: 'bg-orange-100 text-orange-700 border-orange-300',
        description: `Last check: ${Math.round(monthsAgo * 10) / 10} months ago`
      }
    } else {
      return {
        label: 'Stale Audit',
        color: 'bg-red-100 text-red-700 border-red-300',
        description: `Last check: ${Math.round(monthsAgo * 10) / 10} months ago`
      }
    }
  }, [hasComplianceChecks, lastComplianceCheckDate])

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    startNavigation(`/projects/${projectId}?tab=compliance`)
    setTimeout(() => router.push(`/projects/${projectId}?tab=compliance`), 50)
  }

  if (variant === 'compact') {
    return (
      <Badge
        variant="outline"
        className={`text-xs cursor-pointer hover:opacity-80 transition-opacity ${statusInfo.color} ${className}`}
        onClick={handleClick}
        title={`${statusInfo.description} - Click to view audit & compliance`}
      >
        <ClipboardCheck className="h-3 w-3 mr-1" />
        {statusInfo.label}
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={`cursor-pointer hover:opacity-80 transition-opacity ${statusInfo.color} ${className}`}
      onClick={handleClick}
      title={`${statusInfo.description} - Click to view audit & compliance`}
    >
      <ClipboardCheck className="h-3 w-3 mr-1" />
      {statusInfo.label}
    </Badge>
  )
}

