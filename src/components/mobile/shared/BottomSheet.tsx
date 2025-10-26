"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Drawer, DrawerContent, DrawerOverlay } from "@/components/ui/drawer"
import { X } from "lucide-react"

interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  className?: string
  showHandle?: boolean
  height?: "auto" | "half" | "full" | number
  disableDrag?: boolean
}

const BottomSheet = React.forwardRef<HTMLDivElement, BottomSheetProps>(
  ({ open, onOpenChange, children, className, showHandle = true, height = "auto", disableDrag = false, ...props }, ref) => {
    const getHeightClass = () => {
      if (typeof height === "number") {
        return `h-[${height}px]`
      }
      switch (height) {
        case "half":
          return "h-[50vh]"
        case "full":
          return "h-[90vh]"
        default:
          return "h-auto max-h-[85vh]"
      }
    }

    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={!disableDrag}>
        <DrawerOverlay className="bg-black/50 backdrop-blur-sm" />
        <DrawerContent
          ref={ref}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mt-24 flex flex-col rounded-t-2xl border bg-background shadow-2xl",
            getHeightClass(),
            !disableDrag && "touch-pan-y",
            className
          )}
          {...props}
        >
          {showHandle && (
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted-foreground/20" />
          )}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }
)
BottomSheet.displayName = "BottomSheet"

const BottomSheetHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    title?: string
    showCloseButton?: boolean
    onClose?: () => void
  }
>(({ className, title, showCloseButton = false, onClose, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between border-b bg-background px-4 py-3",
        className
      )}
      {...props}
    >
      {title && (
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      )}
      {!title && children}
      {showCloseButton && (
        <button
          onClick={onClose}
          className="rounded-full p-2 hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  )
})
BottomSheetHeader.displayName = "BottomSheetHeader"

const BottomSheetContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "flex-1 overflow-y-auto px-4 py-4",
        className
      )}
      {...props}
    />
  )
})
BottomSheetContent.displayName = "BottomSheetContent"

const BottomSheetFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "border-t bg-background px-4 py-3 mt-auto",
        className
      )}
      {...props}
    />
  )
})
BottomSheetFooter.displayName = "BottomSheetFooter"

export {
  BottomSheet,
  BottomSheetHeader,
  BottomSheetContent,
  BottomSheetFooter,
}