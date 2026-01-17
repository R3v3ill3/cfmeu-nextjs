"use client"

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAccessiblePatches } from '@/hooks/useAccessiblePatches'
import { useAddressSearch, type NearbyProject, type ProjectAccessStatus } from '@/hooks/useAddressSearch'
import { WizardButton } from '../shared/WizardButton'
import { ClaimProjectDialog } from '../shared/ClaimProjectDialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { 
  MapPin, 
  Search, 
  Navigation, 
  Building, 
  AlertCircle,
  Loader2,
  ChevronRight,
  RefreshCw,
  Plus,
  Lock,
  UserPlus
} from 'lucide-react'

interface ProjectSelectorProps {
  onProjectSelected: (project: {
    id: string
    name: string
    address?: string | null
    builderName?: string | null
    mainJobSiteId?: string | null
  }) => void
  onAddNewProject?: () => void
}

type GeolocationState = 
  | 'requesting' 
  | 'available' 
  | 'denied' 
  | 'unavailable' 
  | 'timeout'
  | 'error'

interface UserLocation {
  lat: number
  lng: number
  accuracy: number
}

const MAX_NEARBY_RETRIES = 2

// Project to claim state
interface ProjectToClaim {
  id: string
  name: string
  address?: string | null
  builderName?: string | null
  mainJobSiteId?: string | null
}

export function ProjectSelector({ onProjectSelected, onAddNewProject }: ProjectSelectorProps) {
  const [geoState, setGeoState] = useState<GeolocationState>('requesting')
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [nearbySlow, setNearbySlow] = useState(false)
  const [nearbyRetryCount, setNearbyRetryCount] = useState(0)
  const [projectToClaim, setProjectToClaim] = useState<ProjectToClaim | null>(null)
  const queryClient = useQueryClient()
  
  const { patches, isLoading: loadingPatches } = useAccessiblePatches()
  
  // Request geolocation on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoState('unavailable')
      return
    }
    
    const timeoutId = setTimeout(() => {
      if (geoState === 'requesting') {
        setGeoState('timeout')
      }
    }, 5000) // 5 second timeout
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId)
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
        setGeoState('available')
      },
      (error) => {
        clearTimeout(timeoutId)
        if (error.code === error.PERMISSION_DENIED) {
          setGeoState('denied')
        } else if (error.code === error.TIMEOUT) {
          setGeoState('timeout')
        } else {
          setGeoState('error')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 60000, // Allow cached position up to 1 minute old
      }
    )
    
    return () => clearTimeout(timeoutId)
  }, [])

  // Cleanup: if a nearby-project request got stuck in-flight, don't let it persist across wizard exits.
  useEffect(() => {
    const nearbyQueryKey = [
      'address-search',
      userLocation?.lat ?? null,
      userLocation?.lng ?? null,
      null,
      10,
      10,
    ] as const

    return () => {
      // Best-effort; this won't abort the underlying fetch, but it prevents a stuck "loading" query
      // from being reused on the next wizard launch in long-lived iOS PWA sessions.
      queryClient.cancelQueries({ queryKey: nearbyQueryKey })
      queryClient.removeQueries({ queryKey: nearbyQueryKey })
    }
  }, [queryClient, userLocation?.lat, userLocation?.lng])
  
  // Find nearby projects using geolocation
  const { 
    data: nearbyProjects = [], 
    isLoading: loadingNearby,
    error: nearbyError,
    refetch: refetchNearby,
  } = useAddressSearch({
    lat: userLocation?.lat ?? null,
    lng: userLocation?.lng ?? null,
    address: null,
    enabled: geoState === 'available' && userLocation !== null,
    maxResults: 10,
    maxDistanceKm: 10,
  })

  // If nearby search is taking unusually long, show a recovery UI instead of a forever spinner.
  useEffect(() => {
    if (!loadingNearby) {
      setNearbySlow(false)
      return
    }
    const t = setTimeout(() => setNearbySlow(true), 8_000)
    return () => clearTimeout(t)
  }, [loadingNearby])

  // Auto-fallback to search mode after max retries exceeded
  useEffect(() => {
    if (nearbyError && nearbyRetryCount >= MAX_NEARBY_RETRIES) {
      console.log('[ProjectSelector] Max nearby retries exceeded, auto-switching to search mode')
      setShowSearch(true)
    }
  }, [nearbyError, nearbyRetryCount])
  
  // Fallback: Get user's patch projects
  const patchIds = patches.map(p => p.id)
  
  // Debug logging
  console.log('[ProjectSelector] Patches loaded:', {
    patchCount: patches.length,
    patchIds,
    patchNames: patches.map(p => p.name),
    geoState,
    showSearch,
  })
  
  const { 
    data: patchProjects = [], 
    isLoading: loadingPatchProjects,
    error: patchProjectsError,
  } = useQuery({
    queryKey: ['wizard-patch-projects', patchIds],
    // Always fetch when we have patches - this ensures data is ready when user switches to search
    enabled: patchIds.length > 0,
    queryFn: async () => {
      console.log('[ProjectSelector] Fetching projects for patches:', patchIds)
      // First, get project IDs from the patch mapping view
      const { data: patchMappings, error: mappingError } = await supabase
        .from('patch_project_mapping_view')
        .select('project_id')
        .in('patch_id', patchIds)
      
      console.log('[ProjectSelector] Patch mappings result:', {
        mappingCount: patchMappings?.length || 0,
        mappingError: mappingError?.message,
        sampleIds: patchMappings?.slice(0, 5).map((m: any) => m.project_id),
      })
      
      if (mappingError) {
        console.error('[ProjectSelector] Error fetching patch mappings:', mappingError)
        // Fallback to job_sites direct query
        console.log('[ProjectSelector] Falling back to job_sites query')
        const { data: jobSiteMappings, error: jobSiteError } = await supabase
          .from('job_sites')
          .select('project_id')
          .in('patch_id', patchIds)
          .not('project_id', 'is', null)
        
        console.log('[ProjectSelector] Job sites fallback result:', {
          count: jobSiteMappings?.length || 0,
          error: jobSiteError?.message,
        })
        
        if (jobSiteError) throw jobSiteError
        
        const projectIds = Array.from(new Set(
          (jobSiteMappings || []).map((m: any) => m.project_id).filter(Boolean)
        ))
        
        console.log('[ProjectSelector] Unique project IDs from fallback:', projectIds.length)
        
        if (projectIds.length === 0) return []
        
        // Now fetch the actual projects
        // Use job_sites!project_id to specify the relationship (job_sites.project_id -> projects.id)
        const { data, error } = await supabase
          .from('projects')
          .select(`
            id,
            name,
            main_job_site_id,
            job_sites!project_id (
              id,
              full_address,
              location
            ),
            project_assignments (
              employers (
                id,
                name
              ),
              contractor_role_types (
                code
              )
            )
          `)
          .in('id', projectIds)
          .in('organising_universe', ['active', 'potential'])
          .order('name', { ascending: true })
          .limit(50)
        
        if (error) throw error
        return formatProjects(data || [])
      }
      
      // Extract unique project IDs from patch mappings
      const projectIds = Array.from(new Set(
        (patchMappings || []).map((m: any) => m.project_id).filter(Boolean)
      ))
      
      console.log('[ProjectSelector] Unique project IDs from mappings:', projectIds.length)
      
      if (projectIds.length === 0) {
        console.log('[ProjectSelector] No project IDs found in patch mappings')
        return []
      }
      
      // Now fetch the actual projects
      // Use job_sites!project_id to specify the relationship (job_sites.project_id -> projects.id)
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          main_job_site_id,
          job_sites!project_id (
            id,
            full_address,
            location
          ),
          project_assignments (
            employers (
              id,
              name
            ),
            contractor_role_types (
              code
            )
          )
        `)
        .in('id', projectIds)
        .in('organising_universe', ['active', 'potential'])
        .order('name', { ascending: true })
        .limit(50)
      
      if (error) {
        console.error('[ProjectSelector] Error fetching projects:', error)
        throw error
      }
      
      const formatted = formatProjects(data || [])
      console.log('[ProjectSelector] Projects loaded:', {
        rawCount: data?.length || 0,
        formattedCount: formatted.length,
        sampleNames: formatted.slice(0, 3).map((p: any) => p.name),
      })
      return formatted
    },
    staleTime: 30000,
  })
  
  // Log any errors
  if (patchProjectsError) {
    console.error('[ProjectSelector] Patch projects error:', patchProjectsError)
  }
  
  // Helper function to format projects
  function formatProjects(data: any[]) {
    return data.map((project: any) => {
      const jobSite = project.job_sites?.[0]
      const builderAssignment = project.project_assignments?.find((pa: any) => 
        pa.contractor_role_types?.code === 'builder' || 
        pa.contractor_role_types?.code === 'head_contractor'
      )
      
      return {
        id: project.id,
        name: project.name,
        address: jobSite?.full_address || jobSite?.location || null,
        builderName: builderAssignment?.employers?.name || null,
        mainJobSiteId: project.main_job_site_id || jobSite?.id || null,
      }
    })
  }
  
  // Filter projects by search query
  const filteredPatchProjects = searchQuery
    ? patchProjects.filter((p: any) => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.builderName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : patchProjects
  
  // Get the closest project
  const closestProject = nearbyProjects[0] as NearbyProject | undefined
  
  // Retry geolocation
  const retryGeolocation = useCallback(() => {
    setGeoState('requesting')
    setUserLocation(null)
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          })
          setGeoState('available')
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            setGeoState('denied')
          } else {
            setGeoState('error')
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    }
  }, [])

  // Retry nearby search with tracking
  const handleRetryNearby = useCallback(() => {
    const newCount = nearbyRetryCount + 1
    setNearbyRetryCount(newCount)
    console.log('[ProjectSelector] Retrying nearby search, attempt:', newCount)
    
    if (newCount >= MAX_NEARBY_RETRIES) {
      // Don't bother retrying, auto-switch to search
      console.log('[ProjectSelector] Max retries reached, switching to search mode')
      setShowSearch(true)
    } else {
      refetchNearby()
    }
  }, [nearbyRetryCount, refetchNearby])
  
  // Format distance for display
  const formatDistance = (km: number): string => {
    if (km < 1) {
      return `${Math.round(km * 1000)}m`
    }
    return `${km.toFixed(1)}km`
  }
  
  // Handle project selection with access check
  const handleSelectProject = useCallback((
    project: {
      id: string
      name: string
      address?: string | null
      builderName?: string | null
      mainJobSiteId?: string | null
    },
    accessStatus?: ProjectAccessStatus,
    assignedToNames?: string[] | null
  ) => {
    // For projects from patch search (no access_status), allow directly
    if (!accessStatus || accessStatus === 'owned') {
      onProjectSelected(project)
      return
    }

    // For claimable projects, show the claim dialog
    if (accessStatus === 'claimable') {
      setProjectToClaim(project)
      return
    }

    // For projects assigned to others, show a toast with the names
    if (accessStatus === 'assigned_other') {
      const names = assignedToNames?.join(', ') || 'other organisers'
      toast.error(`This project is assigned to ${names}`, {
        description: 'You cannot access projects assigned to other organisers.',
        duration: 5000,
      })
      return
    }
  }, [onProjectSelected])

  // Handle successful claim
  const handleClaimSuccess = useCallback(() => {
    if (projectToClaim) {
      // Invalidate queries to refresh project lists
      queryClient.invalidateQueries({ queryKey: ['address-search'] })
      queryClient.invalidateQueries({ queryKey: ['wizard-patch-projects'] })
      // Select the claimed project
      onProjectSelected(projectToClaim)
      setProjectToClaim(null)
    }
  }, [projectToClaim, onProjectSelected, queryClient])
  
  // Loading state
  const isLoading = geoState === 'requesting' || loadingPatches
  
  // Show geolocation-based view or fallback
  const showGeoView = geoState === 'available' && !showSearch
  const showFallbackView = geoState !== 'available' || showSearch
  
  return (
    <div className="p-4 space-y-6 pb-safe-bottom">
      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="relative">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Navigation className="h-8 w-8 text-blue-600 animate-pulse" />
            </div>
            <div className="absolute inset-0 border-4 border-blue-200 rounded-full animate-ping" />
          </div>
          <p className="text-lg text-gray-600 font-medium">Finding your location...</p>
        </div>
      )}
      
      {/* Geolocation unavailable/denied - show fallback */}
      {showFallbackView && !isLoading && (
        <div className="space-y-4">
          {/* Info banner if geo failed */}
          {geoState !== 'available' && (
            <div className={cn(
              'flex items-start gap-3 p-4 rounded-xl',
              geoState === 'denied' 
                ? 'bg-amber-50 text-amber-800' 
                : 'bg-gray-100 text-gray-700'
            )}>
              <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium">
                  {geoState === 'denied' 
                    ? 'Location access denied' 
                    : geoState === 'timeout'
                    ? 'Location request timed out'
                    : 'Location unavailable'}
                </p>
                <p className="text-sm mt-1 opacity-80">
                  Search your assigned projects below
                </p>
              </div>
              {(geoState === 'timeout' || geoState === 'error') && (
                <button
                  onClick={retryGeolocation}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
              )}
            </div>
          )}
          
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="search"
              placeholder="Search projects by name or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-4 h-14 text-lg rounded-xl border-2 focus:border-blue-500"
            />
          </div>
          
          {/* Project list */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1">
              Your Projects
            </h2>
            
            {loadingPatches ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading your patches...</span>
              </div>
            ) : patchIds.length === 0 ? (
              <div className="text-center py-8 text-amber-600 bg-amber-50 rounded-xl p-4">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p className="font-medium">No patches assigned</p>
                <p className="text-sm mt-1">You don&apos;t have any patches assigned. Contact your administrator.</p>
              </div>
            ) : patchProjectsError ? (
              <div className="text-center py-8 text-red-600 bg-red-50 rounded-xl p-4">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p className="font-medium">Error loading projects</p>
                <p className="text-sm mt-1">{(patchProjectsError as Error)?.message || 'Unknown error'}</p>
              </div>
            ) : loadingPatchProjects ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading projects...</span>
              </div>
            ) : filteredPatchProjects.length === 0 ? (
              <div className="text-center py-8 space-y-4">
                <p className="text-gray-500">
                  {searchQuery 
                    ? `No projects matching "${searchQuery}"`
                    : `No projects found in ${patches.length} patch(es)`}
                </p>
                {onAddNewProject && (
                  <WizardButton
                    variant="primary"
                    onClick={onAddNewProject}
                    className="w-full"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add New Project
                  </WizardButton>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPatchProjects.map((project: any) => (
                  <ProjectListItem
                    key={project.id}
                    name={project.name}
                    address={project.address}
                    builderName={project.builderName}
                    onSelect={() => handleSelectProject(project)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Geolocation available - show closest project prompt */}
      {showGeoView && !isLoading && (
        <div className="space-y-6">
          {/* Closest project card */}
          {loadingNearby ? (
            nearbySlow ? (
              <div className="text-center py-8 space-y-4">
                <div className="bg-amber-50 text-amber-800 p-4 rounded-xl">
                  <AlertCircle className="h-6 w-6 mx-auto mb-2" />
                  <p className="font-medium">Nearby search is slow</p>
                  <p className="text-sm mt-1 opacity-80">
                    {nearbyRetryCount > 0 
                      ? `Attempt ${nearbyRetryCount + 1} - you can search your projects instead`
                      : 'This sometimes happens on mobile networks'}
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  {nearbyRetryCount < MAX_NEARBY_RETRIES - 1 && (
                    <WizardButton
                      variant="secondary"
                      onClick={handleRetryNearby}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry nearby search
                    </WizardButton>
                  )}
                  <WizardButton
                    variant="primary"
                    onClick={() => setShowSearch(true)}
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Search my projects
                  </WizardButton>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <p className="text-gray-600">Finding nearby projects…</p>
              </div>
            )
          ) : nearbyError ? (
            <div className="text-center py-8 space-y-4">
              <div className="bg-amber-50 text-amber-800 p-4 rounded-xl">
                <AlertCircle className="h-6 w-6 mx-auto mb-2" />
                <p className="font-medium">
                  {nearbyRetryCount >= MAX_NEARBY_RETRIES 
                    ? 'Nearby search unavailable'
                    : 'Unable to find nearby projects'}
                </p>
                <p className="text-sm mt-1 opacity-80">
                  {(nearbyError as Error)?.message?.includes('timed out')
                    ? 'The server is responding slowly. Please use search instead.'
                    : nearbyRetryCount >= MAX_NEARBY_RETRIES 
                      ? 'Please search your projects below.'
                      : 'This sometimes happens on mobile networks.'}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                {nearbyRetryCount < MAX_NEARBY_RETRIES && (
                  <WizardButton
                    variant="secondary"
                    onClick={handleRetryNearby}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry ({MAX_NEARBY_RETRIES - nearbyRetryCount} left)
                  </WizardButton>
                )}
                <WizardButton
                  variant="primary"
                  onClick={() => setShowSearch(true)}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search my projects
                </WizardButton>
              </div>
            </div>
          ) : closestProject ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-center text-gray-700">
                {closestProject.access_status === 'owned' 
                  ? 'Is this your job?'
                  : closestProject.access_status === 'claimable'
                  ? 'Unclaimed project nearby'
                  : 'Nearby project (assigned to others)'}
              </h2>
              
              <div className={cn(
                'rounded-2xl shadow-lg border-2 overflow-hidden',
                closestProject.access_status === 'owned' && 'bg-white border-blue-200',
                closestProject.access_status === 'claimable' && 'bg-amber-50 border-amber-200',
                closestProject.access_status === 'assigned_other' && 'bg-gray-100 border-gray-300 opacity-70'
              )}>
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={cn(
                          'text-xl font-bold truncate',
                          closestProject.access_status === 'assigned_other' ? 'text-gray-600' : 'text-gray-900'
                        )}>
                          {closestProject.project_name}
                        </h3>
                        {closestProject.access_status === 'claimable' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                            <UserPlus className="h-3 w-3" />
                            Unclaimed
                          </span>
                        )}
                        {closestProject.access_status === 'assigned_other' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-600 rounded-full">
                            <Lock className="h-3 w-3" />
                            Assigned
                          </span>
                        )}
                      </div>
                      {closestProject.builder_name && (
                        <p className={cn(
                          'text-sm mt-1 flex items-center gap-1.5',
                          closestProject.access_status === 'assigned_other' ? 'text-gray-500' : 'text-gray-600'
                        )}>
                          <Building className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{closestProject.builder_name}</span>
                        </p>
                      )}
                    </div>
                    <div className={cn(
                      'flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium',
                      closestProject.access_status === 'assigned_other' 
                        ? 'bg-gray-200 text-gray-600'
                        : 'bg-blue-100 text-blue-700'
                    )}>
                      <MapPin className="h-4 w-4" />
                      {formatDistance(closestProject.distance_km)}
                    </div>
                  </div>
                  
                  {closestProject.job_site_address && (
                    <p className={cn(
                      'text-sm',
                      closestProject.access_status === 'assigned_other' ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      {closestProject.job_site_address}
                    </p>
                  )}
                  
                  {/* Show assigned organisers for assigned_other */}
                  {closestProject.access_status === 'assigned_other' && closestProject.assigned_to_names && (
                    <p className="text-xs text-gray-500">
                      Assigned to: {closestProject.assigned_to_names.join(', ')}
                    </p>
                  )}
                </div>
                
                {closestProject.access_status !== 'assigned_other' ? (
                  <div className="grid grid-cols-2 gap-0 border-t border-gray-200">
                    <button
                      onClick={() => setShowSearch(true)}
                      className="py-4 text-center font-semibold text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors border-r border-gray-200"
                    >
                      Other
                    </button>
                    <button
                      onClick={() => handleSelectProject(
                        {
                          id: closestProject.project_id,
                          name: closestProject.project_name,
                          address: closestProject.job_site_address,
                          builderName: closestProject.builder_name,
                          mainJobSiteId: closestProject.job_site_id,
                        },
                        closestProject.access_status,
                        closestProject.assigned_to_names
                      )}
                      className={cn(
                        'py-4 text-center font-bold transition-colors',
                        closestProject.access_status === 'claimable'
                          ? 'text-amber-600 hover:bg-amber-50 active:bg-amber-100'
                          : 'text-blue-600 hover:bg-blue-50 active:bg-blue-100'
                      )}
                    >
                      {closestProject.access_status === 'claimable' ? 'Claim project' : 'Yes, this is it'}
                    </button>
                  </div>
                ) : (
                  <div className="border-t border-gray-200 py-3 text-center">
                    <button
                      onClick={() => setShowSearch(true)}
                      className="text-sm font-medium text-gray-600 hover:text-blue-600"
                    >
                      Search for other projects
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 space-y-4">
              <p className="text-gray-500">No nearby projects found</p>
              <div className="space-y-3">
                <WizardButton
                  variant="secondary"
                  onClick={() => setShowSearch(true)}
                  className="w-full"
                >
                  <Search className="h-5 w-5 mr-2" />
                  Search all projects
                </WizardButton>
                {onAddNewProject && (
                  <WizardButton
                    variant="primary"
                    onClick={onAddNewProject}
                    className="w-full"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add New Project
                  </WizardButton>
                )}
              </div>
            </div>
          )}
          
          {/* Other nearby projects */}
          {nearbyProjects.length > 1 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1">
                Other nearby projects
              </h2>
              
              <div className="space-y-2">
                {nearbyProjects.slice(1, 6).map((project: NearbyProject) => (
                  <ProjectListItem
                    key={project.project_id}
                    name={project.project_name}
                    address={project.job_site_address}
                    builderName={project.builder_name}
                    distance={formatDistance(project.distance_km)}
                    accessStatus={project.access_status}
                    assignedToNames={project.assigned_to_names}
                    patchName={project.patch_name}
                    onSelect={() => handleSelectProject(
                      {
                        id: project.project_id,
                        name: project.project_name,
                        address: project.job_site_address,
                        builderName: project.builder_name,
                        mainJobSiteId: project.job_site_id,
                      },
                      project.access_status,
                      project.assigned_to_names
                    )}
                  />
                ))}
              </div>
              
              <button
                onClick={() => setShowSearch(true)}
                className="w-full py-3 text-center text-blue-600 font-medium hover:bg-blue-50 rounded-xl transition-colors"
              >
                Search all projects
              </button>
            </div>
          )}
        </div>
      )}

      {/* Claim project dialog */}
      <ClaimProjectDialog
        open={!!projectToClaim}
        onOpenChange={(open) => !open && setProjectToClaim(null)}
        project={projectToClaim}
        onSuccess={handleClaimSuccess}
      />
    </div>
  )
}

// Project list item component with access status support
function ProjectListItem({
  name,
  address,
  builderName,
  distance,
  accessStatus,
  assignedToNames,
  patchName,
  onSelect,
}: {
  name: string
  address?: string | null
  builderName?: string | null
  distance?: string
  accessStatus?: ProjectAccessStatus
  assignedToNames?: string[] | null
  patchName?: string | null
  onSelect: () => void
}) {
  const isOwned = !accessStatus || accessStatus === 'owned'
  const isClaimable = accessStatus === 'claimable'
  const isAssignedOther = accessStatus === 'assigned_other'
  
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left p-4 rounded-xl border transition-all duration-200 touch-manipulation flex items-center gap-3',
        // Owned: normal styling
        isOwned && 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md active:bg-gray-50',
        // Claimable: slightly muted with dashed border
        isClaimable && 'bg-gray-50 border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-white',
        // Assigned to other: greyed out
        isAssignedOther && 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed'
      )}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <h3 className={cn(
            'font-semibold truncate',
            isAssignedOther ? 'text-gray-500' : 'text-gray-900'
          )}>
            {name}
          </h3>
          {/* Status badges */}
          {isClaimable && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full whitespace-nowrap">
              <UserPlus className="h-3 w-3" />
              Unclaimed
            </span>
          )}
          {isAssignedOther && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-600 rounded-full whitespace-nowrap">
              <Lock className="h-3 w-3" />
              Assigned
            </span>
          )}
        </div>
        {builderName && (
          <p className={cn(
            'text-sm truncate flex items-center gap-1.5',
            isAssignedOther ? 'text-gray-400' : 'text-gray-600'
          )}>
            <Building className="h-3.5 w-3.5 flex-shrink-0" />
            {builderName}
          </p>
        )}
        {address && (
          <p className={cn(
            'text-sm truncate',
            isAssignedOther ? 'text-gray-400' : 'text-gray-500'
          )}>
            {address}
          </p>
        )}
        {/* Show assigned organiser names for assigned_other */}
        {isAssignedOther && assignedToNames && assignedToNames.length > 0 && (
          <p className="text-xs text-gray-400 truncate">
            Assigned to: {assignedToNames.slice(0, 2).join(', ')}
            {assignedToNames.length > 2 && ` +${assignedToNames.length - 2} more`}
          </p>
        )}
        {/* Show patch name for claimable projects */}
        {isClaimable && patchName && (
          <p className="text-xs text-amber-600">
            Patch: {patchName} (no organiser assigned)
          </p>
        )}
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
        {distance && (
          <span className={cn(
            'text-sm',
            isAssignedOther ? 'text-gray-400' : 'text-gray-500'
          )}>
            {distance}
          </span>
        )}
        {isAssignedOther ? (
          <Lock className="h-5 w-5 text-gray-400" />
        ) : isClaimable ? (
          <UserPlus className="h-5 w-5 text-amber-500" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-400" />
        )}
      </div>
    </button>
  )
}

