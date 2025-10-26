/**
 * Mobile-First Design System Tokens
 *
 * This file contains design tokens specifically optimized for mobile experiences
 * with focus on touch interactions, readability, and performance.
 */

export const mobileSpacing = {
  // Base unit system (4px increments, optimized for mobile)
  base: '4px',
  xs: '4px',   // 0.25rem
  sm: '8px',   // 0.5rem - minimum spacing between elements
  md: '16px',  // 1rem - standard spacing
  lg: '24px',  // 1.5rem - section spacing
  xl: '32px',  // 2rem - large spacing
  xxl: '48px', // 3rem - screen edge spacing
  xxxl: '64px', // 4rem - hero sections

  // Touch-specific spacing
  touchMin: '44px', // Minimum touch target size
  touchComfortable: '48px', // Comfortable touch target
  touchLarge: '52px', // Large touch targets for critical actions

  // Safe area insets for modern phones
  safeArea: {
    top: 'env(safe-area-inset-top, 0)',
    bottom: 'env(safe-area-inset-bottom, 0)',
    left: 'env(safe-area-inset-left, 0)',
    right: 'env(safe-area-inset-right, 0)',
  },

  // Component-specific spacing
  cardPadding: {
    mobile: '16px',
    desktop: '24px',
  },
  buttonPadding: {
    mobile: '12px 24px',
    desktop: '8px 16px',
  },
  inputPadding: {
    mobile: '16px',
    desktop: '12px',
  },
}

export const mobileTypography = {
  // Mobile-optimized font sizes (minimum 16px for readability)
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px - minimum readable size
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem',    // 48px
  },

  // Mobile line heights (improved readability)
  lineHeight: {
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',    // Better for mobile readability
    relaxed: '1.625',
    loose: '2',
  },

  // Mobile font weights
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',     // Better contrast on mobile
    semibold: '600',
    bold: '700',
  },

  // Letter spacing for mobile readability
  letterSpacing: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },

  // Mobile typography scale
  heading: {
    h1: { fontSize: '1.875rem', lineHeight: '2.25rem', fontWeight: '700' },
    h2: { fontSize: '1.5rem', lineHeight: '2rem', fontWeight: '600' },
    h3: { fontSize: '1.25rem', lineHeight: '1.75rem', fontWeight: '600' },
    h4: { fontSize: '1.125rem', lineHeight: '1.625rem', fontWeight: '600' },
    h5: { fontSize: '1rem', lineHeight: '1.5rem', fontWeight: '500' },
    h6: { fontSize: '0.875rem', lineHeight: '1.25rem', fontWeight: '500' },
  },

  body: {
    large: { fontSize: '1.125rem', lineHeight: '1.75rem', fontWeight: '400' },
    base: { fontSize: '1rem', lineHeight: '1.5rem', fontWeight: '400' },
    small: { fontSize: '0.875rem', lineHeight: '1.25rem', fontWeight: '400' },
    xs: { fontSize: '0.75rem', lineHeight: '1rem', fontWeight: '400' },
  },
}

export const mobileColors = {
  // High contrast colors for mobile readability
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    900: '#1e3a8a',
  },

  // Enhanced contrast for outdoor visibility
  text: {
    primary: '#000000',     // Pure black for maximum contrast
    secondary: '#374151',   // Dark gray
    tertiary: '#6b7280',   // Medium gray
    inverse: '#ffffff',
    muted: '#9ca3af',
  },

  // Mobile-optimized background colors
  background: {
    primary: '#ffffff',
    secondary: '#f9fafb',
    tertiary: '#f3f4f6',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  // Mobile status colors with enhanced contrast
  status: {
    success: '#059669',    // Green
    warning: '#d97706',    // Orange
    error: '#dc2626',      // Red
    info: '#2563eb',       // Blue
  },

  // Mobile border colors
  border: {
    light: '#e5e7eb',
    medium: '#d1d5db',
    dark: '#9ca3af',
    focus: '#3b82f6',
  },

  // Dark mode colors optimized for mobile OLED
  dark: {
    background: {
      primary: '#000000',
      secondary: '#1c1c1e',
      tertiary: '#2c2c2e',
      overlay: 'rgba(255, 255, 255, 0.1)',
    },
    text: {
      primary: '#ffffff',
      secondary: '#e5e5e7',
      tertiary: '#a1a1aa',
      muted: '#71717a',
    },
    border: {
      light: '#38383a',
      medium: '#48484a',
      dark: '#636366',
    },
  },
}

export const mobileShadows = {
  // Subtle, battery-optimized shadows for mobile
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',

  // Mobile-specific shadows
  card: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
  button: '0 2px 4px rgba(0, 0, 0, 0.1)',
  touch: '0 3px 12px rgba(0, 0, 0, 0.15)', // When pressed

  // Dark mode shadows (lighter for OLED displays)
  dark: {
    sm: '0 1px 2px 0 rgba(255, 255, 255, 0.05)',
    base: '0 1px 3px 0 rgba(255, 255, 255, 0.1), 0 1px 2px 0 rgba(255, 255, 255, 0.06)',
    md: '0 4px 6px -1px rgba(255, 255, 255, 0.1), 0 2px 4px -1px rgba(255, 255, 255, 0.06)',
  },
}

export const mobileBreakpoints = {
  // Mobile-first breakpoint system
  xs: '320px',   // Small phones
  sm: '375px',   // iPhone SE, standard small phones
  md: '414px',   // iPhone Pro, larger phones
  lg: '768px',   // Tablets (iPad Mini)
  xl: '1024px',  // Tablets (iPad)
  desktop: '1280px', // Desktop
}

export const mobileZIndex = {
  // Mobile z-index scale
  base: '0',
  dropdown: '1000',
  sticky: '1020',
  modal: '1050',
  tooltip: '1070',
  toast: '1100',
  loading: '9999',
}

export const mobileAnimation = {
  // Mobile-optimized durations (shorter for better perceived performance)
  duration: {
    fast: '150ms',     // Quick feedback
    base: '200ms',     // Standard transitions
    slow: '300ms',     // Complex animations
    slower: '500ms',   // Page transitions
  },

  // Mobile-friendly easing functions
  easing: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',  // Touch-friendly
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)', // Natural movement
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', // Bouncy effects
  },

  // Mobile-specific animations
  springGentle: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  springBouncy: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
}

export const mobileBorderRadius = {
  none: '0',
  sm: '4px',
  base: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  full: '9999px',

  // Mobile-specific
  card: '12px',
  button: '8px',
  modal: '16px',
  input: '8px',
}

export const mobileLayout = {
  // Container constraints for mobile
  maxWidth: {
    xs: '320px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    full: '100%',
  },

  // Mobile grid system
  grid: {
    columns: {
      mobile: 4,    // Mobile grid columns
      tablet: 8,    // Tablet grid columns
      desktop: 12,  // Desktop grid columns
    },
    gap: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
    },
  },

  // Mobile spacing patterns
  section: {
    padding: {
      mobile: '24px 16px',
      tablet: '48px 24px',
      desktop: '64px 32px',
    },
  },
}

// Touch interaction tokens
export const mobileTouch = {
  // Touch target requirements
  minTouchTarget: '44px',
  comfortableTouchTarget: '48px',

  // Touch feedback
  touchFeedback: {
    scale: '0.95',
    opacity: '0.8',
    duration: '100ms',
  },

  // Gesture thresholds
  swipe: {
    minDistance: '50px',
    maxVerticalDistance: '50px',
    velocity: '0.3',
  },

  // Pull-to-refresh
  pullToRefresh: {
    threshold: '80px',
    maxDistance: '120px',
  },
}

// Export all tokens as a single object for convenience
export const mobileTokens = {
  spacing: mobileSpacing,
  typography: mobileTypography,
  colors: mobileColors,
  shadows: mobileShadows,
  breakpoints: mobileBreakpoints,
  zIndex: mobileZIndex,
  animation: mobileAnimation,
  borderRadius: mobileBorderRadius,
  layout: mobileLayout,
  touch: mobileTouch,
}

// Type definitions for TypeScript
export type MobileSpacing = typeof mobileSpacing
export type MobileTypography = typeof mobileTypography
export type MobileColors = typeof mobileColors
export type MobileShadows = typeof mobileShadows
export type MobileBreakpoints = typeof mobileBreakpoints
export type MobileZIndex = typeof mobileZIndex
export type MobileAnimation = typeof mobileAnimation
export type MobileBorderRadius = typeof mobileBorderRadius
export type MobileLayout = typeof mobileLayout
export type MobileTouch = typeof mobileTouch
export type MobileTokens = typeof mobileTokens