"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MobileProjectDiscovery } from '@/components/mobile/workflows/MobileProjectDiscovery'
import { useOfflineSync } from '@/hooks/mobile/useOfflineSync'
import { useMobileOptimizations } from '@/hooks/mobile/useMobileOptimizations'
import { useToast } from '@/hooks/use-toast'
import { MobileLoadingState } from '@/components/mobile/shared/MobileOptimizationProvider'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Circle } from '@react-google-maps/api'

interface Project {
  id: string
  name: string
  address: string
  status: string
  employer_id?: string
  primary_trade?: string
  coordinates: {
    lat: number
    lng: number
  }
  workforce_size?: number
  union_percentage?: number
  last_visit?: string
  compliance_rating?: 'green' | 'amber' | 'red'
  distance?: number // from current location
}

interface MapCenter {
  lat: number
  lng: number
}

const mapContainerStyle = {
  width: '100%',
  height: '100vh'
}

const options = {
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false
}

export default function MobileProjectDiscoveryPage() {
  const router = useRouter()
  const { toast } = useToast()

  const {
    debounce,
    isMobile,
    isLowEndDevice,
  } = useMobileOptimizations({
    enableDebouncing: true,
    debounceDelay: 300,
  })

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<MapCenter | null>(null)
  const [mapCenter, setMapCenter] = useState<MapCenter>({ lat: -33.8688, lng: 151.2093 }) // Sydney
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [searchRadius, setSearchRadius] = useState(10) // 10km
  const [filterTrade, setFilterTrade] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places']
  })

  const {
    data: cachedProjects,
    isOnline,
    forceSync,
  } = useOfflineSync<Project>([], {
    storageKey: 'mobile-project-discovery',
    autoSync: true,
    syncInterval: 60000, // 1 minute
  })

  // Get user's current location
  useEffect(() => {
    const getCurrentLocation = () => {
      if (!navigator.geolocation) {
        console.warn('Geolocation not supported')
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
          setUserLocation(location)
          setMapCenter(location)
        },
        (error) => {
          console.warn('Error getting location:', error)
          toast({
            title: "Location unavailable",
            description: "Using default location. Enable location services for better results.",
            variant: "destructive"
          })
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 300000 // 5 minutes
        }
      )
    }

    getCurrentLocation()
  }, [toast])

  // Load projects data
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true)

        // Try to get fresh data if online
        if (isOnline) {
          const response = await fetch('/api/projects/for-mobile', {
            headers: {
              'Cache-Control': 'no-cache'
            }
          })

          if (response.ok) {
            const data = await response.json()
            const projectsWithDistance = calculateDistances(data.projects || [], userLocation)
            setProjects(projectsWithDistance)

            // Cache the data
            // This would be handled by the sync hook in a real implementation
          } else {
            throw new Error('Failed to fetch projects')
          }
        } else {
          // Use cached data when offline
          setProjects(cachedProjects || [])
        }
      } catch (error) {
        console.error('Error loading projects:', error)

        // Fallback to cached data
        if (cachedProjects && cachedProjects.length > 0) {
          setProjects(cachedProjects)
          toast({
            title: "Using cached data",
            description: "Offline mode. Showing previously loaded projects.",
          })
        } else {
          // Use mock data as last resort
          const mockProjects = getMockProjects()
          const projectsWithDistance = calculateDistances(mockProjects, userLocation)
          setProjects(projectsWithDistance)
        }
      } finally {
        setLoading(false)
      }
    }

    loadProjects()
  }, [isOnline, cachedProjects, userLocation, toast])

  // Calculate distances from user location
  const calculateDistances = useCallback((projectList: Project[], userLoc: MapCenter | null) => {
    if (!userLoc) return projectList

    return projectList.map(project => ({
      ...project,
      distance: calculateDistance(userLoc, project.coordinates)
    })).sort((a, b) => (a.distance || 0) - (b.distance || 0))
  }, [])

  // Calculate distance between two points
  const calculateDistance = (point1: MapCenter, point2: MapCenter): number => {
    const R = 6371 // Earth's radius in kilometers
    const dLat = (point2.lat - point1.lat) * Math.PI / 180
    const dLng = (point2.lng - point1.lng) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  // Filter projects based on search criteria
  const filteredProjects = projects.filter(project => {
    // Filter by distance
    if (searchRadius > 0 && project.distance && project.distance > searchRadius) {
      return false
    }

    // Filter by trade
    if (filterTrade && project.primary_trade !== filterTrade) {
      return false
    }

    // Filter by status
    if (filterStatus && project.status !== filterStatus) {
      return false
    }

    return true
  })

  // Handle project selection
  const handleProjectSelect = useCallback((project: Project) => {
    setSelectedProject(project)
  }, [])

  // Handle navigation to project details
  const handleProjectNavigate = useCallback((project: Project) => {
    router.push(`/mobile/projects/${project.id}`)
  }, [router])

  // Refresh data
  const handleRefresh = useCallback(async () => {
    try {
      await forceSync()
      toast({
        title: "Data refreshed",
        description: "Latest project data has been loaded",
      })
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Unable to load latest data",
        variant: "destructive",
      })
    }
  }, [forceSync, toast])

  if (!isLoaded) {
    return <MobileLoadingState message="Loading maps..." />
  }

  if (loading) {
    return <MobileLoadingState message="Loading projects..." />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Offline indicator */}
      {!isOnline && (
        <div className="bg-amber-50 border-b border-amber-200 p-2 relative z-50">
          <div className="flex items-center justify-center gap-2 text-sm text-amber-800">
            <div className="w-2 h-2 bg-amber-600 rounded-full animate-pulse" />
            <span>Offline mode - Showing cached projects</span>
          </div>
        </div>
      )}

      <MobileProjectDiscovery
        projects={filteredProjects}
        userLocation={userLocation}
        mapCenter={mapCenter}
        selectedProject={selectedProject}
        searchRadius={searchRadius}
        filterTrade={filterTrade}
        filterStatus={filterStatus}
        onProjectSelect={handleProjectSelect}
        onProjectNavigate={handleProjectNavigate}
        onMapCenterChange={setMapCenter}
        onSearchRadiusChange={setSearchRadius}
        onFilterTradeChange={setFilterTrade}
        onFilterStatusChange={setFilterStatus}
        onRefresh={handleRefresh}
        isOnline={isOnline}
        isLowEndDevice={isLowEndDevice}
      />
    </div>
  )
}

// Mock data generator
function getMockProjects(): Project[] {
  const sydneyCenter = { lat: -33.8688, lng: 151.2093 }
  const trades = ['Construction', 'Electrical', 'Plumbing', 'Concreting', 'Steel Fixing']
  const statuses = ['active', 'pending', 'completed']
  const ratings: Array<'green' | 'amber' | 'red'> = ['green', 'amber', 'red']

  // Use deterministic values based on index to prevent hydration mismatch
  // Simple hash function for pseudo-random but consistent values
  const hash = (n: number) => {
    let h = n * 2654435761
    return (h ^ (h >>> 16)) / 0xFFFFFFFF
  }

  return Array.from({ length: 20 }, (_, i) => {
    // Generate deterministic coordinates around Sydney
    const angle = (i / 20) * 2 * Math.PI
    const distance = (hash(i) * 0.3 + 0.05) % 0.3 + 0.05 // Deterministic distance
    const lat = sydneyCenter.lat + distance * Math.cos(angle)
    const lng = sydneyCenter.lng + distance * Math.sin(angle)

    // Use modulo to get deterministic but varied selections
    const statusIndex = Math.floor(hash(i) * statuses.length) % statuses.length
    const tradeIndex = Math.floor(hash(i + 100) * trades.length) % trades.length
    const ratingIndex = Math.floor(hash(i + 200) * ratings.length) % ratings.length
    const workforceBase = Math.floor(hash(i + 300) * 100) % 100
    const unionBase = Math.floor(hash(i + 400) * 40) % 40
    const daysAgo = Math.floor(hash(i + 500) * 30) % 30

    return {
      id: `project-${i + 1}`,
      name: `Construction Site ${i + 1}`,
      address: `${100 + i} Construction Street, Sydney NSW`,
      status: statuses[statusIndex],
      primary_trade: trades[tradeIndex],
      coordinates: { lat, lng },
      workforce_size: workforceBase + 10,
      union_percentage: unionBase + 60,
      last_visit: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
      compliance_rating: ratings[ratingIndex]
    }
  })
}