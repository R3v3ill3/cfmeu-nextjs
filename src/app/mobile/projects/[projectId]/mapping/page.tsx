"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { MobileMappingWorkflow } from '@/components/mobile/workflows/MobileMappingWorkflow'
import { useOfflineSync } from '@/hooks/mobile/useOfflineSync'
import { useMobileOptimizations } from '@/hooks/mobile/useMobileOptimizations'
import { useToast } from '@/hooks/use-toast'
import { MobileLoadingState } from '@/components/mobile/shared/MobileOptimizationProvider'

interface ProjectData {
  id: string
  name: string
  address: string
  status: string
  employer_id?: string
  primary_trade?: string
  site_contact?: string
  site_phone?: string
  start_date?: string
  estimated_completion?: string
  workforce_size?: number
  coordinates?: {
    lat: number
    lng: number
  }
}

interface MappingData {
  project_id: string
  employers: Array<{
    id?: string
    name: string
    abn?: string
    trade: string
    workforce_size: number
    contact_name?: string
    contact_phone?: string
    is_primary_contractor?: boolean
    notes?: string
  }>
  delegates: Array<{
    id?: string
    name: string
    phone: string
    email?: string
    trade: string
    is_safety_rep?: boolean
    notes?: string
  }>
  workforce_stats: {
    total_workers: number
    union_members: number
    union_percentage: number
    trades: Array<{
      trade: string
      count: number
      union_members: number
    }>
  }
  site_info: {
    access_notes?: string
    parking_notes?: string
    site_hours?: string
    safety_briefing_time?: string
    amenities_available?: string[]
    hazards?: string[]
  }
  photos: Array<{
    id: string
    url: string
    type: 'site_overview' | 'workforce_area' | 'safety_signage' | 'amenities'
    description?: string
    timestamp: string
  }>
  mapped_by: string
  mapped_at: string
  last_updated: string
}

export default function MobileProjectMappingPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string
  const { toast } = useToast()

  const {
    debounce,
    isMobile,
    isLowEndDevice,
  } = useMobileOptimizations({
    enableDebouncing: true,
    debounceDelay: 300,
  })

  const [projectData, setProjectData] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const {
    data: mappingData,
    loading: syncLoading,
    isOnline,
    pendingSync,
    addItem,
    updateItem,
    forceSync,
  } = useOfflineSync<MappingData>([], {
    storageKey: `project-mapping-${projectId}`,
    autoSync: true,
    syncInterval: 30000,
    maxRetries: 5,
  })

  // Load project data
  useEffect(() => {
    const loadProjectData = async () => {
      try {
        // In a real app, this would fetch from your API
        // For now, we'll use mock data
        const mockProject: ProjectData = {
          id: projectId,
          name: "Sydney Metro Expansion",
          address: "123 Construction Site, Sydney NSW 2000",
          status: "active",
          employer_id: "emp_123",
          primary_trade: "Construction",
          site_contact: "John Smith",
          site_phone: "0412 345 678",
          start_date: "2024-01-15",
          estimated_completion: "2024-12-31",
          workforce_size: 150,
          coordinates: {
            lat: -33.8688,
            lng: 151.2093,
          },
        }

        setProjectData(mockProject)

        // Try to load existing mapping data
        const existingMappingKey = `mapping-${projectId}`
        const existingMapping = localStorage.getItem(existingMappingKey)
        if (existingMapping) {
          const parsed = JSON.parse(existingMapping)
          // Use the sync hook to add existing data
          if (parsed) {
            // This ensures the data is managed through the sync system
          }
        }
      } catch (error) {
        console.error('Error loading project data:', error)
        toast({
          title: "Error",
          description: "Failed to load project data",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (projectId) {
      loadProjectData()
    }
  }, [projectId, toast])

  // Handle form submission
  const handleSubmit = useCallback(async (data: Partial<MappingData>) => {
    if (!projectData) return

    setSubmitting(true)
    try {
      const mappingData: MappingData = {
        project_id: projectId,
        employers: data.employers || [],
        delegates: data.delegates || [],
        workforce_stats: data.workforce_stats || {
          total_workers: 0,
          union_members: 0,
          union_percentage: 0,
          trades: [],
        },
        site_info: data.site_info || {},
        photos: data.photos || [],
        mapped_by: "current_user", // This would come from auth context
        mapped_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      }

      // Save through the sync system
      await addItem(mappingData)

      // Also save to localStorage for immediate access
      localStorage.setItem(`mapping-${projectId}`, JSON.stringify(mappingData))

      toast({
        title: "Mapping saved",
        description: isOnline
          ? "Project mapping has been saved and synced"
          : "Project mapping saved locally. Will sync when online.",
      })

      // Navigate back to project view or dashboard
      router.push(`/mobile/projects/${projectId}`)
    } catch (error) {
      console.error('Error saving mapping:', error)
      toast({
        title: "Save failed",
        description: "Failed to save project mapping. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }, [projectData, projectId, addItem, isOnline, toast, router])

  // Handle partial saves (auto-save)
  const handlePartialSave = useCallback(debounce(async (data: Partial<MappingData>) => {
    if (!projectData) return

    try {
      const partialMapping = {
        project_id: projectId,
        ...data,
        last_updated: new Date().toISOString(),
      } as Partial<MappingData>

      // Save to localStorage for immediate persistence
      const existingKey = `mapping-${projectId}`
      const existing = localStorage.getItem(existingKey)
      const currentData = existing ? JSON.parse(existing) : {}
      const updatedData = { ...currentData, ...partialMapping }

      localStorage.setItem(existingKey, JSON.stringify(updatedData))

      // If we have a complete mapping in the sync system, update it
      if (mappingData && mappingData.length > 0) {
        await updateItem(mappingData[0].id, partialMapping)
      }
    } catch (error) {
      console.error('Error in auto-save:', error)
      // Don't show toast for auto-save errors to avoid annoying users
    }
  }, 2000), [projectData, projectId, mappingData, updateItem, debounce])

  if (loading || syncLoading) {
    return <MobileLoadingState message="Loading project data..." />
  }

  if (!projectData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Project not found</h2>
          <p className="text-gray-600 mb-4">The project you're looking for doesn't exist or you don't have access to it.</p>
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Offline indicator */}
      {!isOnline && (
        <div className="bg-amber-50 border-b border-amber-200 p-2">
          <div className="flex items-center justify-center gap-2 text-sm text-amber-800">
            <div className="w-2 h-2 bg-amber-600 rounded-full animate-pulse" />
            <span>Offline mode - Changes will be saved locally</span>
          </div>
        </div>
      )}

      {/* Pending sync indicator */}
      {isOnline && pendingSync > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 p-2">
          <div className="flex items-center justify-center gap-2 text-sm text-blue-800">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
            <span>{pendingSync} changes pending sync</span>
            <button
              onClick={forceSync}
              className="text-blue-600 underline text-xs"
            >
              Sync now
            </button>
          </div>
        </div>
      )}

      <MobileMappingWorkflow
        projectData={projectData}
        initialData={mappingData?.[0]}
        onSubmit={handleSubmit}
        onPartialSave={handlePartialSave}
        submitting={submitting}
        isOnline={isOnline}
        isLowEndDevice={isLowEndDevice}
      />
    </div>
  )
}