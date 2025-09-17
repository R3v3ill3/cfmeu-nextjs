"use client"

import { useIsMobile } from "@/hooks/use-mobile"
import { WorkersDesktopView } from "@/components/workers/WorkersDesktopView"
import { WorkersMobileView } from "@/components/workers/WorkersMobileView"

export const dynamic = 'force-dynamic'

export default function WorkersPage() {
  const isMobile = useIsMobile()

  return isMobile ? <WorkersMobileView /> : <WorkersDesktopView />
}

