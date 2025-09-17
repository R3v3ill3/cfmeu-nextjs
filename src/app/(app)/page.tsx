"use client"

import { useIsMobile } from "@/hooks/use-mobile"
import { DesktopDashboardView } from "@/components/dashboard/DesktopDashboardView"
import { MobileDashboardView } from "@/components/dashboard/MobileDashboardView"

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  const isMobile = useIsMobile()

  return isMobile ? <MobileDashboardView /> : <DesktopDashboardView />
}

