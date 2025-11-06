"use client"

import { useIsMobile } from "@/hooks/use-mobile"
import { ProjectsMobileView } from "@/components/projects/ProjectsMobileView"
import { ProjectsDesktopView } from "@/components/projects/ProjectsDesktopView"
import { useAccessiblePatches } from "@/hooks/useAccessiblePatches"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"

export const dynamic = 'force-dynamic'

export default function ProjectsPage() {
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { patches: accessiblePatches, isLoading: patchesLoading, role } = useAccessiblePatches()

  // Apply default patch filtering for organisers and lead_organisers when no patch parameter exists
  useEffect(() => {
    // Skip if still loading patches or if user is admin (admin sees all)
    if (patchesLoading || role === 'admin') {
      return
    }

    const existingPatchParam = searchParams.get('patch')

    // Only apply default filtering if no patch parameter is already set
    if (!existingPatchParam && accessiblePatches.length > 0) {
      const defaultPatchIds = accessiblePatches.map(p => p.id)
      const params = new URLSearchParams(searchParams.toString())

      // Set default patch filter
      params.set('patch', defaultPatchIds.join(','))

      // Update URL without triggering navigation reload
      const newUrl = `${pathname}?${params.toString()}`
      router.replace(newUrl)
    }
  }, [patchesLoading, role, accessiblePatches, searchParams, router, pathname])

  if (isMobile) {
    return <ProjectsMobileView />
  }

  return <ProjectsDesktopView />
}