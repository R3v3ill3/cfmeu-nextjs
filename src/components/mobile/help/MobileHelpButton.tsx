"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMobileHelp } from './MobileHelpProvider'
import { useToast } from '@/hooks/use-toast'

interface MobileHelpButtonProps {
  pageKey?: string
  context?: string
  variant?: 'floating' | 'inline'
  className?: string
}

export function MobileHelpButton({
  pageKey,
  context,
  variant = 'floating',
  className = ''
}: MobileHelpButtonProps) {
  const [isPressed, setIsPressed] = useState(false)
  const router = useRouter()
  const { showHelpOverlay, showHelpTip } = useMobileHelp()
  const { toast } = useToast()

  const handleQuickHelp = async () => {
    setIsPressed(true)

    try {
      // Show a quick help tip for immediate assistance
      if (pageKey) {
        showHelpTip(`mobile-${pageKey}`, { context })
      }

      // Provide haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(50)
      }

      toast({
        title: "Help Available",
        description: "Tap the help button again for detailed assistance",
        duration: 2000,
      })
    } catch (error) {
      console.error('Error showing help:', error)
    } finally {
      setTimeout(() => setIsPressed(false), 200)
    }
  }

  const handleDetailedHelp = () => {
    if (pageKey) {
      showHelpOverlay(pageKey)
    } else {
      router.push('/mobile/help')
    }
  }

  if (variant === 'inline') {
    return (
      <button
        onClick={handleDetailedHelp}
        className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors ${className}`}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        Help
      </button>
    )
  }

  return (
    <div className="fixed bottom-20 right-4 z-40">
      {/* Quick Help Button */}
      <button
        onClick={handleQuickHelp}
        className={`w-14 h-14 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 transform active:scale-95 ${isPressed ? 'scale-95' : ''} ${className}`}
        aria-label="Get help"
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Detailed Help Access */}
      <button
        onClick={handleDetailedHelp}
        className="w-10 h-10 bg-gray-600 hover:bg-gray-700 text-white rounded-full shadow-lg flex items-center justify-center -ml-6 mt-2 transition-all duration-200"
        aria-label="Detailed help"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </button>
    </div>
  )
}

// Mobile Quick Help Tooltip for field-specific assistance
export function MobileQuickHelp({
  title,
  content,
  examples
}: {
  title: string
  content: string
  examples?: string[]
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-blue-600 font-medium text-sm">💡</span>
          <span className="text-sm font-medium text-blue-900">{title}</span>
        </div>
        <svg
          className={`w-4 h-4 text-blue-600 transform transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-blue-800">{content}</p>

          {examples && examples.length > 0 && (
            <div className="bg-white bg-opacity-50 rounded p-2">
              <p className="text-xs font-medium text-blue-700 mb-1">Examples:</p>
              <ul className="text-xs text-blue-700 space-y-1">
                {examples.map((example, index) => (
                  <li key={index} className="flex items-start gap-1">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>{example}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}