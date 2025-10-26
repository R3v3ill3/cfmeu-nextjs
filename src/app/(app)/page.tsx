import React from "react"
import { DesktopDashboardView } from "@/components/dashboard/DesktopDashboardView"

export const dynamic = 'force-dynamic'

// Ensure React is globally available for Vercel serverless environment
if (typeof globalThis !== 'undefined' && !globalThis.React) {
  globalThis.React = React;
}
if (typeof global !== 'undefined' && !global.React) {
  global.React = React;
}

export default function DashboardPage() {
  // Temporarily always show desktop view to eliminate mobile detection issues
  return <DesktopDashboardView />
}

