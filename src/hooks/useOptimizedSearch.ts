"use client"
import { useState, useCallback, useEffect, useRef } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"

/**
 * Platform-optimized search state hook
 * Desktop: Direct URL state binding (current behavior)
 * Mobile: Local state with deferred URL sync
 */
export function useOptimizedSearch(initialValue = "") {
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  if (isMobile) {
    // Mobile implementation with local state
    return useMobileSearchState(initialValue, searchParams, router, pathname)
  } else {
    // Desktop implementation with direct URL state
    return useDesktopSearchState(initialValue, searchParams, router, pathname)
  }
}

/**
 * Desktop search: Direct URL state binding (preserves current behavior)
 */
function useDesktopSearchState(
  initialValue: string,
  searchParams: ReturnType<typeof useSearchParams>,
  router: ReturnType<typeof useRouter>,
  pathname: string
) {
  const value = searchParams.get("q") || initialValue

  const setValue = useCallback((newValue: string | undefined) => {
    const params = new URLSearchParams(searchParams)
    if (newValue && newValue.trim()) {
      params.set("q", newValue.trim())
    } else {
      params.delete("q")
    }
    const next = params.toString()
    router.replace(next ? `${pathname}?${next}` : pathname)
  }, [searchParams, router, pathname])

  return [value, setValue] as const
}

/**
 * Mobile search: Local state with deferred URL sync
 */
function useMobileSearchState(
  initialValue: string,
  searchParams: ReturnType<typeof useSearchParams>,
  router: ReturnType<typeof useRouter>,
  pathname: string
) {
  // Initialize from URL params or initial value
  const [localValue, setLocalValue] = useState(() => {
    const urlValue = searchParams.get("q")
    return urlValue || initialValue
  })

  // Ref to track if we need to sync to URL
  const syncTimeoutRef = useRef<NodeJS.Timeout>()

  // Function to sync current local value to URL
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

  // Update local value immediately for responsive typing
  const setValue = useCallback((newValue: string | undefined) => {
    const trimmedValue = newValue?.trim() || ""
    setLocalValue(trimmedValue)

    // Clear any existing sync timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }

    // Set a timeout to sync to URL after user stops typing
    // Shorter delay than before (200ms instead of 300ms) for better responsiveness
    syncTimeoutRef.current = setTimeout(() => {
      syncToUrl()
    }, 200)
  }, [syncToUrl])

  // Sync to URL on component unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [])

  // Update local state when URL changes externally (e.g., back navigation)
  useEffect(() => {
    const urlValue = searchParams.get("q") || ""
    if (urlValue !== localValue) {
      setLocalValue(urlValue)
    }
  }, [searchParams.get("q")])

  return [localValue, setValue, syncToUrl] as const
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