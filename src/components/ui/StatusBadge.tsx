import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'

export type TradeStatus = 
  | 'planned'
  | 'tendering'
  | 'not_yet_tendered'
  | 'unknown'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'on_hold'

interface StatusBadgeProps {
  status: TradeStatus
  showLabel?: boolean
  showDate?: boolean
  updatedAt?: string | null
  size?: 'sm' | 'default'
}

const STATUS_CONFIG: Record<TradeStatus, {
  color: string
  icon: string
  label: string
  description: string
}> = {
  planned: {
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    icon: '📅',
    label: 'Planned',
    description: 'Contract signed, not yet started'
  },
  tendering: {
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    icon: '📋',
    label: 'Tendering',
    description: 'Request for tender issued'
  },
  not_yet_tendered: {
    color: 'bg-purple-100 text-purple-700 border-purple-300',
    icon: '⏳',
    label: 'Not Yet Tendered',
    description: 'Planned but tender not issued'
  },
  unknown: {
    color: 'bg-slate-100 text-slate-600 border-slate-300',
    icon: '❔',
    label: 'Unknown',
    description: 'Status not determined'
  },
  active: {
    color: 'bg-green-100 text-green-700 border-green-300',
    icon: '🟢',
    label: 'Active',
    description: 'Currently on site'
  },
  completed: {
    color: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    icon: '✅',
    label: 'Completed',
    description: 'Work finished'
  },
  cancelled: {
    color: 'bg-red-100 text-red-700 border-red-300',
    icon: '❌',
    label: 'Cancelled',
    description: 'Contract cancelled'
  },
  on_hold: {
    color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    icon: '⏸️',
    label: 'On Hold',
    description: 'Work temporarily paused'
  },
}

export function StatusBadge({ 
  status, 
  showLabel = true,
  showDate = false,
  updatedAt,
  size = 'default'
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unknown
  
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : ''
  
  return (
    <Badge 
      variant="outline" 
      className={`${config.color} ${sizeClass}`}
      title={config.description}
    >
      <span className="mr-1">{config.icon}</span>
      {showLabel && config.label}
      {showDate && updatedAt && (
        <span className="text-[10px] ml-1 opacity-75">
          ({formatDistanceToNow(new Date(updatedAt), { addSuffix: true })})
        </span>
      )}
    </Badge>
  )
}

// Helper function to get status config (useful for external components)
export function getStatusConfig(status: TradeStatus) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.unknown
}

