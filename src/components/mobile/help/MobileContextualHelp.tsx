"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  HelpCircle,
  X,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Navigation,
  Star,
  Clock,
  Wifi,
  WifiOff
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useHapticFeedback } from '@/components/mobile/shared/HapticFeedback'
import { useToast } from '@/hooks/use-toast'
import { useContextualHelp } from '@/components/help/ContextualHelpProvider'
import { getPageTooltips } from '@/components/help/ContextualHelpConfig'
import { cn } from '@/lib/utils'

export interface MobileContextualHelpProps {
  /** Force show specific help topic */
  topic?: string

  /** Current workflow step (for multi-step processes) */
  workflowStep?: number
  totalWorkflowSteps?: number

  /** Show help button inline */
  inline?: boolean

  /** Custom trigger button */
  triggerButton?: React.ReactNode

  /** Additional CSS classes */
  className?: string
}

export function MobileContextualHelp({
  topic,
  workflowStep,
  totalWorkflowSteps,
  inline = false,
  triggerButton,
  className
}: MobileContextualHelpProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const { trigger, success } = useHapticFeedback()

  const {
    currentTooltip,
    showTooltip,
    hideTooltip,
    hasSeenTooltip,
    markTooltipViewed,
    preferences,
    getPageTooltips
  } = useContextualHelp()

  const [isExpanded, setIsExpanded] = useState(false)
  const [showQuickTips, setShowQuickTips] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  // Get page-specific tooltips
  const pageTooltips = useMemo(() => {
    return getPageTooltips(topic)
  }, [getPageTooltips, topic])

  // Mobile-specific help content
  const mobileHelpContent = useMemo(() => {
    const content: Array<{
      id: string
      title: string
      description: string
      icon: React.ComponentType<{ className?: string }>
      action?: () => void
      type: 'feature' | 'tip' | 'workflow' | 'troubleshooting'
      priority: 'high' | 'medium' | 'low'
    }> = []

    // Add contextual help based on current page
    if (pathname.includes('/site-visit-wizard')) {
      content.push({
        id: 'site-wizard-workflow',
        title: 'Site Visit Workflow',
        description: 'Complete comprehensive site assessments efficiently',
        icon: Star,
        type: 'workflow',
        priority: 'high'
      })
    }

    if (pathname.includes('/ratings/wizard')) {
      content.push({
        id: 'rating-confidence',
        title: 'Rating Confidence Scores',
        description: 'Understand how confidence levels affect ratings',
        icon: Star,
        type: 'feature',
        priority: 'high'
      })
    }

    if (pathname.includes('/map/discovery')) {
      content.push({
        id: 'gps-features',
        title: 'GPS & Location Features',
        description: 'Use location services for nearby projects',
        icon: Navigation,
        type: 'feature',
        priority: 'high'
      })
    }

    // Add general mobile tips
    content.push(
      {
        id: 'offline-usage',
        title: 'Works Offline',
        description: 'Continue working without internet connection',
        icon: WifiOff,
        type: 'tip',
        priority: 'medium'
      },
      {
        id: 'sync-status',
        title: 'Auto-Sync',
        description: 'Your work saves and syncs automatically',
        icon: Wifi,
        type: 'feature',
        priority: 'medium'
      },
      {
        id: 'pwa-install',
        title: 'Install App',
        description: 'Add to home screen for quick access',
        icon: Smartphone,
        type: 'tip',
        priority: 'low'
      }
    )

    return content
  }, [pathname])

  // Filter content based on user preferences
  const filteredContent = useMemo(() => {
    if (preferences.advancedMode) {
      return mobileHelpContent
    }

    // Show only high and medium priority for regular users
    return mobileHelpContent.filter(item =>
      item.priority === 'high' || item.priority === 'medium'
    )
  }, [mobileHelpContent, preferences.advancedMode])

  const handleHelpClick = useCallback(() => {
    trigger()

    if (filteredContent.length === 0) {
      toast({
        title: "Help Coming Soon",
        description: "Contextual help for this screen is being developed.",
      })
      return
    }

    setIsExpanded(true)
    setShowQuickTips(true)
    success()

    // Track help usage
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'mobile_help_open', {
        page: pathname,
        topic,
        workflow_step: workflowStep
      })
    }
  }, [trigger, success, filteredContent.length, toast, pathname, topic, workflowStep])

  const handleQuickTipClick = useCallback((item: typeof mobileHelpContent[0]) => {
    trigger()
    markTooltipViewed(item.id)

    // Show detailed tooltip if available
    const tooltip = pageTooltips.find(t => t.id === item.id)
    if (tooltip) {
      showTooltip(tooltip.id)
    } else if (item.action) {
      item.action()
    } else {
      // Show toast for simple tips
      toast({
        title: item.title,
        description: item.description,
      })
    }

    success()
  }, [trigger, markTooltipViewed, pageTooltips, showTooltip, toast, success])

  const handleViewFullGuide = useCallback(() => {
    trigger()

    // Navigate to comprehensive help
    router.push('/mobile/help')

    // Track help navigation
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'mobile_help_full_guide', {
        from_page: pathname,
        topic
      })
    }

    success()
  }, [trigger, router, pathname, topic, success])

  const handleClose = useCallback(() => {
    trigger()
    setIsExpanded(false)
    setShowQuickTips(false)
    success()
  }, [trigger, success])

  // Keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isExpanded) {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded, handleClose])

  // Workflow step indicator
  const WorkflowProgress = useMemo(() => {
    if (!workflowStep || !totalWorkflowSteps) return null

    const progress = (workflowStep / totalWorkflowSteps) * 100

    return (
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-blue-900">
            Step {workflowStep} of {totalWorkflowSteps}
          </span>
          <span className="text-xs text-blue-700">
            {Math.round(progress)}% Complete
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
    )
  }, [workflowStep, totalWorkflowSteps])

  // Trigger button
  const TriggerButton = triggerButton || (
    <Button
      variant="outline"
      size="icon"
      className={cn(
        'h-8 w-8 rounded-full border-2',
        'bg-white/90 backdrop-blur-sm shadow-lg',
        'hover:bg-white hover:scale-105 active:scale-95',
        'transition-all duration-200',
        className
      )}
      onClick={handleHelpClick}
    >
      <HelpCircle className="h-4 w-4" />
    </Button>
  )

  // Inline mode - simple button only
  if (inline) {
    return TriggerButton
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Help Button */}
      {!isExpanded && TriggerButton}

      {/* Expanded Help Panel */}
      {isExpanded && (
        <div
          ref={sheetRef}
          className="fixed inset-x-4 bottom-4 bg-white rounded-t-2xl shadow-2xl border border-gray-200 max-h-[80vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <HelpCircle className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Quick Help</h3>
                <p className="text-xs text-gray-600">
                  {topic ? `Help for ${topic}` : 'Contextual guidance'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Workflow Progress */}
          {WorkflowProgress}

          {/* Quick Tips */}
          {showQuickTips && (
            <div className="p-4 space-y-3 overflow-y-auto max-h-[50vh]">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">Quick Tips</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowQuickTips(!showQuickTips)}
                  className="h-6 px-2"
                >
                  {showQuickTips ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>
              </div>

              <div className="space-y-2">
                {filteredContent.map((item) => {
                  const Icon = item.icon
                  const isSeen = hasSeenTooltip(item.id)

                  return (
                    <Card
                      key={item.id}
                      className={cn(
                        'cursor-pointer transition-all duration-200',
                        'hover:shadow-md hover:scale-[1.02] active:scale-[0.98]',
                        isSeen && 'opacity-75'
                      )}
                      onClick={() => handleQuickTipClick(item)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                            item.type === 'workflow' && 'bg-blue-100',
                            item.type === 'feature' && 'bg-green-100',
                            item.type === 'tip' && 'bg-purple-100',
                            item.type === 'troubleshooting' && 'bg-amber-100'
                          )}>
                            <Icon className={cn(
                              'h-4 w-4',
                              item.type === 'workflow' && 'text-blue-600',
                              item.type === 'feature' && 'text-green-600',
                              item.type === 'tip' && 'text-purple-600',
                              item.type === 'troubleshooting' && 'text-amber-600'
                            )} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="font-medium text-sm text-gray-900 truncate">
                                {item.title}
                              </h5>
                              {isSeen && (
                                <Badge variant="secondary" className="text-xs">
                                  Viewed
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 line-clamp-2">
                              {item.description}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={handleViewFullGuide}
              >
                <span>View Full Guide</span>
                <ArrowRight className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => window.open('tel:1300CFMEU', '_self')}
              >
                Call Support (1300 CFMEU)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}