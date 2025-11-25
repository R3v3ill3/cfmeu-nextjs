"use client"
import { useState, useCallback, useEffect, useRef } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"

/**
 * Platform-optimized search state hook
 * Desktop: Direct URL state binding (current behavior)
 * Mobile: Local state with deferred URL sync
 * 
 * IMPORTANT: All hooks must be called unconditionally to satisfy Rules of Hooks.
 * We use the isMobile flag to switch behavior, not to conditionally call hooks.
 */
export function useOptimizedSearch(initialValue = "") {
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Get URL value (used by both mobile and desktop)
  const urlValue = searchParams.get("q") || initialValue

  // === ALL HOOKS MUST BE CALLED UNCONDITIONALLY ===
  // Mobile state - always initialized, but only used when isMobile is true
  const [localValue, setLocalValue] = useState(() => urlValue)
  const syncTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // Sync local value to URL (mobile only, but callback always created)
  const syncToUrl = useCallback(() => {
    const params = new URLSearchParams(searchParams)
    if (localValue && localValue.trim()) {
      params.set("q", localValue.trim())
    } else {
      params.delete("q")
    }
    const next = params.toString()
    router.replace(next ? `${pathname}?${next}` : pathname)
  }, [localValue, searchParams, router, pathname])

  // Desktop setValue - updates URL directly
  const setValueDesktop = useCallback((newValue: string | undefined) => {
    const params = new URLSearchParams(searchParams)
    if (newValue && newValue.trim()) {
      params.set("q", newValue.trim())
    } else {
      params.delete("q")
    }
    const next = params.toString()
    router.replace(next ? `${pathname}?${next}` : pathname)
  }, [searchParams, router, pathname])

  // Mobile setValue - updates local state with deferred URL sync
  const setValueMobile = useCallback((newValue: string | undefined) => {
    const trimmedValue = newValue?.trim() || ""
    setLocalValue(trimmedValue)

    // Clear any existing sync timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }

    // Set a timeout to sync to URL after user stops typing
    syncTimeoutRef.current = setTimeout(() => {
      syncToUrl()
    }, 200)
  }, [syncToUrl])

  // Cleanup timeout on unmount (always runs)
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [])

  // Sync local state when URL changes externally (always runs, relevant for mobile)
  useEffect(() => {
    const currentUrlValue = searchParams.get("q") || ""
    if (currentUrlValue !== localValue) {
      setLocalValue(currentUrlValue)
    }
  }, [searchParams, localValue])

  // === RETURN BASED ON PLATFORM ===
  // The hooks are already called unconditionally above, so this is safe
  if (isMobile) {
    return [localValue, setValueMobile, syncToUrl] as const
  } else {
    // Desktop: return URL value and URL setter, syncToUrl for compatibility
    return [urlValue, setValueDesktop, syncToUrl] as const
  }
}

/**
 * Hook to handle mobile input focus preservation
 */
export function useMobileFocus() {
  const inputRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()

  const preserveFocus = useCallback(() => {
    if (isMobile && inputRef.current) {
      // Small delay to ensure DOM has updated
      setTimeout(() => {
        if (inputRef.current && document.activeElement !== inputRef.current) {
          inputRef.current.focus()
        }
      }, 0)
    }
  }, [isMobile])

  return { inputRef, preserveFocus }
}