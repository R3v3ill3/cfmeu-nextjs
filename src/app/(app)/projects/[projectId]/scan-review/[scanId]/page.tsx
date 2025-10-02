"use client"

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Loader2, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScanReviewContainer } from '@/components/projects/mapping/scan-review/ScanReviewContainer'

interface PageProps {
  params: {
    projectId: string
    scanId: string
  }
}

export default function ScanReviewPage({ params }: PageProps) {
  const { projectId, scanId } = params

  // Fetch scan data
  const { data: scanData, isLoading: scanLoading, error: scanError } = useQuery({
    queryKey: ['mapping_sheet_scan', scanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mapping_sheet_scans')
        .select('*')
        .eq('id', scanId)
        .single()

      if (error) throw error
      return data
    },
  })

  // Fetch project data
  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (error) throw error
      
      // For now, return basic data - we'll enhance with relationships later
      return {
        ...data,
        builder_name: null, // TODO: Fetch from employers table
        organiser_names: null, // TODO: Fetch from patch assignments  
        address: null, // TODO: Fetch from job_sites
      }
    },
  })

  // Fetch existing site contacts
  const { data: existingContacts } = useQuery({
    queryKey: ['site_contacts', projectData?.main_job_site_id],
    enabled: !!projectData?.main_job_site_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_contacts')
        .select('*')
        .eq('job_site_id', projectData.main_job_site_id)

      if (error) throw error
      return data || []
    },
  })

  if (scanLoading || projectLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
          <p className="text-sm text-gray-600">Loading scan data...</p>
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
            Failed to load scan data. {scanError?.message || 'Scan not found'}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (scanData.status !== 'completed' && scanData.status !== 'under_review') {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This scan is not ready for review yet. Status: {scanData.status}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!projectData) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load project data.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <ScanReviewContainer
      scanData={scanData}
      projectData={projectData}
      existingContacts={existingContacts || []}
    />
  )
}
