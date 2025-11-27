# Search Component Patterns & Best Practices

This document outlines the different search component patterns used in the CFMEU Next.js application and when to use each approach.

## Overview

The application uses multiple search component patterns, each optimized for different use cases. Understanding these patterns helps ensure consistent UX and appropriate component selection.

## Search Component Patterns

### 1. Popover-Based Search (`EmployerSearch`)

**Component:** `src/components/ui/EmployerSearch.tsx`

**Pattern:**
- Uses shadcn/ui `Popover` + `Command` components
- Search input inside popover content
- Results displayed in scrollable list within popover
- Fixed width based on trigger button width
- Sticky search input at top of popover

**Use When:**
- Inline selection within forms
- Limited screen space available
- Quick selection from predefined list
- Embedded in dialogs or modals

**Key Features:**
- Fixed popover dimensions prevent input movement/resizing
- Min-width: 300px, Max-width: 400px
- Max-height: 400px for popover, 300px for results list
- Sticky search input stays visible while scrolling results
- Maintains trigger button width for consistency

**Mobile Considerations:**
- Works well on mobile with fixed dimensions
- Popover adapts to trigger width (min 300px)
- Touch-friendly item heights
- Keyboard-friendly navigation

**Example Usage:**
```tsx
<EmployerSearch
  employers={employers}
  value={selectedId}
  onSelect={(id, name) => handleSelect(id, name)}
  placeholder="Search employers..."
/>
```

### 2. Sticky Header Search (`MobileEmployerSearch`)

**Component:** `src/components/search/MobileEmployerSearch.tsx`

**Pattern:**
- Fixed search input at top (sticky header)
- Results scroll independently below
- Full-width search bar
- Quick filters below search input
- Card-based or table-based results

**Use When:**
- Full-page search experiences
- Large result sets requiring scrolling
- Need for filters and advanced search
- Mobile-first interfaces

**Key Features:**
- Sticky search header never moves
- Independent scrolling for results
- Quick filter buttons
- Pull-to-refresh support
- Infinite scroll option

**Mobile Considerations:**
- Optimized for mobile touch interactions
- Large touch targets (44px minimum)
- Safe area insets support
- Optimized for one-handed use

### 3. Fixed Input Above List (`MobileEmployerSelection`)

**Component:** `src/components/mobile/assessments/MobileEmployerSelection.tsx`

**Pattern:**
- Fixed search input above scrollable list
- No popover or overlay
- Full-page pattern
- Simple, focused interface

**Use When:**
- Selection workflows
- Multi-select scenarios
- Assessment/audit flows
- Simple, focused interfaces

**Key Features:**
- Simple, predictable layout
- No overlays or popovers
- Full control over layout
- Easy to understand

**Mobile Considerations:**
- Excellent for mobile use
- No popover positioning issues
- Full screen real estate
- Clear visual hierarchy

### 4. URL-Based Search (`EmployersMobileView`)

**Component:** `src/components/employers/EmployersMobileView.tsx`

**Pattern:**
- Search input updates URL query parameters
- Server-side filtering via API
- Debounced search (300ms)
- Pagination support
- State persisted in URL

**Use When:**
- Server-side filtering required
- Large datasets
- Need for shareable/searchable URLs
- Pagination required

**Key Features:**
- URL state management
- Debounced API calls
- Server-side filtering
- Pagination support
- Shareable URLs

**Mobile Considerations:**
- Efficient for large datasets
- Reduces client-side processing
- Better performance on mobile
- URL-based state is shareable

### 5. Standalone Search Input (`MobileSearchInput`)

**Component:** `src/components/search/MobileSearchInput.tsx`

**Pattern:**
- Standalone search input component
- Suggestions panel below input
- Voice search support
- Search history
- Keyboard navigation

**Use When:**
- Need standalone search input
- Want suggestions/history
- Voice search required
- Custom search UI needed

**Key Features:**
- Voice search integration
- Search suggestions
- History support
- Keyboard navigation
- Accessible design

**Mobile Considerations:**
- Voice search optimized for mobile
- Large touch targets
- Keyboard-friendly
- Accessible

## Component Selection Guide

### Choose Popover-Based Search When:
- ✅ Selecting from a predefined list
- ✅ Inline form selection
- ✅ Limited screen space
- ✅ Quick selection needed
- ✅ Results are client-side filtered

### Choose Sticky Header Search When:
- ✅ Full-page search experience
- ✅ Need for filters
- ✅ Large result sets
- ✅ Mobile-first interface
- ✅ Advanced search features needed

### Choose Fixed Input Above List When:
- ✅ Simple selection workflow
- ✅ Multi-select needed
- ✅ Assessment/audit flows
- ✅ Want full control over layout
- ✅ No need for overlays

### Choose URL-Based Search When:
- ✅ Server-side filtering required
- ✅ Large datasets (1000+ items)
- ✅ Pagination needed
- ✅ Shareable URLs desired
- ✅ Performance is critical

### Choose Standalone Search Input When:
- ✅ Custom search UI needed
- ✅ Voice search required
- ✅ Suggestions/history needed
- ✅ Building custom search component
- ✅ Need maximum flexibility

## Mobile UX Best Practices

### 1. Fixed Dimensions
- **Always** use fixed or min/max width constraints on search containers
- Prevents input movement during typing
- Maintains visual stability

### 2. Sticky Search Inputs
- Keep search input visible while scrolling results
- Use `sticky` positioning for search inputs
- Ensures search is always accessible

### 3. Touch Targets
- Minimum 44px height for touch targets
- Adequate spacing between items
- Large, easy-to-tap buttons

### 4. Keyboard Handling
- Support keyboard navigation (arrow keys, enter, escape)
- Proper focus management
- Keyboard shortcuts where appropriate

### 5. Performance
- Debounce search input (300ms recommended)
- Limit result sets (100-200 items max)
- Use virtual scrolling for large lists
- Server-side filtering for 1000+ items

### 6. Accessibility
- Proper ARIA labels
- Keyboard navigation support
- Screen reader friendly
- Focus management

## Common Issues & Solutions

### Issue: Search Input Moves/Resizes During Typing
**Solution:** 
- Use fixed width constraints on popover/container
- Measure trigger width and apply to popover
- Use min-width and max-width constraints
- Make search input sticky within container

### Issue: Poor Mobile Experience
**Solution:**
- Use full-screen patterns on mobile
- Avoid popovers on small screens
- Use bottom sheets for mobile
- Ensure adequate touch targets

### Issue: Slow Performance with Large Lists
**Solution:**
- Implement server-side filtering
- Use pagination or infinite scroll
- Limit client-side results (100-200 max)
- Use virtual scrolling

### Issue: Inconsistent Search Behavior
**Solution:**
- Standardize on one pattern per use case
- Document component selection criteria
- Create reusable search components
- Follow established patterns

## Implementation Checklist

When implementing a new search component:

- [ ] Determine appropriate pattern based on use case
- [ ] Set fixed dimensions to prevent resizing
- [ ] Make search input sticky if results scroll
- [ ] Implement debouncing (300ms)
- [ ] Add keyboard navigation support
- [ ] Ensure touch targets are 44px minimum
- [ ] Test on actual mobile devices
- [ ] Verify accessibility (keyboard, screen readers)
- [ ] Document component usage
- [ ] Consider performance implications

## Recent Improvements

### EmployerSearch Component (2024)
- **Fixed:** Popover dimensions now stable (min 300px, max 400px)
- **Fixed:** Search input sticky at top of popover
- **Fixed:** Results list scrolls independently (max-height 300px)
- **Fixed:** Popover width matches trigger button width
- **Result:** No more input movement/resizing during typing

## References

- [Mobile Design Tokens](../src/styles/mobile-design-tokens.ts)
- [Mobile Optimization Hooks](../src/hooks/mobile/useMobileOptimizations.ts)
- [Component Documentation](../docs/)

