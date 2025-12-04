"use client"

import { useParams, useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { useEffect } from "react"

const MappingSheetPage1 = dynamic(() => import("@/components/projects/mapping/MappingSheetMobile").then(m => m.MappingSheetMobile), { ssr: false })

export default function ProjectMobileMappingPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params?.projectId as string

  useEffect(() => {
    document.body.classList.add('bg-white')
    return () => { document.body.classList.remove('bg-white') }
  }, [])

  return (
    <div className="px-safe py-4 pb-safe-bottom space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Mapping Sheets</div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { try { router.back() } catch {} }}>Close</Button>
          <Button size="sm" variant="outline" onClick={() => { try { router.push(`/projects/${projectId}/print?print=1`) } catch {} }}>Print</Button>
        </div>
      </div>

      <MappingSheetPage1 projectId={projectId} />
    </div>
  )
}

