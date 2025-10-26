import { useState, useEffect, useCallback, useMemo, useRef, forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Desktop-specific variants
        "desktop-success": "lg:bg-green-100 lg:text-green-800 lg:border-green-200 lg:hover:bg-green-200",
        "desktop-warning": "lg:bg-amber-100 lg:text-amber-800 lg:border-amber-200 lg:hover:bg-amber-200",
        "desktop-info": "lg:bg-blue-100 lg:text-blue-800 lg:border-blue-200 lg:hover:bg-blue-200",
        "desktop-error": "lg:bg-red-100 lg:text-red-800 lg:border-red-200 lg:hover:bg-red-200",
        "desktop-neutral": "lg:bg-gray-100 lg:text-gray-800 lg:border-gray-200 lg:hover:bg-gray-200",
        "desktop-primary": "lg:bg-blue-100 lg:text-blue-800 lg:border-blue-200 lg:hover:bg-blue-200",
        "desktop-secondary": "lg:bg-purple-100 lg:text-purple-800 lg:border-purple-200 lg:hover:bg-purple-200",
      },
      size: {
        default: "",
        sm: "px-2 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
        // Desktop-specific sizes
        "desktop-xs": "lg:px-1.5 lg:py-0.5 lg:text-xs",
        "desktop-sm": "lg:px-2 lg:py-0.5 lg:text-xs",
        "desktop-md": "lg:px-2.5 lg:py-1 lg:text-sm",
        "desktop-lg": "lg:px-3 lg:py-1.5 lg:text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(function Badge(
  { className, variant, size, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
})

export { Badge, badgeVariants }
