"use client"

import { MobileSiteVisitForm } from "@/components/mobile/siteVisits/MobileSiteVisitForm"
import { useSearchParams } from "next/navigation"

export default function MobileSiteVisitPage() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get("project_id") || undefined
  const jobSiteId = searchParams.get("job_site_id") || undefined

  return (
    <MobileSiteVisitForm
      initialData={{
        project_id: projectId,
        job_site_id: jobSiteId
      }}
    />
  )
}


