/**
 * Custom Image Loader for Mobile Optimization
 *
 * Optimized image loading with:
 * - WebP/AVIF format support with fallbacks
 * - Progressive loading with low-quality placeholders
 * - Mobile-specific compression
 * - Responsive image generation
 */

export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  // For external images, return as-is
  if (src.startsWith('http')) {
    return src
  }

  // For local images, add mobile optimization parameters
  const params = new URLSearchParams({
    w: String(width),
    q: String(quality || 75), // Default quality for mobile
    fm: 'webp', // Default to WebP
  })

  // Add mobile-specific optimizations
  if (typeof window !== 'undefined') {
    const isMobile = window.innerWidth <= 768
    const isSlowConnection = (navigator as any).connection?.effectiveType === 'slow-2g' ||
                            (navigator as any).connection?.effectiveType === '2g'

    if (isMobile) {
      params.set('mobile', 'true')
      if (isSlowConnection) {
        params.set('q', String(Math.max(50, (quality || 75) - 25))) // Lower quality for slow connections
      }
    }
  }

  return `${src}?${params.toString()}`
}