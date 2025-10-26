import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 touch-manipulation",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm",
        outline:
          "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100",
        secondary:
          "bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300 shadow-sm",
        ghost: "text-gray-700 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200",
        link: "text-blue-600 underline-offset-4 hover:underline hover:text-blue-700 active:text-blue-800",
        // Desktop-specific variants
        "desktop-primary": "lg:bg-blue-600 lg:hover:bg-blue-700 lg:text-white lg:font-medium lg:px-4 lg:py-2 lg:rounded-md lg:transition-colors lg:duration-200 lg:shadow-sm",
        "desktop-secondary": "lg:bg-gray-100 lg:hover:bg-gray-200 lg:text-gray-900 lg:font-medium lg:px-4 lg:py-2 lg:rounded-md lg:transition-colors lg:duration-200 lg:shadow-sm",
        "desktop-outline": "lg:border lg:border-gray-300 lg:bg-white lg:hover:bg-gray-50 lg:text-gray-700 lg:font-medium lg:px-4 lg:py-2 lg:rounded-md lg:transition-colors lg:duration-200",
        "desktop-ghost": "lg:hover:bg-gray-100 lg:text-gray-700 lg:font-medium lg:px-3 lg:py-2 lg:rounded-md lg:transition-colors lg:duration-200",
      },
      size: {
        default: "min-h-[44px] h-10 px-4 py-2 max-lg:min-h-[44px] max-lg:px-4 max-lg:py-3 max-lg:text-base",
        sm: "min-h-[44px] h-9 rounded-md px-3 max-lg:min-h-[44px] max-lg:px-4 max-lg:py-3 max-lg:text-base",
        lg: "min-h-[44px] h-11 rounded-md px-8 max-lg:min-h-[44px] max-lg:px-6 max-lg:py-3 max-lg:text-base",
        xl: "min-h-[44px] h-12 rounded-md px-6 py-3 text-base max-lg:min-h-[44px] max-lg:px-6 max-lg:py-3 max-lg:text-base",
        icon: "min-h-[44px] min-w-[44px] h-10 w-10 max-lg:min-h-[44px] max-lg:min-w-[44px] max-lg:h-11 max-lg:w-11",
        // Desktop-specific sizes
        "desktop-sm": "lg:h-8 lg:px-3 lg:py-1.5 lg:text-xs max-lg:min-h-[44px] max-lg:min-w-[44px] max-lg:px-4 max-lg:py-3 max-lg:text-base",
        "desktop-md": "lg:h-10 lg:px-4 lg:py-2 lg:text-sm max-lg:min-h-[44px] max-lg:min-w-[44px] max-lg:px-4 max-lg:py-3 max-lg:text-base",
        "desktop-lg": "lg:h-12 lg:px-6 lg:py-3 lg:text-base max-lg:min-h-[44px] max-lg:min-w-[44px] max-lg:px-6 max-lg:py-3 max-lg:text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }