# CFMEU Next.js - Mobile Optimization Action Plan

**Priority Implementation Guide**
**Created:** October 26, 2025
**Timeline:** 12-Week Implementation Plan
**Target Completion:** January 19, 2026

---

## Executive Summary

This action plan provides a prioritized, week-by-week implementation roadmap for addressing all critical mobile optimization issues identified in the comprehensive mobile audit. The plan focuses on immediate business impact while establishing a foundation for long-term mobile excellence.

**Primary Objectives:**
1. Unblock critical business workflows within 2 weeks
2. Achieve full mobile accessibility compliance within 4 weeks
3. Establish mobile-first development practices within 8 weeks
4. Complete advanced mobile optimization within 12 weeks

---

## Phase 1: Critical Business Workflow Restoration (Weeks 1-2)

### Week 1: Touch Target & Form Compliance (October 28 - November 3)

#### Day 1-2: Critical Input Component Updates
**Priority:** 🚨 CRITICAL
**Owner:** Frontend Developer
**Files:** `/src/components/ui/input.tsx`, `/src/app/(auth)/auth/page.tsx`

**Implementation Tasks:**

**1. Update Base Input Component**
```tsx
// File: /src/components/ui/input.tsx
import React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "desktop" | "desktop-large" | "mobile"
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = "default", ...props }, ref) => {
    // Mobile input mode mapping for proper keyboards
    const inputModeMap = {
      email: 'email',
      tel: 'tel',
      number: 'numeric',
      url: 'url',
      search: 'search'
    }

    // Auto-complete mapping for better UX
    const autoCompleteMap = {
      email: 'email',
      password: 'current-password',
      tel: 'tel',
      url: 'url'
    }

    // Mobile-optimized base classes
    const baseClasses = "flex min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"

    return (
      <input
        type={type}
        inputMode={inputModeMap[type as keyof typeof inputModeMap]}
        autoComplete={autoCompleteMap[type as keyof typeof autoCompleteMap]}
        className={cn(baseClasses, className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
```

**2. Update Authentication Form**
```tsx
// File: /src/app/(auth)/auth/page.tsx
export default function AuthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 mobile-safe-area">
      <form onSubmit={handleSignIn} className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Sign in to CFMEU</h1>
          <p className="text-sm text-gray-600 mt-2">Access your projects and compliance data</p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your work email"
              autoComplete="email"
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              className="mt-1"
            />
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          className="w-full h-12 min-h-[48px] text-base font-medium"
          disabled={loading}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Need help? Contact your site administrator
          </p>
        </div>
      </form>
    </div>
  )
}
```

#### Day 3-4: Mobile Form Field Components
**Create standardized mobile form field component**

```tsx
// File: /src/components/ui/form-field.tsx
"use client"

import { Label } from './label'
import { Input } from './input'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  id: string
  label: string
  error?: string
  required?: boolean
  description?: string
  children: React.ReactNode
}

export function FormField({
  id,
  label,
  error,
  required,
  description,
  children
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor={id}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
        {required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
      </Label>
      {children}
      {description && (
        <p className="text-sm text-gray-600" id={`${id}-description`}>
          {description}
        </p>
      )}
      {error && (
        <p
          className="text-sm text-red-600 font-medium"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  )
}
```

#### Day 5: Touch Target Validation Testing
**Implement automated touch target testing**

```tsx
// File: /tests/mobile/helpers/touch-target-validator.ts
export class TouchTargetValidator {
  static async validateTouchTargets(page: Page) {
    const interactiveElements = page.locator('input, button, select, textarea, [role="button"], a');
    const count = await interactiveElements.count();

    const violations = [];
    const passed = [];

    for (let i = 0; i < count; i++) {
      const element = interactiveElements.nth(i);
      const isVisible = await element.isVisible();

      if (isVisible) {
        const box = await element.boundingBox();

        if (box) {
          const isValid = box.height >= 44 && box.width >= 44;
          const elementInfo = {
            element: await element.getAttribute('data-testid') || `element-${i}`,
            size: { width: box.width, height: box.height },
            selector: await element.locator('..').locator(element).toString()
          };

          if (isValid) {
            passed.push(elementInfo);
          } else {
            violations.push({
              ...elementInfo,
              minimum: { width: 44, height: 44 },
              deficit: {
                width: Math.max(0, 44 - box.width),
                height: Math.max(0, 44 - box.height)
              }
            });
          }
        }
      }
    }

    return {
      total: count,
      passed: passed.length,
      violations: violations.length,
      compliance: ((passed.length / count) * 100).toFixed(1),
      details: { violations, passed }
    };
  }
}
```

**Week 1 Success Criteria:**
- ✅ All form inputs meet 44×44px minimum
- ✅ Authentication form fully mobile optimized
- ✅ Input modes and autocomplete implemented
- ✅ Touch target validation tests passing

---

### Week 2: Scan Review Mobile Workflow (November 4-10)

#### Day 1-3: Mobile Scan Review Cards
**Priority:** 🚨 CRITICAL
**Owner:** Frontend Developer
**Files:** `/src/components/projects/mapping/scan-review/SubcontractorsReview.tsx`

**Implementation:**

```tsx
// File: /src/components/projects/mapping/scan-review/MobileSubcontractorCard.tsx
"use client"

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { Building2, MapPin, CheckCircle, AlertCircle } from 'lucide-react'

interface MobileSubcontractorCardProps {
  subcontractor: {
    id: string
    company: string
    trade: string
    stage: string
    eba: boolean
    confidence?: number
    address?: string
  }
  selected: boolean
  onSelectionChange: (id: string, selected: boolean) => void
  onMatch: (id: string) => void
  onSkip: (id: string) => void
}

export function MobileSubcontractorCard({
  subcontractor,
  selected,
  onSelectionChange,
  onMatch,
  onSkip
}: MobileSubcontractorCardProps) {
  const handleSwipeLeft = () => onSkip(subcontractor.id)
  const handleSwipeRight = () => onMatch(subcontractor.id)

  return (
    <Card className="mb-4 overflow-hidden shadow-sm border-0 bg-white">
      <CardContent className="p-4">
        {/* Header with selection and company info */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 pr-3 min-w-0">
            <h3 className="font-semibold text-lg text-gray-900 truncate mb-1">
              {subcontractor.company || 'Unknown Company'}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {subcontractor.trade}
              </Badge>
              <span className="text-gray-400">•</span>
              <span className="text-xs">{subcontractor.stage}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) =>
                onSelectionChange(subcontractor.id, checked as boolean)
              }
              className="w-6 h-6"
              aria-label={`Select ${subcontractor.company}`}
            />
          </div>
        </div>

        {/* EBA Status and Confidence */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              {subcontractor.eba ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-orange-600" />
              )}
              <span className="text-xs font-medium text-gray-700">EBA Status</span>
            </div>
            <span className={cn(
              "text-sm font-semibold",
              subcontractor.eba ? "text-green-700" : "text-orange-700"
            )}>
              {subcontractor.eba ? 'EBA Covered' : 'Non-EBA'}
            </span>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-medium text-gray-700 mb-1">Confidence</div>
            <div className="text-sm font-semibold text-gray-900">
              {subcontractor.confidence || 0}%
            </div>
          </div>
        </div>

        {/* Address if available */}
        {subcontractor.address && (
          <div className="flex items-start gap-2 mb-4 p-3 bg-blue-50 rounded-lg">
            <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-blue-800 line-clamp-2">
              {subcontractor.address}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => onMatch(subcontractor.id)}
            className="h-12 min-h-[48px] bg-green-600 hover:bg-green-700 text-white font-medium"
            size="default"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Match
          </Button>

          <Button
            onClick={() => onSkip(subcontractor.id)}
            variant="outline"
            className="h-12 min-h-[48px] border-gray-300 hover:bg-gray-50 font-medium"
            size="default"
          >
            Skip
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

#### Day 4-5: Update Scan Review Component
**Integrate mobile cards with responsive layout**

```tsx
// File: /src/components/projects/mapping/scan-review/SubcontractorsReview.tsx
"use client"

import { useState, useEffect } from 'react'
import { useMediaQuery } from '@/hooks/use-media-query'
import { MobileSubcontractorCard } from './MobileSubcontractorCard'
import { DesktopSubcontractorTable } from './DesktopSubcontractorTable'

export function SubcontractorsReview({
  extractedSubcontractors,
  selectedEmployers,
  handleSelectionChange,
  handleEmployerMatch
}) {
  const isMobile = useMediaQuery("(max-width: 768px)")
  const [isLoading, setIsLoading] = useState(false)

  const handleMatch = async (subcontractorId: string) => {
    setIsLoading(true)
    try {
      await handleEmployerMatch(subcontractorId)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Processing match...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-blue-900">Scan Review Progress</h3>
            <p className="text-sm text-blue-700">
              {selectedEmployers.length} of {extractedSubcontractors.length} subcontractors reviewed
            </p>
          </div>
          <div className="text-blue-600 font-semibold">
            {Math.round((selectedEmployers.length / extractedSubcontractors.length) * 100)}%
          </div>
        </div>
      </div>

      {/* Mobile View */}
      {isMobile && (
        <div className="space-y-3">
          {extractedSubcontractors.map((sub, index) => (
            <MobileSubcontractorCard
              key={sub.id || index}
              subcontractor={sub}
              selected={selectedEmployers.includes(sub.id || index.toString())}
              onSelectionChange={handleSelectionChange}
              onMatch={handleMatch}
              onSkip={() => {/* Skip logic */}}
            />
          ))}
        </div>
      )}

      {/* Desktop View */}
      {!isMobile && (
        <DesktopSubcontractorTable
          extractedSubcontractors={extractedSubcontractors}
          selectedEmployers={selectedEmployers}
          handleSelectionChange={handleSelectionChange}
          handleEmployerMatch={handleEmployerMatch}
        />
      )}
    </div>
  )
}
```

#### Day 6-7: Employer Match Dialog Mobile Optimization

```tsx
// File: /src/components/projects/mapping/scan-review/EmployerMatchDialog.tsx
"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, X, Check, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmployerMatchDialogProps {
  isOpen: boolean
  onClose: () => void
  onMatch: (employerId: string) => void
  companyName: string
  availableEmployers: Array<{
    id: string
    name: string
    abn: string
    address: string
    ebaStatus: boolean
  }>
}

export function EmployerMatchDialog({
  isOpen,
  onClose,
  onMatch,
  companyName,
  availableEmployers
}: EmployerMatchDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEmployer, setSelectedEmployer] = useState<string | null>(null)

  const filteredEmployers = availableEmployers.filter(emp =>
    searchQuery === '' ||
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.abn.includes(searchQuery)
  )

  const handleConfirmMatch = () => {
    if (selectedEmployer) {
      onMatch(selectedEmployer)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0 mx-4">
        {/* Sticky Header */}
        <div className="flex-shrink-0 bg-white border-b p-4">
          <DialogHeader className="pb-3">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Match Employer
            </DialogTitle>
            <p className="text-sm text-gray-600">
              Finding match for: <span className="font-medium text-gray-900">{companyName}</span>
            </p>
          </DialogHeader>

          {/* Search Input */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name or ABN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 min-h-[48px]"
              autoFocus
            />
          </div>
        </div>

        {/* Scrollable Employer List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-2">
            {filteredEmployers.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No employers found</p>
                <p className="text-sm text-gray-500 mt-1">
                  {searchQuery ? 'Try a different search term' : 'Check the company details and try again'}
                </p>
              </div>
            ) : (
              filteredEmployers.map((employer) => (
                <div
                  key={employer.id}
                  onClick={() => setSelectedEmployer(employer.id)}
                  className={cn(
                    "p-4 border rounded-lg cursor-pointer transition-all duration-200",
                    "hover:bg-gray-50 active:bg-gray-100",
                    selectedEmployer === employer.id
                      ? "bg-blue-50 border-blue-500 ring-2 ring-blue-500 ring-opacity-50"
                      : "bg-white border-gray-200"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-3 min-w-0">
                      <h4 className="font-semibold text-base text-gray-900 mb-1 truncate">
                        {employer.name}
                      </h4>

                      <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {employer.abn}
                        </span>
                        {employer.ebaStatus && (
                          <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                            EBA Active
                          </Badge>
                        )}
                      </div>

                      {employer.address && (
                        <p className="text-sm text-gray-500 line-clamp-2">
                          {employer.address}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center">
                      {selectedEmployer === employer.id && (
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sticky Footer Actions */}
        <div className="flex-shrink-0 bg-white border-t p-4 space-y-2">
          <Button
            onClick={handleConfirmMatch}
            disabled={!selectedEmployer || filteredEmployers.length === 0}
            className="w-full h-12 min-h-[48px] bg-blue-600 hover:bg-blue-700 text-white font-medium"
            size="default"
          >
            Confirm Match
          </Button>

          <Button
            variant="outline"
            onClick={onClose}
            className="w-full h-12 min-h-[48px] border-gray-300 hover:bg-gray-50 font-medium"
            size="default"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

**Week 2 Success Criteria:**
- ✅ Mobile scan review workflow fully functional
- ✅ Critical subcontractor matching process unblocked
- ✅ Employer match dialog optimized for mobile
- ✅ Bulk operations mobile interface implemented

---

## Phase 2: Enhanced Mobile UX (Weeks 3-6)

### Week 3-4: Responsive Modal Design System (November 11-24)

#### Modal Component Mobile Optimization
**Create mobile-first modal system**

```tsx
// File: /src/components/ui/mobile-dialog.tsx
"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const MobileDialog = DialogPrimitive.Root

const MobileDialogTrigger = DialogPrimitive.Trigger

const MobileDialogPortal = DialogPrimitive.Portal

const MobileDialogClose = DialogPrimitive.Close

const MobileDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
MobileDialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const MobileDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <MobileDialogPortal>
    <MobileDialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-0 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg md:w-full mx-4",
        "max-h-[90vh] flex flex-col",
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </MobileDialogPortal>
))
MobileDialogContent.displayName = DialogPrimitive.Content.displayName

const MobileDialogHeader = React.forwardRef<
  React.ElementRef<"div">,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left p-6 pb-4 flex-shrink-0",
      className
    )}
    {...props}
  />
))
MobileDialogHeader.displayName = "MobileDialogHeader"

const MobileDialogFooter = React.forwardRef<
  React.ElementRef<"div">,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-6 pt-0 gap-2 flex-shrink-0",
      className
    )}
    {...props}
  />
))
MobileDialogFooter.displayName = "MobileDialogFooter"

const MobileDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
MobileDialogTitle.displayName = DialogPrimitive.Title.displayName

const MobileDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
MobileDialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  MobileDialog,
  MobileDialogPortal,
  MobileDialogOverlay,
  MobileDialogClose,
  MobileDialogTrigger,
  MobileDialogContent,
  MobileDialogHeader,
  MobileDialogFooter,
  MobileDialogTitle,
  MobileDialogDescription,
}
```

### Week 5-6: Performance & Safe Area Implementation (November 25 - December 8)

#### Safe Area CSS Implementation
**Modern iPhone compatibility**

```css
/* File: /src/app/globals.css - Safe Area Implementation */

/* Base safe area support */
.mobile-safe-area {
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}

/* Enhanced safe area with fallbacks */
@supports (padding: max(0px)) {
  .mobile-safe-area {
    padding-top: max(env(safe-area-inset-top), 16px);
    padding-right: max(env(safe-area-inset-right), 16px);
    padding-bottom: max(env(safe-area-inset-bottom), 16px);
    padding-left: max(env(safe-area-inset-left), 16px);
  }
}

/* Modal safe area support */
.mobile-dialog-safe-area {
  padding-left: max(env(safe-area-inset-left), 16px);
  padding-right: max(env(safe-area-inset-right), 16px);
}

/* Dynamic Island awareness */
@supports (padding: max(0px)) {
  .dynamic-island-aware {
    /* Avoid content collision with Dynamic Island */
    padding-top: max(env(safe-area-inset-top), 54px);
  }
}

/* Landscape safe area handling */
@media screen and (orientation: landscape) {
  .landscape-safe-area {
    padding-top: max(env(safe-area-inset-top), 8px);
    padding-bottom: max(env(safe-area-inset-bottom), 8px);
  }
}

/* Status bar background for home indicator */
.home-indicator-aware {
  padding-bottom: max(env(safe-area-inset-bottom), 20px);
}
```

**Performance Optimization:**
```tsx
// File: /src/hooks/use-mobile-performance.ts
"use client"

import { useEffect, useState } from 'react'

export function useMobilePerformance() {
  const [performanceMetrics, setPerformanceMetrics] = useState({
    loadTime: 0,
    firstContentfulPaint: 0,
    domContentLoaded: 0,
    bundleSize: 0
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const measurePerformance = () => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0]

        setPerformanceMetrics({
          loadTime: navigation.loadEventEnd - navigation.loadEventStart,
          firstContentfulPaint: fcpEntry?.startTime || 0,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          bundleSize: (window.performance.getEntriesByType('resource') as PerformanceResourceTiming[])
            .filter(entry => entry.name.includes('.js') || entry.name.includes('.css'))
            .reduce((total, entry) => total + (entry.transferSize || 0), 0)
        })
      }

      // Measure after page load
      if (document.readyState === 'complete') {
        measurePerformance()
      } else {
        window.addEventListener('load', measurePerformance)
        return () => window.removeEventListener('load', measurePerformance)
      }
    }
  }, [])

  return performanceMetrics
}
```

**Weeks 3-6 Success Criteria:**
- ✅ All modal dialogs mobile-optimized
- ✅ Safe area CSS fully implemented
- ✅ Performance metrics under 2s load time
- ✅ Bundle size optimized for mobile
- ✅ iPhone Dynamic Island compatibility achieved

---

## Phase 3: Advanced Mobile Features (Weeks 7-12)

### Weeks 7-8: Swipe Gestures & Advanced Interactions (December 9-22)

#### Swipe Gesture Implementation
```tsx
// File: /src/hooks/use-swipe-gestures.ts
"use client"

import { useRef, useCallback } from 'react'

interface SwipeGestureOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  threshold?: number
  preventDefault?: boolean
}

export function useSwipeGestures(options: SwipeGestureOptions) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    preventDefault = true
  } = options

  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (preventDefault) {
      e.preventDefault()
    }
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    }
  }, [preventDefault])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (preventDefault) {
      e.preventDefault()
    }

    if (!touchStart.current) return

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY
    }

    const deltaX = touchEnd.x - touchStart.current.x
    const deltaY = touchEnd.y - touchStart.current.y

    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY)
    const isVerticalSwipe = Math.abs(deltaY) > Math.abs(deltaX)

    if (Math.abs(deltaX) > threshold && isHorizontalSwipe) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight()
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft()
      }
    }

    if (Math.abs(deltaY) > threshold && isVerticalSwipe) {
      if (deltaY > 0 && onSwipeDown) {
        onSwipeDown()
      } else if (deltaY < 0 && onSwipeUp) {
        onSwipeUp()
      }
    }

    touchStart.current = null
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold, preventDefault])

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd
  }
}
```

### Weeks 9-10: Pull-to-Refresh & Progressive Loading (December 23 - January 5)

#### Pull-to-Refresh Implementation
```tsx
// File: /src/components/ui/pull-to-refresh.tsx
"use client"

import { useState, useRef, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: React.ReactNode
  disabled?: boolean
  threshold?: number
}

export function PullToRefresh({
  onRefresh,
  children,
  disabled = false,
  threshold = 80
}: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const currentY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || refreshing) return

    // Only allow pull-to-refresh at top of scrollable content
    const container = containerRef.current
    if (container && container.scrollTop > 0) return

    startY.current = e.touches[0].clientY
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || refreshing) return

    currentY.current = e.touches[0].clientY
    const distance = currentY.current - startY.current

    if (distance > 0 && distance <= threshold * 2) {
      e.preventDefault()
      setPullDistance(distance)
      setPulling(distance >= threshold)
    }
  }

  const handleTouchEnd = async () => {
    if (pulling && !refreshing) {
      setRefreshing(true)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        setPulling(false)
        setPullDistance(0)
      }
    } else {
      setPulling(false)
      setPullDistance(0)
    }
  }

  const pullProgress = Math.min(pullDistance / threshold, 1)

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-auto", disabled && "pointer-events-none")}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 bg-blue-500 text-white flex items-center justify-center transition-all duration-200 ease-out z-10"
        style={{
          height: `${pullDistance}px`,
          opacity: pullProgress
        }}
      >
        <div className="flex items-center gap-2">
          <RefreshCw
            className={cn(
              "w-5 h-5",
              refreshing && "animate-spin",
              pulling && "rotate-180"
            )}
          />
          {refreshing ? (
            <span className="text-sm font-medium">Refreshing...</span>
          ) : pulling ? (
            <span className="text-sm font-medium">Release to refresh</span>
          ) : (
            <span className="text-sm font-medium opacity-70">Pull to refresh</span>
          )}
        </div>
      </div>

      {/* Content with offset for pull indicator */}
      <div style={{ transform: `translateY(${pullDistance}px)` }}>
        {children}
      </div>
    </div>
  )
}
```

### Weeks 11-12: PWA Features & Final Optimization (January 6-19)

#### Service Worker Implementation
```tsx
// File: /public/sw.js - Service Worker for Mobile PWA
const CACHE_NAME = 'cfmeu-mobile-v1'
const STATIC_ASSETS = [
  '/',
  '/auth',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
]

// Cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
  )
})

// Serve cached content when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request)
      })
  )
})

// Update cache when new version available
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
})
```

**Phase 3 Success Criteria:**
- ✅ Swipe gestures implemented for employer cards
- ✅ Pull-to-refresh functionality working
- ✅ PWA features enabled (service worker, manifest)
- ✅ Haptic feedback integration
- ✅ Offline functionality for critical features

---

## Implementation Checklist & Success Metrics

### Weekly Validation Checklist

**Week 1 Checklist:**
- [ ] All form inputs meet 44×44px minimum
- [ ] Authentication form mobile optimized
- [ ] Touch target validation tests passing
- [ ] Mobile input modes implemented
- [ ] Autocomplete attributes added

**Week 2 Checklist:**
- [ ] Scan review mobile cards implemented
- [ ] Employer matching dialog optimized
- [ ] Bulk operations mobile interface
- [ ] Responsive layout for scan review
- [ ] Progress indicators implemented

**Weeks 3-4 Checklist:**
- [ ] Modal system mobile optimized
- [ ] Safe area CSS implemented
- [ ] Dynamic Island compatibility
- [ ] Responsive design system established
- [ ] Touch feedback implemented

**Weeks 5-6 Checklist:**
- [ ] Performance metrics under 2 seconds
- [ ] Bundle size optimized
- [ ] Image lazy loading implemented
- [ ] Code splitting for mobile components
- [ ] Performance monitoring active

**Weeks 7-8 Checklist:**
- [ ] Swipe gestures implemented
- [ ] Mobile touch feedback enhanced
- [ ] Gesture-based navigation
- [ ] Haptic feedback integration
- [ ] Advanced mobile interactions

**Weeks 9-10 Checklist:**
- [ ] Pull-to-refresh implemented
- [ ] Progressive loading patterns
- [ ] Offline data handling
- [ ] Network condition awareness
- [ ] Error recovery mechanisms

**Weeks 11-12 Checklist:**
- [ ] PWA manifest configured
- [ ] Service worker implemented
- [ ] Offline functionality complete
- [ ] Advanced accessibility features
- [ ] Mobile analytics integration

### Success Metrics Tracking

**Technical Metrics Dashboard:**
```typescript
// File: /src/lib/mobile-metrics.ts
export const MOBILE_SUCCESS_METRICS = {
  // Performance
  PAGE_LOAD_TIME_TARGET: 2000, // 2 seconds
  FIRST_CONTENTFUL_PAINT_TARGET: 1000, // 1 second
  BUNDLE_SIZE_TARGET: 2000000, // 2MB

  // Touch Targets
  TOUCH_TARGET_MINIMUM: 44, // 44x44px
  TOUCH_TARGET_COMPLIANCE_TARGET: 100, // 100%

  // Accessibility
  ACCESSIBILITY_SCORE_TARGET: 95, // Lighthouse
  WCAG_COMPLIANCE_TARGET: 100, // 100%

  // Business Workflow
  SCAN_REVIEW_COMPLETION_TARGET: 95, // 95%
  FORM_COMPLETION_TIME_TARGET: 30, // 30 seconds
  USER_SATISFACTION_TARGET: 4.5, // 4.5/5

  // Technical Quality
  CRITICAL_ISSUES_TARGET: 0,
  MAJOR_ISSUES_TARGET: 5,
  MINOR_ISSUES_TARGET: 10,
  TEST_COVERAGE_TARGET: 90 // 90%
}
```

### Risk Mitigation Plan

**High Risk Items:**
1. **Business Process Disruption**
   - Mitigation: Feature flags for gradual rollout
   - Backup: Maintain desktop version during transition
   - Monitoring: Real-time error tracking

2. **Performance Regression**
   - Mitigation: Performance budgets and monitoring
   - Backup: Rollback procedures
   - Monitoring: Automated performance tests

3. **User Adoption**
   - Mitigation: User training and communication
   - Backup: Progressive enhancement approach
   - Monitoring: User feedback collection

**Medium Risk Items:**
1. **Technical Complexity**
   - Mitigation: Phased implementation approach
   - Backup: Component-level isolation
   - Monitoring: Code review and testing

2. **Device Compatibility**
   - Mitigation: Comprehensive device testing
   - Backup: Graceful degradation
   - Monitoring: Real device analytics

---

## Resource Allocation & Timeline

### Team Responsibilities

**Frontend Developer (Mobile Specialist) - 1.0 FTE:**
- Week 1-2: Critical touch target and form compliance
- Week 3-6: Modal optimization and safe area implementation
- Week 7-12: Advanced features and PWA integration

**UI/UX Designer (Mobile Focus) - 0.5 FTE:**
- Week 1-4: Mobile design system and component standards
- Week 5-8: Advanced interaction patterns
- Week 9-12: User testing and refinement

**QA Engineer (Mobile Testing) - 0.5 FTE:**
- Week 1-2: Critical functionality testing
- Week 3-6: Comprehensive mobile test suite
- Week 7-12: Advanced feature validation

**Backend Developer (API Optimization) - 0.25 FTE:**
- Week 3-6: Mobile API optimization
- Week 9-12: Offline sync and PWA features

### Budget Requirements

**Development Resources:**
- Personnel: ~$120,000 (12 weeks × team FTEs)
- Testing Devices: $5,000 (iPhone test devices)
- Tools & Software: $2,000 (monitoring, testing licenses)
- Total: **$127,000**

**Infrastructure Costs:**
- CI/CD Mobile Testing: $500/month
- Performance Monitoring: $300/month
- Mobile Analytics: $200/month
- Total: **$1,000/month**

### Critical Success Factors

1. **Executive Support:** Clear priority and resource allocation
2. **Technical Excellence:** Adherence to mobile-first standards
3. **User Focus:** Regular field worker feedback integration
4. **Performance Monitoring:** Continuous optimization based on metrics
5. **Risk Management:** Proactive identification and mitigation of issues

---

**Next Steps:**
1. Executive review and approval of action plan
2. Resource allocation confirmation
3. Week 1 implementation kickoff
4. Weekly progress review meetings
5. Success metrics dashboard setup

**Document Version:** 1.0
**Last Updated:** October 26, 2025
**Next Review:** Weekly implementation progress meetings