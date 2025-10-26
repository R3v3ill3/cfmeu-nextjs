import { useState, useEffect, useCallback, useMemo, useRef, forwardRef } from 'react'
import type { HTMLAttributes } from 'react'

import { cn } from "@/lib/utils"

const Table = forwardRef<
  HTMLTableElement,
  HTMLAttributes<HTMLTableElement> & {
    variant?: "default" | "desktop" | "desktop-elevated"
  }
>(({ className, variant = "default", ...props }, ref) => {
  const baseClasses = "w-full caption-bottom text-sm"
  
  const variantClasses = {
    default: baseClasses,
    desktop: "lg:bg-white lg:border lg:border-gray-200 lg:rounded-lg lg:shadow-sm lg:overflow-hidden",
    "desktop-elevated": "lg:bg-white lg:border lg:border-gray-200 lg:rounded-lg lg:shadow-md lg:overflow-hidden"
  }
  
  return (
    <div className={cn(variantClasses[variant])}>
      <table
        ref={ref}
        className={cn(baseClasses, className)}
        {...props}
      />
    </div>
  )
})
Table.displayName = "Table"

const TableHeader = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement> & {
    variant?: "default" | "desktop"
  }
>(({ className, variant = "default", ...props }, ref) => {
  const baseClasses = ""
  
  const variantClasses = {
    default: baseClasses,
    desktop: "lg:bg-gray-50 lg:border-b lg:border-gray-200"
  }
  
  return (
    <thead
      ref={ref}
      className={cn(variantClasses[variant], className)}
      {...props}
    />
  )
})
TableHeader.displayName = "TableHeader"

const TableBody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement> & {
    variant?: "default" | "desktop"
  }
>(({ className, variant = "default", ...props }, ref) => {
  const baseClasses = "[&_tr:last-child]:border-0"
  
  const variantClasses = {
    default: baseClasses,
    desktop: "lg:divide-y lg:divide-gray-100"
  }
  
  return (
    <tbody
      ref={ref}
      className={cn(baseClasses, variantClasses[variant], className)}
      {...props}
    />
  )
})
TableBody.displayName = "TableBody"

const TableFooter = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement> & {
    variant?: "default" | "desktop"
  }
>(({ className, variant = "default", ...props }, ref) => {
  const baseClasses = "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0"
  
  const variantClasses = {
    default: baseClasses,
    desktop: "lg:bg-gray-50 lg:border-t lg:border-gray-200"
  }
  
  return (
    <tfoot
      ref={ref}
      className={cn(baseClasses, variantClasses[variant], className)}
      {...props}
    />
  )
})
TableFooter.displayName = "TableFooter"

const TableRow = forwardRef<
  HTMLTableRowElement,
  HTMLAttributes<HTMLTableRowElement> & {
    variant?: "default" | "desktop" | "desktop-hover"
  }
>(({ className, variant = "default", ...props }, ref) => {
  const baseClasses = "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
  
  const variantClasses = {
    default: baseClasses,
    desktop: "lg:border-b lg:border-gray-100",
    "desktop-hover": "lg:border-b lg:border-gray-100 lg:hover:bg-gray-50 lg:transition-colors lg:duration-150"
  }
  
  return (
    <tr
      ref={ref}
      className={cn(baseClasses, variantClasses[variant], className)}
      {...props}
    />
  )
})
TableRow.displayName = "TableRow"

const TableHead = forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & {
    variant?: "default" | "desktop"
  }
>(({ className, variant = "default", ...props }, ref) => {
  const baseClasses = "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0"
  
  const variantClasses = {
    default: baseClasses,
    desktop: "lg:px-6 lg:py-3 lg:text-left lg:text-xs lg:font-medium lg:text-gray-500 lg:uppercase lg:tracking-wider lg:bg-gray-50 lg:border-b lg:border-gray-200"
  }
  
  return (
    <th
      ref={ref}
      className={cn(baseClasses, variantClasses[variant], className)}
      {...props}
    />
  )
})
TableHead.displayName = "TableHead"

const TableCell = forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement> & {
    variant?: "default" | "desktop"
  }
>(({ className, variant = "default", ...props }, ref) => {
  const baseClasses = "p-4 align-middle [&:has([role=checkbox])]:pr-0"
  
  const variantClasses = {
    default: baseClasses,
    desktop: "lg:px-6 lg:py-4 lg:text-sm lg:text-gray-900"
  }
  
  return (
    <td
      ref={ref}
      className={cn(baseClasses, variantClasses[variant], className)}
      {...props}
    />
  )
})
TableCell.displayName = "TableCell"

const TableCaption = forwardRef<
  HTMLTableCaptionElement,
  HTMLAttributes<HTMLTableCaptionElement> & {
    variant?: "default" | "desktop"
  }
>(({ className, variant = "default", ...props }, ref) => {
  const baseClasses = "mt-4 text-sm text-muted-foreground"
  
  const variantClasses = {
    default: baseClasses,
    desktop: "lg:text-gray-600 lg:text-center lg:py-4"
  }
  
  return (
    <caption
      ref={ref}
      className={cn(baseClasses, variantClasses[variant], className)}
      {...props}
    />
  )
})
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
