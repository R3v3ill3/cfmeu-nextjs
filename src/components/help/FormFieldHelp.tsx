"use client"

import { useState, useCallback, useMemo } from 'react'
import { HelpCircle, AlertCircle, Lightbulb, Info } from 'lucide-react'
import { ContextualHelpTooltip, type HelpTooltipConfig } from './ContextualHelpTooltip'
import { getHelpConfigById } from './ContextualHelpConfig'
import { cn } from '@/lib/utils'

export interface FormFieldHelpProps {
  /** The help configuration ID or a custom configuration object */
  helpId?: string
  config?: HelpTooltipConfig

  /** Field label for context */
  fieldLabel?: string

  /** Display mode */
  variant?: 'icon' | 'text' | 'inline'

  /** Size of the help icon */
  size?: 'sm' | 'md' | 'lg'

  /** Position relative to field */
  position?: 'inline' | 'above' | 'below'

  /** Additional CSS classes */
  className?: string

  /** Show help text inline instead of tooltip */
  showInline?: boolean

  /** Custom help content that overrides config */
  children?: React.ReactNode
}

export function FormFieldHelp({
  helpId,
  config,
  fieldLabel,
  variant = 'icon',
  size = 'sm',
  position = 'inline',
  className,
  showInline = false,
  children,
}: FormFieldHelpProps) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)

  // Get configuration by ID or use provided config
  const helpConfig = useMemo(() => {
    if (config) return config
    if (helpId) return getHelpConfigById(helpId)
    return undefined
  }, [config, helpId])

  // Enhanced config with field context
  const enhancedConfig = useMemo(() => {
    if (!helpConfig) return undefined

    return {
      ...helpConfig,
      context: {
        ...helpConfig.context,
        section: helpConfig.context?.section || fieldLabel?.toLowerCase().replace(/\s+/g, '-'),
      }
    }
  }, [helpConfig, fieldLabel])

  const handleOpen = useCallback(() => {
    setIsTooltipOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    setIsTooltipOpen(false)
  }, [])

  if (!enhancedConfig && !children) {
    return null
  }

  // Icon component
  const HelpIcon = useMemo(() => {
    const iconMap = {
      info: Info,
      help: HelpCircle,
      warning: AlertCircle,
      tip: Lightbulb,
      field: HelpCircle,
    }

    const IconComponent = iconMap[enhancedConfig?.type as keyof typeof iconMap] || HelpCircle
    const sizeClasses = {
      sm: 'h-3 w-3',
      md: 'h-4 w-4',
      lg: 'h-5 w-5',
    }

    return (
      <IconComponent
        className={cn(
          sizeClasses[size],
          'text-muted-foreground hover:text-foreground transition-colors',
          enhancedConfig?.type === 'warning' && 'text-amber-500',
          enhancedConfig?.type === 'tip' && 'text-green-500'
        )}
      />
    )
  }, [enhancedConfig?.type, size])

  // Inline help text display
  if (showInline && enhancedConfig) {
    return (
      <div className={cn('text-sm text-muted-foreground mt-1 space-y-1', className)}>
        <div className="flex items-center gap-2">
          {HelpIcon}
          <span className="font-medium">{enhancedConfig.title}</span>
        </div>
        <p className="text-xs leading-relaxed pl-6">
          {enhancedConfig.content}
        </p>
        {enhancedConfig.examples && enhancedConfig.examples.length > 0 && (
          <div className="pl-6">
            <p className="text-xs font-medium mb-1">Examples:</p>
            <ul className="text-xs space-y-0.5">
              {enhancedConfig.examples.map((example, index) => (
                <li key={index} className="flex items-start gap-1">
                  <span className="text-muted-foreground">•</span>
                  <span>{example}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  // Inline positioning (next to field label)
  if (position === 'inline') {
    return (
      <span className={cn('inline-flex items-center', className)}>
        {children || (
          <ContextualHelpTooltip
            config={enhancedConfig!}
            size={size}
            variant={variant}
            onOpen={handleOpen}
            onClose={handleClose}
          />
        )}
      </span>
    )
  }

  // Above or below positioning
  return (
    <div className={cn('w-full', className)}>
      {position === 'above' && (
        <div className="mb-2">
          {children || (
            <ContextualHelpTooltip
              config={enhancedConfig!}
              size={size}
              variant="text"
              onOpen={handleOpen}
              onClose={handleClose}
            />
          )}
        </div>
      )}

      {position === 'below' && (
        <div className="mt-2">
          {children || (
            <ContextualHelpTooltip
              config={enhancedConfig!}
              size={size}
              variant="text"
              onOpen={handleOpen}
              onClose={handleClose}
            />
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Higher-order component to wrap form fields with help
 */
export function withFieldHelp<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  helpConfig: { helpId?: string; config?: HelpTooltipConfig; fieldLabel?: string }
) {
  const WithFieldHelpComponent = (props: P) => {
    const [showHelp, setShowHelp] = useState(false)

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <WrappedComponent {...props} />
          <FormFieldHelp
            helpId={helpConfig.helpId}
            config={helpConfig.config}
            fieldLabel={helpConfig.fieldLabel}
            size="sm"
          />
        </div>
        {showHelp && (
          <FormFieldHelp
            helpId={helpConfig.helpId}
            config={helpConfig.config}
            fieldLabel={helpConfig.fieldLabel}
            showInline
          />
        )}
      </div>
    )
  }

  WithFieldHelpComponent.displayName = `withFieldHelp(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`

  return WithFieldHelpComponent
}

/**
 * Pre-configured help components for common form fields
 */
export const CommonFieldHelp = {
  ABN: (props: Partial<FormFieldHelpProps>) => (
    <FormFieldHelp
      helpId="abn-validation"
      fieldLabel="ABN"
      {...props}
    />
  ),

  Phone: (props: Partial<FormFieldHelpProps>) => (
    <FormFieldHelp
      helpId="phone-format"
      fieldLabel="Phone"
      {...props}
    />
  ),

  Email: (props: Partial<FormFieldHelpProps>) => (
    <FormFieldHelp
      config={{
        id: 'email-format',
        type: 'info',
        title: 'Email Address',
        content: 'Enter a valid email address for communications and notifications.',
        examples: [
          'Use work email for official correspondence',
          'Personal email can be used for backup contact',
          'Ensure email address is regularly checked'
        ]
      }}
      fieldLabel="Email"
      {...props}
    />
  ),

  Address: (props: Partial<FormFieldHelpProps>) => (
    <FormFieldHelp
      config={{
        id: 'address-format',
        type: 'help',
        title: 'Site Address',
        content: 'Enter the complete street address for accurate location and navigation.',
        detailedContent: 'Include unit numbers, street names, and suburbs. This address is used for mapping, navigation, and compliance reporting. Ensure accuracy as it affects geofencing and location-based features.',
        examples: [
          '123 Construction Street, Sydney NSW 2000',
          'Unit 4, 456 Builder Road, Parramatta NSW 2150',
          'Site Office, 789 Development Drive, Rhodes NSW 2138'
        ]
      }}
      fieldLabel="Address"
      {...props}
    />
  ),

  ConfidenceScore: (props: Partial<FormFieldHelpProps>) => (
    <FormFieldHelp
      helpId="rating-confidence-score"
      fieldLabel="Confidence Score"
      {...props}
    />
  ),

  ShamContracting: (props: Partial<FormFieldHelpProps>) => (
    <FormFieldHelp
      helpId="sham-contracting-detection"
      fieldLabel="Sham Contracting"
      {...props}
    />
  )
}