# Desktop Design System - CFMEU Next.js App

## Overview

This document describes the enhanced desktop design system implemented for the CFMEU Next.js application. The system provides a Salesforce-inspired desktop experience while preserving all existing mobile functionality and Apple-inspired design principles.

## Key Principles

### 1. **Dual Design Systems**
- **Mobile**: Preserves existing Apple-inspired design with dark themes and mobile-optimized layouts
- **Desktop**: New Salesforce-inspired design with light themes, enhanced visual hierarchy, and efficient use of widescreen space

### 2. **Responsive Breakpoints**
- **Mobile/Tablet**: `< 1024px` - Uses original Layout.tsx
- **Desktop**: `≥ 1024px` - Uses enhanced DesktopLayout.tsx

### 3. **Preserved Functionality**
- All database interactions remain unchanged
- All API calls and backend logic preserved
- Feature set completely maintained
- Only visual presentation and layout optimized for desktop

## Architecture

### Device Detection
```typescript
// Server-side user agent detection in app/(app)/layout.tsx
const isMobile = isMobileOrTablet(userAgent)
return (
  <AuthProvider>
    {isMobile ? <Layout>{children}</Layout> : <DesktopLayout>{children}</DesktopLayout>}
  </AuthProvider>
)
```

### CSS Variables System
```css
/* Desktop-specific design tokens */
@media (min-width: 1024px) {
  :root {
    --desktop-background: #f8fafc;
    --desktop-foreground: #1e293b;
    --desktop-card-background: #ffffff;
    /* ... more tokens */
  }
}
```

## Design System Components

### 1. **Desktop Layout (`DesktopLayout.tsx`)**
- **Enhanced Sidebar**: Better visual hierarchy with descriptions and improved spacing
- **Professional Header**: Clean, Salesforce-inspired top navigation
- **Improved Navigation**: Role-based navigation with enhanced visual feedback

#### Key Features:
- Collapsible sidebar with icon-only mode
- Enhanced navigation items with descriptions
- Professional color scheme (light backgrounds, dark text)
- Better use of screen real estate

### 2. **Enhanced UI Components**

#### Card Component
```typescript
// New desktop variants
<Card variant="desktop-elevated">
  <CardHeader variant="desktop">
    <CardTitle variant="desktop-large">Title</CardTitle>
  </CardHeader>
  <CardContent variant="desktop-compact">
    Content
  </CardContent>
</Card>
```

**Variants:**
- `default`: Original mobile styling
- `desktop`: Basic desktop styling
- `desktop-elevated`: Enhanced shadows and hover effects
- `desktop-interactive`: Interactive hover states

#### Button Component
```typescript
// Desktop-specific button variants
<Button variant="desktop-primary" size="desktop-lg">
  Action Button
</Button>
```

**Desktop Variants:**
- `desktop-primary`: Blue primary buttons
- `desktop-secondary`: Gray secondary buttons
- `desktop-outline`: Clean outline buttons
- `desktop-ghost`: Subtle ghost buttons

#### Table Component
```typescript
// Enhanced table with desktop styling
<Table variant="desktop-elevated">
  <TableHeader variant="desktop">
    <TableHead variant="desktop">Header</TableHead>
  </TableHeader>
  <TableBody variant="desktop">
    <TableRow variant="desktop-hover">
      <TableCell variant="desktop">Data</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

**Features:**
- Enhanced borders and shadows
- Better spacing and typography
- Hover effects for rows
- Professional color scheme

### 3. **Design Tokens**

#### Colors
```typescript
import { desktopColors } from '@/lib/desktop-design-system'

// Usage
<div style={{ backgroundColor: desktopColors.background }}>
  Content
</div>
```

**Available Colors:**
- `background`: Light gray background
- `foreground`: Dark text
- `card`: White card backgrounds
- `border`: Subtle borders
- `accent`: Light accent colors
- `primary`: Blue primary colors
- `secondary`: Gray secondary colors

#### Spacing
```typescript
import { desktopSpacing } from '@/lib/desktop-design-system'

// Usage
<div style={{ padding: desktopSpacing.lg }}>
  Content
</div>
```

**Available Spacing:**
- `xs`: 0.5rem
- `sm`: 0.75rem
- `md`: 1rem
- `lg`: 1.5rem
- `xl`: 2rem
- `2xl`: 3rem

#### Typography
```typescript
import { desktopTypography } from '@/lib/desktop-design-system'

// Usage
<h1 style={{ fontSize: desktopTypography['3xl'] }}>
  Large Heading
</h1>
```

**Available Typography:**
- `xs`: 0.75rem
- `sm`: 0.875rem
- `base`: 1rem
- `lg`: 1.125rem
- `xl`: 1.25rem
- `2xl`: 1.5rem
- `3xl`: 1.875rem

## Implementation Examples

### 1. **Dashboard Page Enhancement**
The dashboard page demonstrates the new desktop design system:

```typescript
// Enhanced KPI cards with desktop styling
<Card className="lg:bg-white lg:border-gray-200 lg:shadow-sm hover:shadow-md transition-shadow duration-200">
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
    <CardTitle className="text-sm font-medium text-gray-700 lg:text-base">
      Total Workers
    </CardTitle>
    <div className="p-2 bg-blue-50 rounded-lg">
      <Users className="h-4 w-4 text-blue-600" />
    </div>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold text-gray-900 lg:text-3xl">
      {data?.totalWorkers || 0}
    </div>
    {/* Enhanced content with progress indicators */}
  </CardContent>
</Card>
```

### 2. **Responsive Layout Patterns**
```typescript
// Desktop-optimized grid layouts
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
  {/* Cards automatically adapt to screen size */}
</div>

// Enhanced spacing for desktop
<div className="space-y-6 lg:space-y-8">
  {/* Increased spacing on larger screens */}
</div>
```

### 3. **Component Variants**
```typescript
// Using desktop-specific component variants
<Badge variant="desktop-success" size="desktop-sm">
  Success
</Badge>

<Input variant="desktop" placeholder="Enter text..." />

<Button variant="desktop-primary" size="desktop-md">
  Submit
</Button>
```

## Utility Functions

### 1. **Desktop Class Helper**
```typescript
import { desktopClass } from '@/lib/desktop-design-system'

// Apply desktop-specific classes
const className = desktopClass('base-class', 'lg:desktop-class')
// Result: "base-class lg:desktop-class"
```

### 2. **Responsive Layout Creator**
```typescript
import { createDesktopLayout } from '@/lib/desktop-design-system'

// Create responsive layouts
const layoutClasses = createDesktopLayout('mobile-classes', 'desktop-classes')
// Result: "mobile-classes lg:desktop-classes"
```

### 3. **Conditional Styling**
```typescript
import { getDesktopStyles } from '@/lib/desktop-design-system'

// Apply styles conditionally
const styles = getDesktopStyles(isDesktop, 'desktop-styles', 'mobile-styles')
```

## Best Practices

### 1. **Mobile-First Development**
- Always start with mobile styles
- Use `lg:` prefix for desktop enhancements
- Ensure mobile experience remains optimal

### 2. **Component Variants**
- Use existing component variants when possible
- Create new variants only when necessary
- Maintain consistency across the design system

### 3. **Responsive Design**
- Use CSS Grid and Flexbox for layouts
- Implement proper breakpoints
- Test on various screen sizes

### 4. **Performance**
- Desktop styles only load on larger screens
- CSS variables provide efficient theming
- Minimal JavaScript overhead

## Migration Guide

### 1. **Existing Components**
Existing components automatically work with the new system. To enhance them:

```typescript
// Before
<Card>
  <CardHeader>Title</CardHeader>
  <CardContent>Content</CardContent>
</Card>

// After (with desktop enhancements)
<Card variant="desktop-elevated">
  <CardHeader variant="desktop">Title</CardHeader>
  <CardContent variant="desktop">Content</CardContent>
</Card>
```

### 2. **New Pages**
For new pages, use the desktop design system from the start:

```typescript
// Import design system utilities
import { desktopDesignSystem } from '@/lib/desktop-design-system'

// Use desktop-optimized layouts
<div className="lg:bg-white lg:border lg:border-gray-200 lg:rounded-lg lg:p-6 lg:shadow-sm">
  <h1 className="text-3xl font-bold text-gray-900 lg:text-4xl">
    Page Title
  </h1>
  {/* Content */}
</div>
```

### 3. **Testing**
- Test on mobile devices to ensure mobile experience is preserved
- Test on desktop to verify new design system
- Use browser dev tools to test responsive breakpoints

## Accessibility

### 1. **Color Contrast**
- Desktop colors meet WCAG AA standards
- Proper contrast ratios maintained
- Color-blind friendly palette

### 2. **Typography**
- Readable font sizes on all devices
- Proper line heights for readability
- Consistent font hierarchy

### 3. **Interactive Elements**
- Clear hover and focus states
- Proper keyboard navigation
- Screen reader compatibility

## Future Enhancements

### 1. **Additional Components**
- Enhanced form components
- Advanced data visualization
- Improved navigation patterns

### 2. **Theme System**
- User preference themes
- Dark mode for desktop
- Customizable color schemes

### 3. **Performance Optimizations**
- CSS-in-JS solutions
- Dynamic imports for desktop components
- Optimized bundle splitting

## Conclusion

The desktop design system provides a professional, Salesforce-inspired experience while maintaining the existing mobile functionality. The system is built on solid foundations of responsive design, component variants, and design tokens, making it easy to maintain and extend.

Key benefits:
- **Enhanced User Experience**: Better readability and visual hierarchy on desktop
- **Efficient Development**: Reusable components and design tokens
- **Maintained Compatibility**: All existing functionality preserved
- **Scalable Architecture**: Easy to extend and maintain

For questions or contributions to the design system, refer to the component documentation and utility functions provided in the codebase.
