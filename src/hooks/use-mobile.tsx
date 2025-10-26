import { useState, useEffect, useCallback, useMemo, useRef } from 'react'

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Start with false to prevent hydration mismatch
  const [isMobile, setIsMobile] = React.useState(false)
  const [hasMounted, setHasMounted] = React.useState(false)

  React.useEffect(() => {
    setHasMounted(true)
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    // Set initial value
    onChange()
    return () => mql.removeEventListener("change", onChange)
  }, [])

  // Return false during SSR/initial render to prevent hydration mismatch
  return hasMounted ? isMobile : false
}
