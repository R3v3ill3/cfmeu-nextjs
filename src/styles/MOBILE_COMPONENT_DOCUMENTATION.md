# Mobile-First Design System Documentation

## Overview

This document provides comprehensive guidance for implementing mobile-optimized components and patterns in the CFMEU Organiser application. The mobile-first design system ensures consistent, accessible, and performant user experiences across all devices, with particular focus on touch interactions and mobile usability.

## Table of Contents

1. [Design Tokens](#design-tokens)
2. [Core Components](#core-components)
3. [Data Display Patterns](#data-display-patterns)
4. [Navigation Patterns](#navigation-patterns)
5. [Mobile Gestures](#mobile-gestures)
6. [Performance Guidelines](#performance-guidelines)
7. [Accessibility Guidelines](#accessibility-guidelines)
8. [Implementation Examples](#implementation-examples)

---

## Design Tokens

### Spacing

Mobile spacing uses a 4px base unit with touch-friendly minimums:

```typescript
import { mobileSpacing } from '@/styles/mobile-design-tokens'

// Base spacing (4px increments)
mobileSpacing.xs  // '4px'   // Minimum spacing
mobileSpacing.sm  // '8px'   // Standard spacing
mobileSpacing.md  // '16px'  // Section spacing
mobileSpacing.lg  // '24px'  // Large spacing
mobileSpacing.xl  // '32px'  // Extra large spacing

// Touch-specific
mobileSpacing.touchMin       // '44px' // Minimum touch target
mobileSpacing.touchComfortable // '48px' // Comfortable touch target

// Safe areas for modern phones
mobileSpacing.safeArea.top    // 'env(safe-area-inset-top, 0)'
mobileSpacing.safeArea.bottom // 'env(safe-area-inset-bottom, 0)'
```

### Typography

Mobile-optimized font sizes for readability:

```typescript
import { mobileTypography } from '@/styles/mobile-design-tokens'

// Minimum readable size is 16px (base)
mobileTypography.fontSize.base  // '1rem' (16px) - minimum body text
mobileTypography.fontSize.sm    // '0.875rem' (14px)
mobileTypography.fontSize.lg    // '1.125rem' (18px)
mobileTypography.fontSize.xl    // '1.25rem' (20px)

// Line heights optimized for mobile reading
mobileTypography.lineHeight.normal // '1.5' - better readability
```

### Colors

High contrast colors optimized for outdoor visibility:

```typescript
import { mobileColors } from '@/styles/mobile-design-tokens'

// Enhanced contrast
mobileColors.text.primary   // '#000000' - Pure black for max contrast
mobileColors.text.secondary // '#374151' - Dark gray

// Mobile-optimized backgrounds
mobileColors.background.primary   // '#ffffff'
mobileColors.background.secondary // '#f9fafb'
```

---

## Core Components

### MobileCard

The foundation for mobile-optimized cards with touch interactions.

```typescript
import { MobileCard } from '@/components/ui/MobileCard'

<MobileCard
  clickable
  onPress={() => navigate('/details')}
  swipeActions={{
    left: [{ icon: <Phone />, label: 'Call', onPress: handleCall }],
    right: [{ icon: <Mail />, label: 'Email', onPress: handleEmail }]
  }}
  size="md"
  className="border-l-4 border-l-blue-500"
>
  <h3 className="font-semibold text-gray-900">Card Title</h3>
  <p className="text-sm text-gray-600">Card description</p>
</MobileCard>
```

**Props:**

- `clickable`: Enable touch interactions
- `onPress`: Callback for card press
- `swipeActions`: Left/right swipe actions
- `size`: 'sm' | 'md' | 'lg'
- `variant`: Visual style variant
- `loading`: Show loading state
- `disabled`: Disable interactions

**Best Practices:**

- Use minimum 44px touch targets
- Provide visual feedback on touch
- Include swipe actions for common tasks
- Use semantic colors and borders
- Keep content scannable with clear hierarchy

### SwipeActions

Touch-optimized swipe gesture component for mobile actions.

```typescript
import { SwipeActions } from '@/components/ui/SwipeActions'

<SwipeActions
  leftActions={[
    { icon: <Phone />, label: 'Call', color: 'success', onPress: handleCall }
  ]}
  rightActions={[
    { icon: <Mail />, label: 'Email', color: 'primary', onPress: handleEmail },
    { icon: <Edit />, label: 'Edit', color: 'secondary', onPress: handleEdit }
  ]}
>
  <div>Card content here</div>
</SwipeActions>
```

**Action Colors:**

- `primary`: Blue, for primary actions
- `secondary`: Gray, for secondary actions
- `success`: Green, for positive actions
- `warning`: Orange, for cautionary actions
- `error`: Red, for destructive actions

### SkeletonLoader

Mobile-optimized loading states with smooth animations.

```typescript
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'

// Basic skeleton
<SkeletonLoader lines={3} />

// Mobile-specific variants
<MobileSkeletonCard variant="compact" />
<MobileSkeletonCard variant="detailed" />

// Grid skeleton
<SkeletonGrid items={6} columns={3} />
```

---

## Data Display Patterns

### MobileTable

Responsive table that transforms to cards on mobile.

```typescript
import { MobileTable } from '@/components/ui/MobileTable'

const columns = [
  {
    key: 'name',
    title: 'Name',
    mobile: { priority: 'high' },
    render: (value) => <strong>{value}</strong>
  },
  {
    key: 'email',
    title: 'Email',
    mobile: { priority: 'medium' }
  },
  {
    key: 'phone',
    title: 'Phone',
    mobile: { priority: 'low' }
  }
]

<MobileTable
  data={users}
  columns={columns}
  variant="table" // Auto-switches to cards on mobile
  searchable
  selectable
  onRowClick={handleRowClick}
/>
```

**Mobile Priority System:**

- `high`: Always visible in mobile card header
- `medium`: Visible in mobile card subtitle
- `low`: Visible in mobile card details section

### MobileList

Touch-optimized list component with swipe actions and selection.

```typescript
import { MobileList } from '@/components/ui/MobileList'

const items = [
  {
    id: 1,
    title: 'John Doe',
    subtitle: 'Site Manager',
    description: 'Responsible for project coordination',
    leftElement: <Avatar />,
    rightElement: <ChevronRight />,
    actions: [
      { icon: <Phone />, label: 'Call', onPress: handleCall },
      { icon: <Mail />, label: 'Email', onPress: handleEmail }
    ]
  }
]

<MobileList
  items={items}
  variant="default"
  selectable
  multiselect
  searchable
  pullToRefresh
  onRefresh={handleRefresh}
/>
```

**List Variants:**

- `default`: Standard list with 60px minimum height
- `compact`: Dense list for large datasets (44px height)
- `detailed`: Rich list with expanded content (72px height)

### MobileGrid

Responsive grid with adaptive layouts for different screen sizes.

```typescript
import { MobileGrid } from '@/components/ui/MobileGrid'

const items = [
  {
    id: 1,
    title: 'Project Alpha',
    subtitle: 'Commercial Construction',
    image: '/project-alpha.jpg',
    badge: <Badge>Tier 1</Badge>,
    aspectRatio: 'square'
  }
]

<MobileGrid
  items={items}
  columns={{ mobile: 2, tablet: 3, desktop: 4 }}
  searchable
  filterable
  viewMode="grid" // or "list"
  onViewModeChange={setViewMode}
/>
```

---

## Navigation Patterns

### Mobile Navigation

Enhanced Layout component with mobile-specific navigation:

```typescript
// Mobile features automatically enabled:
- Swipe from left edge to open navigation menu
- Back button for browser navigation
- Pull-to-refresh for content
- Search overlay
- Touch-optimized menu items (44px minimum height)
- Safe area support for modern iPhones
```

### Gesture Navigation

**Supported Gestures:**

1. **Swipe Right from Edge**: Open navigation drawer
2. **Swipe Left from Edge**: Close navigation drawer
3. **Pull Down**: Refresh content (when enabled)
4. **Tap**: Navigate/activate
5. **Long Press**: Select items (when selection enabled)

**Gesture Thresholds:**

- Minimum swipe distance: 50px
- Pull-to-refresh threshold: 80px
- Long press duration: 500ms

### Breadcrumb Navigation

Mobile-optimized breadcrumbs with touch targets:

```typescript
<Breadcrumb className="max-lg:hidden">
  <BreadcrumbItem>
    <BreadcrumbLink href="/">Home</BreadcrumbLink>
  </BreadcrumbItem>
  <BreadcrumbItem>
    <BreadcrumbLink href="/projects">Projects</BreadcrumbLink>
  </BreadcrumbItem>
  <BreadcrumbItem>
    <BreadcrumbPage>Current Page</BreadcrumbPage>
  </BreadcrumbItem>
</Breadcrumb>
```

---

## Mobile Gestures

### Touch Target Requirements

- **Minimum size**: 44x44px (Apple HIG)
- **Recommended**: 48x48px for better usability
- **Spacing**: Minimum 8px between touch targets

### Implemented Gestures

#### Swipe Actions

```typescript
// Left swipe actions (primary)
swipeActions: {
  left: [
    { icon: <Phone />, label: 'Call', color: 'success' },
    { icon: <Message />, label: 'Message', color: 'primary' }
  ]
}

// Right swipe actions (secondary)
swipeActions: {
  right: [
    { icon: <Edit />, label: 'Edit', color: 'secondary' },
    { icon: <Trash />, label: 'Delete', color: 'error' }
  ]
}
```

#### Pull-to-Refresh

```typescript
<MobileList
  pullToRefresh
  refreshing={isRefreshing}
  onRefresh={handleRefresh}
  // Visual indicator included automatically
/>
```

#### Selection Gestures

- **Tap**: Select single item
- **Long Press**: Enter selection mode
- **Multi-tap**: Select multiple items (when enabled)

### Haptic Feedback

Add tactile feedback for better user experience:

```typescript
// Light feedback for touch
if ('vibrate' in navigator) {
  navigator.vibrate(10) // Light vibration
}

// Stronger feedback for actions
if ('vibrate' in navigator) {
  navigator.vibrate(25) // Stronger vibration
}
```

---

## Performance Guidelines

### Rendering Optimization

1. **Virtual Scrolling**: For lists with 100+ items
2. **Image Lazy Loading**: Use `loading="lazy"` attribute
3. **Memoization**: Use React.memo for expensive components
4. **Debouncing**: For search and scroll events

### Animation Performance

1. **Hardware Acceleration**: Use `transform3d` and `translateZ`
2. **Reduced Motion**: Respect `prefers-reduced-motion`
3. **Duration Limits**: Keep animations under 300ms
4. **60 FPS**: Maintain smooth frame rates

```typescript
// Hardware acceleration example
const styles = {
  transform: 'translateZ(0)', // Force hardware acceleration
  willChange: 'transform', // Hint to browser
  backfaceVisibility: 'hidden' // Optimize for mobile
}
```

### Bundle Optimization

1. **Code Splitting**: Lazy load heavy components
2. **Tree Shaking**: Remove unused code
3. **Image Optimization**: WebP format with fallbacks
4. **Font Loading**: Optimize font loading strategy

---

## Accessibility Guidelines

### Mobile Accessibility

1. **Touch Targets**: Minimum 44px, recommended 48px
2. **Contrast Ratio**: Minimum 4.5:1 for normal text
3. **Focus Indicators**: Visible focus for keyboard navigation
4. **Screen Reader Support**: Proper ARIA labels and roles

### Screen Reader Support

```typescript
// Accessible card example
<MobileCard
  role="button"
  tabIndex={0}
  aria-label={`View details for ${employer.name}`}
  aria-busy={loading}
  onPress={handleClick}
>
  {/* Card content */}
</MobileCard>
```

### Voice Control

- Ensure all interactive elements have accessible names
- Provide visible labels for form controls
- Use semantic HTML elements
- Test with VoiceOver and TalkBack

---

## Implementation Examples

### Enhanced Employer Card

```typescript
<EmployerCard
  employer={employer}
  onClick={() => navigate(`/employers/${employer.id}`)}
  variant="mobile" // Use mobile-optimized version
/>
```

### Mobile Project List

```typescript
<MobileGrid
  items={projects.map(project => ({
    id: project.id,
    title: project.name,
    subtitle: project.builderName,
    image: project.imageUrl,
    badge: <ProjectTierBadge tier={project.tier} />,
    aspectRatio: 'portrait'
  }))}
  columns={{ mobile: 2, tablet: 3, desktop: 4 }}
  searchable
  filterable
  viewMode={viewMode}
  onViewModeChange={setViewMode}
/>
```

### Mobile Data Table

```typescript
<MobileTable
  data={workers}
  columns={[
    {
      key: 'name',
      title: 'Name',
      mobile: { priority: 'high' },
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <Avatar src={row.avatar} size="sm" />
          <span>{value}</span>
        </div>
      )
    },
    {
      key: 'trade',
      title: 'Trade',
      mobile: { priority: 'medium' }
    },
    {
      key: 'status',
      title: 'Status',
      mobile: { priority: 'low' },
      render: (value) => <Badge variant={value === 'Active' ? 'success' : 'secondary'}>{value}</Badge>
    }
  ]}
  searchable
  sortable
  pagination={{
    page,
    pageSize: 20,
    total: totalCount,
    onPageChange: setPage
  }}
/>
```

### Mobile Navigation Menu

```typescript
// The enhanced Layout component automatically provides:
- Swipe gestures for menu open/close
- Touch-optimized menu items (44px height)
- Safe area support for notched displays
- Mobile-specific navigation item filtering
- Back button support
- Pull-to-refresh functionality

// Usage:
<Layout>
  <YourPageContent onRefresh={handleRefresh} />
</Layout>
```

---

## Testing Guidelines

### Mobile Testing Checklist

- [ ] Touch targets are at least 44x44px
- [ ] Swipe gestures work smoothly
- [ ] Pull-to-refresh functions correctly
- [ ] Content is readable at arm's length
- [ ] High contrast mode works
- [ ] Screen reader navigation works
- [ ] Performance is smooth (60 FPS)
- [ ] Safe areas are respected on notched devices
- [ ] Landscape orientation works
- [ ] Keyboard navigation is possible

### Device Testing

Test on representative devices:

1. **Small Phone**: iPhone SE (375x667)
2. **Standard Phone**: iPhone 12 (390x844)
3. **Large Phone**: iPhone Pro Max (428x926)
4. **Tablet**: iPad Air (820x1180)
5. **Android**: Various screen sizes and densities

---

## Best Practices Summary

### Design Principles

1. **Mobile First**: Design for mobile, enhance for desktop
2. **Touch First**: Prioritize touch interactions over mouse
3. **Progressive Enhancement**: Layer functionality
4. **Performance First**: Optimize for mobile networks
5. **Accessibility First**: Design for all users

### Implementation Patterns

1. **Use Mobile Components**: Prefer mobile-optimized components
2. **Responsive Design**: Use mobile breakpoints properly
3. **Gesture Support**: Implement standard mobile gestures
4. **Loading States**: Show appropriate loading indicators
5. **Error Handling**: Provide clear error messages and recovery

### Content Guidelines

1. **Progressive Disclosure**: Show information in layers
2. **Clear Hierarchy**: Use typography and spacing effectively
3. **Consistent Language**: Use familiar terminology
4. **Action Labels**: Be specific and action-oriented
5. **Feedback**: Provide immediate visual/tactile feedback

---

## Support and Maintenance

### Regular Reviews

- Quarterly mobile UX audit
- Monthly performance monitoring
- Device testing on new releases
- User feedback collection and analysis

### Updates and Improvements

- Monitor mobile usage patterns
- Test on new device releases
- Update component library based on feedback
- Maintain documentation accuracy

This documentation should be updated regularly to reflect changes in mobile best practices, device capabilities, and user feedback.