"use client"
export const dynamic = 'force-dynamic'

import { useIsMobile } from "@/hooks/use-mobile"
import { EbaEmployersDesktopView } from "@/components/eba-employers/EbaEmployersDesktopView"
import { EbaEmployersMobileView } from "@/components/eba-employers/EbaEmployersMobileView"

export default function EbaEmployersPage() {
  const isMobile = useIsMobile()

  return isMobile ? <EbaEmployersMobileView /> : <EbaEmployersDesktopView />
}


