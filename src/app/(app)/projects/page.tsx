"use client"

import { useIsMobile } from "@/hooks/use-mobile"
import { ProjectsMobileView } from "@/components/projects/ProjectsMobileView"
import { ProjectsDesktopView } from "@/components/projects/ProjectsDesktopView"

export const dynamic = 'force-dynamic'

export default function ProjectsPage() {
  const isMobile = useIsMobile()

  return isMobile ? <ProjectsMobileView /> : <ProjectsDesktopView />
}