import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "desktop" | "desktop-elevated" | "desktop-interactive"
  }
>(({ className, variant = "default", ...props }, ref) => {
  const baseClasses = "rounded-lg border bg-card text-card-foreground shadow-sm"
  
  const variantClasses = {
    default: baseClasses,
    desktop: "lg:bg-white lg:border-gray-200 lg:shadow-sm lg:rounded-lg",
    "desktop-elevated": "lg:bg-white lg:border-gray-200 lg:shadow-md lg:rounded-lg lg:hover:shadow-lg lg:transition-shadow lg:duration-200",
    "desktop-interactive": "lg:bg-white lg:border-gray-200 lg:shadow-sm lg:rounded-lg lg:hover:shadow-md lg:hover:border-gray-300 lg:transition-all lg:duration-200 lg:cursor-pointer"
  }
  
  return (
    <div
      ref={ref}
      className={cn(
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
})
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "desktop" | "desktop-compact"
  }
>(({ className, variant = "default", ...props }, ref) => {
  const baseClasses = "flex flex-col space-y-1.5 p-6"
  
  const variantClasses = {
    default: baseClasses,
    desktop: "lg:p-6 lg:pb-3",
    "desktop-compact": "lg:p-4 lg:pb-3"
  }
  
  return (
    <div
      ref={ref}
      className={cn(
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
})
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement> & {
    variant?: "default" | "desktop" | "desktop-large"
  }
>(({ className, variant = "default", ...props }, ref) => {
  const baseClasses = "text-2xl font-semibold leading-none tracking-tight"
  
  const variantClasses = {
    default: baseClasses,
    desktop: "lg:text-lg lg:font-medium lg:text-gray-700",
    "desktop-large": "lg:text-2xl lg:font-bold lg:text-gray-900"
  }
  
  return (
    <h3
      ref={ref}
      className={cn(
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
})
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement> & {
    variant?: "default" | "desktop"
  }
>(({ className, variant = "default", ...props }, ref) => {
  const baseClasses = "text-sm text-muted-foreground"
  
  const variantClasses = {
    default: baseClasses,
    desktop: "lg:text-gray-600"
  }
  
  return (
    <p
      ref={ref}
      className={cn(
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
})
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "desktop" | "desktop-compact"
  }
>(({ className, variant = "default", ...props }, ref) => {
  const baseClasses = "p-6 pt-0"
  
  const variantClasses = {
    default: baseClasses,
    desktop: "lg:p-6 lg:pt-0",
    "desktop-compact": "lg:p-4 lg:pt-0"
  }
  
  return (
    <div 
      ref={ref} 
      className={cn(
        variantClasses[variant],
        className
      )} 
      {...props} 
    />
  )
})
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "desktop"
  }
>(({ className, variant = "default", ...props }, ref) => {
  const baseClasses = "flex items-center p-6 pt-0"
  
  const variantClasses = {
    default: baseClasses,
    desktop: "lg:p-6 lg:pt-0 lg:border-t lg:border-gray-200 lg:pt-4"
  }
  
  return (
    <div
      ref={ref}
      className={cn(
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
})
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
