"use client"

import { useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Loader2, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScanReviewContainer } from '@/components/projects/mapping/scan-review/ScanReviewContainer'
import { usePatchOrganiserLabels } from '@/hooks/usePatchOrganiserLabels'
import { useMappingSheetData } from '@/hooks/useMappingSheetData'

interface PageProps {
  params: {
    projectId: string
    scanId: string
  }
}

export default function ScanReviewPage({ params }: PageProps) {
  const { projectId, scanId } = params
  const queryClient = useQueryClient()

  // Force REMOVE cache entirely when component mounts to prevent stuck loading states
  // removeQueries is more aggressive than invalidateQueries - ensures completely fresh fetch
  useEffect(() => {
    console.log('[scan-review] Page mounted with params:', { projectId, scanId })
    console.log('[scan-review] Removing all scan and project cache entries')
    queryClient.removeQueries({ queryKey: ['mapping_sheet_scan'] })
    queryClient.removeQueries({ queryKey: ['project', projectId] })
  }, [queryClient, projectId])

  // Fetch scan data
  const { data: scanData, error: scanError, isLoading: scanLoading, isFetching: scanFetching } = useQuery({
    queryKey: ['mapping_sheet_scan', scanId],
    queryFn: async () => {
      console.log('[scan-review] Fetching scan data for:', scanId)
      const { data, error } = await supabase
        .from('mapping_sheet_scans')
        .select('*')
        .eq('id', scanId)
        .single()

      if (error) {
        console.error('[scan-review] Scan fetch error:', error)
        throw error
      }
      console.log('[scan-review] Scan data fetched:', data?.status)
      return data
    },
    staleTime: 0,  // Always refetch
    refetchOnMount: 'always',
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  })

  // Fetch project data
  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      console.log('[scan-review] Fetching project data for:', projectId)
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (error) {
        console.error('[scan-review] Project fetch error:', error)
        throw error
      }
      console.log('[scan-review] Project data fetched')
      return data
    },
    staleTime: 0,  // Always refetch
    refetchOnMount: true,
    retry: 3,
  })

  // Get job sites for patch lookup (same as main mapping sheet page)
  const { data: sites = [] } = useQuery({
    queryKey: ["project-sites", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_sites")
        .select("id,name")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true })
      if (error) throw error
      return data || []
    }
  })

  const sortedSiteIds = useMemo(
    () => Array.from(new Set(((sites as any[]) || []).map((s: any) => String(s.id)).filter(Boolean))).sort(),
    [sites]
  )

  // Get patches (same as main mapping sheet page)
  const { data: projectPatches = [] } = useQuery({
    queryKey: ["project-patches", projectId, sortedSiteIds],
    enabled: !!projectId && sortedSiteIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("patch_job_sites")
        .select("patch_id, patches:patch_id(id,name)")
        .in("job_site_id", sortedSiteIds)
      const list = ((data as any[]) || [])
      const byId = new Map<string, { id: string; name: string }>()
      list.forEach((r: any) => {
        const patch = Array.isArray(r.patches) ? r.patches[0] : r.patches
        if (patch?.id) byId.set(patch.id, { id: patch.id, name: patch.name })
      })
      return Array.from(byId.values())
    }
  })

  const patchIds = useMemo(() => (projectPatches as any[]).map((pp: any) => pp.id), [projectPatches])
  const { mergedList: patchOrganisers = [] } = usePatchOrganiserLabels(patchIds)

  // Fetch builder name from builder_id (same as mobile mapping sheet)
  const { data: builderData } = useQuery({
    queryKey: ['builder-name', projectData?.builder_id],
    enabled: !!projectData?.builder_id,
    queryFn: async () => {
      if (!projectData?.builder_id) {
        console.log('No builder_id found in project data')
        return null
      }
      
      console.log('Fetching builder for ID:', projectData.builder_id)
      const { data, error } = await supabase
        .from('employers')
        .select('name')
        .eq('id', projectData.builder_id)
        .single()
      
      if (error) {
        console.error('Builder fetch error:', error)
        throw error
      }
      
      console.log('Builder data fetched:', data)
      return data
    }
  })

  // Also try to get builder from mapping sheet data (alternative approach)
  const { data: mappingSheetData } = useMappingSheetData(projectId)
  const builderFromMapping = useMemo(() => {
    return mappingSheetData?.contractorRoles.find(role => role.role === 'builder')
  }, [mappingSheetData])

  // Fetch address from main job site
  const { data: addressData } = useQuery({
    queryKey: ['site-address', projectData?.main_job_site_id],
    enabled: !!projectData?.main_job_site_id,
    queryFn: async () => {
      if (!projectData?.main_job_site_id) return null
      
      const { data, error } = await supabase
        .from('job_sites')
        .select('full_address, location')
        .eq('id', projectData.main_job_site_id)
        .single()
      
      if (error) throw error
      return data
    }
  })

  // Enhanced project data with relationships
  const enhancedProjectData = useMemo(() => {
    if (!projectData) return null
    
    // Try multiple sources for builder name
    const builderName = builderData?.name || builderFromMapping?.employerName || null
    
    console.log('Enhanced project data builder sources:', {
      builderData: builderData?.name,
      builderFromMapping: builderFromMapping?.employerName,
      finalBuilderName: builderName
    })
    
    return {
      ...projectData,
      organiser_names: (patchOrganisers as any[]).join(', ') || null,
      builder_name: builderName,
      address: addressData?.full_address || addressData?.location || null,
    }
  }, [projectData, patchOrganisers, builderData, addressData, builderFromMapping])

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

  if (scanError) {
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

  // Show loading only while queries are actively loading
  if (scanLoading || scanFetching || projectLoading) {
    console.log('[scan-review] Render: showing loading state', { 
      scanLoading, 
      scanFetching, 
      projectLoading, 
      hasScanData: !!scanData 
    })
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
          <p className="text-sm text-gray-600">Loading scan data...</p>
          {(scanLoading || scanFetching) && <p className="text-xs text-gray-400">This may take a moment for large scans</p>}
        </div>
      </div>
    )
  }
  
  console.log('[scan-review] Render: proceeding with data checks')

  if (!scanData) {
    return null
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
      projectData={enhancedProjectData}
      existingContacts={existingContacts || []}
    />
  )
}
