/**
 * Mobile-First Responsive Utilities
 *
 * Utility functions and CSS-in-JS helpers for responsive design
 * optimized for mobile-first development with touch interactions.
 */

import type { CSSProperties } from 'react'
import { mobileBreakpoints, mobileSpacing, mobileTokens } from './mobile-design-tokens'

// Media query helpers for mobile-first development
export const mediaQuery = {
  // Mobile-first breakpoints (min-width)
  xs: `@media (min-width: ${mobileBreakpoints.xs})`,
  sm: `@media (min-width: ${mobileBreakpoints.sm})`,
  md: `@media (min-width: ${mobileBreakpoints.md})`,
  lg: `@media (min-width: ${mobileBreakpoints.lg})`,
  xl: `@media (min-width: ${mobileBreakpoints.xl})`,
  desktop: `@media (min-width: ${mobileBreakpoints.desktop})`,

  // Max-width breakpoints for mobile-first approach
  maxSm: `@media (max-width: ${mobileBreakpoints.sm})`,
  maxMd: `@media (max-width: ${mobileBreakpoints.md})`,
  maxLg: `@media (max-width: ${mobileBreakpoints.lg})`,
  maxXl: `@media (max-width: ${mobileBreakpoints.xl})`,

  // Range breakpoints
  smToMd: `@media (min-width: ${mobileBreakpoints.sm}) and (max-width: ${mobileBreakpoints.md})`,
  mdToLg: `@media (min-width: ${mobileBreakpoints.md}) and (max-width: ${mobileBreakpoints.lg})`,
  lgToXl: `@media (min-width: ${mobileBreakpoints.lg}) and (max-width: ${mobileBreakpoints.xl})`,

  // Device-specific breakpoints
  phone: `@media (max-width: ${mobileBreakpoints.md})`,
  tablet: `@media (min-width: ${mobileBreakpoints.lg}) and (max-width: ${mobileBreakpoints.xl})`,
  desktop: `@media (min-width: ${mobileBreakpoints.desktop})`,

  // Orientation-based breakpoints
  landscape: `@media (orientation: landscape)`,
  portrait: `@media (orientation: portrait)`,
  mobileLandscape: `@media (max-width: ${mobileBreakpoints.md}) and (orientation: landscape)`,
  mobilePortrait: `@media (max-width: ${mobileBreakpoints.md}) and (orientation: portrait)`,

  // Device capabilities
  touch: `@media (hover: none) and (pointer: coarse)`,
  mouse: `@media (hover: hover) and (pointer: fine)`,
  highRes: `@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)`,
  reducedMotion: `@media (prefers-reduced-motion: reduce)`,
  darkMode: `@media (prefers-color-scheme: dark)`,
  lightMode: `@media (prefers-color-scheme: light)`,
  highContrast: `@media (prefers-contrast: high)`,
}

// Responsive spacing utilities
export const responsiveSpacing = {
  // Mobile-first spacing that scales up
  padding: {
    mobile: mobileSpacing.md,
    tablet: mobileSpacing.lg,
    desktop: mobileSpacing.xl,
  },
  margin: {
    mobile: mobileSpacing.sm,
    tablet: mobileSpacing.md,
    desktop: mobileSpacing.lg,
  },
  gap: {
    mobile: mobileSpacing.sm,
    tablet: mobileSpacing.md,
    desktop: mobileSpacing.lg,
  },
}

// Container utilities
export const container = {
  mobile: {
    padding: `0 ${mobileSpacing.md}`,
    maxWidth: '100%',
  },
  tablet: {
    padding: `0 ${mobileSpacing.lg}`,
    maxWidth: mobileBreakpoints.lg,
  },
  desktop: {
    padding: `0 ${mobileSpacing.xl}`,
    maxWidth: mobileBreakpoints.xl,
  },
}

// Grid utilities for responsive layouts
export const grid = {
  mobile: {
    columns: 1,
    gap: mobileSpacing.sm,
  },
  tablet: {
    columns: 2,
    gap: mobileSpacing.md,
  },
  desktop: {
    columns: 3,
    gap: mobileSpacing.lg,
  },
}

// Typography scaling utilities
export const typography = {
  heading: {
    mobile: {
      fontSize: mobileTokens.typography.heading.h3.fontSize,
      lineHeight: mobileTokens.typography.heading.h3.lineHeight,
    },
    tablet: {
      fontSize: mobileTokens.typography.heading.h2.fontSize,
      lineHeight: mobileTokens.typography.heading.h2.lineHeight,
    },
    desktop: {
      fontSize: mobileTokens.typography.heading.h1.fontSize,
      lineHeight: mobileTokens.typography.heading.h1.lineHeight,
    },
  },
  body: {
    mobile: {
      fontSize: mobileTokens.typography.body.base.fontSize,
      lineHeight: mobileTokens.typography.body.base.lineHeight,
    },
    tablet: {
      fontSize: mobileTokens.typography.body.large.fontSize,
      lineHeight: mobileTokens.typography.body.large.lineHeight,
    },
    desktop: {
      fontSize: mobileTokens.typography.body.large.fontSize,
      lineHeight: mobileTokens.typography.body.large.lineHeight,
    },
  },
}

// Touch-specific responsive utilities
export const touch = {
  // Touch target sizes that scale with device
  touchTarget: {
    mobile: mobileSpacing.touchMin,
    tablet: mobileSpacing.touchMin,
    desktop: mobileSpacing.touchComfortable,
  },

  // Button sizes
  button: {
    mobile: {
      height: mobileSpacing.touchMin,
      padding: '12px 24px',
      fontSize: mobileTokens.typography.fontSize.base,
    },
    tablet: {
      height: mobileSpacing.touchComfortable,
      padding: '12px 32px',
      fontSize: mobileTokens.typography.fontSize.base,
    },
    desktop: {
      height: mobileSpacing.touchComfortable,
      padding: '8px 24px',
      fontSize: mobileTokens.typography.fontSize.sm,
    },
  },

  // Icon button sizes
  iconButton: {
    mobile: {
      size: mobileSpacing.touchMin,
      iconSize: '20px',
    },
    tablet: {
      size: mobileSpacing.touchComfortable,
      iconSize: '24px',
    },
    desktop: {
      size: mobileSpacing.touchComfortable,
      iconSize: '20px',
    },
  },
}

// Helper function to generate responsive CSS
export const responsive = (styles: {
  mobile?: CSSProperties
  tablet?: CSSProperties
  desktop?: CSSProperties
}) => {
  const css: Record<string, CSSProperties> = {
    base: styles.mobile || {},
  }

  if (styles.tablet) {
    css[mediaQuery.md] = styles.tablet
  }

  if (styles.desktop) {
    css[mediaQuery.desktop] = styles.desktop
  }

  return css
}

// Helper function to create responsive styles object for styled-components or CSS-in-JS
export const createResponsiveStyles = (styles: {
  mobile?: string
  tablet?: string
  desktop?: string
}) => {
  const baseStyles = styles.mobile || ''
  const tabletStyles = styles.tablet ? `${mediaQuery.md} { ${styles.tablet} }` : ''
  const desktopStyles = styles.desktop ? `${mediaQuery.desktop} { ${styles.desktop} }` : ''

  return `${baseStyles} ${tabletStyles} ${desktopStyles}`.trim()
}

// Breakpoint detection utilities
export const useBreakpoint = () => {
  // This would typically be implemented as a React hook
  // For now, returning a mock implementation
  return {
    isMobile: true, // Default to mobile for SSR
    isTablet: false,
    isDesktop: false,
    isTouch: typeof window !== 'undefined' && 'ontouchstart' in window,
  }
}

// Device detection utilities
export const device = {
  isMobile: () => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < parseInt(mobileBreakpoints.md)
  },

  isTablet: () => {
    if (typeof window === 'undefined') return false
    const width = window.innerWidth
    return width >= parseInt(mobileBreakpoints.lg) && width < parseInt(mobileBreakpoints.xl)
  },

  isDesktop: () => {
    if (typeof window === 'undefined') return false
    return window.innerWidth >= parseInt(mobileBreakpoints.desktop)
  },

  isTouch: () => {
    if (typeof window === 'undefined') return false
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0
  },

  isPortrait: () => {
    if (typeof window === 'undefined') return false
    return window.innerHeight > window.innerWidth
  },

  isLandscape: () => {
    if (typeof window === 'undefined') return false
    return window.innerWidth > window.innerHeight
  },

  // Device-specific features
  hasSafeArea: () => {
    if (typeof window === 'undefined') return false
    return CSS.supports('padding-top', 'env(safe-area-inset-top)')
  },

  prefersReducedMotion: () => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  },

  prefersDarkMode: () => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  },

  prefersHighContrast: () => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-contrast: high)').matches
  },
}

// Viewport utilities
export const viewport = {
  getWidth: () => {
    if (typeof window === 'undefined') return 0
    return window.innerWidth
  },

  getHeight: () => {
    if (typeof window === 'undefined') return 0
    return window.innerHeight
  },

  getSafeAreaInset: (side: 'top' | 'bottom' | 'left' | 'right') => {
    if (typeof window === 'undefined') return 0

    // Create a temporary element to measure safe area
    const temp = document.createElement('div')
    temp.style.position = 'fixed'
    temp.style.left = '0'
    temp.style.top = '0'
    temp.style.width = '0'
    temp.style.height = '0'
    temp.style.opacity = '0'
    temp.style.pointerEvents = 'none'

    const insetKey = `safe-area-inset-${side}`
    temp.style.paddingTop = `env(${insetKey})`

    document.body.appendChild(temp)
    const computedStyle = getComputedStyle(temp)
    const inset = parseInt(computedStyle.paddingTop) || 0
    document.body.removeChild(temp)

    return inset
  },
}

// Responsive image utilities
export const responsiveImage = {
  // Generate srcset for responsive images
  generateSrcset: (baseUrl: string, widths: number[] = [320, 640, 768, 1024, 1280]) => {
    return widths.map(width => `${baseUrl}?w=${width} ${width}w`).join(', ')
  },

  // Generate sizes attribute for responsive images
  generateSizes: (breakpoints: string[] = ['100vw', '50vw', '33vw']) => {
    return `(max-width: ${mobileBreakpoints.md}) ${breakpoints[0]}, (max-width: ${mobileBreakpoints.lg}) ${breakpoints[1]}, ${breakpoints[2]}`
  },
}

// Animation utilities for responsive performance
export const animation = {
  // Optimized animation duration based on device
  getDuration: (baseDuration: number) => {
    if (typeof window === 'undefined') return baseDuration

    // Reduce animation duration on mobile for better perceived performance
    if (device.isMobile()) {
      return Math.max(baseDuration * 0.7, 100) // Minimum 100ms
    }

    return baseDuration
  },

  // Disable animations if user prefers reduced motion
  shouldAnimate: () => {
    return !device.prefersReducedMotion()
  },
}

// CSS Custom Properties generator
export const generateCSSVariables = () => {
  return `
    :root {
      /* Mobile Spacing */
      --spacing-xs: ${mobileSpacing.xs};
      --spacing-sm: ${mobileSpacing.sm};
      --spacing-md: ${mobileSpacing.md};
      --spacing-lg: ${mobileSpacing.lg};
      --spacing-xl: ${mobileSpacing.xl};
      --spacing-xxl: ${mobileSpacing.xxl};

      /* Touch Targets */
      --touch-min: ${mobileSpacing.touchMin};
      --touch-comfortable: ${mobileSpacing.touchComfortable};

      /* Safe Areas */
      --safe-top: env(safe-area-inset-top, 0);
      --safe-bottom: env(safe-area-inset-bottom, 0);
      --safe-left: env(safe-area-inset-left, 0);
      --safe-right: env(safe-area-inset-right, 0);

      /* Breakpoints */
      --breakpoint-xs: ${mobileBreakpoints.xs};
      --breakpoint-sm: ${mobileBreakpoints.sm};
      --breakpoint-md: ${mobileBreakpoints.md};
      --breakpoint-lg: ${mobileBreakpoints.lg};
      --breakpoint-xl: ${mobileBreakpoints.xl};
    }
  `
}

// Type definitions
export type ResponsiveStyles = {
  mobile?: CSSProperties
  tablet?: CSSProperties
  desktop?: CSSProperties
}

export type ResponsiveStringStyles = {
  mobile?: string
  tablet?: string
  desktop?: string
}

export type BreakpointResult = {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isTouch: boolean
}