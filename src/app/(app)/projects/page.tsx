"use client"

import { useIsMobile } from "@/hooks/use-mobile"
import { ProjectsMobileView } from "@/components/projects/ProjectsMobileView"
import { ProjectsDesktopView } from "@/components/projects/ProjectsDesktopView"
import { useAccessiblePatches } from "@/hooks/useAccessiblePatches"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import { useAdminPatchContext } from "@/context/AdminPatchContext"

export const dynamic = 'force-dynamic'

export default function ProjectsPage() {
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { patches: accessiblePatches, isLoading: patchesLoading, role } = useAccessiblePatches()
  const adminPatchContext = useAdminPatchContext()

  // Apply default patch filtering for organisers and lead_organisers when no patch parameter exists
  useEffect(() => {
    // For admins: check if context has patches, if so, apply them to URL if URL doesn't have any
    if (role === 'admin' && adminPatchContext.isInitialized) {
      const existingPatchParam = searchParams.get('patch')
      
      // If context has patches but URL doesn't, restore from context
      if (!existingPatchParam && adminPatchContext.selectedPatchIds && adminPatchContext.selectedPatchIds.length > 0) {
        const params = new URLSearchParams(searchParams.toString())
        params.set('patch', adminPatchContext.selectedPatchIds.join(','))
        const newUrl = `${pathname}?${params.toString()}`
        router.replace(newUrl)
      }
      return
    }

    // For non-admins: apply default patch filtering as before
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
  }, [patchesLoading, role, accessiblePatches, searchParams, router, pathname, adminPatchContext.isInitialized, adminPatchContext.selectedPatchIds])

  if (isMobile) {
    return <ProjectsMobileView />
  }

  return <ProjectsDesktopView />
}