"use client"

import { MappingSheetPage1 } from "@/components/projects/mapping/MappingSheetPage1"

export function MappingSheetMobile({ projectId }: { projectId: string }) {
  // For now, reuse the existing form with mobile-focused container styling.
  // If needed, we can progressively enhance to a true stepper.
  return (
    <div className="space-y-3">
      <MappingSheetPage1 projectId={projectId} />
    </div>
  )
}

