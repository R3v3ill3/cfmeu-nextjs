import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react'

interface ConfidenceIndicatorProps {
  confidence: number
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function ConfidenceIndicator({ 
  confidence, 
  showLabel = false,
  size = 'md' 
}: ConfidenceIndicatorProps) {
  const percentage = Math.round(confidence * 100)
  
  const getVariant = () => {
    if (confidence >= 0.9) return 'default'
    if (confidence >= 0.7) return 'secondary'
    return 'destructive'
  }

  const getIcon = () => {
    if (confidence >= 0.9) return <CheckCircle2 className="h-3 w-3" />
    if (confidence >= 0.7) return <AlertTriangle className="h-3 w-3" />
    return <AlertCircle className="h-3 w-3" />
  }

  const getLabel = () => {
    if (confidence >= 0.9) return 'High confidence'
    if (confidence >= 0.7) return 'Medium confidence'
    return 'Low confidence'
  }

  return (
    <Badge 
      variant={getVariant()} 
      className={`flex items-center gap-1 ${
        size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'
      }`}
    >
      {getIcon()}
      {percentage}%
      {showLabel && <span className="ml-1">• {getLabel()}</span>}
    </Badge>
  )
}
