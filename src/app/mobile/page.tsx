"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MobileDashboard } from '@/components/mobile/dashboard/MobileDashboard'
import { ContextualHelp } from '@/components/mobile/help/ContextualHelp'
import { useMobileOptimizations } from '@/hooks/mobile/useMobileOptimizations'
import { useToast } from '@/hooks/use-toast'
import { MobileLoadingState } from '@/components/mobile/shared/MobileOptimizationProvider'

interface QuickAction {
  id: string
  title: string
  description: string
  icon: string
  route: string
  color: string
}

export default function MobileHomePage() {
  const router = useRouter()
  const { toast } = useToast()

  const {
    isMobile,
    isLowEndDevice,
    prefersReducedMotion,
  } = useMobileOptimizations({
    enableDebouncing: true,
    debounceDelay: 300,
  })

  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Check if user has completed onboarding
  useEffect(() => {
    try {
      const hasCompletedOnboarding = localStorage.getItem('mobile-onboarding-complete') === 'true'
      setShowOnboarding(!hasCompletedOnboarding)
    } catch (error) {
      console.warn('Unable to read onboarding state', error)
      setShowOnboarding(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
  }

  const quickActions: QuickAction[] = [
    {
      id: '1',
      title: 'Map Project',
      description: 'Start mapping a new construction site',
      icon: 'map',
      route: '/mobile/map/discovery',
      color: 'bg-blue-500'
    },
    {
      id: '2',
      title: 'Compliance Audit',
      description: 'Conduct workplace compliance assessment',
      icon: 'audit',
      route: '/mobile/projects',
      color: 'bg-green-500'
    },
    {
      id: '3',
      title: 'View Projects',
      description: 'See and manage your projects',
      icon: 'projects',
      route: '/mobile/projects',
      color: 'bg-purple-500'
    },
    {
      id: '4',
      title: 'Dashboard',
      description: 'View your organizing overview',
      icon: 'dashboard',
      route: '/mobile/dashboard',
      color: 'bg-orange-500'
    }
  ]

  const handleNavigation = (route: string) => {
    router.push(route)
  }

  if (loading) {
    return <MobileLoadingState message="Loading..." />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">CFMEU Mobile</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Construction site organizing tools
              </p>
            </div>
            <ContextualHelp
              showOnboarding={showOnboarding}
              onOnboardingComplete={handleOnboardingComplete}
            />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Get Started</h2>
        <div className="grid grid-cols-2 gap-4">
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleNavigation(action.route)}
              className="bg-white p-4 rounded-xl border border-gray-200 hover:shadow-md transition-shadow text-left"
            >
              <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center mb-3`}>
                {action.icon === 'map' && (
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
                {action.icon === 'audit' && (
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                {action.icon === 'projects' && (
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                )}
                {action.icon === 'dashboard' && (
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                )}
              </div>
              <h3 className="font-semibold text-sm mb-1">{action.title}</h3>
              <p className="text-xs text-muted-foreground">{action.description}</p>
            </button>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-center py-8">
              <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-600 mb-2">No recent activity</p>
              <p className="text-sm text-muted-foreground">
                Start by mapping a project or conducting an audit
              </p>
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-8">
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-sm mb-1">Need help?</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Access guides, tutorials, and support resources
                </p>
                <button
                  onClick={() => window.open('tel:1300CFMEU', '_self')}
                  className="text-xs text-blue-600 font-medium"
                >
                  Call Support →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}