"use client"

import { forwardRef, type ReactNode, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { useHapticFeedback } from '@/components/mobile/shared/HapticFeedback'

export interface WizardButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  icon?: ReactNode
  iconPosition?: 'left' | 'top'
  fullWidth?: boolean
  loading?: boolean
}

const WizardButton = forwardRef<HTMLButtonElement, WizardButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'lg',
      icon,
      iconPosition = 'left',
      fullWidth = false,
      loading = false,
      disabled,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const { trigger } = useHapticFeedback()
    
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || loading) return
      trigger('light')
      onClick?.(e)
    }
    
    const baseStyles = cn(
      'inline-flex items-center justify-center font-semibold transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
      'active:scale-[0.98] touch-manipulation',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100'
    )
    
    const variantStyles = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
      secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300',
      outline: 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100',
      ghost: 'text-gray-700 hover:bg-gray-100 active:bg-gray-200',
      danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
    }
    
    const sizeStyles = {
      sm: 'min-h-[40px] px-4 py-2 text-sm rounded-lg gap-2',
      md: 'min-h-[48px] px-5 py-3 text-base rounded-xl gap-2',
      lg: 'min-h-[56px] px-6 py-4 text-lg rounded-xl gap-3',
      xl: 'min-h-[64px] px-8 py-5 text-xl rounded-2xl gap-3',
    }
    
    const iconSizeStyles = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
      xl: 'h-8 w-8',
    }
    
    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          iconPosition === 'top' && 'flex-col',
          className
        )}
        disabled={disabled || loading}
        onClick={handleClick}
        {...props}
      >
        {loading ? (
          <svg 
            className={cn('animate-spin', iconSizeStyles[size])} 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4" 
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
            />
          </svg>
        ) : icon ? (
          <span className={iconSizeStyles[size]}>{icon}</span>
        ) : null}
        {children && <span>{children}</span>}
      </button>
    )
  }
)

WizardButton.displayName = 'WizardButton'

export { WizardButton }

