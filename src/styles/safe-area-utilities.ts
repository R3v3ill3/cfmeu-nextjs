/**
 * Safe Area Utilities
 *
 * Comprehensive safe area detection, calculation, and helper functions
 * for modern iPhone displays with Dynamic Island and home indicator support.
 */

// Device detection interfaces
interface DeviceInfo {
  isIOS: boolean;
  isiPhone: boolean;
  hasNotch: boolean;
  hasDynamicIsland: boolean;
  model: iPhoneModel;
  screenSize: ScreenSize;
  orientation: Orientation;
}

interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

type iPhoneModel =
  | 'iPhone-13'
  | 'iPhone-13-mini'
  | 'iPhone-13-Pro'
  | 'iPhone-13-Pro-Max'
  | 'iPhone-14'
  | 'iPhone-14-plus'
  | 'iPhone-14-Pro'
  | 'iPhone-14-Pro-Max'
  | 'iPhone-15'
  | 'iPhone-15-plus'
  | 'iPhone-15-Pro'
  | 'iPhone-15-Pro-Max'
  | 'iPhone-SE'
  | 'iPhone-12-mini'
  | 'iPhone-12'
  | 'iPhone-12-Pro'
  | 'iPhone-12-Pro-Max'
  | 'unknown';

type ScreenSize = {
  width: number;
  height: number;
};

type Orientation = 'portrait' | 'landscape';

/**
 * Dynamic Island device specifications
 */
const DYNAMIC_ISLAND_DEVICES: Record<string, { width: number; height: number }> = {
  'iPhone-14-Pro': { width: 393, height: 852 },
  'iPhone-14-Pro-Max': { width: 430, height: 932 },
  'iPhone-15': { width: 393, height: 852 },
  'iPhone-15-plus': { width: 430, height: 932 },
  'iPhone-15-Pro': { width: 393, height: 852 },
  'iPhone-15-Pro-Max': { width: 430, height: 932 },
};

/**
 * Notch device specifications (pre-Dynamic Island)
 */
const NOTCH_DEVICES: Record<string, { width: number; height: number }> = {
  'iPhone-12-mini': { width: 375, height: 812 },
  'iPhone-12': { width: 390, height: 844 },
  'iPhone-12-Pro': { width: 390, height: 844 },
  'iPhone-12-Pro-Max': { width: 428, height: 926 },
  'iPhone-13-mini': { width: 375, height: 812 },
  'iPhone-13': { width: 390, height: 844 },
  'iPhone-13-Pro': { width: 390, height: 844 },
  'iPhone-13-Pro-Max': { width: 428, height: 926 },
  'iPhone-14': { width: 390, height: 844 },
  'iPhone-14-plus': { width: 428, height: 926 },
};

/**
 * Home indicator dimensions
 */
const HOME_INDICATOR = {
  portrait: 34,
  landscape: 21,
};

/**
 * Dynamic Island dimensions
 */
const DYNAMIC_ISLAND = {
  height: 32,
  width: 126,
  padding: 8,
};

/**
 * Detect iOS device
 */
export function detectIOS(): boolean {
  if (typeof window === 'undefined') return false;

  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Detect iPhone device
 */
export function detectiPhone(): boolean {
  if (typeof window === 'undefined') return false;

  return /iPhone/.test(navigator.userAgent) ||
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 && window.screen.width < 500);
}

/**
 * Get current screen dimensions
 */
export function getScreenSize(): ScreenSize {
  if (typeof window === 'undefined') return { width: 0, height: 0 };

  return {
    width: window.screen.width,
    height: window.screen.height,
  };
}

/**
 * Get current orientation
 */
export function getOrientation(): Orientation {
  if (typeof window === 'undefined') return 'portrait';

  return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
}

/**
 * Detect iPhone model based on screen dimensions
 */
export function detectiPhoneModel(): iPhoneModel {
  if (typeof window === 'undefined') return 'unknown';

  const { width, height } = getScreenSize();
  const actualWidth = Math.min(width, height);
  const actualHeight = Math.max(width, height);

  // Check Dynamic Island devices first
  for (const [model, dimensions] of Object.entries(DYNAMIC_ISLAND_DEVICES)) {
    if (dimensions.width === actualWidth && dimensions.height === actualHeight) {
      return model as iPhoneModel;
    }
  }

  // Check notch devices
  for (const [model, dimensions] of Object.entries(NOTCH_DEVICES)) {
    if (dimensions.width === actualWidth && dimensions.height === actualHeight) {
      return model as iPhoneModel;
    }
  }

  // Check for iPhone SE and other small devices
  if (actualWidth === 375 && actualHeight <= 667) {
    return 'iPhone-SE';
  }

  return 'unknown';
}

/**
 * Check if device has Dynamic Island
 */
export function hasDynamicIsland(): boolean {
  const model = detectiPhoneModel();
  return Object.keys(DYNAMIC_ISLAND_DEVICES).includes(model);
}

/**
 * Check if device has notch (pre-Dynamic Island)
 */
export function hasNotch(): boolean {
  const model = detectiPhoneModel();
  return Object.keys(NOTCH_DEVICES).includes(model);
}

/**
 * Get safe area insets from CSS environment variables
 */
export function getSafeAreaInsets(): SafeAreaInsets {
  if (typeof window === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const computedStyle = getComputedStyle(document.documentElement);

  return {
    top: parseInt(computedStyle.getPropertyValue('--safe-area-inset-top')) || 0,
    right: parseInt(computedStyle.getPropertyValue('--safe-area-inset-right')) || 0,
    bottom: parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom')) || 0,
    left: parseInt(computedStyle.getPropertyValue('--safe-area-inset-left')) || 0,
  };
}

/**
 * Get enhanced safe area calculations with device-specific adjustments
 */
export function getEnhancedSafeAreaInsets(): SafeAreaInsets {
  const baseInsets = getSafeAreaInsets();
  const model = detectiPhoneModel();
  const orientation = getOrientation();

  let enhanced = { ...baseInsets };

  // Add Dynamic Island padding
  if (hasDynamicIsland()) {
    enhanced.top += DYNAMIC_ISLAND.height + DYNAMIC_ISLAND.padding;
  } else if (hasNotch()) {
    // Add notch padding
    enhanced.top += 30; // Standard notch height approximation
  }

  // Add home indicator padding
  if (detectiPhone() && baseInsets.bottom > 0) {
    enhanced.bottom += orientation === 'portrait'
      ? HOME_INDICATOR.portrait
      : HOME_INDICATOR.landscape;
  }

  // Device-specific adjustments
  switch (model) {
    case 'iPhone-14-Pro':
    case 'iPhone-15-Pro':
    case 'iPhone-15':
      enhanced.top += 16; // Additional Dynamic Island margin
      break;
    case 'iPhone-14-Pro-Max':
    case 'iPhone-15-Pro-Max':
    case 'iPhone-15-plus':
      enhanced.top += 20; // Additional Dynamic Island margin for Pro Max
      enhanced.bottom += 8; // Additional bottom padding for Pro Max
      break;
    case 'iPhone-13':
    case 'iPhone-14':
      enhanced.top += 12; // Standard iPhone 13/14
      break;
    case 'iPhone-13-Pro-Max':
    case 'iPhone-14-plus':
      enhanced.top += 16; // Plus models
      enhanced.bottom += 4;
      break;
  }

  return enhanced;
}

/**
 * Get comprehensive device information
 */
export function getDeviceInfo(): DeviceInfo {
  return {
    isIOS: detectIOS(),
    isiPhone: detectiPhone(),
    hasNotch: hasNotch(),
    hasDynamicIsland: hasDynamicIsland(),
    model: detectiPhoneModel(),
    screenSize: getScreenSize(),
    orientation: getOrientation(),
  };
}

/**
 * Calculate safe area-aware CSS styles
 */
export function getSafeAreaStyles(additionalPadding = 0): React.CSSProperties {
  const insets = getEnhancedSafeAreaInsets();

  return {
    paddingTop: `${insets.top + additionalPadding}px`,
    paddingBottom: `${insets.bottom + additionalPadding}px`,
    paddingLeft: `${insets.left + additionalPadding}px`,
    paddingRight: `${insets.right + additionalPadding}px`,
  };
}

/**
 * Calculate safe area-aware margin for avoiding overlays
 */
export function getSafeAreaMargins(): React.CSSProperties {
  const insets = getEnhancedSafeAreaInsets();
  const orientation = getOrientation();

  return {
    marginTop: orientation === 'landscape' ? '0' : `${insets.top}px`,
    marginBottom: orientation === 'landscape' ? `${insets.bottom}px` : '0',
    marginLeft: orientation === 'landscape' ? `${insets.left}px` : '0',
    marginRight: orientation === 'landscape' ? `${insets.right}px` : '0',
  };
}

/**
 * Check if viewport is safe for overlays
 */
export function isViewportSafeForOverlay(): boolean {
  const deviceInfo = getDeviceInfo();
  const insets = getEnhancedSafeAreaInsets();

  // Check if there's enough space after accounting for safe areas
  const availableWidth = window.innerWidth - insets.left - insets.right;
  const availableHeight = window.innerHeight - insets.top - insets.bottom;

  return availableWidth >= 300 && availableHeight >= 200;
}

/**
 * Get safe area-aware viewport dimensions
 */
export function getSafeViewport(): ScreenSize {
  const insets = getEnhancedSafeAreaInsets();
  const { width, height } = getScreenSize();

  return {
    width: width - insets.left - insets.right,
    height: height - insets.top - insets.bottom,
  };
}

/**
 * Generate safe area CSS classes
 */
export function getSafeAreaClasses(): string {
  const deviceInfo = getDeviceInfo();
  const classes: string[] = [];

  // Base safe area classes
  classes.push('safe-area-all');

  // Device-specific classes
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

  // Orientation-specific classes
  if (deviceInfo.orientation === 'landscape') {
    classes.push('safe-area-landscape');
  }

  return classes.join(' ');
}

/**
 * Hook for reactive safe area updates
 */
export function useSafeArea() {
  const [deviceInfo, setDeviceInfo] = React.useState<DeviceInfo>(getDeviceInfo());

  React.useEffect(() => {
    const handleResize = () => {
      setDeviceInfo(getDeviceInfo());
    };

    const handleOrientationChange = () => {
      // Small delay to allow orientation change to complete
      setTimeout(handleResize, 100);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      window.addEventListener('orientationchange', handleOrientationChange);

      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleOrientationChange);
      };
    }
  }, []);

  return {
    deviceInfo,
    safeAreaInsets: getEnhancedSafeAreaInsets(),
    safeAreaStyles: getSafeAreaStyles(),
    safeAreaClasses: getSafeAreaClasses(),
    safeViewport: getSafeViewport(),
    isSafeForOverlay: isViewportSafeForOverlay(),
  };
}

/**
 * Safe area validation functions
 */
export const safeAreaValidation = {
  /**
   * Validate that safe area calculations are working
   */
  validateSafeAreaSupport(): boolean {
    if (typeof window === 'undefined') return false;

    const testElement = document.createElement('div');
    testElement.style.paddingTop = 'env(safe-area-inset-top)';
    document.body.appendChild(testElement);

    const computedStyle = getComputedStyle(testElement);
    const hasSupport = computedStyle.paddingTop !== 'env(safe-area-inset-top)';

    document.body.removeChild(testElement);
    return hasSupport;
  },

  /**
   * Check for Dynamic Island support
   */
  validateDynamicIslandSupport(): boolean {
    return hasDynamicIsland() && getSafeAreaInsets().top >= 32;
  },

  /**
   * Get safe area compatibility score
   */
  getCompatibilityScore(): number {
    const deviceInfo = getDeviceInfo();
    let score = 0;

    if (deviceInfo.isIOS) score += 30;
    if (deviceInfo.isiPhone) score += 30;
    if (deviceInfo.hasDynamicIsland) score += 20;
    if (deviceInfo.hasNotch) score += 15;
    if (this.validateSafeAreaSupport()) score += 5;

    return Math.min(score, 100);
  },
};

// React import (avoiding import statement to keep this file pure)
declare const React: any;