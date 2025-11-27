"use client"

import { createContext, useContext, useCallback, useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

interface MobileHelpContextType {
  showHelpTip: (tipId: string, context?: any) => void
  showHelpOverlay: (pageKey: string) => void
  dismissHelpTip: (tipId: string) => void
  getHelpTips: (pageKey: string) => Promise<any[]>
  isHelpAvailable: boolean
  isLoading: boolean
}

const MobileHelpContext = createContext<MobileHelpContextType | undefined>(undefined)

interface MobileHelpProviderProps {
  children: ReactNode
  userRole?: string
}

export function MobileHelpProvider({ children, userRole }: MobileHelpProviderProps) {
  const [activeTips, setActiveTips] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()

  const showHelpTip = useCallback((tipId: string, context?: any) => {
    setActiveTips(prev => new Set(prev).add(tipId))

    // Auto-dismiss after 8 seconds for mobile
    setTimeout(() => {
      setActiveTips(prev => {
        const newSet = new Set(prev)
        newSet.delete(tipId)
        return newSet
      })
    }, 8000)
  }, [])

  const dismissHelpTip = useCallback((tipId: string) => {
    setActiveTips(prev => {
      const newSet = new Set(prev)
      newSet.delete(tipId)
      return newSet
    })
  }, [])

  const getHelpTips = useCallback(async (pageKey: string): Promise<any[]> => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/help/tips?route=${pageKey}&role=${userRole}&mobile=true&contextual=true`)
      if (!response.ok) {
        throw new Error('Failed to fetch help tips')
      }
      const data = await response.json()
      return data.tips || []
    } catch (error) {
      console.error('Error fetching help tips:', error)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [userRole])

  const showHelpOverlay = useCallback((pageKey: string) => {
    // For mobile, we'll show a simplified help overlay
    router.push(`/mobile/help?context=${pageKey}`)
  }, [router])

  const isHelpAvailable = true // Help is always available on mobile

  return (
    <MobileHelpContext.Provider
      value={{
        showHelpTip,
        showHelpOverlay,
        dismissHelpTip,
        getHelpTips,
        isHelpAvailable,
        isLoading
      }}
    >
      {children}

      {/* Mobile Help Tips Display */}
      {Array.from(activeTips).map(tipId => (
        <MobileHelpTip
          key={tipId}
          tipId={tipId}
          onDismiss={() => dismissHelpTip(tipId)}
        />
      ))}
    </MobileHelpContext.Provider>
  )
}

export function useMobileHelp() {
  const context = useContext(MobileHelpContext)
  if (context === undefined) {
    throw new Error('useMobileHelp must be used within a MobileHelpProvider')
  }
  return context
}

interface MobileHelpTipProps {
  tipId: string
  onDismiss: () => void
}

function MobileHelpTip({ tipId, onDismiss }: MobileHelpTipProps) {
  const [tip, setTip] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadTip = async () => {
      try {
        // In a real implementation, this would fetch the specific tip
        // For now, we'll use a placeholder
        setTip({
          id: tipId,
          title: 'Mobile Tip',
          content: 'This is a mobile help tip to assist you with field work.',
          type: 'info'
        })
      } catch (error) {
        console.error('Error loading help tip:', error)
      } finally {
        setLoading(false)
      }
    }

    loadTip()
  }, [tipId])

  if (loading) {
    return null
  }

  if (!tip) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="text-sm font-medium text-blue-900 mb-1">
              💡 {tip.title}
            </h4>
            <p className="text-sm text-blue-800">
              {tip.content}
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="ml-3 text-blue-600 hover:text-blue-800"
            aria-label="Dismiss help tip"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}