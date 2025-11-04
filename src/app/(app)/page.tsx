import React from "react"
import { DesktopDashboardView } from "@/components/dashboard/DesktopDashboardView"
import type { Metadata } from "next"

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Dashboard",
  description: "CFMEU Organizer Dashboard",
}

// Ensure React is globally available for Vercel serverless environment
if (typeof globalThis !== 'undefined' && !globalThis.React) {
  globalThis.React = React;
}
if (typeof global !== 'undefined' && !global.React) {
  global.React = React;
}

export default function RootPage() {
  // Render the main dashboard directly at the root
  // This eliminates the routing complexity with route groups
  if (process.env.NODE_ENV === 'development') {
    console.log('[RootPage] Rendering dashboard at root path')
  }
  return <DesktopDashboardView />
}