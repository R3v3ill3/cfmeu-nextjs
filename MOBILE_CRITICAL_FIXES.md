# Critical Mobile Fixes - Immediate Implementation Required

Based on comprehensive mobile testing, these are the most critical issues that need immediate attention.

## 🚨 Priority 1: Touch Target Compliance

### Issue: Email and Password Fields Too Small
**Current Size:** 358x42px (below 44px minimum)
**Impact:** Fails mobile accessibility guidelines

### Files to Fix:
1. `/src/app/(auth)/auth/page.tsx` - Authentication form
2. Any component using standard Input components

### Immediate Fix:
```tsx
// Create mobile-optimized input wrapper
// src/components/ui/mobile-input.tsx
import { Input } from "./input"
import { forwardRef } from "react"

export const MobileInput = forwardRef<HTMLInputElement, any>((props, ref) => (
  <Input
    ref={ref}
    className="h-12 min-h-[48px] w-full px-4" // 48px minimum height
    {...props}
  />
))

MobileInput.displayName = "MobileInput"
```

### Update Input Component:
```tsx
// src/components/ui/input.tsx - Add mobile default
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
```

## 🚨 Priority 2: Scan Review Table Responsiveness

### Issue: Tables Require Horizontal Scrolling on Mobile
**Impact:** Core business process unusable on mobile

### Fix: Mobile Card Layout for Scan Review
```tsx
// src/components/projects/mapping/scan-review/SubcontractorsReviewMobile.tsx
"use client"

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface MobileSubcontractorCardProps {
  subcontractor: any
  selected: boolean
  onSelectionChange: (id: string, selected: boolean) => void
  onMatch: (id: string) => void
}

export function MobileSubcontractorCard({
  subcontractor,
  selected,
  onSelectionChange,
  onMatch
}: MobileSubcontractorCardProps) {
  return (
    <Card className="mb-3 overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 pr-3">
            <h3 className="font-semibold text-lg mb-1">
              {subcontractor.company || 'Unknown Company'}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Badge variant="secondary">{subcontractor.trade}</Badge>
              <span>•</span>
              <span>{subcontractor.stage}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) =>
                onSelectionChange(subcontractor.id, checked as boolean)
              }
              className="w-6 h-6" // Larger touch target
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
          <div>
            <span className="text-gray-500">EBA Status:</span>
            <div className="mt-1">
              {subcontractor.eba ? (
                <Badge variant="default" className="text-xs">EBA Covered</Badge>
              ) : (
                <Badge variant="outline" className="text-xs">Non-EBA</Badge>
              )}
            </div>
          </div>
          <div>
            <span className="text-gray-500">Confidence:</span>
            <div className="mt-1 font-medium">
              {subcontractor.confidence || 0}%
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => onMatch(subcontractor.id)}
            className="flex-1 h-12 min-h-[48px]" // Minimum touch target
            size="default"
          >
            Match Employer
          </Button>
          <Button
            variant="outline"
            className="h-12 min-h-[48px] px-4"
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

### Update SubcontractorsReview Component:
```tsx
// Add responsive layout to SubcontractorsReview.tsx
import { MobileSubcontractorCard } from './SubcontractorsReviewMobile'

export function SubcontractorsReview({ ...props }) {
  const isMobile = useMediaQuery("(max-width: 768px)")

  return (
    <div className="space-y-4">
      {/* Mobile Card View */}
      {isMobile && (
        <div className="space-y-3">
          {extractedSubcontractors.map((sub, index) => (
            <MobileSubcontractorCard
              key={sub.id || index}
              subcontractor={sub}
              selected={selectedEmployers.includes(sub.id || index.toString())}
              onSelectionChange={handleSelectionChange}
              onMatch={handleEmployerMatch}
            />
          ))}
        </div>
      )}

      {/* Desktop Table View */}
      {!isMobile && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Select</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Trade</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>EBA Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Existing desktop table implementation */}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
```

## 🚨 Priority 3: Employer Matching Dialog Mobile Optimization

### Issue: Dialog Exceeds Viewport on Mobile
**Impact:** Can't complete employer matching workflow

### Fix: Mobile-Optimized Dialog
```tsx
// src/components/projects/mapping/scan-review/EmployerMatchDialogMobile.tsx
"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, X, Check } from 'lucide-react'

interface EmployerMatchDialogMobileProps {
  isOpen: boolean
  onClose: () => void
  onMatch: (employerId: string) => void
  companyName: string
}

export function EmployerMatchDialogMobile({
  isOpen,
  onClose,
  onMatch,
  companyName
}: EmployerMatchDialogMobileProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEmployer, setSelectedEmployer] = useState<string | null>(null)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-[95vw] max-h-[90vh] overflow-y-auto p-0"
        // Disable backdrop behavior for better mobile UX
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Header with search */}
        <div className="sticky top-0 bg-white z-10 p-4 border-b">
          <DialogHeader className="pb-3">
            <DialogTitle className="text-lg">Match Employer</DialogTitle>
            <p className="text-sm text-gray-600 mt-1">
              Finding match for: <strong>{companyName}</strong>
            </p>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search employers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 min-h-[48px]" // Minimum touch target
              autoFocus
            />
          </div>
        </div>

        {/* Employer List */}
        <div className="p-4 space-y-2 overflow-y-auto">
          {mockEmployers
            .filter(emp =>
              searchQuery === '' ||
              emp.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((employer) => (
              <div
                key={employer.id}
                onClick={() => setSelectedEmployer(employer.id)}
                className={cn(
                  "p-3 border rounded-lg cursor-pointer transition-colors",
                  "active:bg-gray-50 active:border-blue-500",
                  selectedEmployer === employer.id
                    ? "bg-blue-50 border-blue-500"
                    : "bg-white border-gray-200"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-3">
                    <h4 className="font-semibold text-base mb-1">
                      {employer.name}
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>{employer.abn}</span>
                      {employer.ebaStatus && (
                        <Badge variant="default" className="text-xs">
                          EBA Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {employer.address}
                    </p>
                  </div>
                  <div className="flex items-center">
                    {selectedEmployer === employer.id && (
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-white border-t p-4 space-y-2">
          <Button
            onClick={() => selectedEmployer && onMatch(selectedEmployer)}
            disabled={!selectedEmployer}
            className="w-full h-12 min-h-[48px]"
          >
            Confirm Match
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full h-12 min-h-[48px]"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

## 🚨 Priority 4: Form Accessibility Labels

### Issue: Missing Form Labels
**Impact:** Fails accessibility compliance

### Fix: Add Proper Labels to All Forms
```tsx
// src/components/ui/form-field.tsx
"use client"

import { Label } from './label'
import { Input } from './input'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  id: string
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}

export function FormField({ id, label, error, required, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
```

## Implementation Strategy

### Immediate Actions (This Week):
1. **Update Input Components** - Apply minimum height of 48px to all inputs
2. **Mobile-Optimized Auth Form** - Fix touch targets and add proper labels
3. **Mobile Scan Review Cards** - Implement card layout for subcontractors
4. **Dialog Optimization** - Update all dialogs for mobile responsiveness

### Next Sprint Actions:
1. **Swipe Gestures** - Add swipe actions for employer cards
2. **Bulk Operations Mobile** - Mobile-friendly bulk selection UI
3. **Performance Optimization** - Implement loading skeletons and progressive loading
4. **Testing Integration** - Add continuous mobile testing to CI/CD

### Success Metrics:
- **Touch Target Compliance:** 100% of interactive elements meet 44px minimum
- **Scan Review Success Rate:** 95%+ completion on mobile devices
- **Accessibility Score:** 95+ on Lighthouse accessibility audit
- **User Satisfaction:** Mobile user experience rating 4.5/5+

These fixes address the most critical mobile usability issues identified in testing and will significantly improve the mobile experience for CFMEU users.