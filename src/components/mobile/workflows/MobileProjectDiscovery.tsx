"use client"

import { useState, useCallback, useRef, useMemo } from 'react'
import { GoogleMap, Marker, InfoWindow, Circle } from '@react-google-maps/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useHapticFeedback } from '@/components/mobile/shared/HapticFeedback'
import {
  Navigation,
  Filter,
  Search,
  MapPin,
  Users,
  Shield,
  Phone,
  Clock,
  ChevronRight,
  Layers,
  Crosshair,
  RefreshCw
} from 'lucide-react'

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
  distance?: number
}

interface MapCenter {
  lat: number
  lng: number
}

interface MobileProjectDiscoveryProps {
  projects: Project[]
  userLocation: MapCenter | null
  mapCenter: MapCenter
  selectedProject: Project | null
  searchRadius: number
  filterTrade: string
  filterStatus: string
  onProjectSelect: (project: Project) => void
  onProjectNavigate: (project: Project) => void
  onMapCenterChange: (center: MapCenter) => void
  onSearchRadiusChange: (radius: number) => void
  onFilterTradeChange: (trade: string) => void
  onFilterStatusChange: (status: string) => void
  onRefresh: () => void
  isOnline: boolean
  isLowEndDevice: boolean
}

const mapContainerStyle = {
  width: '100%',
  height: 'calc(100vh - 140px)' // Account for header and controls
}

const mapOptions = {
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  gestureHandling: 'greedy' as const,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    }
  ]
}

const COMMON_TRADES = [
  'All Trades',
  'Construction',
  'Electrical',
  'Plumbing',
  'Concreting',
  'Steel Fixing',
  'Scaffolding',
  'Carpentry',
  'Demolition'
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' }
]

export function MobileProjectDiscovery({
  projects,
  userLocation,
  mapCenter,
  selectedProject,
  searchRadius,
  filterTrade,
  filterStatus,
  onProjectSelect,
  onProjectNavigate,
  onMapCenterChange,
  onSearchRadiusChange,
  onFilterTradeChange,
  onFilterStatusChange,
  onRefresh,
  isOnline,
  isLowEndDevice
}: MobileProjectDiscoveryProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [infoWindowOpen, setInfoWindowOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const mapRef = useRef<google.maps.Map>(null)

  const { trigger, success } = useHapticFeedback()

  // Filter projects based on search query
  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      if (searchQuery && !project.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !project.address.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      return true
    })
  }, [projects, searchQuery])

  // Get marker color based on compliance rating
  const getMarkerColor = (rating?: 'green' | 'amber' | 'red') => {
    switch (rating) {
      case 'green': return '#22c55e'
      case 'amber': return '#f59e0b'
      case 'red': return '#ef4444'
      default: return '#6b7280'
    }
  }

  // Handle map load
  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map)
    mapRef.current = map
  }, [])

  // Handle map center change
  const onCenterChanged = useCallback(() => {
    if (mapRef.current) {
      const center = mapRef.current.getCenter()
      if (center) {
        onMapCenterChange({
          lat: center.lat(),
          lng: center.lng()
        })
      }
    }
  }, [onMapCenterChange])

  // Focus on user location
  const focusOnUserLocation = useCallback(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.panTo(userLocation)
      mapRef.current.setZoom(12)
      trigger()
      success()
    }
  }, [userLocation, trigger, success])

  // Handle project marker click
  const handleMarkerClick = useCallback((project: Project) => {
    trigger()
    onProjectSelect(project)
    setInfoWindowOpen(true)

    // Center map on project
    if (mapRef.current) {
      mapRef.current.panTo(project.coordinates)
    }
  }, [onProjectSelect, trigger])

  // Handle info window close
  const handleInfoWindowClose = useCallback(() => {
    setInfoWindowOpen(false)
    onProjectSelect(null as any)
  }, [onProjectSelect])

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default'
      case 'pending': return 'secondary'
      case 'completed': return 'outline'
      default: return 'secondary'
    }
  }

  return (
    <div className="relative h-full">
      {/* Map */}
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={12}
        options={mapOptions}
        onLoad={onLoad}
        onCenterChanged={onCenterChanged}
      >

        {/* User Location Marker */}
        {userLocation && (
          <>
            <Marker
              position={userLocation}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#3b82f6',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2
              }}
              title="Your Location"
            />
            <Circle
              center={userLocation}
              radius={searchRadius * 1000} // Convert km to meters
              options={{
                fillColor: '#3b82f6',
                fillOpacity: 0.1,
                strokeColor: '#3b82f6',
                strokeOpacity: 0.3,
                strokeWeight: 2
              }}
            />
          </>
        )}

        {/* Project Markers */}
        {filteredProjects.map((project) => (
          <Marker
            key={project.id}
            position={project.coordinates}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: getMarkerColor(project.compliance_rating),
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2
            }}
            onClick={() => handleMarkerClick(project)}
            title={project.name}
          />
        ))}

        {/* Info Window for Selected Project */}
        {selectedProject && (
          <InfoWindow
            position={selectedProject.coordinates}
            onCloseClick={handleInfoWindowClose}
          >
            <div className="p-2 max-w-xs">
              <h3 className="font-semibold text-sm mb-1">{selectedProject.name}</h3>
              <p className="text-xs text-muted-foreground mb-2">{selectedProject.address}</p>

              <div className="space-y-1 text-xs">
                {selectedProject.primary_trade && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Trade:</span>
                    <span>{selectedProject.primary_trade}</span>
                  </div>
                )}

                {selectedProject.workforce_size && (
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span>{selectedProject.workforce_size} workers</span>
                  </div>
                )}

                {selectedProject.union_percentage && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Union:</span>
                    <span>{selectedProject.union_percentage}%</span>
                  </div>
                )}

                {selectedProject.distance && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>{selectedProject.distance.toFixed(1)} km away</span>
                  </div>
                )}
              </div>

              <Button
                size="sm"
                className="w-full mt-3 h-8"
                onClick={() => onProjectNavigate(selectedProject)}
              >
                View Details
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Controls Overlay */}
      <div className="absolute top-4 left-4 right-4 z-10">
        {/* Search Bar */}
        <Card className="mb-3">
          <CardContent className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Quick Filters */}
        <div className="flex gap-2 mb-3">
          <Card className="flex-1">
            <CardContent className="p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">
                  {filteredProjects.length} projects
                </span>
                {searchRadius > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {searchRadius}km radius
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Sheet open={showFilters} onOpenChange={setShowFilters}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 px-3">
                <Filter className="h-4 w-4 mr-1" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[60vh]">
              <SheetHeader>
                <SheetTitle>Filter Projects</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {/* Search Radius */}
                <div>
                  <Label className="text-sm font-medium">Search Radius</Label>
                  <Select
                    value={searchRadius.toString()}
                    onValueChange={(value) => onSearchRadiusChange(parseInt(value))}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">All distances</SelectItem>
                      <SelectItem value="5">5 km</SelectItem>
                      <SelectItem value="10">10 km</SelectItem>
                      <SelectItem value="25">25 km</SelectItem>
                      <SelectItem value="50">50 km</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Trade Filter */}
                <div>
                  <Label className="text-sm font-medium">Trade</Label>
                  <Select
                    value={filterTrade}
                    onValueChange={onFilterTradeChange}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_TRADES.map(trade => (
                        <SelectItem key={trade} value={trade === 'All Trades' ? '' : trade}>
                          {trade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <Select
                    value={filterStatus}
                    onValueChange={onFilterStatusChange}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(status => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Clear Filters */}
                <Button
                  variant="outline"
                  onClick={() => {
                    onFilterTradeChange('')
                    onFilterStatusChange('')
                    onSearchRadiusChange(10)
                  }}
                  className="w-full"
                >
                  Clear All Filters
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        {/* Refresh Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          disabled={!isOnline}
          className="h-12 w-12 bg-white shadow-lg"
        >
          <RefreshCw className="h-5 w-5" />
        </Button>

        {/* User Location Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={focusOnUserLocation}
          disabled={!userLocation}
          className="h-12 w-12 bg-white shadow-lg"
        >
          <Navigation className="h-5 w-5" />
        </Button>
      </div>

      {/* Project List (Mobile-friendly) */}
      <div className="absolute bottom-20 left-4 right-4 z-10">
        <Card className="max-h-32 overflow-y-auto">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Nearby Projects</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(true)}
                className="h-6 px-2 text-xs"
              >
                <Filter className="h-3 w-3 mr-1" />
                Filter
              </Button>
            </div>

            <div className="space-y-2">
              {filteredProjects.slice(0, 3).map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                  onClick={() => handleMarkerClick(project)}
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getMarkerColor(project.compliance_rating) }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{project.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{project.primary_trade}</span>
                      {project.distance && (
                        <span>• {project.distance.toFixed(1)} km</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Online Status Indicator */}
      <div className="absolute top-4 right-4 z-10">
        <Card className="px-2 py-1">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs font-medium">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </Card>
      </div>
    </div>
  )
}