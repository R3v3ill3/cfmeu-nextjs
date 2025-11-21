import { useState, useEffect, useCallback, useMemo, useRef, forwardRef, type ElementRef, type ComponentPropsWithoutRef } from 'react'
import type {  } from 'react'
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = forwardRef<
  ElementRef<typeof CheckboxPrimitive.Root>,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <div className="relative inline-flex items-center justify-center">
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border border-gray-300 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 data-[state=checked]:text-primary-foreground touch-manipulation",
        // Mobile-specific styling to increase touch target while keeping visual size
        "max-lg:h-5 max-lg:w-5",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn("flex items-center justify-center text-current")}
      >
        <Check className="h-3 w-3 max-lg:h-4 max-lg:w-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
    {/* Invisible touch target overlay for mobile only - disabled on desktop to allow checkbox clicks */}
    <div
      className="absolute inset-0 -m-4 max-lg:-m-5 z-10 touch-manipulation lg:pointer-events-none"
      aria-hidden="true"
      style={{
        minHeight: '44px',
        minWidth: '44px',
        cursor: 'pointer'
      }}
    />
  </div>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
