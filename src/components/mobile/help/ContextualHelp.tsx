"use client"

import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useHapticFeedback } from '@/components/mobile/shared/HapticFeedback'
import {
  HelpCircle,
  X,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  MessageCircle,
  Lightbulb,
  CheckCircle,
  AlertTriangle,
  Info,
  ArrowRight,
  Target
} from 'lucide-react'

interface HelpTopic {
  id: string
  title: string
  description: string
  content: React.ReactNode
  category: 'getting-started' | 'workflow' | 'technical' | 'troubleshooting'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedReadTime: number // in minutes
  relatedTopics?: string[]
  prerequisites?: string[]
}

interface HelpStep {
  id: string
  title: string
  content: React.ReactNode
  target?: string // CSS selector for highlighting
  position?: 'top' | 'bottom' | 'left' | 'right'
  action?: {
    label: string
    type: 'next' | 'skip' | 'complete'
    handler?: () => void
  }
}

interface ContextualHelpProps {
  context?: string
  topic?: string
  showOnboarding?: boolean
  onHelpComplete?: (topicId: string) => void
  className?: string
}

const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'mobile-project-mapping',
    title: 'Project Mapping',
    description: 'Learn how to map construction sites and capture workforce information',
    category: 'workflow',
    difficulty: 'beginner',
    estimatedReadTime: 3,
    content: (
      <div className="space-y-4">
        <p>
          Project mapping helps you document who's working on construction sites, their roles, and working conditions.
        </p>
        <div>
          <h4 className="font-medium mb-2">Key Information to Capture:</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Total workforce size and union membership</li>
            <li>• All employers and contractors on site</li>
            <li>• Union delegates and their contact details</li>
            <li>• Site conditions and amenities</li>
            <li>• Photos for documentation</li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium mb-2">Tips for Effective Mapping:</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Start with workforce overview for quick metrics</li>
            <li>• Take photos of site entrance and key areas</li>
            <li>• Talk to workers to verify information</li>
            <li>• Note any safety concerns or issues</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 'compliance-auditing',
    title: 'Compliance Auditing',
    description: 'Understanding traffic light ratings and compliance assessments',
    category: 'workflow',
    difficulty: 'intermediate',
    estimatedReadTime: 5,
    content: (
      <div className="space-y-4">
        <p>
          Compliance auditing helps assess workplace conditions and union rights compliance using traffic light ratings.
        </p>
        <div>
          <h4 className="font-medium mb-2">Traffic Light System:</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-sm"><strong>Green:</strong> Good compliance, minimal concerns</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full" />
              <span className="text-sm"><strong>Amber:</strong> Some concerns, needs attention</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <span className="text-sm"><strong>Red:</strong> Serious issues, immediate action required</span>
            </div>
          </div>
        </div>
        <div>
          <h4 className="font-medium mb-2">Assessment Areas:</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Workplace Health & Safety</li>
            <li>• Union Rights & Representation</li>
            <li>• Workplace Conditions</li>
            <li>• Communication & Consultation</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 'offline-mode',
    title: 'Working Offline',
    description: 'How to use the app without internet connection',
    category: 'technical',
    difficulty: 'beginner',
    estimatedReadTime: 2,
    content: (
      <div className="space-y-4">
        <p>
          The mobile app works offline, allowing you to continue working on construction sites with poor connectivity.
        </p>
        <div>
          <h4 className="font-medium mb-2">What Works Offline:</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Project mapping and data entry</li>
            <li>• Compliance auditing forms</li>
            <li>• Photo capture and storage</li>
            <li>• Access to previously loaded data</li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium mb-2">Automatic Sync:</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Changes are saved locally when offline</li>
            <li>• Data syncs automatically when connection restored</li>
            <li>• You can manually trigger sync when online</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 'taking-photos',
    title: 'Taking Site Photos',
    description: 'Best practices for capturing site documentation photos',
    category: 'workflow',
    difficulty: 'beginner',
    estimatedReadTime: 2,
    content: (
      <div className="space-y-4">
        <p>
          Photos are important for documenting site conditions and evidence during audits and mapping.
        </p>
        <div>
          <h4 className="font-medium mb-2">Photo Guidelines:</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Take overview shots of the entire site</li>
            <li>• Capture safety signage and notices</li>
            <li>• Document amenities and facilities</li>
            <li>• Include workers in break areas (with permission)</li>
            <li>• Note specific issues or concerns</li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium mb-2">Photo Quality Tips:</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Ensure good lighting and clear focus</li>
            <li>• Include context and scale when possible</li>
            <li>• Add descriptive captions</li>
            <li>• Take multiple angles if needed</li>
          </ul>
        </div>
      </div>
    )
  }
]

const ONBOARDING_STEPS: HelpStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to CFMEU Mobile',
    content: (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
          <Target className="h-8 w-8 text-blue-600" />
        </div>
        <p>
          Let's walk through the key features to help you get started with organizing on construction sites.
        </p>
        <p className="text-sm text-muted-foreground">
          This should only take about 2 minutes.
        </p>
      </div>
    ),
    action: {
      label: 'Get Started',
      type: 'next'
    }
  },
  {
    id: 'navigation',
    title: 'Easy Navigation',
    content: (
      <div className="space-y-4">
        <p>
          Navigate between different workflows using the bottom menu and header buttons.
        </p>
        <div className="bg-blue-50 p-3 rounded-lg">
          <p className="text-sm">
            <strong>Tip:</strong> Use the back button in headers or swipe from the left edge to navigate.
          </p>
        </div>
      </div>
    ),
    action: {
      label: 'Next',
      type: 'next'
    }
  },
  {
    id: 'offline',
    title: 'Works Offline',
    content: (
      <div className="space-y-4">
        <p>
          The app works even without internet connection - perfect for construction sites!
        </p>
        <div className="bg-amber-50 p-3 rounded-lg">
          <p className="text-sm">
            <strong>Look for:</strong> Online/offline indicators at the top of the screen
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Your work saves locally and syncs automatically when you're back online.
        </p>
      </div>
    ),
    action: {
      label: 'Next',
      type: 'next'
    }
  },
  {
    id: 'help',
    title: 'Help is Always Available',
    content: (
      <div className="space-y-4">
        <p>
          Need help? Tap the help icon (?) in any screen to get contextual guidance.
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-blue-600" />
            <span className="text-sm">Get help for specific features</span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-600" />
            <span className="text-sm">Access detailed guides</span>
          </div>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-blue-600" />
            <span className="text-sm">Contact support if needed</span>
          </div>
        </div>
      </div>
    ),
    action: {
      label: 'Complete Setup',
      type: 'complete'
    }
  }
]

export function ContextualHelp({
  context,
  topic,
  showOnboarding = false,
  onHelpComplete,
  className = ""
}: ContextualHelpProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null)
  const [showOnboardingTour, setShowOnboardingTour] = useState(showOnboarding)
  const [currentStep, setCurrentStep] = useState(0)
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(new Set())
  const { trigger, success } = useHapticFeedback()

  // Load completed topics from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('mobile-help-completed')
    if (stored) {
      setCompletedTopics(new Set(JSON.parse(stored)))
    }
  }, [])

  // Filter topics based on context
  const relevantTopics = useMemo(() => {
    if (topic) {
      return HELP_TOPICS.filter(t => t.id === topic)
    }
    if (context) {
      return HELP_TOPICS.filter(t => t.id.includes(context))
    }
    return HELP_TOPICS
  }, [context, topic])

  // Handle topic selection
  const handleTopicSelect = useCallback((topic: HelpTopic) => {
    trigger()
    setSelectedTopic(topic)
    success()
  }, [trigger, success])

  // Mark topic as completed
  const handleTopicComplete = useCallback(() => {
    if (selectedTopic) {
      const newCompleted = new Set(completedTopics)
      newCompleted.add(selectedTopic.id)
      setCompletedTopics(newCompleted)
      localStorage.setItem('mobile-help-completed', JSON.stringify([...newCompleted]))
      onHelpComplete?.(selectedTopic.id)
    }
  }, [selectedTopic, completedTopics, onHelpComplete])

  // Onboarding tour handlers
  const handleOnboardingNext = useCallback(() => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
      trigger()
    } else {
      setShowOnboardingTour(false)
      localStorage.setItem('mobile-onboarding-complete', 'true')
      success()
    }
  }, [currentStep, trigger, success])

  const handleOnboardingSkip = useCallback(() => {
    setShowOnboardingTour(false)
    localStorage.setItem('mobile-onboarding-complete', 'true')
  }, [])

  // Get category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'getting-started': return Lightbulb
      case 'workflow': return Target
      case 'technical': return Info
      case 'troubleshooting': return AlertTriangle
      default: return HelpCircle
    }
  }

  // Get difficulty color
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Onboarding Tour Modal
  if (showOnboardingTour) {
    const step = ONBOARDING_STEPS[currentStep]
    const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{step.title}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOnboardingSkip}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Progress value={progress} className="h-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            {step.content}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleOnboardingSkip}
                className="flex-1"
              >
                Skip Tour
              </Button>
              <Button
                onClick={handleOnboardingNext}
                className="flex-1"
              >
                {step.action?.label || 'Next'}
                {step.action?.type !== 'complete' && <ChevronRight className="h-4 w-4 ml-2" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Help Button */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={() => trigger()}
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[80vh]">
          <SheetHeader>
            <SheetTitle>Help & Guidance</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => setShowOnboardingTour(true)}
                className="h-auto p-4 flex flex-col gap-2"
              >
                <Target className="h-6 w-6" />
                <span className="text-sm">Take Tour</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open('tel:1300CFMEU', '_self')}
                className="h-auto p-4 flex flex-col gap-2"
              >
                <MessageCircle className="h-6 w-6" />
                <span className="text-sm">Call Support</span>
              </Button>
            </div>

            {/* Help Topics */}
            <div>
              <h3 className="font-medium mb-3">Help Topics</h3>
              <div className="space-y-2">
                {relevantTopics.map((topic) => {
                  const Icon = getCategoryIcon(topic.category)
                  const isCompleted = completedTopics.has(topic.id)

                  return (
                    <Card
                      key={topic.id}
                      className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                        selectedTopic?.id === topic.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => handleTopicSelect(topic)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <Icon className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-sm">{topic.title}</h4>
                              {isCompleted && <CheckCircle className="h-3 w-3 text-green-600" />}
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                              {topic.description}
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge className={getDifficultyColor(topic.difficulty)}>
                                {topic.difficulty}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {topic.estimatedReadTime} min read
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* Selected Topic Content */}
            {selectedTopic && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-medium">{selectedTopic.title}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleTopicComplete}
                    className="h-6 px-2 text-xs"
                  >
                    Mark Complete
                  </Button>
                </div>
                <div className="prose prose-sm max-w-none">
                  {selectedTopic.content}
                </div>
              </div>
            )}

            {/* Completed Topics Summary */}
            {completedTopics.size > 0 && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>{completedTopics.size} topics completed</span>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}