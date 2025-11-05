"use client"

import { DesktopDashboardView } from "@/components/dashboard/DesktopDashboardView"

export const dynamic = 'force-dynamic'

export default function RootPage() {
  // Render the main dashboard directly at the root
  // This eliminates the routing complexity with route groups
  if (process.env.NODE_ENV === 'development') {
    console.log('[RootPage] Rendering dashboard at root path')
  }
  return <DesktopDashboardView />
}