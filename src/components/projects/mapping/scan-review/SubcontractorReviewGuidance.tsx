"use client"

import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Progress } from '@/components/ui/progress'
import {
  Lightbulb,
  ArrowRight,
  CheckCircle2,
  Zap,
  Users,
  FileSearch,
  Tags,
  Keyboard,
  HelpCircle,
  ChevronDown,
  Info,
  Target,
  Rocket,
  Star,
  AlertTriangle,
  ThumbsUp
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SubcontractorReviewGuidanceProps {
  isOpen?: boolean
  onToggle?: () => void
  progressStats?: {
    total: number
    completed: number
    inProgress: number
    pending: number
  }
  needsReviewCount?: number
  needsEbaUpdateCount?: number
  needsEditingCount?: number
  onQuickAction?: (action: string) => void
  processingAction?: string | null
}

interface GuideStep {
  id: string
  title: string
  description: string
  icon: ReactNode
  action?: {
    label: string
    onClick: () => void
    shortcut?: string
  }
  completed?: boolean
  priority: 'high' | 'medium' | 'low'
}

interface FeatureInfo {
  title: string
  description: string
  benefits: string[]
  action?: {
    label: string
    onClick: () => void
  }
  tips: string[]
}

export function SubcontractorReviewGuidance({
  isOpen = true,
  onToggle,
  progressStats = { total: 0, completed: 0, inProgress: 0, pending: 0 },
  needsReviewCount = 0,
  needsEbaUpdateCount = 0,
  needsEditingCount = 0,
  onQuickAction,
  processingAction
}: SubcontractorReviewGuidanceProps) {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'workflow' | 'features' | 'shortcuts'>('overview')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['getting-started']))
  const [dismissedTips, setDismissedTips] = useState<Set<string>>(new Set())

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  const dismissTip = (tipId: string) => {
    const newDismissed = new Set(dismissedTips)
    newDismissed.add(tipId)
    setDismissedTips(newDismissed)
  }

  // Dynamic guide steps based on current state
  const getGuideSteps = (): GuideStep[] => {
    const steps: GuideStep[] = []

    if (needsEditingCount > 0) {
      steps.push({
        id: 'fix-data-entry',
        title: 'Fix Data Entry Issues',
        description: `Correct ${needsEditingCount} "Other" trade${needsEditingCount > 1 ? 's' : ''} with missing company names. This is usually caused by data entry errors.`,
        icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
        action: {
          label: 'Fix First Issue',
          onClick: () => onQuickAction?.('fix-first-error'),
          shortcut: '↑↓ to navigate'
        },
        priority: 'high'
      })
    }

    if (needsReviewCount > 0) {
      steps.push({
        id: 'review-matches',
        title: 'Review Employer Matches',
        description: `${needsReviewCount} subcontractor${needsReviewCount > 1 ? 's' : ''} need manual review. Confirm or change suggested employer matches.`,
        icon: <Target className="h-5 w-5 text-yellow-500" />,
        action: {
          label: 'Go to First Review',
          onClick: () => onQuickAction?.('go-to-first-review'),
          shortcut: 'Click rows to select'
        },
        priority: 'high'
      })
    }

    if (needsEbaUpdateCount > 0) {
      steps.push({
        id: 'update-eba-status',
        title: 'Update EBA Status',
        description: `${needsEbaUpdateCount} employer${needsEbaUpdateCount > 1 ? 's' : ''} can have EBA status updated. Search FWC database for current agreements.`,
        icon: <FileSearch className="h-5 w-5 text-orange-500" />,
        action: {
          label: 'Batch EBA Search',
          onClick: () => onQuickAction?.('batch-eba-search'),
          shortcut: 'Ctrl+E when selected'
        },
        priority: 'medium'
      })
    }

    if (progressStats.total > 0) {
      const completionRate = (progressStats.completed / progressStats.total) * 100
      if (completionRate > 80) {
        steps.push({
          id: 'create-aliases',
          title: 'Improve Future Matching',
          description: 'Create aliases from scanned company names to improve matching accuracy for future documents.',
          icon: <Tags className="h-5 w-5 text-blue-500" />,
          action: {
            label: 'Create Aliases',
            onClick: () => onQuickAction?.('create-aliases'),
            shortcut: 'Ctrl+A when selected'
          },
          priority: 'medium'
        })
      }

      if (completionRate === 100) {
        steps.push({
          id: 'completion',
          title: 'Review Complete!',
          description: 'All subcontractors have been processed. You can proceed to the next step.',
          icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
          priority: 'low'
        })
      }
    }

    return steps
  }

  const guideSteps = getGuideSteps()

  const featuresInfo: Record<string, FeatureInfo> = {
    aliases: {
      title: 'Employer Aliases',
      description: 'Connect scanned company names to your existing employer database for better matching.',
      benefits: [
        'Improves future document scanning accuracy',
        'Reduces manual review time',
        'Handles company name variations automatically',
        'Learns from your corrections over time'
      ],
      tips: [
        'Create aliases for common name variations (e.g., "BHP" → "BHP Billiton Ltd")',
        'High-confidence suggestions are pre-selected for you',
        'Aliases can be managed later from the employer database',
        'Bulk operations save time when processing multiple entries'
      ],
      action: {
        label: 'Quick Alias Creation',
        onClick: () => onQuickAction?.('create-aliases')
      }
    },
    eba: {
      title: 'EBA Quick List',
      description: 'Search and link Enterprise Bargaining Agreements from the Fair Work Commission database.',
      benefits: [
        'Access current EBA information directly',
        'Automatically update employer EBA status',
        'Streamlined FWC database integration',
        'Batch processing for multiple employers'
      ],
      tips: [
        'Search by employer name or ABN for best results',
        'Verify EBA expiry dates before linking',
        'Batch search processes all employers at once',
        'EBA status is automatically updated when linked'
      ],
      action: {
        label: 'Batch EBA Search',
        onClick: () => onQuickAction?.('batch-eba-search')
      }
    }
  }

  const keyboardShortcuts = [
    { key: '↑↓', description: 'Navigate between rows', category: 'navigation' },
    { key: 'Ctrl+A', description: 'Manage aliases for selected employer', category: 'aliases' },
    { key: 'Ctrl+E', description: 'EBA search for selected employer', category: 'eba' },
    { key: 'Ctrl+Shift+S', description: 'Suggest alias for selected entry', category: 'aliases' },
    { key: 'Ctrl+K', description: 'Toggle quick actions panel', category: 'navigation' },
    { key: '?', description: 'Show/hide keyboard shortcuts', category: 'navigation' },
    { key: 'Esc', description: 'Close modals and return to review', category: 'navigation' },
    { key: 'Enter', description: 'Confirm selected action', category: 'general' },
    { key: 'Tab', description: 'Navigate through form elements', category: 'navigation' }
  ]

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low': return 'text-green-600 bg-green-50 border-green-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertTriangle className="h-4 w-4" />
      case 'medium': return <Info className="h-4 w-4" />
      case 'low': return <ThumbsUp className="h-4 w-4" />
      default: return <Info className="h-4 w-4" />
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <Card className={cn(
      "border-2 transition-all duration-300",
      needsEditingCount > 0 ? "border-red-200 bg-red-50" :
      needsReviewCount > 0 ? "border-yellow-200 bg-yellow-50" :
      "border-blue-200 bg-blue-50"
    )}>
      <CardHeader className="pb-3">
        <Collapsible open={expandedSections.has('guidance-main')} onOpenChange={() => toggleSection('guidance-main')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Smart Guidance Assistant
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {guideSteps.filter(s => s.priority === 'high').length} Priority Tasks
              </Badge>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                expandedSections.has('guidance-main') ? 'rotate-180' : ''
              )} />
            </div>
          </CollapsibleTrigger>
        </Collapsible>
      </CardHeader>

      <CollapsibleContent open={expandedSections.has('guidance-main')}>
        <CardContent className="pt-0">
          <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as any)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="workflow" className="text-xs">Workflow</TabsTrigger>
              <TabsTrigger value="features" className="text-xs">Features</TabsTrigger>
              <TabsTrigger value="shortcuts" className="text-xs">Shortcuts</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <div className="space-y-4">
                {/* Progress Overview */}
                {progressStats.total > 0 && (
                  <div className="p-4 bg-white rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Overall Progress</span>
                      <span className="text-sm text-gray-600">
                        {progressStats.completed} / {progressStats.total} complete
                      </span>
                    </div>
                    <Progress
                      value={(progressStats.completed / progressStats.total) * 100}
                      className="mb-2"
                    />
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{Math.round((progressStats.completed / progressStats.total) * 100)}% Complete</span>
                      <span>{progressStats.inProgress} Need Review</span>
                    </div>
                  </div>
                )}

                {/* Priority Steps */}
                <div className="space-y-3">
                  {guideSteps.slice(0, 3).map((step) => (
                    <div
                      key={step.id}
                      className={cn(
                        "p-4 rounded-lg border transition-all duration-200",
                        getPriorityColor(step.priority),
                        step.completed && "opacity-60"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {step.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{step.title}</h4>
                            {getPriorityIcon(step.priority)}
                          </div>
                          <p className="text-sm mb-3">{step.description}</p>
                          {step.action && (
                            <Button
                              size="sm"
                              onClick={step.action.onClick}
                              disabled={processingAction === 'action'}
                              className="gap-2"
                            >
                              <Zap className="h-4 w-4" />
                              {processingAction === 'action' ? 'Processing...' : step.action.label}
                            </Button>
                          )}
                          {step.action?.shortcut && (
                            <p className="text-xs mt-2 opacity-75">
                              Tip: {step.action.shortcut}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <div className="text-lg font-bold text-red-600">{needsEditingCount}</div>
                    <div className="text-xs">Data Issues</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <div className="text-lg font-bold text-yellow-600">{needsReviewCount}</div>
                    <div className="text-xs">Need Review</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <div className="text-lg font-bold text-orange-600">{needsEbaUpdateCount}</div>
                    <div className="text-xs">EBA Updates</div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="workflow" className="mt-4">
              <div className="space-y-3">
                <Alert>
                  <Rocket className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Recommended Workflow:</strong> Follow these steps for efficient processing
                  </AlertDescription>
                </Alert>

                {guideSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border transition-all duration-200",
                      getPriorityColor(step.priority),
                      step.completed && "opacity-60"
                    )}
                  >
                    <div className="flex-shrink-0 w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs font-bold border">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{step.title}</h4>
                        {getPriorityIcon(step.priority)}
                      </div>
                      <p className="text-sm text-gray-700">{step.description}</p>
                    </div>
                    <div className="flex-shrink-0">
                      {step.action && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={step.action.onClick}
                          disabled={processingAction === step.id}
                        >
                          {step.action.label}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="features" className="mt-4">
              <div className="space-y-4">
                {Object.entries(featuresInfo).map(([key, feature]) => (
                  <Card key={key} className="border-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        {key === 'aliases' ? <Tags className="h-5 w-5" /> : <FileSearch className="h-5 w-5" />}
                        {feature.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-gray-700 mb-3">{feature.description}</p>

                      <div className="mb-3">
                        <h5 className="font-medium text-sm mb-2 flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500" />
                          Benefits
                        </h5>
                        <ul className="space-y-1">
                          {feature.benefits.map((benefit, index) => (
                            <li key={index} className="text-xs text-gray-600 flex items-start gap-1">
                              <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                              {benefit}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="mb-3">
                        <h5 className="font-medium text-sm mb-2 flex items-center gap-1">
                          <Lightbulb className="h-4 w-4 text-blue-500" />
                          Pro Tips
                        </h5>
                        <ul className="space-y-1">
                          {feature.tips.slice(0, 2).map((tip, index) => (
                            <li key={index} className="text-xs text-gray-600 flex items-start gap-1">
                              <Info className="h-3 w-3 text-blue-500 mt-0.5 flex-shrink-0" />
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {feature.action && (
                        <Button
                          size="sm"
                          onClick={feature.action.onClick}
                          disabled={processingAction === `feature-${key}`}
                          className="w-full"
                        >
                          {processingAction === `feature-${key}` ? 'Loading...' : feature.action.label}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="shortcuts" className="mt-4">
              <div className="space-y-4">
                <Alert>
                  <Keyboard className="h-4 w-4" />
                  <AlertDescription>
                    Press <kbd className="px-2 py-1 bg-gray-100 border rounded text-xs">?</kbd> anytime to show shortcuts
                  </AlertDescription>
                </Alert>

                {['navigation', 'aliases', 'eba', 'general'].map(category => (
                  <div key={category} className="space-y-2">
                    <h5 className="font-medium text-sm capitalize">{category}</h5>
                    <div className="grid grid-cols-2 gap-2">
                      {keyboardShortcuts
                        .filter(shortcut => shortcut.category === category)
                        .map((shortcut, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-white rounded border"
                          >
                            <span className="text-xs font-medium">{shortcut.description}</span>
                            <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">
                              {shortcut.key}
                            </kbd>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}

                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-sm text-blue-900">Power User Tips</span>
                  </div>
                  <ul className="space-y-1 text-xs text-blue-800">
                    <li>• Use arrow keys to quickly navigate between rows</li>
                    <li>• Press Ctrl+A on selected rows for instant alias management</li>
                    <li>• Ctrl+K toggles the quick actions panel</li>
                    <li>• Escape closes all modals and returns focus to the table</li>
                  </ul>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </CollapsibleContent>
    </Card>
  )
}