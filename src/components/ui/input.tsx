import { useState, useEffect, useCallback, useMemo, useRef, forwardRef } from 'react'
import type { HTMLAttributes } from 'react'

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "desktop" | "desktop-large"
  mobileOptimization?: boolean
}

// Input mode mapping for optimal mobile keyboards
const inputModeMap: Record<string, React.InputHTMLAttributes<HTMLInputElement>['inputMode']> = {
  email: 'email',
  tel: 'tel',
  number: 'numeric',
  decimal: 'decimal',
  url: 'url',
  search: 'search',
  date: 'none',
  time: 'none',
  datetime: 'none',
  'datetime-local': 'none',
  month: 'none',
  week: 'none'
}

// Auto-complete mapping for mobile optimization
const autoCompleteMap: Record<string, string> = {
  email: 'email',
  tel: 'tel',
  url: 'url',
  search: 'off',
  name: 'name',
  'given-name': 'given-name',
  'family-name': 'family-name',
  organization: 'organization',
  'street-address': 'street-address',
  'address-line1': 'address-line1',
  'address-line2': 'address-line2',
  locality: 'address-level2',
  region: 'address-level1',
  'postal-code': 'postal-code',
  country: 'country-name',
  'new-password': 'new-password',
  'current-password': 'current-password',
  'cc-name': 'cc-name',
  'cc-number': 'cc-number',
  'cc-exp': 'cc-exp',
  'cc-csc': 'cc-csc'
}

// Pattern validation for mobile inputs
const patternMap: Record<string, string> = {
  tel: '[0-9]{3}-?[0-9]{3}-?[0-9]{4}',
  number: '\\d*',
  decimal: '\\d*(\\.\\d*)?',
  'postal-code-australia': '\\d{4}',
  'phone-australia': '^0[2-9]\\d{8}$|\\+61[2-9]\\d{8}$'
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({
    className,
    type,
    variant = "default",
    mobileOptimization = true,
    inputMode: propInputMode,
    autoComplete: propAutoComplete,
    pattern: propPattern,
    ...props
  }, ref) => {
    const baseClasses = "flex min-h-[44px] h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"

    // Mobile-specific touch target compliance
    // NOTE: No mobile-specific left padding (max-lg:pl-*) - this allows custom pl-10, pl-12 etc. classes
    // (for inputs with icons) to work correctly. Media query classes override non-media query classes
    // in CSS, so max-lg:pl-4 would beat pl-10 on mobile, breaking icon input layouts.
    const mobileClasses = "max-lg:py-3 max-lg:min-h-[44px] max-lg:text-base max-lg:touch-manipulation max-lg:select-none"

    const variantClasses = {
      default: `${baseClasses} ${mobileClasses}`,
      desktop: "lg:border-gray-300 lg:bg-white lg:focus:border-blue-500 lg:focus:ring-blue-500 lg:shadow-sm lg:hover:border-gray-400 lg:transition-colors lg:duration-200",
      "desktop-large": "lg:h-12 lg:px-4 lg:py-3 lg:text-base lg:border-gray-300 lg:bg-white lg:focus:border-blue-500 lg:focus:ring-blue-500 lg:shadow-sm lg:hover:border-gray-400 lg:transition-colors lg:duration-200"
    }

    // Apply mobile optimizations if enabled
    const mobileProps: React.InputHTMLAttributes<HTMLInputElement> = {}

    if (mobileOptimization && typeof window !== 'undefined' && 'ontouchstart' in window) {
      // Set appropriate input mode for mobile keyboards
      if (!propInputMode && type && inputModeMap[type]) {
        mobileProps.inputMode = inputModeMap[type]
      }

      // Set appropriate auto-complete for mobile
      if (!propAutoComplete && props.name && autoCompleteMap[props.name]) {
        mobileProps.autoComplete = autoCompleteMap[props.name] as React.InputHTMLAttributes<HTMLInputElement>['autoComplete']
      }

      // Set appropriate pattern for validation
      if (!propPattern && props.name && patternMap[props.name]) {
        mobileProps.pattern = patternMap[props.name]
      }

      // Add spellcheck and autocapitalize settings
      mobileProps.spellCheck = type === 'email' || type === 'url' ? false : undefined
      mobileProps.autoCapitalize = type === 'email' ? 'none' : undefined
      mobileProps.autoCorrect = type === 'email' ? 'off' : undefined

      // Ensure proper enter key behavior
      if (type === 'search') {
        mobileProps.enterKeyHint = 'search'
      } else if (type === 'email') {
        mobileProps.enterKeyHint = 'next'
      } else if (type === 'tel') {
        mobileProps.enterKeyHint = 'next'
      } else if (type === 'url') {
        mobileProps.enterKeyHint = 'next'
      } else if (type === 'number') {
        mobileProps.enterKeyHint = 'next'
      } else {
        mobileProps.enterKeyHint = 'enter'
      }
    }

    return (
      <input
        type={type}
        className={cn(
          variantClasses[variant],
          className
        )}
        ref={ref}
        {...mobileProps}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
