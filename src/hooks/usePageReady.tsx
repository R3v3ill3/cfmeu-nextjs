'use client'

/**
 * Hook that pages can optionally use to signal when they're ready to be displayed.
 * 
 * Currently, this is a placeholder for future enhancement. The navigation loading
 * system uses a minimum display time (800ms) to ensure smooth transitions, which
 * should handle most cases automatically.
 * 
 * Future enhancement: This hook could be used to signal page readiness and allow
 * the loading overlay to clear slightly faster for pages that load quickly, while
 * still respecting minimum display times for UX consistency.
 * 
 * @example
 * ```tsx
 * export default function MyPage() {
 *   usePageReady() // Optional - currently no-op
 *   // ... rest of page
 * }
 * ```
 */
export function usePageReady() {
  // Currently a no-op - the minimum display time in useNavigationLoading
  // handles the timing automatically. This hook is available for future
  // enhancements if needed.
}

