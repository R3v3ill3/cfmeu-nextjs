/**
 * Optimized Image Component for Mobile Delivery
 *
 * Features:
 * - Responsive images with mobile breakpoints
 * - Next-gen formats (WebP, AVIF) with fallbacks
 * - Lazy loading with intersection observers
 * - Progressive loading with low-quality placeholders
 * - Critical image inlining for above-the-fold content
 */

'use client'

import { useState, useEffect, useRef, useCallback, type FC, type SyntheticEvent } from 'react'
import Image, { ImageProps } from 'next/image'
import { cn } from '@/lib/utils'
import { isMobile, isSlowConnection } from '@/lib/device'

// Mobile-specific image configurations
const MOBILE_BREAKPOINTS = {
  xs: 320,   // iPhone SE
  sm: 375,   // iPhone 12/13
  md: 414,   // iPhone 12/13 Pro Max
  lg: 768,   // iPad Mini
  xl: 1024,  // iPad
}

const MOBILE_QUALITY_SETTINGS = {
  fast: { thumbnail: 30, full: 75 },
  slow: { thumbnail: 20, full: 60 },
  offline: { thumbnail: 15, full: 50 },
}

interface OptimizedImageProps extends Omit<ImageProps, 'onLoad' | 'onError'> {
  // Mobile-specific props
  priority?: boolean // Critical image - loads immediately
  lazy?: boolean // Enable lazy loading (default: true)
  placeholderQuality?: number // Low-quality placeholder quality
  enableProgressive?: boolean // Enable progressive loading
  fallbackSrc?: string // Fallback image source
  sizes?: string // Responsive sizes attribute

  // Mobile optimization props
  compressForMobile?: boolean // Additional mobile compression
  generateBlurDataURL?: boolean // Generate blur data URL
  skipOptimization?: boolean // Skip mobile optimization

  // Loading states
  showPlaceholder?: boolean // Show placeholder during load
  showSkeleton?: boolean // Show skeleton loader

  // Event handlers
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void
  onError?: (error: SyntheticEvent<HTMLImageElement>) => void
  onProgress?: (progress: number) => void
}

interface LoadingState {
  isLoading: boolean
  isLoaded: boolean
  isError: boolean
  progress: number
}

const OptimizedImage: FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  lazy = true,
  placeholderQuality,
  enableProgressive = true,
  fallbackSrc,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',

  // Mobile optimization
  compressForMobile = true,
  generateBlurDataURL = true,
  skipOptimization = false,

  // Loading states
  showPlaceholder = true,
  showSkeleton = true,

  // Event handlers
  onLoad,
  onError,
  onProgress,

  ...props
}) => {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: true,
    isLoaded: false,
    isError: false,
    progress: 0,
  })

  const [imageSrc, setImageSrc] = useState<string>(src as string)
  const [retryCount, setRetryCount] = useState(0)
  const imgRef = useRef<HTMLImageElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const progressTrackerRef = useRef<{ loaded: number; total: number }>({ loaded: 0, total: 0 })

  // Get mobile-specific quality settings
  const getQualitySettings = useCallback(() => {
    if (skipOptimization) return { thumbnail: 50, full: 80 }

    const connectionType = (navigator as any).connection?.effectiveType
    if (!navigator.onLine) return MOBILE_QUALITY_SETTINGS.offline

    if (isSlowConnection()) return MOBILE_QUALITY_SETTINGS.slow

    return MOBILE_QUALITY_SETTINGS.fast
  }, [skipOptimization])

  // Generate responsive srcset for mobile
  const generateSrcSet = useCallback((baseSrc: string) => {
    if (!isMobile() || skipOptimization) return undefined

    const quality = getQualitySettings()
    const breakpoints = Object.values(MOBILE_BREAKPOINTS)

    return breakpoints
      .sort((a, b) => a - b)
      .map(bp => {
        const params = new URLSearchParams({
          w: String(bp),
          q: String(quality.full),
          fm: 'webp',
        })

        if (compressForMobile) {
          params.set('mobile', 'true')
          params.set('compress', 'true')
        }

        return `${baseSrc}?${params.toString()} ${bp}w`
      })
      .join(', ')
  }, [getQualitySettings, compressForMobile, skipOptimization])

  // Generate low-quality placeholder
  const generatePlaceholderSrc = useCallback((baseSrc: string) => {
    if (!enableProgressive) return undefined

    const quality = getQualitySettings()
    const placeholderQ = placeholderQuality || quality.thumbnail

    const params = new URLSearchParams({
      w: String(width),
      h: String(height),
      q: String(placeholderQ),
      fm: 'webp',
      blur: '10',
    })

    return `${baseSrc}?${params.toString()}`
  }, [width, height, placeholderQuality, enableProgressive, getQualitySettings])

  // Track loading progress
  const trackProgress = useCallback(() => {
    if (!imgRef.current) return

    const img = new Image()
    img.src = imageSrc

    const progressHandler = () => {
      progressTrackerRef.current.loaded++

      if (img.complete) {
        setLoadingState(prev => ({
          ...prev,
          progress: 100,
          isLoading: false,
          isLoaded: true,
        }))
        onProgress?.(100)
      } else {
        const progress = (progressTrackerRef.current.loaded / progressTrackerRef.current.total) * 100
        setLoadingState(prev => ({ ...prev, progress }))
        onProgress?.(progress)
      }
    }

    img.onload = progressHandler
    img.onerror = progressHandler
  }, [imageSrc, onProgress])

  // Set up intersection observer for lazy loading
  const setupIntersectionObserver = useCallback(() => {
    if (!lazy || priority) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            trackProgress()
            observerRef.current?.disconnect()
          }
        })
      },
      {
        rootMargin: '50px', // Start loading 50px before image enters viewport
        threshold: 0.1,
      }
    )

    if (imgRef.current) {
      observerRef.current.observe(imgRef.current)
    }
  }, [lazy, priority, trackProgress])

  // Handle image load
  const handleLoad = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    setLoadingState(prev => ({
      ...prev,
      isLoading: false,
      isLoaded: true,
      progress: 100,
    }))
    onLoad?.(event)
  }, [onLoad])

  // Handle image error with retry logic
  const handleError = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    if (retryCount < 3) {
      // Retry with lower quality
      setRetryCount(prev => prev + 1)
      const retrySrc = `${src}?retry=${retryCount + 1}&q=${Math.max(30, (props.quality || 75) - 20)}`
      setImageSrc(retrySrc)
    } else if (fallbackSrc) {
      // Use fallback image after retries
      setImageSrc(fallbackSrc)
    } else {
      // Mark as error
      setLoadingState(prev => ({
        ...prev,
        isLoading: false,
        isError: true,
      }))
      onError?.(event)
    }
  }, [retryCount, src, fallbackSrc, props.quality, onError])

  // Initialize image
  useEffect(() => {
    if (!src) return

    const optimizedSrc = imageSrc

    if (priority || !lazy) {
      trackProgress()
    } else {
      setupIntersectionObserver()
    }

    return () => {
      observerRef.current?.disconnect()
    }
  }, [imageSrc, priority, lazy, trackProgress, setupIntersectionObserver])

  // Generate optimized image props
  const optimizedProps: Partial<ImageProps> = {
    src: imageSrc,
    alt,
    width,
    height,
    sizes,
    className: cn(
      'transition-opacity duration-300',
      loadingState.isLoaded ? 'opacity-100' : 'opacity-0',
      className
    ),
    priority,
    quality: props.quality || getQualitySettings().full,
    placeholder: generateBlurDataURL ? 'blur' : undefined,
    blurDataURL: generatePlaceholderSrc(src as string),
    onLoad: handleLoad,
    onError: handleError,
    ...props,
  }

  // If it's a mobile device and we have a srcset, use regular img element for better control
  if (isMobile() && !skipOptimization) {
    const srcSet = generateSrcSet(src as string)

    return (
      <div className={cn('relative', className)}>
        {/* Skeleton loader */}
        {showSkeleton && loadingState.isLoading && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse rounded" />
        )}

        {/* Error state */}
        {loadingState.isError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded">
            <div className="text-center text-gray-500">
              <svg
                className="w-8 h-8 mx-auto mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-xs">Failed to load image</p>
            </div>
          </div>
        )}

        {/* Progress indicator */}
        {enableProgressive && loadingState.isLoading && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${loadingState.progress}%` }}
            />
          </div>
        )}

        <img
          ref={imgRef}
          src={optimizedProps.src as string}
          srcSet={srcSet}
          sizes={optimizedProps.sizes}
          alt={alt}
          className={cn(
            'w-full h-full object-cover',
            loadingState.isLoaded ? 'opacity-100' : 'opacity-0',
            className
          )}
          onLoad={handleLoad as any}
          onError={handleError as any}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
        />
      </div>
    )
  }

  // Use Next.js Image component for desktop or when optimization is skipped
  return (
    <div className={cn('relative', className)}>
      {/* Skeleton loader */}
      {showSkeleton && loadingState.isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse rounded" />
      )}

      {/* Progress indicator */}
      {enableProgressive && loadingState.isLoading && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${loadingState.progress}%` }}
          />
        </div>
      )}

      {/* Error state */}
      {loadingState.isError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded">
          <div className="text-center text-gray-500">
            <svg
              className="w-8 h-8 mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-xs">Failed to load image</p>
          </div>
        </div>
      )}

      <Image {...optimizedProps} />
    </div>
  )
}

// Export convenience functions for common use cases
export const MobileOptimizedImage: FC<Omit<OptimizedImageProps, 'compressForMobile' | 'enableProgressive'>> = (props) => (
  <OptimizedImage {...props} compressForMobile={true} enableProgressive={true} />
)

export const CriticalImage: FC<Omit<OptimizedImageProps, 'priority' | 'lazy'>> = (props) => (
  <OptimizedImage {...props} priority={true} lazy={false} showSkeleton={false} />
)

export const LazyImage: FC<Omit<OptimizedImageProps, 'lazy'>> = (props) => (
  <OptimizedImage {...props} lazy={true} showPlaceholder={true} />
)

export default OptimizedImage