import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "desktop" | "desktop-large"
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = "default", ...props }, ref) => {
    const baseClasses = "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    
    const variantClasses = {
      default: baseClasses,
      desktop: "lg:border-gray-300 lg:bg-white lg:focus:border-blue-500 lg:focus:ring-blue-500 lg:shadow-sm lg:hover:border-gray-400 lg:transition-colors lg:duration-200",
      "desktop-large": "lg:h-12 lg:px-4 lg:py-3 lg:text-base lg:border-gray-300 lg:bg-white lg:focus:border-blue-500 lg:focus:ring-blue-500 lg:shadow-sm lg:hover:border-gray-400 lg:transition-colors lg:duration-200"
    }
    
    return (
      <input
        type={type}
        className={cn(
          variantClasses[variant],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
