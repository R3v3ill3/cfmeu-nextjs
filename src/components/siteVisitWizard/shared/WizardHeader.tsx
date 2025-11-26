"use client"

import { ArrowLeft, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHapticFeedback } from '@/components/mobile/shared/HapticFeedback'

interface WizardHeaderProps {
  title: string
  subtitle?: string
  onBack?: () => void
  onClose?: () => void
  showBack?: boolean
  showClose?: boolean
  className?: string
}

export function WizardHeader({
  title,
  subtitle,
  onBack,
  onClose,
  showBack = true,
  showClose = false,
  className,
}: WizardHeaderProps) {
  const { trigger } = useHapticFeedback()
  
  const handleBack = () => {
    trigger('light')
    onBack?.()
  }
  
  const handleClose = () => {
    trigger('light')
    onClose?.()
  }
  
  return (
    <header 
      className={cn(
        'sticky top-0 z-40 bg-white border-b border-gray-200',
        'px-4 py-3 safe-area-inset-top',
        className
      )}
    >
      <div className="flex items-center gap-3">
        {/* Back button */}
        {showBack && onBack && (
          <button
            onClick={handleBack}
            className={cn(
              'flex items-center justify-center',
              'w-12 h-12 -ml-2 rounded-full',
              'text-gray-600 hover:bg-gray-100 active:bg-gray-200',
              'transition-colors touch-manipulation'
            )}
            aria-label="Go back"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
        )}
        
        {/* Title area */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-gray-500 truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        
        {/* Close button */}
        {showClose && onClose && (
          <button
            onClick={handleClose}
            className={cn(
              'flex items-center justify-center',
              'w-12 h-12 -mr-2 rounded-full',
              'text-gray-600 hover:bg-gray-100 active:bg-gray-200',
              'transition-colors touch-manipulation'
            )}
            aria-label="Close wizard"
          >
            <X className="h-6 w-6" />
          </button>
        )}
      </div>
    </header>
  )
}

