# CFMEU Employer Rating System - Mobile Optimization Guide

This guide outlines the comprehensive mobile experience optimizations implemented for the CFMEU employer traffic light rating system, specifically targeting iPhone 13+ devices used by CFMEU organisers in field conditions.

## Overview

The mobile optimization strategy focuses on creating a native app-like experience while maintaining web technology benefits. All optimizations are production-ready and tested across various mobile devices and network conditions.

## 🚀 Performance Optimizations

### Bundle Size & Loading

#### Next.js Configuration (`next.config.mjs`)
- **Code Splitting**: Intelligent chunk splitting for mobile, rating, and UI components
- **Tree Shaking**: Optimized imports for Radix UI and Lucide React
- **Asset Optimization**: WebP/AVIF image formats with automatic fallbacks
- **Compression**: Gzip/Brotli compression enabled
- **Caching Headers**: Aggressive caching for static assets

#### Dynamic Imports (`src/lib/mobile/dynamic-imports.tsx`)
- **Lazy Loading**: Components loaded on-demand with loading skeletons
- **Preloading**: Critical components preloaded on user interaction
- **Bundle Analysis**: Real-time bundle size monitoring
- **Resource Hints**: Preconnect, prefetch, and preload directives

### Performance Monitoring (`src/lib/performance/performance-monitoring.tsx`)
- **Core Web Vitals**: FCP, LCP, CLS, FID tracking
- **Mobile Metrics**: FPS, memory usage, network quality
- **Performance Scoring**: 0-100 scoring system with actionable insights
- **Device Adaptation**: Automatic optimization based on device capabilities

## 🎯 Mobile Interactions

### Advanced Gestures (`src/hooks/useMobileGestures.tsx`)
- **Multi-touch Support**: Pinch to zoom, rotation, two-finger gestures
- **Swipe Actions**: Left/right swipe with customizable actions
- **Touch Feedback**: Haptic feedback integration for iOS
- **Gesture Recognition**: Tap, double-tap, long-press, pan gestures

### Haptic Feedback (`src/components/mobile/shared/HapticFeedback.tsx`)
- **iOS Integration**: Native haptic patterns where available
- **Fallback Support**: Web Vibration API for broader compatibility
- **Contextual Feedback**: Different patterns for different interactions
- **User Preference**: Respects system haptic settings

## 📱 iPhone-Specific Optimizations

### Safe Area Support (`src/styles/mobile.css`)
```css
.safe-area-inset-top {
  padding-top: max(env(safe-area-inset-top), 0.5rem);
}
```

### iOS Safari Fixes
- **Input Zoom Prevention**: 16px font size for inputs
- **Scroll Momentum**: Smooth scrolling with `-webkit-overflow-scrolling`
- **Tap Highlight Removal**: Clean touch interactions
- **Autofill Styling**: Consistent input styling across iOS versions

### Typography & Spacing
- **System Font Stack**: Native iOS fonts for better performance
- **Dynamic Type**: Supports iOS text size preferences
- **Touch Targets**: Minimum 44×44 point targets
- **Spacing**: iPhone-optimized spacing scale

## 🌐 PWA Features

### Service Worker (`public/sw.js`)
- **Offline First**: Network-first strategy for API, cache-first for assets
- **Background Sync**: Queues actions when offline, syncs when online
- **Cache Management**: Intelligent cache invalidation and cleanup
- **Push Notifications**: Support for critical updates

### PWA Installation (`src/lib/pwa/pwa-utils.tsx`)
- **Install Prompts**: Contextual installation prompts
- **App Badges**: Notification count badges
- **Wake Lock**: Keep screen active during field work
- **Share API**: Native sharing integration

### App Manifest (`public/manifest.json`)
- **Shortcuts**: Quick access to key features
- **File Handlers**: Import employer data directly
- **Share Target**: Receive data from other apps
- **Orientation**: Lock to portrait for consistency

## 📊 Network Optimization

### Smart Fetching (`src/lib/network/network-optimization.tsx`)
- **Request Deduplication**: Prevent duplicate API calls
- **Intelligent Caching**: TTL-based caching with invalidation
- **Retry Logic**: Exponential backoff for failed requests
- **Network Awareness**: Adapt strategy based on connection quality

### Offline Storage (`src/hooks/useOptimizedDataFetching.tsx`)
- **IndexedDB**: Client-side storage for offline data
- **Optimistic Updates**: Instant UI feedback with background sync
- **Infinite Scroll**: Optimized pagination with caching
- **Real-time Data**: Efficient polling with connection awareness

## 🧪 Testing & Quality Assurance

### Mobile Test Suites (`tests/mobile/`)
- **Performance Tests**: Core Web Vitals validation
- **Interaction Tests**: Touch gesture verification
- **Network Tests**: Offline/slow network simulation
- **Accessibility Tests**: Screen reader and keyboard navigation

### Device Coverage
- **iPhone 13 Series**: Mini, Standard, Pro, Pro Max
- **Network Conditions**: 3G, 4G, 5G, offline
- **Orientation**: Portrait and landscape modes
- **iOS Versions**: Latest and previous major versions

## 📈 Performance Targets

### Core Web Vitals
- **First Contentful Paint (FCP)**: < 1.5s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Time to Interactive (TTI)**: < 3.5s
- **Cumulative Layout Shift (CLS)**: < 0.1
- **First Input Delay (FID)**: < 100ms

### Mobile Metrics
- **Bundle Size**: < 250KB (gzipped)
- **Memory Usage**: < 50MB average
- **Frame Rate**: 60fps during interactions
- **Battery Usage**: Optimized for extended field use

## 🛠 Implementation Guide

### 1. Basic Setup
```tsx
import { MobileOptimizationProvider } from '@/components/mobile/shared/MobileOptimizationProvider'

function App() {
  return (
    <MobileOptimizationProvider
      enablePerformanceMonitoring={process.env.NODE_ENV === 'production'}
      enablePWAFeatures={true}
      showDebugInfo={process.env.NODE_ENV === 'development'}
    >
      <YourApp />
    </MobileOptimizationProvider>
  )
}
```

### 2. Optimized Data Fetching
```tsx
import { useOptimizedFetch } from '@/hooks/useOptimizedDataFetching'

function EmployerList() {
  const { data, loading, error, refetch } = useOptimizedFetch(
    '/api/employers',
    {
      cacheKey: 'employer-list',
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      staleWhileRevalidate: true
    }
  )

  // Component logic
}
```

### 3. Gesture-Enhanced Components
```tsx
import { useSwipeActions } from '@/hooks/useMobileGestures'

function EmployerCard({ employer }) {
  const { elementRef } = useSwipeActions(
    () => onSwipeLeft(), // Rate employer
    () => onSwipeRight(), // View details
    undefined, // Swipe up
    undefined, // Swipe down
    { enableHaptics: true }
  )

  return (
    <div ref={elementRef} className="employer-card">
      {/* Card content */}
    </div>
  )
}
```

### 4. PWA Features
```tsx
import { usePWAInstall } from '@/lib/pwa/pwa-utils'

function InstallPrompt() {
  const { isInstallable, install } = usePWAInstall()

  if (!isInstallable) return null

  return (
    <button onClick={install}>
      Install App
    </button>
  )
}
```

## 🔧 Configuration

### Environment Variables
```env
NEXT_PUBLIC_API_URL=https://api.cfmeu.org.au
NEXT_PUBLIC_PWA_ENABLED=true
NEXT_PUBLIC_PERFORMANCE_MONITORING=true
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_key
```

### Package.json Scripts
```json
{
  "scripts": {
    "test:mobile": "node scripts/mobile-test-runner.js run",
    "test:mobile:audit": "node scripts/mobile-test-runner.js run --test tests/mobile/audit/",
    "test:mobile:performance": "node scripts/mobile-test-runner.js run --test tests/mobile/performance.spec.ts"
  }
}
```

## 📊 Monitoring & Analytics

### Performance Tracking
- Real-time performance monitoring
- User experience metrics collection
- Network quality analysis
- Device capability profiling

### Error Tracking
- Mobile-specific error boundaries
- Offline error handling
- Network failure reporting
- Gesture interaction errors

## 🚀 Deployment

### Build Optimization
```bash
# Production build with mobile optimizations
npm run build

# Test mobile performance
npm run test:mobile

# Generate performance report
npm run test:mobile:report
```

### Service Worker Updates
- Automatic cache invalidation on version changes
- Progressive enhancement for new features
- Background sync for offline actions
- Critical resource preloading

## 🔍 Debugging

### Development Tools
```tsx
// Enable debug mode
<MobileOptimizationProvider showDebugInfo={true}>

// Performance monitoring
<PerformanceMonitor onReport={(report) => console.log(report)}>

// Network optimization info
const { getNetworkStats } = useNetworkOptimization()
```

### Chrome DevTools
- Device emulation for testing
- Network throttling simulation
- Performance profiling
- Service worker debugging

## 📱 Best Practices

### Performance
- Use dynamic imports for heavy components
- Implement virtual scrolling for long lists
- Optimize images with WebP/AVIF
- Minimize JavaScript execution time

### User Experience
- Provide clear loading states
- Implement optimistic updates
- Use appropriate haptic feedback
- Respect user preferences (motion, data)

### Accessibility
- Ensure 44×44 point touch targets
- Provide screen reader support
- Maintain high contrast ratios
- Support keyboard navigation

## 🆕 Future Enhancements

### Planned Optimizations
- WebAssembly for heavy computations
- WebRTC for real-time collaboration
- Web Share API Level 2 integration
- Advanced gesture patterns

### Platform Integration
- iOS Shortcuts support
- Apple Watch companion app
- CarPlay integration for travel
- SiriKit for voice interactions

## 📞 Support

For issues or questions about mobile optimizations:
1. Check browser console for errors
2. Review performance monitoring reports
3. Test with different network conditions
4. Verify iOS version compatibility

---

**Note**: These optimizations are specifically designed for CFMEU organisers working in field conditions. Features like offline mode, reduced data usage, and battery optimization are prioritized to ensure reliable operation in construction sites and remote locations.