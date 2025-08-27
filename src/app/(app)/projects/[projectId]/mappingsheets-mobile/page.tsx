"use client"

import { useParams } from "next/navigation"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { useEffect } from "react"

const MappingSheetPage1 = dynamic(() => import("@/components/projects/mapping/MappingSheetMobile").then(m => m.MappingSheetMobile), { ssr: false })

export default function ProjectMobileMappingPage() {
  const params = useParams()
  const projectId = params?.projectId as string

  useEffect(() => {
    document.body.classList.add('bg-white')
    return () => { document.body.classList.remove('bg-white') }
  }, [])

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Mapping Sheets</div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { try { window.history.back() } catch {} }}>Close</Button>
          <Button size="sm" variant="outline" onClick={() => { try { window.location.href = `/projects/${projectId}/print?print=1` } catch {} }}>Print</Button>
        </div>
      </div>

      <MappingSheetPage1 projectId={projectId} />
    </div>
  )
}

