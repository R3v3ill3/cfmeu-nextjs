"use client"

import { useIsMobile } from "@/hooks/use-mobile"
import { EmployersDesktopView } from "@/components/employers/EmployersDesktopView"
import { EmployersMobileView } from "@/components/employers/EmployersMobileView"

export const dynamic = 'force-dynamic'

export default function EmployersPage() {
  const isMobile = useIsMobile()

  return isMobile ? <EmployersMobileView /> : <EmployersDesktopView />
}

