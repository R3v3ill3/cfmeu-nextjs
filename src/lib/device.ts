/**
 * Device detection utilities for mobile optimization
 */

export function isMobileOrTablet(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  // Common mobile and tablet indicators
  const mobileTabletRegex = /mobile|iphone|ipod|android(?!.*tv)|blackberry|bb10|mini|windows phone|webos|tablet|ipad/;
  return mobileTabletRegex.test(ua);
}

/**
 * Check if current device is mobile (client-side only)
 * Returns false on server to avoid SSR mismatches
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return isMobileOrTablet(navigator.userAgent);
}

/**
 * Check if current connection is slow (3G or worse)
 */
export function isSlowConnection(): boolean {
  if (typeof window === 'undefined' || !('connection' in navigator)) {
    // Fallback: assume slow connection on mobile without API support
    return isMobile();
  }

  const connection = (navigator as any).connection ||
                    (navigator as any).mozConnection ||
                    (navigator as any).webkitConnection;

  if (!connection) return isMobile(); // Fallback

  // Check effective type (4g, 3g, 2g, slow-2g)
  const effectiveType = connection.effectiveType;
  if (effectiveType) {
    return ['slow-2g', '2g', '3g'].includes(effectiveType);
  }

  // Fallback: check downlink speed
  if (connection.downlink) {
    return connection.downlink < 1.5; // Less than 1.5 Mbps
  }

  return false;
}

/**
 * Get comprehensive device information
 */
export function getDeviceInfo() {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isSlowConnection: false,
      userAgent: 'server',
      screen: { width: 0, height: 0 },
      viewport: { width: 0, height: 0 },
      pixelRatio: 1,
      touchSupport: false,
      memory: { deviceMemory: 0, jsHeapSizeLimit: 0 }
    };
  }

  return {
    isMobile: isMobile(),
    isSlowConnection: isSlowConnection(),
    userAgent: navigator.userAgent,
    screen: {
      width: window.screen.width,
      height: window.screen.height
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    pixelRatio: window.devicePixelRatio || 1,
    touchSupport: 'ontouchstart' in window,
    memory: {
      deviceMemory: (navigator as any).deviceMemory || 0,
      jsHeapSizeLimit: (performance as any).memory?.jsHeapSizeLimit || 0
    }
  };
}

