"use client"

import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useHapticFeedback } from '@/components/mobile/shared/HapticFeedback'
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  Eye,
  EyeOff,
  Settings,
  Info,
  CheckCircle,
  AlertTriangle,
  Lightbulb
} from 'lucide-react'

interface DisclosureSection {
  id: string
  title: string
  description?: string
  required?: boolean
  priority: 'high' | 'medium' | 'low'
  content: React.ReactNode
  condition?: (data: any) => boolean
  help?: {
    title: string
    content: string
    type: 'info' | 'warning' | 'tip'
  }
}

interface ProgressiveDisclosureProps {
  sections: DisclosureSection[]
  initialExpanded?: string[]
  onSectionChange?: (sectionId: string, expanded: boolean, data: any) => void
  onProgressChange?: (completedSections: number, totalSections: number) => void
  showProgress?: boolean
  allowSkip?: boolean
  collapsible?: boolean
  smartReveal?: boolean
  className?: string
}

interface SmartRevealConfig {
  enableHints: boolean
  showRequiredFirst: boolean
  groupByPriority: boolean
  autoExpandConditional: boolean
}

export function ProgressiveDisclosure({
  sections,
  initialExpanded = [],
  onSectionChange,
  onProgressChange,
  showProgress = true,
  allowSkip = false,
  collapsible = true,
  smartReveal = false,
  className = ""
}: ProgressiveDisclosureProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(initialExpanded))
  const [sectionData, setSectionData] = useState<Record<string, any>>({})
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set())
  const [hintedSections, setHintedSections] = useState<Set<string>>(new Set())
  const { trigger, success } = useHapticFeedback()

  const revealConfig: SmartRevealConfig = {
    enableHints: true,
    showRequiredFirst: true,
    groupByPriority: true,
    autoExpandConditional: true
  }

  // Sort sections based on smart reveal logic
  const sortedSections = useCallback(() => {
    if (!smartReveal) return sections

    return [...sections].sort((a, b) => {
      // Required sections first
      if (a.required && !b.required) return -1
      if (!a.required && b.required) return 1

      // Then by priority
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      const aPriority = priorityOrder[a.priority]
      const bPriority = priorityOrder[b.priority]

      if (aPriority !== bPriority) return aPriority - bPriority

      // Finally by title
      return a.title.localeCompare(b.title)
    })
  }, [sections, smartReveal])

  // Calculate progress
  const progress = Math.round((completedSections.size / sections.length) * 100)

  // Notify parent of progress changes
  useEffect(() => {
    onProgressChange?.(completedSections.size, sections.length)
  }, [completedSections.size, sections.length, onProgressChange])

  // Handle section expansion
  const toggleSection = useCallback((sectionId: string) => {
    const section = sections.find(s => s.id === sectionId)
    if (!section) return

    const newExpanded = new Set(expandedSections)
    const isExpanding = !newExpanded.has(sectionId)

    if (isExpanding) {
      newExpanded.add(sectionId)
      success()
    } else if (collapsible) {
      newExpanded.delete(sectionId)
    }

    setExpandedSections(newExpanded)
    onSectionChange?.(sectionId, isExpanding, sectionData[sectionId])
    trigger()
  }, [expandedSections, sections, sectionData, collapsible, onSectionChange, trigger, success])

  // Handle section data change
  const handleSectionDataChange = useCallback((sectionId: string, data: any) => {
    const newSectionData = { ...sectionData, [sectionId]: data }
    setSectionData(newSectionData)

    // Check if section is completed
    const isCompleted = data && Object.keys(data).length > 0
    const newCompleted = new Set(completedSections)
    if (isCompleted) {
      newCompleted.add(sectionId)
    } else {
      newCompleted.delete(sectionId)
    }
    setCompletedSections(newCompleted)

    // Auto-expand conditional sections
    if (smartReveal && revealConfig.autoExpandConditional) {
      sections.forEach(section => {
        if (section.condition && section.condition(newSectionData)) {
          setExpandedSections(prev => new Set(prev).add(section.id))
        }
      })
    }
  }, [sectionData, completedSections, sections, smartReveal, revealConfig.autoExpandConditional])

  // Smart reveal hints
  useEffect(() => {
    if (!smartReveal || !revealConfig.enableHints) return

    const timer = setTimeout(() => {
      const requiredIncomplete = sections.filter(s =>
        s.required &&
        !expandedSections.has(s.id) &&
        !completedSections.has(s.id)
      )

      if (requiredIncomplete.length > 0) {
        setHintedSections(new Set(requiredIncomplete.map(s => s.id)))
      }
    }, 5000) // Show hints after 5 seconds

    return () => clearTimeout(timer)
  }, [expandedSections, completedSections, sections, smartReveal, revealConfig.enableHints])

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Get help icon
  const getHelpIcon = (type: string) => {
    switch (type) {
      case 'warning': return AlertTriangle
      case 'tip': return Lightbulb
      default: return Info
    }
  }

  const getHelpColor = (type: string) => {
    switch (type) {
      case 'warning': return 'bg-amber-50 text-amber-800 border-amber-200'
      case 'tip': return 'bg-green-50 text-green-800 border-green-200'
      default: return 'bg-blue-50 text-blue-800 border-blue-200'
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Progress Bar */}
      {showProgress && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span>Progress</span>
                <span>{completedSections.size} of {sections.length} completed</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Smart Reveal Hints */}
      {smartReveal && hintedSections.size > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-blue-800">
              <Lightbulb className="h-4 w-4" />
              <span>
                Complete the {hintedSections.size} required section{hintedSections.size > 1 ? 's' : ''} below
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sections */}
      {sortedSections().map((section) => {
        const isExpanded = expandedSections.has(section.id)
        const isCompleted = completedSections.has(section.id)
        const isHinted = hintedSections.has(section.id)
        const canExpand = !section.condition || section.condition(sectionData)

        return (
          <Card
            key={section.id}
            className={`transition-all duration-200 ${
              isExpanded ? 'ring-2 ring-blue-500' : ''
            } ${
              isHinted ? 'ring-2 ring-amber-400 animate-pulse' : ''
            } ${
              !canExpand ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <CardHeader
              className="pb-3 cursor-pointer"
              onClick={() => canExpand && toggleSection(section.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Completion Status */}
                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : section.required ? (
                      <div className="h-5 w-5 rounded-full border-2 border-red-500" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                    )}
                  </div>

                  {/* Title and Description */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-base">{section.title}</CardTitle>
                      {section.required && (
                        <Badge variant="destructive" className="text-xs">Required</Badge>
                      )}
                    </div>
                    {section.description && (
                      <p className="text-sm text-muted-foreground">
                        {section.description}
                      </p>
                    )}
                  </div>

                  {/* Priority Badge */}
                  <Badge className={getPriorityColor(section.priority)}>
                    {section.priority}
                  </Badge>
                </div>

                {/* Expand/Collapse Icon */}
                {collapsible && (
                  <div className="flex-shrink-0 ml-2">
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>

              {/* Help Content */}
              {section.help && isExpanded && (
                <div className={`mt-3 p-3 rounded-lg border ${getHelpColor(section.help.type)}`}>
                  <div className="flex gap-2">
                    {(() => {
                      const Icon = getHelpIcon(section.help!.type)
                      return <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    })()}
                    <div className="flex-1">
                      <h4 className="font-medium text-sm mb-1">{section.help.title}</h4>
                      <p className="text-xs">{section.help.content}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardHeader>

            {/* Section Content */}
            {isExpanded && (
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {/* Render section content with data binding */}
                  {typeof section.content === 'function'
                    ? section.content({
                        data: sectionData[section.id] || {},
                        onChange: (data: any) => handleSectionDataChange(section.id, data)
                      })
                    : section.content
                  }

                  {/* Section Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    {allowSkip && !section.required && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setCompletedSections(prev => new Set(prev).add(section.id))
                        }}
                      >
                        Skip
                      </Button>
                    )}
                    {collapsible && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSection(section.id)
                        }}
                      >
                        {isExpanded ? 'Collapse' : 'Expand'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}

      {/* Summary */}
      {showProgress && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>Form Configuration</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setExpandedSections(new Set(sections.map(s => s.id)))
                  trigger()
                }}
              >
                Expand All
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Helper function to create form content that works with progressive disclosure
export function createFormFieldComponent(config: {
  type: 'text' | 'number' | 'select' | 'textarea' | 'checkbox'
  label: string
  placeholder?: string
  required?: boolean
  options?: Array<{ value: string; label: string }>
  validation?: (value: any) => string | true
}) {
  return ({ data, onChange }: { data: any; onChange: (data: any) => void }) => {
    const [error, setError] = useState<string>()
    const [value, setValue] = useState(data.value || '')

    const handleChange = (newValue: any) => {
      setValue(newValue)

      // Validate if validation function provided
      if (config.validation) {
        const validationResult = config.validation(newValue)
        if (validationResult === true) {
          setError(undefined)
          onChange({ value: newValue, valid: true })
        } else {
          setError(validationResult)
          onChange({ value: newValue, valid: false })
        }
      } else {
        onChange({ value: newValue })
      }
    }

    // Render different input types based on config
    const renderInput = () => {
      switch (config.type) {
        case 'text':
          return (
            <input
              type="text"
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={config.placeholder}
              className={`w-full h-11 px-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                error ? 'border-red-500' : 'border-gray-300'
              }`}
            />
          )
        case 'number':
          return (
            <input
              type="number"
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={config.placeholder}
              className={`w-full h-11 px-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                error ? 'border-red-500' : 'border-gray-300'
              }`}
            />
          )
        case 'textarea':
          return (
            <textarea
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={config.placeholder}
              rows={4}
              className={`w-full px-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                error ? 'border-red-500' : 'border-gray-300'
              }`}
            />
          )
        case 'checkbox':
          return (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => handleChange(e.target.checked)}
                className="h-4 w-4"
              />
              <span>{config.label}</span>
            </label>
          )
        default:
          return null
      }
    }

    return (
      <div className="space-y-2">
        {config.type !== 'checkbox' && (
          <label className="text-sm font-medium">
            {config.label}
            {config.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        {renderInput()}
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>
    )
  }
}