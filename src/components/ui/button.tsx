import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 shadow-sm",
        outline:
          "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 hover:border-gray-400",
        secondary:
          "bg-gray-100 text-gray-900 hover:bg-gray-200 shadow-sm",
        ghost: "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
        link: "text-blue-600 underline-offset-4 hover:underline hover:text-blue-700",
        // Desktop-specific variants
        "desktop-primary": "lg:bg-blue-600 lg:hover:bg-blue-700 lg:text-white lg:font-medium lg:px-4 lg:py-2 lg:rounded-md lg:transition-colors lg:duration-200 lg:shadow-sm",
        "desktop-secondary": "lg:bg-gray-100 lg:hover:bg-gray-200 lg:text-gray-900 lg:font-medium lg:px-4 lg:py-2 lg:rounded-md lg:transition-colors lg:duration-200 lg:shadow-sm",
        "desktop-outline": "lg:border lg:border-gray-300 lg:bg-white lg:hover:bg-gray-50 lg:text-gray-700 lg:font-medium lg:px-4 lg:py-2 lg:rounded-md lg:transition-colors lg:duration-200",
        "desktop-ghost": "lg:hover:bg-gray-100 lg:text-gray-700 lg:font-medium lg:px-3 lg:py-2 lg:rounded-md lg:transition-colors lg:duration-200",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        xl: "h-12 rounded-md px-6 py-3 text-base",
        icon: "h-10 w-10",
        // Desktop-specific sizes
        "desktop-sm": "lg:h-8 lg:px-3 lg:py-1.5 lg:text-xs",
        "desktop-md": "lg:h-10 lg:px-4 lg:py-2 lg:text-sm",
        "desktop-lg": "lg:h-12 lg:px-6 lg:py-3 lg:text-base",
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