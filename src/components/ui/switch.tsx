import { useState, useEffect, useCallback, useMemo, useRef, forwardRef } from 'react'
import type {  } from 'react'
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <div className="relative inline-flex">
    <SwitchPrimitives.Root
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-200 touch-manipulation max-lg:h-7 max-lg:w-12",
        className
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0 max-lg:h-6 max-lg:w-6 max-lg:data-[state=checked]:translate-x-6"
        )}
      />
    </SwitchPrimitives.Root>
    {/* Invisible touch target overlay for mobile */}
    <div
      className="absolute inset-0 -m-4 z-10 touch-manipulation"
      aria-hidden="true"
      style={{
        minHeight: '44px',
        minWidth: '44px',
        cursor: 'pointer'
      }}
    />
  </div>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
