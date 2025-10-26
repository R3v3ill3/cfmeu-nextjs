# Safe Area Implementation Guide

This comprehensive guide covers the safe area implementation for modern iPhone displays with Dynamic Island and home indicator compatibility.

## Overview

The safe area implementation provides:

- **Dynamic Island Support**: Full compatibility with iPhone 14 Pro+ and 15 Pro+ models
- **Home Indicator Protection**: Prevents UI elements from overlapping the home indicator
- **Device-Specific Optimizations**: Tailored safe area calculations for different iPhone models
- **Orientation Awareness**: Handles both portrait and landscape orientations
- **Automated Testing**: Comprehensive validation tools for safe area compliance

## Quick Start

### Basic Usage

```tsx
import { SafeAreaContainer } from '@/components/ui/SafeAreaContainer';

function MyComponent() {
  return (
    <SafeAreaContainer>
      {/* Your content will automatically respect safe areas */}
      <div>This content is safe from Dynamic Island and home indicator</div>
    </SafeAreaContainer>
  );
}
```

### Specialized Containers

```tsx
import {
  SafeAreaHeader,
  SafeAreaFooter,
  SafeAreaModal,
  SafeAreaTabBar
} from '@/components/ui/SafeAreaContainer';

function AppLayout() {
  return (
    <>
      <SafeAreaHeader>
        <h1>Header with Dynamic Island awareness</h1>
      </SafeAreaHeader>

      <main>
        {/* Main content */}
      </main>

      <SafeAreaTabBar>
        <nav>Bottom navigation avoiding home indicator</nav>
      </SafeAreaTabBar>
    </>
  );
}
```

## Device Compatibility

### Supported iPhone Models

| Model | Screen Size | Dynamic Island | Notch | Enhanced Support |
|-------|-------------|----------------|-------|------------------|
| iPhone 15 Pro Max | 6.7" | ✅ | ❌ | ✅ |
| iPhone 15 Pro | 6.1" | ✅ | ❌ | ✅ |
| iPhone 15 Plus | 6.7" | ✅ | ❌ | ✅ |
| iPhone 15 | 6.1" | ✅ | ❌ | ✅ |
| iPhone 14 Pro Max | 6.7" | ✅ | ❌ | ✅ |
| iPhone 14 Pro | 6.1" | ✅ | ❌ | ✅ |
| iPhone 14 Plus | 6.7" | ❌ | ✅ | ✅ |
| iPhone 14 | 6.1" | ❌ | ✅ | ✅ |
| iPhone 13 Pro Max | 6.7" | ❌ | ✅ | ✅ |
| iPhone 13 Pro | 6.1" | ❌ | ✅ | ✅ |
| iPhone 13 | 6.1" | ❌ | ✅ | ✅ |
| iPhone 13 mini | 5.4" | ❌ | ✅ | ✅ |
| iPhone 12 Pro Max | 6.7" | ❌ | ✅ | ✅ |
| iPhone 12 Pro | 6.1" | ❌ | ✅ | ✅ |
| iPhone 12 | 6.1" | ❌ | ✅ | ✅ |
| iPhone 12 mini | 5.4" | ❌ | ✅ | ✅ |
| iPhone SE (2022) | 4.7" | ❌ | ❌ | ✅ |

### Safe Area Measurements

#### Dynamic Island Models (iPhone 14 Pro+, 15 Pro+)

- **Top Safe Area**: ~47px (includes Dynamic Island height + padding)
- **Bottom Safe Area**: ~34px (home indicator in portrait)
- **Landscape Bottom**: ~21px (home indicator in landscape)

#### Notch Models (iPhone X - 14)

- **Top Safe Area**: ~44px (includes notch + status bar)
- **Bottom Safe Area**: ~34px (home indicator in portrait)
- **Landscape Bottom**: ~21px (home indicator in landscape)

#### Non-Notch Models (iPhone SE, older models)

- **Top Safe Area**: 0px
- **Bottom Safe Area**: 0px

## CSS Variables and Classes

### Core CSS Variables

```css
:root {
  /* Safe area insets - Fallback to 0 for non-iOS devices */
  --safe-area-inset-top: env(safe-area-inset-top, 0px);
  --safe-area-inset-right: env(safe-area-inset-right, 0px);
  --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-inset-left: env(safe-area-inset-left, 0px);

  /* Dynamic Island specific variables */
  --dynamic-island-height: 32px;
  --dynamic-island-width: 126px;
  --dynamic-island-padding: 8px;

  /* Home indicator variables */
  --home-indicator-height: 34px; /* Portrait */
  --home-indicator-height-landscape: 21px; /* Landscape */
}
```

### Utility Classes

#### Basic Safe Area Classes

```css
.safe-area-inset-top    /* Padding for top safe area */
.safe-area-inset-bottom /* Padding for bottom safe area */
.safe-area-inset-left   /* Padding for left safe area */
.safe-area-inset-right  /* Padding for right safe area */
.safe-area-all          /* All safe areas */
.safe-area-horizontal  /* Left and right safe areas */
.safe-area-vertical    /* Top and bottom safe areas */
```

#### Device-Specific Classes

```css
.dynamic-island-aware          /* Dynamic Island specific styling */
.notch-aware                   /* Notch specific styling */
.safe-area-pro-enhanced        /* iPhone 13/14 Pro models */
.safe-area-pro-max-enhanced    /* iPhone 13/14 Pro Max models */
.safe-area-standard-enhanced   /* Standard iPhone models */
.safe-area-compact             /* iPhone SE/mini models */
.safe-area-landscape          /* Landscape orientation */
```

## SafeAreaContainer API

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `enableSafeArea` | `boolean` | `true` | Enable automatic safe area padding |
| `additionalPadding` | `number` | `0` | Additional padding beyond safe area |
| `edges` | `'all' | 'top' | 'bottom' | 'horizontal' | 'vertical'` | `'all'` | Which edges to apply safe area to |
| `useClasses` | `boolean` | `true` | Use CSS classes instead of inline styles |
| `minPadding` | `number` | `16` | Minimum padding regardless of safe area |
| `deviceEnhancements` | `boolean` | `true` | Apply device-specific enhancements |
| `responsive` | `boolean` | `true` | Apply responsive breakpoint classes |
| `orientationAware` | `boolean` | `true` | Handle orientation changes |

### Examples

#### Basic Safe Area Container

```tsx
<SafeAreaContainer>
  {/* Full safe area protection */}
</SafeAreaContainer>
```

#### Top-Only Safe Area

```tsx
<SafeAreaContainer edges="top">
  {/* Only top safe area protection */}
</SafeAreaContainer>
```

#### Custom Padding

```tsx
<SafeAreaContainer
  additionalPadding={8}
  minPadding={24}
>
  {/* Enhanced padding with minimum values */}
</SafeAreaContainer>
```

## SafeAreaView (Debug Component)

### Usage

```tsx
import { SafeAreaView } from '@/components/ui/SafeAreaView';

function DebugScreen() {
  return (
    <div>
      {/* Your app content */}

      {/* Debug overlay */}
      <SafeAreaView
        showBoundaries={true}
        showDeviceInfo={true}
        theme="debug"
      />
    </div>
  );
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `showBoundaries` | `boolean` | `true` | Show safe area boundaries visually |
| `showDeviceInfo` | `boolean` | `true` | Show device information |
| `showMeasurements` | `boolean` | `true` | Show safe area measurements |
| `theme` | `'debug' | 'production' | 'dark' | 'light'` | `'debug'` | Color theme for overlay |
| `infoPosition` | `'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'` | `'top-left'` | Position of info panel |
| `interactive` | `boolean` | `false` | Enable interactive mode |
| `opacity` | `number` | `0.7` | Opacity of the overlay |

## Utility Functions

### Device Detection

```tsx
import {
  getDeviceInfo,
  hasDynamicIsland,
  hasNotch,
  detectiPhoneModel
} from '@/styles/safe-area-utilities';

const deviceInfo = getDeviceInfo();
const isDynamicIslandDevice = hasDynamicIsland();
const isNotchDevice = hasNotch();
const model = detectiPhoneModel();
```

### Safe Area Calculations

```tsx
import {
  getSafeAreaInsets,
  getEnhancedSafeAreaInsets,
  getSafeAreaStyles,
  getSafeViewport
} from '@/styles/safe-area-utilities';

const insets = getSafeAreaInsets();
const enhancedInsets = getEnhancedSafeAreaInsets();
const styles = getSafeAreaStyles(8); // 8px additional padding
const viewport = getSafeViewport();
```

### Safe Area Hook

```tsx
import { useSafeArea } from '@/styles/safe-area-utilities';

function MyComponent() {
  const {
    deviceInfo,
    safeAreaInsets,
    safeAreaStyles,
    safeAreaClasses
  } = useSafeArea();

  return (
    <div
      className={safeAreaClasses}
      style={safeAreaStyles}
    >
      Content with safe area
    </div>
  );
}
```

## Testing and Validation

### Automated Testing

```tsx
import { SafeAreaTestRunner } from '@/lib/testing/safe-area-testing';

async function runSafeAreaTests() {
  const results = await SafeAreaTestRunner.runFullTestSuite();

  console.log('Compatibility Score:', results.compatibilityScore);
  console.log('Issues:', results.issues);
  console.log('Recommendations:', results.recommendations);
}
```

### Quick Test Component

```tsx
import { SafeAreaQuickTest } from '@/components/ui/SafeAreaView';

function TestScreen() {
  return (
    <SafeAreaQuickTest
      onComplete={(results) => {
        console.log('Test completed:', results);
      }}
    />
  );
}
```

### Performance Testing

```tsx
import { SafeAreaPerformanceTesting } from '@/lib/testing/safe-area-testing';

async function measurePerformance() {
  const calculationTime = await SafeAreaPerformanceTesting.measureCalculationPerformance();
  const cssPerformance = await SafeAreaPerformanceTesting.testCSSVariablePerformance();

  console.log('Calculation time per iteration:', calculationTime, 'ms');
  console.log('CSS variable performance:', cssPerformance, 'ms');
}
```

## Layout.tsx Integration

The Layout component has been enhanced with comprehensive safe area support:

```tsx
// Header with Dynamic Island awareness
<header className="safe-area-inset-top">
  {/* Header content */}
</header>

// Main content with safe area padding
<main className="px-safe py-4">
  {/* Main content */}
</main>

// Bottom tab bar with home indicator awareness
<div className="fixed bottom-0 safe-area-inset-bottom">
  {/* Tab bar content */}
</div>
```

## Dialog.tsx Integration

Modal dialogs automatically respect safe areas:

```tsx
<Dialog>
  <DialogContent className="safe-area-all modal-dynamic-island">
    {/* Modal content automatically avoids Dynamic Island */}
  </DialogContent>
</Dialog>
```

## Best Practices

### 1. Always Use Safe Area Containers

```tsx
// Good
<SafeAreaContainer>
  <Card>Your content</Card>
</SafeAreaContainer>

// Avoid - no safe area protection
<Card>Your content</Card>
```

### 2. Choose Appropriate Container Types

```tsx
// For headers
<SafeAreaHeader>
  <Navigation />
</SafeAreaHeader>

// For footers
<SafeAreaFooter>
  <TabBar />
</SafeAreaFooter>

// For modals
<SafeAreaModal>
  <DialogContent />
</SafeAreaModal>
```

### 3. Test on Real Devices

- Test on actual iPhone devices, not just simulators
- Test both portrait and landscape orientations
- Test different iPhone models (Pro, Pro Max, standard)
- Use SafeAreaView for visual debugging

### 4. Consider Edge Cases

```tsx
// Handle devices without safe areas gracefully
function SafeAreaWrapper({ children }) {
  const deviceInfo = getDeviceInfo();

  if (!deviceInfo.isiPhone) {
    return <>{children}</>;
  }

  return <SafeAreaContainer>{children}</SafeAreaContainer>;
}
```

### 5. Performance Considerations

```tsx
// Use the hook for reactive updates
function MyComponent() {
  const { safeAreaStyles } = useSafeArea();

  return <div style={safeAreaStyles}>Content</div>;
}
```

## Troubleshooting

### Common Issues

1. **Safe areas not working**
   - Check if running on iOS device
   - Verify viewport meta tag: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
   - Use SafeAreaView to debug

2. **Dynamic Island overlap**
   - Ensure `viewport-fit=cover` is in viewport meta tag
   - Check device detection is working correctly
   - Use `dynamic-island-aware` class

3. **Performance issues**
   - Use `useSafeArea` hook for reactive updates
   - Minimize CSS variable updates
   - Use performance testing tools

4. **Inconsistent padding**
   - Check device-specific classes are applied
   - Verify orientation changes are handled
   - Use enhanced safe area calculations

### Debug Tools

1. **SafeAreaView Component**
   ```tsx
   <SafeAreaView theme="debug" interactive={true} />
   ```

2. **Console Logging**
   ```tsx
   console.log('Device Info:', getDeviceInfo());
   console.log('Safe Areas:', getEnhancedSafeAreaInsets());
   ```

3. **Browser DevTools**
   - Check computed styles for `env(safe-area-inset-*)`
   - Verify CSS variables are set correctly
   - Test orientation changes

## Migration Guide

### From Manual Safe Areas

```tsx
// Before
<div style={{ paddingTop: '44px', paddingBottom: '34px' }}>
  Content
</div>

// After
<SafeAreaContainer>
  Content
</SafeAreaContainer>
```

### From Basic CSS Classes

```tsx
// Before
<div className="pt-safe-top pb-safe-bottom">
  Content
</div>

// After
<SafeAreaContainer edges="top-bottom">
  Content
</SafeAreaContainer>
```

## Conclusion

This comprehensive safe area implementation ensures your application looks great on all modern iPhone models while gracefully handling older devices. The combination of CSS variables, React components, and testing tools provides a complete solution for safe area management.

For questions or issues, refer to the testing utilities and debug components included in this implementation.