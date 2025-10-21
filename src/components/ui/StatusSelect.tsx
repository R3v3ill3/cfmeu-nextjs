import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TradeStatus } from './StatusBadge'

interface StatusSelectProps {
  value: TradeStatus
  onChange: (value: TradeStatus) => void
  disabled?: boolean
  size?: 'sm' | 'default'
  showIcons?: boolean
}

const STATUS_OPTIONS: Array<{
  value: TradeStatus
  icon: string
  label: string
  description: string
}> = [
  {
    value: 'active',
    icon: '🟢',
    label: 'Active',
    description: 'Currently on site working'
  },
  {
    value: 'completed',
    icon: '✅',
    label: 'Completed',
    description: 'Work finished and signed off'
  },
  {
    value: 'tendering',
    icon: '📋',
    label: 'Tendering',
    description: 'Out to tender (RFT/RFQ issued)'
  },
  {
    value: 'not_yet_tendered',
    icon: '⏳',
    label: 'Not Yet Tendered',
    description: 'Planned but tender not issued yet'
  },
  {
    value: 'planned',
    icon: '📅',
    label: 'Planned',
    description: 'Contract signed, not yet started'
  },
  {
    value: 'on_hold',
    icon: '⏸️',
    label: 'On Hold',
    description: 'Work temporarily paused'
  },
  {
    value: 'cancelled',
    icon: '❌',
    label: 'Cancelled',
    description: 'Contract cancelled/terminated'
  },
  {
    value: 'unknown',
    icon: '❔',
    label: 'Unknown',
    description: 'Status not yet determined'
  },
]

export function StatusSelect({
  value,
  onChange,
  disabled = false,
  size = 'default',
  showIcons = true,
}: StatusSelectProps) {
  const triggerClass = size === 'sm' ? 'h-8 text-xs' : ''

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={triggerClass}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2">
              {showIcons && <span>{option.icon}</span>}
              <div>
                <div className="font-medium">{option.label}</div>
                <div className="text-[10px] text-muted-foreground">
                  {option.description}
                </div>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// Simple version without descriptions (for compact UIs)
export function StatusSelectSimple({
  value,
  onChange,
  disabled = false,
  size = 'sm',
}: Omit<StatusSelectProps, 'showIcons'>) {
  const triggerClass = size === 'sm' ? 'h-8 text-xs' : ''

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={triggerClass}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <span className="mr-2">{option.icon}</span>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

