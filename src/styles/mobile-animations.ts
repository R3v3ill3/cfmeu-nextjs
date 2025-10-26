/**
 * Mobile-Optimized Animation System
 *
 * Mobile-optimized animations with touch-friendly easing,
 * shorter durations, and performance considerations.
 */

import type { CSSProperties } from 'react'
import { mobileTokens } from './mobile-design-tokens'

// Animation keyframes optimized for mobile
export const keyframes = {
  // Entry animations
  fadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },

  slideUp: {
    from: { transform: 'translateY(100%)', opacity: 0 },
    to: { transform: 'translateY(0)', opacity: 1 },
  },

  slideDown: {
    from: { transform: 'translateY(-100%)', opacity: 0 },
    to: { transform: 'translateY(0)', opacity: 1 },
  },

  slideLeft: {
    from: { transform: 'translateX(100%)', opacity: 0 },
    to: { transform: 'translateX(0)', opacity: 1 },
  },

  slideRight: {
    from: { transform: 'translateX(-100%)', opacity: 0 },
    to: { transform: 'translateX(0)', opacity: 1 },
  },

  scaleIn: {
    from: { transform: 'scale(0.8)', opacity: 0 },
    to: { transform: 'scale(1)', opacity: 1 },
  },

  scaleOut: {
    from: { transform: 'scale(1)', opacity: 1 },
    to: { transform: 'scale(0.8)', opacity: 0 },
  },

  // Touch feedback animations
  touchPress: {
    from: { transform: 'scale(1)' },
    to: { transform: 'scale(0.95)' },
  },

  touchRelease: {
    from: { transform: 'scale(0.95)' },
    to: { transform: 'scale(1)' },
  },

  // Loading animations
  spin: {
    from: { transform: 'rotate(0deg)' },
    to: { transform: 'rotate(360deg)' },
  },

  pulse: {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.5 },
  },

  bounce: {
    '0%, 100%': { transform: 'translateY(0)' },
    '50%': { transform: 'translateY(-10px)' },
  },

  // Swipe animations
  swipeReveal: {
    from: { transform: 'translateX(0)' },
    to: { transform: 'translateX(-100%)' },
  },

  swipeDismiss: {
    from: { transform: 'translateX(0)' },
    to: { transform: 'translateX(100%)' },
  },

  // Progress animations
  progressFill: {
    from: { width: '0%' },
    to: { width: '100%' },
  },

  // Notification animations
  notificationSlideIn: {
    from: { transform: 'translateY(-100%)', opacity: 0 },
    to: { transform: 'translateY(0)', opacity: 1 },
  },

  notificationSlideOut: {
    from: { transform: 'translateY(0)', opacity: 1 },
    to: { transform: 'translateY(-100%)', opacity: 0 },
  },

  // Modal animations
  modalFadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },

  modalSlideUp: {
    from: { transform: 'translateY(100%)' },
    to: { transform: 'translateY(0)' },
  },

  // Tab animations
  tabIndicator: {
    from: { transform: 'translateX(var(--tab-from))' },
    to: { transform: 'translateX(var(--tab-to))' },
  },

  // Skeleton loading
  skeleton: {
    '0%': { backgroundPosition: '-200% 0' },
    '100%': { backgroundPosition: '200% 0' },
  },
}

// Animation configurations optimized for mobile
export const animations = {
  // Fast feedback animations (150ms)
  fast: {
    duration: mobileTokens.animation.duration.fast,
    easing: mobileTokens.animation.easing.easeOut,
  },

  // Standard animations (200ms)
  base: {
    duration: mobileTokens.animation.duration.base,
    easing: mobileTokens.animation.easing.easeOut,
  },

  // Slow animations (300ms)
  slow: {
    duration: mobileTokens.animation.duration.slow,
    easing: mobileTokens.animation.easing.easeInOut,
  },

  // Page transitions (500ms)
  pageTransition: {
    duration: mobileTokens.animation.duration.slower,
    easing: mobileTokens.animation.easing.easeInOut,
  },

  // Touch feedback animations (100ms)
  touchFeedback: {
    duration: '100ms',
    easing: mobileTokens.animation.easing.easeOut,
  },

  // Spring animations
  spring: {
    duration: '400ms',
    easing: mobileTokens.animation.easing.spring,
  },

  // Gentle spring animations
  springGentle: {
    duration: '300ms',
    easing: mobileTokens.animation.easing.springGentle,
  },

  // Bouncy animations for delightful interactions
  bounce: {
    duration: '600ms',
    easing: mobileTokens.animation.easing.springBouncy,
  },
}

// Preset animation configurations
export const presets = {
  // Entry presets
  entry: {
    fadeIn: {
      keyframe: keyframes.fadeIn,
      config: animations.base,
      fillMode: 'forwards',
    },

    slideUp: {
      keyframe: keyframes.slideUp,
      config: animations.base,
      fillMode: 'forwards',
    },

    slideDown: {
      keyframe: keyframes.slideDown,
      config: animations.base,
      fillMode: 'forwards',
    },

    slideLeft: {
      keyframe: keyframes.slideLeft,
      config: animations.base,
      fillMode: 'forwards',
    },

    slideRight: {
      keyframe: keyframes.slideRight,
      config: animations.base,
      fillMode: 'forwards',
    },

    scaleIn: {
      keyframe: keyframes.scaleIn,
      config: animations.spring,
      fillMode: 'forwards',
    },
  },

  // Exit presets
  exit: {
    fadeOut: {
      keyframe: keyframes.fadeIn,
      config: animations.base,
      fillMode: 'backwards',
      direction: 'reverse',
    },

    slideUp: {
      keyframe: keyframes.slideUp,
      config: animations.base,
      fillMode: 'backwards',
      direction: 'reverse',
    },

    scaleOut: {
      keyframe: keyframes.scaleOut,
      config: animations.base,
      fillMode: 'forwards',
    },
  },

  // Touch interaction presets
  touch: {
    press: {
      keyframe: keyframes.touchPress,
      config: animations.touchFeedback,
    },

    release: {
      keyframe: keyframes.touchRelease,
      config: animations.touchFeedback,
    },
  },

  // Loading presets
  loading: {
    spin: {
      keyframe: keyframes.spin,
      config: {
        duration: '1s',
        easing: 'linear',
        iterationCount: 'infinite',
      },
    },

    pulse: {
      keyframe: keyframes.pulse,
      config: {
        duration: '1.5s',
        easing: 'ease-in-out',
        iterationCount: 'infinite',
      },
    },

    bounce: {
      keyframe: keyframes.bounce,
      config: {
        duration: '1s',
        easing: 'ease-in-out',
        iterationCount: 'infinite',
      },
    },

    skeleton: {
      keyframe: keyframes.skeleton,
      config: {
        duration: '1.5s',
        easing: 'ease-in-out',
        iterationCount: 'infinite',
      },
    },
  },

  // Navigation presets
  navigation: {
    swipeReveal: {
      keyframe: keyframes.swipeReveal,
      config: animations.base,
      fillMode: 'forwards',
    },

    swipeDismiss: {
      keyframe: keyframes.swipeDismiss,
      config: animations.base,
      fillMode: 'forwards',
    },

    tabIndicator: {
      keyframe: keyframes.tabIndicator,
      config: animations.base,
      fillMode: 'forwards',
    },
  },

  // UI presets
  ui: {
    notificationSlideIn: {
      keyframe: keyframes.notificationSlideIn,
      config: animations.fast,
      fillMode: 'forwards',
    },

    notificationSlideOut: {
      keyframe: keyframes.notificationSlideOut,
      config: animations.fast,
      fillMode: 'forwards',
    },

    modalFadeIn: {
      keyframe: keyframes.modalFadeIn,
      config: animations.base,
      fillMode: 'forwards',
    },

    modalSlideUp: {
      keyframe: keyframes.modalSlideUp,
      config: animations.slow,
      fillMode: 'forwards',
    },
  },
}

// Performance-optimized animation utilities
export const createAnimation = (
  keyframe: Keyframe[],
  config: KeyframeAnimationOptions,
  options?: {
    reduceMotion?: boolean
    performance?: boolean
  }
) => {
  // Check if user prefers reduced motion
  if (options?.reduceMotion !== false) {
    return {
      keyframe: [{ opacity: 1 }],
      config: { duration: 0 },
    }
  }

  // Performance optimizations for mobile
  if (options?.performance !== false) {
    // Enable hardware acceleration
    keyframe = keyframe.map(frame => ({
      ...frame,
      transform: frame.transform ? `${frame.transform} translateZ(0)` : undefined,
      willChange: 'transform, opacity',
    }))
  }

  return { keyframe, config }
}

// CSS animation utility functions
export const cssAnimation = {
  // Create CSS animation string
  create: (
    name: string,
    duration: string = animations.base.duration,
    easing: string = animations.base.easing,
    delay: string = '0ms',
    iterationCount: string = '1',
    direction: string = 'normal',
    fillMode: string = 'forwards'
  ) => ({
    animation: `${name} ${duration} ${easing} ${delay} ${iterationCount} ${direction} ${fillMode}`,
  }),

  // Create transform-based animation for better performance
  transform: {
    translate: (x: number, y: number) => `translate(${x}px, ${y}px)`,
    scale: (scale: number) => `scale(${scale})`,
    rotate: (degrees: number) => `rotate(${degrees}deg)`,
    translate3d: (x: number, y: number, z: number) => `translate3d(${x}px, ${y}px, ${z}px)`,
  },

  // Hardware acceleration utilities
  accelerate: (styles: CSSProperties) => ({
    ...styles,
    transform: styles.transform ? `${styles.transform} translateZ(0)` : 'translateZ(0)',
    willChange: 'transform, opacity',
    backfaceVisibility: 'hidden' as const,
    perspective: '1000px',
  }),
}

// Gesture animation helpers
export const gestureAnimations = {
  // Swipe animation helper
  swipe: (element: HTMLElement, direction: 'left' | 'right' | 'up' | 'down') => {
    const animations = {
      left: keyframes.swipeDismiss,
      right: keyframes.swipeReveal,
      up: keyframes.slideUp,
      down: keyframes.slideDown,
    }

    return element.animate(animations[direction], animations.base)
  },

  // Pull to refresh animation
  pullToRefresh: (element: HTMLElement, progress: number) => {
    const scale = 0.5 + (progress * 0.5)
    const rotation = progress * 360

    return element.animate([
      { transform: `scale(${scale}) rotate(${rotation}deg)` },
    ], {
      duration: 100,
      fill: 'forwards',
    })
  },

  // Tab switch animation
  tabSwitch: (fromTab: HTMLElement, toTab: HTMLElement) => {
    const fromRect = fromTab.getBoundingClientRect()
    const toRect = toTab.getBoundingClientRect()

    const deltaX = toRect.left - fromRect.left

    return [
      fromTab.animate([
        { transform: 'translateX(0)', opacity: 1 },
        { transform: `translateX(-${deltaX}px)`, opacity: 0 },
      ], animations.base),

      toTab.animate([
        { transform: `translateX(${deltaX}px)`, opacity: 0 },
        { transform: 'translateX(0)', opacity: 1 },
      ], animations.base),
    ]
  },
}

// Animation hooks (placeholder for React hooks)
export const useAnimation = () => {
  // This would be implemented as a React hook
  // For now, returning utility functions
  return {
    create: createAnimation,
    gesture: gestureAnimations,
    css: cssAnimation,
  }
}

// CSS animations export for global styles
export const globalAnimations = {
  // Generate CSS keyframes
  keyframes: () => `
    @keyframes fade-in {
      ${JSON.stringify(keyframes.fadeIn).replace(/[{}]/g, '').replace(/"/g, '')}
    }

    @keyframes slide-up {
      ${JSON.stringify(keyframes.slideUp).replace(/[{}]/g, '').replace(/"/g, '')}
    }

    @keyframes slide-down {
      ${JSON.stringify(keyframes.slideDown).replace(/[{}]/g, '').replace(/"/g, '')}
    }

    @keyframes slide-left {
      ${JSON.stringify(keyframes.slideLeft).replace(/[{}]/g, '').replace(/"/g, '')}
    }

    @keyframes slide-right {
      ${JSON.stringify(keyframes.slideRight).replace(/[{}]/g, '').replace(/"/g, '')}
    }

    @keyframes scale-in {
      ${JSON.stringify(keyframes.scaleIn).replace(/[{}]/g, '').replace(/"/g, '')}
    }

    @keyframes scale-out {
      ${JSON.stringify(keyframes.scaleOut).replace(/[{}]/g, '').replace(/"/g, '')}
    }

    @keyframes spin {
      ${JSON.stringify(keyframes.spin).replace(/[{}]/g, '').replace(/"/g, '')}
    }

    @keyframes pulse {
      ${JSON.stringify(keyframes.pulse).replace(/[{}]/g, '').replace(/"/g, '')}
    }

    @keyframes bounce {
      ${JSON.stringify(keyframes.bounce).replace(/[{}]/g, '').replace(/"/g, '')}
    }

    @keyframes skeleton {
      ${JSON.stringify(keyframes.skeleton).replace(/[{}]/g, '').replace(/"/g, '')}
    }

    @keyframes swipe-reveal {
      ${JSON.stringify(keyframes.swipeReveal).replace(/[{}]/g, '').replace(/"/g, '')}
    }

    @keyframes swipe-dismiss {
      ${JSON.stringify(keyframes.swipeDismiss).replace(/[{}]/g, '').replace(/"/g, '')}
    }

    @keyframes notification-slide-in {
      ${JSON.stringify(keyframes.notificationSlideIn).replace(/[{}]/g, '').replace(/"/g, '')}
    }

    @keyframes notification-slide-out {
      ${JSON.stringify(keyframes.notificationSlideOut).replace(/[{}]/g, '').replace(/"/g, '')}
    }

    @keyframes modal-slide-up {
      ${JSON.stringify(keyframes.modalSlideUp).replace(/[{}]/g, '').replace(/"/g, '')}
    }
  `,

  // Generate CSS utility classes
  utilityClasses: () => `
    .fade-in {
      animation: fade-in ${animations.base.duration} ${animations.base.easing} forwards;
    }

    .slide-up {
      animation: slide-up ${animations.base.duration} ${animations.base.easing} forwards;
    }

    .slide-down {
      animation: slide-down ${animations.base.duration} ${animations.base.easing} forwards;
    }

    .slide-left {
      animation: slide-left ${animations.base.duration} ${animations.base.easing} forwards;
    }

    .slide-right {
      animation: slide-right ${animations.base.duration} ${animations.base.easing} forwards;
    }

    .scale-in {
      animation: scale-in ${animations.spring.duration} ${animations.spring.easing} forwards;
    }

    .scale-out {
      animation: scale-out ${animations.base.duration} ${animations.base.easing} forwards;
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    .pulse {
      animation: pulse 1.5s ease-in-out infinite;
    }

    .bounce {
      animation: bounce 1s ease-in-out infinite;
    }

    .skeleton {
      animation: skeleton 1.5s ease-in-out infinite;
      background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
      background-size: 200% 100%;
    }

    .swipe-reveal {
      animation: swipe-reveal ${animations.base.duration} ${animations.base.easing} forwards;
    }

    .swipe-dismiss {
      animation: swipe-dismiss ${animations.base.duration} ${animations.base.easing} forwards;
    }

    .notification-slide-in {
      animation: notification-slide-in ${animations.fast.duration} ${animations.fast.easing} forwards;
    }

    .notification-slide-out {
      animation: notification-slide-out ${animations.fast.duration} ${animations.fast.easing} forwards;
    }

    .modal-slide-up {
      animation: modal-slide-up ${animations.slow.duration} ${animations.slow.easing} forwards;
    }

    /* Touch feedback classes */
    .touch-press {
      animation: touch-press ${animations.touchFeedback.duration} ${animations.touchFeedback.easing} forwards;
    }

    .gpu-accelerated {
      transform: translateZ(0);
      will-change: transform, opacity;
      backface-visibility: hidden;
      perspective: 1000px;
    }

    /* Reduced motion support */
    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }
  `,
}

// Type definitions
export type AnimationPreset = typeof presets
export type KeyframeType = typeof keyframes
export type AnimationConfig = typeof animations
export type CSSAnimationUtils = typeof cssAnimation
export type GestureAnimationUtils = typeof gestureAnimations

export default {
  keyframes,
  animations,
  presets,
  createAnimation,
  cssAnimation,
  gestureAnimations,
  globalAnimations,
}