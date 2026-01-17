"use client"

import { useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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
  const router = useRouter()
  const { startNavigation } = useNavigationLoading()
  const queryClient = useQueryClient()

  // Force REMOVE cache entirely when component mounts to prevent stuck loading states
  // removeQueries is more aggressive than invalidateQueries - ensures completely fresh fetch
  useEffect(() => {
    console.log('[new-scan-review] Removing all scan cache entries')
    queryClient.removeQueries({ queryKey: ["mapping_sheet_scan"] })
    queryClient.removeQueries({ queryKey: ["new-project-scan-temporary"] })
  }, [queryClient])

  const { data: scanData, error: scanError, isLoading, isFetching } = useQuery({
    queryKey: ["mapping_sheet_scan", scanId],
    queryFn: async () => {
      console.log('[new-scan-review] Fetching scan data for:', scanId)
      const { data, error } = await supabase
        .from("mapping_sheet_scans")
        .select("*")
        .eq("id", scanId)
        .single()

      if (error) {
        console.error('[new-scan-review] Scan fetch error:', error)
        throw error
      }
      console.log('[new-scan-review] Scan data fetched successfully')
      return data
    },
    staleTime: 0,
    refetchOnMount: 'always',
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
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

  if (scanError) {
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

  if (isLoading || isFetching || !scanData) {
    console.log('[new-scan-review] Render: showing loading state', { isLoading, isFetching, hasScanData: !!scanData })
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading scan data…</p>
          {(isLoading || isFetching) && <p className="text-xs text-gray-400">This may take a moment for large scans</p>}
        </div>
      </div>
    )
  }
  
  console.log('[new-scan-review] Render: showing review container')

  const placeholder = projectData || placeholderProject

  return (
    <ScanReviewContainer
      scanData={scanData}
      projectData={placeholder}
      existingContacts={[]}
      allowProjectCreation
      onCancel={() => {
        // NOTE: Previously used window.location.assign which destroys the React tree
        // and can cause session loss. Using router.push preserves the React tree.
        startNavigation("/projects")
        router.push("/projects")
      }}
    />
  )
}
