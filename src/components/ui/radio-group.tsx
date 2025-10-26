import { useState, useEffect, useCallback, useMemo, useRef, forwardRef, type ElementRef, type ComponentPropsWithoutRef } from 'react'
import type {  } from 'react'
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { Circle } from "lucide-react"

import { cn } from "@/lib/utils"

const RadioGroup = forwardRef<
  ElementRef<typeof RadioGroupPrimitive.Root>,
  ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-4 max-lg:gap-6", className)}
      {...props}
      ref={ref}
    />
  )
})
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

const RadioGroupItem = forwardRef<
  ElementRef<typeof RadioGroupPrimitive.Item>,
  ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <div className="relative inline-flex items-center">
      <RadioGroupPrimitive.Item
        ref={ref}
        className={cn(
          "aspect-square h-4 w-4 rounded-full border border-gray-300 text-blue-600 ring-offset-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation peer",
          // Mobile-specific styling to increase touch target while keeping visual size
          "max-lg:h-5 max-lg:w-5",
          className
        )}
        {...props}
      >
        <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
          <Circle className="h-2.5 w-2.5 fill-current text-current max-lg:h-3 max-lg:w-3" />
        </RadioGroupPrimitive.Indicator>
      </RadioGroupPrimitive.Item>
      {/* Invisible touch target overlay for mobile */}
      <div
        className="absolute inset-0 -m-4 max-lg:-m-5 z-10 touch-manipulation"
        aria-hidden="true"
        style={{
          minHeight: '44px',
          minWidth: '44px',
          cursor: 'pointer'
        }}
      />
    </div>
  )
})
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName

export { RadioGroup, RadioGroupItem }
