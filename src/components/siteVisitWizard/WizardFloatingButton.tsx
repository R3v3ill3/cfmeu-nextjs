"use client"

import { useRouter } from 'next/navigation'
import { useHapticFeedback } from '@/components/mobile/shared/HapticFeedback'
import { cn } from '@/lib/utils'
import { MapPin } from 'lucide-react'

interface WizardFloatingButtonProps {
  className?: string
}

export function WizardFloatingButton({ className }: WizardFloatingButtonProps) {
  const router = useRouter()
  const { trigger } = useHapticFeedback()
  
  const handleClick = () => {
    trigger('medium')
    router.push('/site-visit-wizard')
  }
  
  return (
    <button
      onClick={handleClick}
      className={cn(
        // Positioning
        'fixed bottom-6 right-6 z-50',
        // Safe area padding for iPhone
        'mb-safe-bottom mr-safe-right',
        // Size and shape
        'w-16 h-16 rounded-full',
        // Colors
        'bg-blue-600 text-white shadow-xl',
        // Hover/active states
        'hover:bg-blue-700 active:bg-blue-800 active:scale-95',
        // Animation
        'transition-all duration-200 transform',
        // Touch optimization
        'touch-manipulation',
        // Ring for focus
        'focus:outline-none focus:ring-4 focus:ring-blue-300',
        className
      )}
      aria-label="Start Site Visit"
    >
      <MapPin className="h-7 w-7 mx-auto" />
    </button>
  )
}

