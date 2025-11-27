# Context-Aware Help Implementation Guide

This guide provides comprehensive instructions for implementing the enhanced context-aware help features throughout the CFMEU NSW Construction Union Organising Database.

## Overview

The enhanced help system provides:
- **Contextual tooltips** for form fields and UI elements
- **Page-level help** with progressive disclosure
- **Mobile-first help** with offline support
- **Workflow guidance** for complex multi-step processes
- **Role-aware content** tailored to user permissions
- **Analytics tracking** for help usage and effectiveness

## Architecture

### Core Components

1. **`ContextualHelpTooltip`** - Rich tooltips with detailed content, examples, and related links
2. **`FormFieldHelp`** - Form field-specific help with inline and tooltip modes
3. **`ContextualHelpProvider`** - Context management and analytics
4. **`MobileContextualHelp`** - Mobile-optimized help interface
5. **`ContextualHelpConfig`** - Centralized help content configuration

### Integration Points

- Site Visit Wizard workflow
- Mobile ratings system with confidence scores
- GPS and map discovery features
- PWA installation prompts
- Delegate task management
- Offline sync indicators

## Implementation Steps

### 1. Add Context Provider

Wrap your application or specific routes with the `ContextualHelpProvider`:

```tsx
// src/app/layout.tsx or specific route layouts
import { ContextualHelpProvider } from '@/components/help/ContextualHelpProvider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ContextualHelpProvider>
          {children}
        </ContextualHelpProvider>
      </body>
    </html>
  )
}
```

### 2. Add Help to Form Fields

Use `FormFieldHelp` for individual form fields:

```tsx
import { FormFieldHelp, CommonFieldHelp } from '@/components/help/FormFieldHelp'

// Example: ABN field
<div className="space-y-2">
  <Label htmlFor="abn">Australian Business Number (ABN)</Label>
  <div className="flex items-center gap-2">
    <Input id="abn" placeholder="12345678901" />
    <CommonFieldHelp.ABN />
  </div>
</div>

// Example: Custom help configuration
<FormFieldHelp
  config={{
    id: 'custom-field-help',
    type: 'info',
    title: 'Special Field',
    content: 'This field requires special handling.',
    examples: ['Example 1', 'Example 2']
  }}
  fieldLabel="Special Field"
  position="above"
/>

// Example: Inline help text
<FormFieldHelp
  helpId="confidence-score"
  showInline
/>
```

### 3. Add Page-Level Help

Integrate `MobileContextualHelp` for mobile screens:

```tsx
// src/app/mobile/ratings/wizard/[employerId]/page.tsx
import { MobileContextualHelp } from '@/components/mobile/help/MobileContextualHelp'

export default function RatingWizardPage({ params }: PageProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Your page content */}

      {/* Contextual help button */}
      <MobileContextualHelp
        topic="ratings-wizard"
        workflowStep={2}
        totalWorkflowSteps={5}
      />
    </div>
  )
}
```

### 4. Add Desktop Help Launcher

Use the existing `HelpLauncher` for desktop interfaces:

```tsx
import { HelpLauncher } from '@/components/help/HelpLauncher'

function ComponentHeader() {
  return (
    <div className="flex items-center justify-between">
      <h1>Page Title</h1>
      <HelpLauncher />
    </div>
  )
}
```

## Feature-Specific Implementation

### Site Visit Wizard

```tsx
// src/components/siteVisitWizard/SiteVisitWizard.tsx
import { MobileContextualHelp } from '@/components/mobile/help/MobileContextualHelp'

export function SiteVisitWizard() {
  const [currentStep, setCurrentStep] = useState(0)
  const totalSteps = 6

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Wizard content */}

      {/* Contextual help with workflow progress */}
      <MobileContextualHelp
        topic="site-visit-wizard"
        workflowStep={currentStep + 1}
        totalWorkflowSteps={totalSteps}
      />
    </div>
  )
}
```

### Ratings System with Confidence Scores

```tsx
// src/components/mobile/rating-system/RatingForm.tsx
import { FormFieldHelp } from '@/components/help/FormFieldHelp'

export function RatingForm() {
  return (
    <form className="space-y-6">
      {/* Confidence Score Field */}
      <div className="space-y-2">
        <Label>Confidence Score</Label>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select confidence level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="very_high">Very High</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <FormFieldHelp
          helpId="rating-confidence-score"
          fieldLabel="Confidence Score"
          showInline
        />
      </div>

      {/* Sham Contracting Indicators */}
      <div className="space-y-2">
        <Label>Sham Contracting Indicators</Label>
        <CheckboxGroup>
          {/* Checkboxes for indicators */}
        </CheckboxGroup>
        <FormFieldHelp
          helpId="sham-contracting-detection"
          fieldLabel="Sham Contracting"
          variant="warning"
        />
      </div>
    </form>
  )
}
```

### GPS and Map Discovery

```tsx
// src/app/mobile/map/discovery/page.tsx
import { MobileContextualHelp } from '@/components/mobile/help/MobileContextualHelp'

export default function MobileProjectDiscoveryPage() {
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Location permission prompt */}
      {locationPermission === 'prompt' && (
        <div className="bg-blue-50 border-b border-blue-200 p-4">
          <div className="flex items-center gap-3">
            <FormFieldHelp
              helpId="gps-permission-request"
              fieldLabel="Location Services"
              showInline
            />
            <Button onClick={requestLocationPermission}>
              Enable Location
            </Button>
          </div>
        </div>
      )}

      {/* Map and discovery content */}

      {/* Contextual help */}
      <MobileContextualHelp topic="gps-location-features" />
    </div>
  )
}
```

### PWA Installation Prompt

```tsx
// src/components/pwa/IosInstallPrompt.tsx
import { FormFieldHelp } from '@/components/help/FormFieldHelp'

export function IosInstallPrompt() {
  return (
    <Card className="m-4">
      <CardContent className="p-4">
        <div className="space-y-3">
          <h3 className="font-semibold">Install CFMEU Mobile</h3>
          <FormFieldHelp
            helpId="pwa-installation"
            fieldLabel="App Installation"
            showInline
          />
          <Button className="w-full">
            Add to Home Screen
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

### Offline Sync Indicators

```tsx
// src/components/mobile/sync/SyncIndicator.tsx
import { FormFieldHelp } from '@/components/help/FormFieldHelp'

export function SyncIndicator({
  isOnline,
  pendingChanges
}: {
  isOnline: boolean;
  pendingChanges: number
}) {
  return (
    <div className="flex items-center gap-2 p-2">
      <div className={cn(
        'w-2 h-2 rounded-full',
        isOnline ? 'bg-green-500' : 'bg-red-500'
      )} />
      <span className="text-sm">
        {isOnline ? 'Online' : 'Offline'}
      </span>
      {pendingChanges > 0 && (
        <Badge variant="secondary">
          {pendingChanges} pending
        </Badge>
      )}
      <FormFieldHelp
        helpId="offline-sync-indicator"
        size="sm"
        variant="icon"
      />
    </div>
  )
}
```

## Configuration Management

### Adding New Help Content

1. **Update `ContextualHelpConfig.ts`**:

```tsx
export const CONTEXTUAL_HELP_CONFIGS: Record<string, HelpTooltipConfig[]> = {
  'new-feature': [
    {
      id: 'new-feature-help',
      type: 'info',
      title: 'New Feature Guide',
      content: 'Brief description of the feature.',
      detailedContent: 'Detailed explanation with examples.',
      examples: ['Example 1', 'Example 2'],
      relatedLinks: [
        { label: 'Documentation', url: '/docs/new-feature' }
      ],
      context: { page: '/new-feature', section: 'overview' }
    }
  ]
}
```

2. **Add route mapping**:

```tsx
export const PAGE_ROUTE_MAPPINGS: Record<string, string> = {
  '/new-feature': 'new-feature'
}
```

### Updating Help Content

- All help content is centralized in `ContextualHelpConfig.ts`
- Use descriptive IDs for easy maintenance
- Include examples and related links for comprehensive help
- Consider different user roles and skill levels

## Analytics and Tracking

The help system automatically tracks:

- Tooltip views and interactions
- Page visits with help content
- Help dialog opens
- User preferences and session duration

### Custom Analytics

```tsx
import { useContextualHelp } from '@/components/help/ContextualHelpProvider'

function CustomComponent() {
  const { markTooltipViewed, showHelpDialog } = useContextualHelp()

  const handleCustomHelp = () => {
    // Track custom help interaction
    markTooltipViewed('custom-help-id')

    // Show detailed help
    showHelpDialog('custom-topic', { customData: 'value' })
  }
}
```

## Mobile-Specific Considerations

### Touch Targets
- Ensure help icons are at least 44x44px for touch accessibility
- Use adequate spacing around help triggers

### Offline Support
- Help content is cached for offline access
- Consider bandwidth usage for rich media content

### Progressive Disclosure
- Start with simple tooltips, expand to detailed content
- Use haptic feedback for better user experience

## Testing

### Unit Tests
```tsx
import { render, screen } from '@testing-library/react'
import { ContextualHelpTooltip } from '@/components/help/ContextualHelpTooltip'

test('renders help tooltip', () => {
  const config = {
    id: 'test-help',
    type: 'info',
    title: 'Test Help',
    content: 'Test content'
  }

  render(<ContextualHelpTooltip config={config} />)

  expect(screen.getByRole('button')).toBeInTheDocument()
})
```

### Mobile Tests
```typescript
// tests/mobile/contextual-help.mobile.spec.ts
import { test, expect } from '@playwright/test'

test('mobile help tooltips work correctly', async ({ page }) => {
  await page.goto('/mobile/ratings/wizard/1')

  // Test help tooltip interaction
  await page.click('[data-testid="help-icon"]')
  await expect(page.locator('[data-testid="help-tooltip"]')).toBeVisible()

  // Test tooltip content
  await expect(page.locator('text=Confidence Score')).toBeVisible()
})
```

## Best Practices

### Content Guidelines
- Keep help text concise but comprehensive
- Use examples relevant to construction industry
- Consider different user skill levels
- Provide actionable guidance

### UI/UX Guidelines
- Don't overwhelm users with too many help icons
- Use progressive disclosure for complex features
- Maintain consistent positioning and styling
- Ensure accessibility compliance

### Performance Guidelines
- Lazy load help content when possible
- Cache frequently accessed help content
- Monitor help system performance impact

## Maintenance

### Regular Updates
- Review and update help content monthly
- Add new feature help during development
- Remove outdated help content
- Update analytics tracking for new features

### User Feedback
- Monitor help usage analytics
- Collect user feedback on help effectiveness
- Prioritize improvements based on usage patterns
- Test help content with actual field organizers

This implementation provides a comprehensive, scalable help system that enhances user experience while maintaining the mobile-first focus essential for field organizers working on construction sites.