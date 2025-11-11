'use client'

import { Badge } from '@/components/ui/badge'
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react'

interface ScanStatusBadgeProps {
  status: string
  errorMessage?: string | null
}

export function ScanStatusBadge({
  status,
  errorMessage,
}: ScanStatusBadgeProps) {
  const variants: Record<
    string,
    { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any; label: string; color?: string }
  > = {
    pending: { variant: 'secondary', icon: Clock, label: 'Pending' },
    processing: { variant: 'default', icon: Loader2, label: 'Processing' },
    completed: { variant: 'outline', icon: AlertCircle, label: 'Needs Review', color: 'text-yellow-600 border-yellow-300 bg-yellow-50' },
    under_review: { variant: 'default', icon: Clock, label: 'In Review', color: 'bg-blue-100 text-blue-700 border-blue-300' },
    confirmed: { variant: 'outline', icon: CheckCircle2, label: 'Confirmed', color: 'text-green-600 border-green-300 bg-green-50' },
    rejected: { variant: 'outline', icon: XCircle, label: 'Rejected', color: 'text-gray-500 border-gray-300' },
    review_new_project: { variant: 'outline', icon: AlertCircle, label: 'Needs Review', color: 'text-yellow-600 border-yellow-300 bg-yellow-50' },
    failed: { variant: 'destructive', icon: XCircle, label: 'Failed' },
  }

  const config = variants[status] || variants.pending
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className={`gap-1 text-xs ${config.color || ''}`}>
      <Icon className={`h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  )
}

