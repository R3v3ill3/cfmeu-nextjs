"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Loader2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScanReviewContainer } from "@/components/projects/mapping/scan-review/ScanReviewContainer"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"

interface PageProps {
  params: {
    scanId: string
  }
}

export default function NewProjectScanReviewPage({ params }: PageProps) {
  const { scanId } = params
  const { startNavigation } = useNavigationLoading()

  const { data: scanData, isLoading: scanLoading, error: scanError } = useQuery({
    queryKey: ["mapping_sheet_scan", scanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mapping_sheet_scans")
        .select("*")
        .eq("id", scanId)
        .single()

      if (error) throw error
      return data
    },
  })

  const { data: projectData } = useQuery({
    queryKey: ["new-project-scan-temporary"],
    enabled: false,
    queryFn: async () => ({})
  })

  const placeholderProject = useMemo(() => ({
    id: "TEMP",
    name: scanData?.extracted_data?.project?.project_name || "New Project",
    organiser_names: scanData?.extracted_data?.project?.organiser || null,
    address: scanData?.extracted_data?.project?.address || null,
  }), [scanData])

  if (scanLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading scan data…</p>
        </div>
      </div>
    )
  }

  if (scanError || !scanData) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load scan data. {scanError?.message || "Scan not found"}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const placeholder = projectData || placeholderProject

  return (
    <ScanReviewContainer
      scanData={scanData}
      projectData={placeholder}
      existingContacts={[]}
      allowProjectCreation
      onCancel={() => {
        startNavigation("/projects")
        setTimeout(() => window.location.assign("/projects"), 50)
      }}
    />
  )
}
