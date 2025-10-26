/**
 * Safe Area Container Component
 *
 * Automatic safe area handling for modern iPhone displays with Dynamic Island and home indicator support.
 * This component provides comprehensive safe area management for React components.
 */

import {  forwardRef, ReactNode, useMemo  } from 'react';
import { cn } from '@/lib/utils';
import {
  useSafeArea,
  getSafeAreaClasses,
  getSafeAreaStyles,
  getDeviceInfo,
  SafeAreaInsets
} from '@/styles/safe-area-utilities';

export interface SafeAreaContainerProps {
  children: ReactNode;
  className?: string;
  /**
   * Enable automatic safe area padding
   * @default true
   */
  enableSafeArea?: boolean;
  /**
   * Additional padding beyond safe area
   * @default 0
   */
  additionalPadding?: number;
  /**
   * Which edges to apply safe area to
   * @default 'all'
   */
  edges?: 'all' | 'top' | 'bottom' | 'horizontal' | 'vertical' | 'top-bottom' | 'left-right';
  /**
   * Use CSS classes instead of inline styles
   * @default true
   */
  useClasses?: boolean;
  /**
   * Minimum padding regardless of safe area
   * @default 16
   */
  minPadding?: number;
  /**
   * Device-specific enhancements
   * @default true
   */
  deviceEnhancements?: boolean;
  /**
   * Responsive breakpoints
   * @default true
   */
  responsive?: boolean;
  /**
   * Handle orientation changes
   * @default true
   */
  orientationAware?: boolean;
}

/**
 * Calculate safe area styles based on edges and padding
 */
function calculateSafeAreaStyles(
  insets: SafeAreaInsets,
  edges: string,
  additionalPadding: number,
  minPadding: number
): React.CSSProperties {
  const styles: React.CSSProperties = {};

  const addPadding = (edge: 'top' | 'right' | 'bottom' | 'left') => {
    const inset = insets[edge];
    const padding = Math.max(inset + additionalPadding, minPadding);
    const edgeMap = {
      top: 'paddingTop',
      right: 'paddingRight',
      bottom: 'paddingBottom',
      left: 'paddingLeft'
    };
    styles[edgeMap[edge]] = `${padding}px`;
  };

  switch (edges) {
    case 'all':
      addPadding('top');
      addPadding('right');
      addPadding('bottom');
      addPadding('left');
      break;
    case 'top':
      addPadding('top');
      break;
    case 'bottom':
      addPadding('bottom');
      break;
    case 'horizontal':
      addPadding('left');
      addPadding('right');
      break;
    case 'vertical':
      addPadding('top');
      addPadding('bottom');
      break;
    case 'top-bottom':
      addPadding('top');
      addPadding('bottom');
      break;
    case 'left-right':
      addPadding('left');
      addPadding('right');
      break;
  }

  return styles;
}

/**
 * Generate CSS classes based on safe area configuration
 */
function generateSafeAreaClasses(
  edges: string,
  deviceEnhancements: boolean,
  responsive: boolean,
  orientationAware: boolean,
  customClasses?: string
): string {
  const classes: string[] = [];

  // Base safe area classes
  if (edges === 'all') {
    classes.push('safe-area-all');
  } else if (edges === 'horizontal') {
    classes.push('safe-area-horizontal');
  } else if (edges === 'vertical') {
    classes.push('safe-area-vertical');
  } else {
    classes.push(`safe-area-inset-${edges}`);
  }

  // Device-specific enhancements
  if (deviceEnhancements) {
    const deviceInfo = getDeviceInfo();

    if (deviceInfo.hasDynamicIsland) {
      classes.push('dynamic-island-aware');
    }

    if (deviceInfo.hasNotch) {
      classes.push('notch-aware');
    }

    // Model-specific classes
    if (deviceInfo.model.includes('Pro-Max') || deviceInfo.model.includes('plus')) {
      classes.push('safe-area-pro-max-enhanced');
    } else if (deviceInfo.model.includes('Pro')) {
      classes.push('safe-area-pro-enhanced');
    } else if (deviceInfo.model.includes('SE') || deviceInfo.model.includes('mini')) {
      classes.push('safe-area-compact');
    } else {
      classes.push('safe-area-standard-enhanced');
    }

    // Orientation-aware classes
    if (orientationAware && deviceInfo.orientation === 'landscape') {
      classes.push('safe-area-landscape');
    }
  }

  // Responsive classes
  if (responsive) {
    classes.push('max-lg:safe-area-all');
  }

  // Add custom classes
  if (customClasses) {
    classes.push(customClasses);
  }

  return classes.join(' ');
}

/**
 * SafeAreaContainer Component
 */
export const SafeAreaContainer = forwardRef<HTMLDivElement, SafeAreaContainerProps>(({
  children,
  className,
  enableSafeArea = true,
  additionalPadding = 0,
  edges = 'all',
  useClasses = true,
  minPadding = 16,
  deviceEnhancements = true,
  responsive = true,
  orientationAware = true,
  ...props
}, ref) => {
  const { safeAreaInsets, deviceInfo } = useSafeArea();

  // Calculate styles if using inline styles
  const safeAreaStyles = useMemo(() => {
    if (!enableSafeArea) return {};

    if (useClasses) {
      // When using classes, we still need some inline styles for dynamic values
      const deviceInfo = getDeviceInfo();
      if (deviceInfo.hasDynamicIsland || deviceInfo.hasNotch) {
        return getSafeAreaStyles(additionalPadding);
      }
      return {};
    }

    return calculateSafeAreaStyles(
      safeAreaInsets,
      edges,
      additionalPadding,
      minPadding
    );
  }, [enableSafeArea, useClasses, safeAreaInsets, edges, additionalPadding, minPadding]);

  // Generate CSS classes
  const safeAreaClasses = useMemo(() => {
    if (!enableSafeArea) return className;

    return generateSafeAreaClasses(
      edges,
      deviceEnhancements,
      responsive,
      orientationAware,
      className
    );
  }, [enableSafeArea, edges, deviceEnhancements, responsive, orientationAware, className]);

  return (
    <div
      ref={ref}
      className={cn(
        'safe-area-container',
        enableSafeArea && safeAreaClasses
      )}
      style={safeAreaStyles}
      {...props}
    >
      {children}
    </div>
  );
});

SafeAreaContainer.displayName = 'SafeAreaContainer';

/**
 * Specialized Safe Area Containers
 */

/**
 * Header Safe Area Container - Optimized for headers with Dynamic Island awareness
 */
export const SafeAreaHeader = forwardRef<HTMLDivElement, Omit<SafeAreaContainerProps, 'edges'>>(
  ({ children, className, ...props }, ref) => {
    return (
      <SafeAreaContainer
        ref={ref}
        edges="top-horizontal"
        additionalPadding={8}
        deviceEnhancements={true}
        className={cn('safe-area-header', className)}
        {...props}
      >
        {children}
      </SafeAreaContainer>
    );
  }
);

SafeAreaHeader.displayName = 'SafeAreaHeader';

/**
 * Footer Safe Area Container - Optimized for footers with home indicator awareness
 */
export const SafeAreaFooter = forwardRef<HTMLDivElement, Omit<SafeAreaContainerProps, 'edges'>>(
  ({ children, className, ...props }, ref) => {
    return (
      <SafeAreaContainer
        ref={ref}
        edges="bottom-horizontal"
        additionalPadding={8}
        deviceEnhancements={true}
        className={cn('safe-area-footer', className)}
        {...props}
      >
        {children}
      </SafeAreaContainer>
    );
  }
);

SafeAreaFooter.displayName = 'SafeAreaFooter';

/**
 * Modal Safe Area Container - Optimized for modals and overlays
 */
export const SafeAreaModal = forwardRef<HTMLDivElement, Omit<SafeAreaContainerProps, 'additionalPadding'>>(
  ({ children, className, additionalPadding = 16, ...props }, ref) => {
    return (
      <SafeAreaContainer
        ref={ref}
        edges="all"
        additionalPadding={additionalPadding}
        deviceEnhancements={true}
        orientationAware={true}
        className={cn('safe-area-modal', className)}
        {...props}
      >
        {children}
      </SafeAreaContainer>
    );
  }
);

SafeAreaModal.displayName = 'SafeAreaModal';

/**
 * Navigation Safe Area Container - Optimized for navigation bars
 */
export const SafeAreaNavigation = forwardRef<HTMLDivElement, Omit<SafeAreaContainerProps, 'edges'>>(
  ({ children, className, ...props }, ref) => {
    return (
      <SafeAreaContainer
        ref={ref}
        edges="top-horizontal"
        additionalPadding={4}
        minPadding={8}
        deviceEnhancements={true}
        className={cn('safe-area-navigation', className)}
        {...props}
      >
        {children}
      </SafeAreaContainer>
    );
  }
);

SafeAreaNavigation.displayName = 'SafeAreaNavigation';

/**
 * Tab Bar Safe Area Container - Optimized for bottom tab bars
 */
export const SafeAreaTabBar = forwardRef<HTMLDivElement, Omit<SafeAreaContainerProps, 'edges'>>(
  ({ children, className, ...props }, ref) => {
    return (
      <SafeAreaContainer
        ref={ref}
        edges="bottom-horizontal"
        additionalPadding={0}
        minPadding={0}
        deviceEnhancements={true}
        className={cn('safe-area-tab-bar', className)}
        {...props}
      >
        {children}
      </SafeAreaContainer>
    );
  }
);

SafeAreaTabBar.displayName = 'SafeAreaTabBar';

/**
 * Floating Action Button Safe Area Container - Optimized for FAB positioning
 */
export const SafeAreaFAB = forwardRef<HTMLDivElement, Omit<SafeAreaContainerProps, 'edges'>>(
  ({ children, className, ...props }, ref) => {
    return (
      <SafeAreaContainer
        ref={ref}
        edges="bottom-right"
        additionalPadding={24}
        minPadding={24}
        deviceEnhancements={true}
        className={cn('safe-area-fab', className)}
        {...props}
      >
        {children}
      </SafeAreaContainer>
    );
  }
);

SafeAreaFAB.displayName = 'SafeAreaFAB';

export default SafeAreaContainer;