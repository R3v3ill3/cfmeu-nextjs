"use client"

import { useState, useCallback, useMemo, useRef } from 'react'
import { Info, HelpCircle, AlertTriangle, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type TooltipType = 'info' | 'warning' | 'tip' | 'help' | 'field'

export type TooltipSize = 'sm' | 'md' | 'lg'

export interface HelpTooltipConfig {
  id: string
  type: TooltipType
  title: string
  content: string
  detailedContent?: string
  examples?: string[]
  relatedLinks?: Array<{
    label: string
    url: string
  }>
  videoId?: string
  context?: {
    page?: string
    role?: string
    section?: string
  }
}

export interface ContextualHelpTooltipProps {
  config: HelpTooltipConfig
  size?: TooltipSize
  variant?: 'icon' | 'text' | 'inline'
  iconOnly?: boolean
  className?: string
  children?: React.ReactNode
  onOpen?: () => void
  onClose?: () => void
  showLearnMore?: boolean
}

const iconMap = {
  info: Info,
  help: HelpCircle,
  warning: AlertTriangle,
  tip: Lightbulb,
  field: HelpCircle,
}

const typeStyles = {
  info: 'text-blue-600 hover:text-blue-700',
  help: 'text-gray-600 hover:text-gray-700',
  warning: 'text-amber-600 hover:text-amber-700',
  tip: 'text-green-600 hover:text-green-700',
  field: 'text-blue-600 hover:text-blue-700',
}

const badgeStyles = {
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  help: 'bg-gray-100 text-gray-800 border-gray-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  tip: 'bg-green-100 text-green-800 border-green-200',
  field: 'bg-blue-100 text-blue-800 border-blue-200',
}

export function ContextualHelpTooltip({
  config,
  size = 'md',
  variant = 'icon',
  iconOnly = false,
  className,
  children,
  onOpen,
  onClose,
  showLearnMore = true,
}: ContextualHelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const Icon = iconMap[config.type]

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open)
    if (open) {
      onOpen?.()
      // Track help tooltip usage
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'help_tooltip_open', {
          tooltip_id: config.id,
          tooltip_type: config.type,
          page: config.context?.page,
          section: config.context?.section,
        })
      }
    } else {
      onClose?.()
    }
  }, [config.id, config.type, config.context, onOpen, onClose])

  const sizeClasses = useMemo(() => {
    switch (size) {
      case 'sm':
        return 'h-3 w-3 text-xs'
      case 'lg':
        return 'h-5 w-5 text-base'
      default:
        return 'h-4 w-4 text-sm'
    }
  }, [size])

  const tooltipContent = useMemo(() => (
    <div className={cn('max-w-sm', size === 'lg' && 'max-w-md')}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('flex-shrink-0', sizeClasses)} />
        <h4 className="font-semibold text-sm">{config.title}</h4>
      </div>

      {/* Main Content */}
      <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
        {config.content}
      </p>

      {/* Detailed Content */}
      {config.detailedContent && isOpen && (
        <div className="mb-3 p-3 bg-muted/50 rounded-md">
          <p className="text-xs leading-relaxed">{config.detailedContent}</p>
        </div>
      )}

      {/* Examples */}
      {config.examples && config.examples.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium mb-2">Examples:</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            {config.examples.map((example, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-muted-foreground mt-0.5">•</span>
                <span>{example}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Related Links */}
      {config.relatedLinks && config.relatedLinks.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium mb-2">Learn more:</p>
          <div className="flex flex-wrap gap-2">
            {config.relatedLinks.map((link, index) => (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-700 underline"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Video Link */}
      {config.videoId && (
        <div className="mb-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              // Open video modal or navigate to video
              window.open(`https://www.youtube.com/watch?v=${config.videoId}`, '_blank')
            }}
          >
            Watch Video Tutorial
          </Button>
        </div>
      )}

      {/* Learn More Button */}
      {showLearnMore && (
        <div className="flex justify-between items-center pt-2 border-t">
          <Badge
            variant="outline"
            className={cn('text-xs', badgeStyles[config.type])}
          >
            {config.type} tip
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700"
            onClick={() => {
              // Open comprehensive help dialog
              const event = new CustomEvent('openHelpDialog', {
                detail: {
                  topic: config.context?.section || config.title,
                  context: config.context,
                }
              })
              window.dispatchEvent(event)
            }}
          >
            Learn more
          </Button>
        </div>
      )}
    </div>
  ), [config, Icon, sizeClasses, isOpen, showLearnMore])

  // For simple tooltips without rich content
  if (variant === 'icon' && !config.detailedContent && !config.examples?.length) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            {children || (
              <Button
                ref={triggerRef}
                variant="ghost"
                size="icon"
                className={cn('h-6 w-6', typeStyles[config.type], className)}
              >
                <Icon className="h-3 w-3" />
              </Button>
            )}
          </TooltipTrigger>
          <TooltipContent>
            <div className="max-w-xs">
              <p className="text-sm font-medium mb-1">{config.title}</p>
              <p className="text-xs text-muted-foreground">{config.content}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // For rich tooltips with detailed content
  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {children || (
          <Button
            ref={triggerRef}
            variant="ghost"
            size="icon"
            className={cn(
              'h-6 w-6',
              typeStyles[config.type],
              iconOnly && 'p-0',
              className
            )}
          >
            <Icon className="h-3 w-3" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="p-4"
        side="top"
        align="center"
        sideOffset={8}
        collisionPadding={16}
      >
        {tooltipContent}
      </PopoverContent>
    </Popover>
  )
}