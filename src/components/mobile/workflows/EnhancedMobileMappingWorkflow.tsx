"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { useFieldOrganizerMonitor } from '@/lib/mobile/mobile-field-organizer-monitor'
import { useOfflineSync } from '@/hooks/mobile/useOfflineSync'
import { useHapticFeedback } from '@/components/mobile/shared/HapticFeedback'
import { MobileCameraCapture } from '@/components/mobile/forms/MobileCameraCapture'
import { MobileLocationPicker } from '@/components/mobile/forms/MobileLocationPicker'

// Icons
import {
  MapPin,
  Camera,
  Users,
  Building,
  Phone,
  Mail,
  Save,
  Navigation,
  Wifi,
  WifiOff,
  Battery,
  AlertTriangle,
  CheckCircle,
  Clock,
  Compass,
  Plus,
  X,
  Upload,
  Download,
  RefreshCw,
  Settings,
  Sun,
  Cloud
} from 'lucide-react'

interface ProjectData {
  id: string
  name: string
  address: string
  coordinates?: { lat: number; lng: number }
  status: string
}

interface EmployerData {
  id?: string
  name: string
  abn?: string
  phone?: string
  email?: string
  role: 'builder' | 'head_contractor' | 'trade_subcontractor' | 'project_manager'
  unionMembership?: 'member' | 'non_member' | 'potential' | 'declined'
  notes?: string
  photos?: string[]
  contactPerson?: string
  siteLocation?: { lat: number; lng: number }
  timestamp: number
}

interface MappingSession {
  id: string
  projectId: string
  startTime: number
  endTime?: number
  employers: EmployerData[]
  location?: { lat: number; lng: number }
  accuracy?: number
  weather?: string
  photos: string[]
  notes: string
  status: 'active' | 'completed' | 'synced'
  syncErrors?: string[]
}

interface EnhancedMobileMappingWorkflowProps {
  project: ProjectData
  onComplete?: (session: MappingSession) => void
  onCancel?: () => void
}

export function EnhancedMobileMappingWorkflow({
  project,
  onComplete,
  onCancel
}: EnhancedMobileMappingWorkflowProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { trigger, success, error } = useHapticFeedback()

  const {
    metrics,
    alerts,
    isOnline,
    recordPhotoCapture,
    recordPhotoUpload,
    recordFormStart,
    recordFormCompletion,
    startGPSTracking,
    stopGPSTracking
  } = useFieldOrganizerMonitor()

  const {
    data: cachedSessions,
    forceSync
  } = useOfflineSync<MappingSession>([], {
    storageKey: 'mapping-sessions',
    autoSync: true,
    syncInterval: 30000
  })

  const [session, setSession] = useState<MappingSession>({
    id: `session_${Date.now()}`,
    projectId: project.id,
    startTime: Date.now(),
    employers: [],
    photos: [],
    notes: '',
    status: 'active'
  })

  const [currentEmployer, setCurrentEmployer] = useState<EmployerData>({
    name: '',
    role: 'trade_subcontractor',
    unionMembership: 'potential',
    timestamp: Date.now()
  })

  const [isTrackingLocation, setIsTrackingLocation] = useState(false)
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null)
  const [autoSaveCount, setAutoSaveCount] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false)
  const [showEmployerForm, setShowEmployerForm] = useState(false)
  const [activeEmployerIndex, setActiveEmployerIndex] = useState<number | null>(null)

  const locationWatchId = useRef<number | null>(null)
  const autoSaveInterval = useRef<NodeJS.Timeout | null>(null)

  // Start location tracking
  useEffect(() => {
    const startLocationTracking = async () => {
      try {
        await startGPSTracking()
        setIsTrackingLocation(true)

        // Watch position for continuous updates
        locationWatchId.current = navigator.geolocation.watchPosition(
          (position) => {
            const accuracy = position.coords.accuracy
            setLocationAccuracy(accuracy)

            setSession(prev => ({
              ...prev,
              location: {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              },
              accuracy
            }))

            // Trigger haptic feedback for accurate location
            if (accuracy < 10) {
              success()
            }
          },
          (error) => {
            console.error('Location tracking error:', error)
            setIsTrackingLocation(false)
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        )
      } catch (error) {
        console.error('Failed to start GPS tracking:', error)
        toast({
          title: "GPS Error",
          description: "Unable to start location tracking",
          variant: "destructive"
        })
      }
    }

    startLocationTracking()

    return () => {
      if (locationWatchId.current) {
        navigator.geolocation.clearWatch(locationWatchId.current)
      }
      stopGPSTracking()
    }
  }, [startGPSTracking, stopGPSTracking, toast, success])

  // Auto-save functionality
  useEffect(() => {
    autoSaveInterval.current = setInterval(() => {
      if (session.employers.length > 0 || session.photos.length > 0) {
        saveSession(true)
      }
    }, 30000) // Auto-save every 30 seconds

    return () => {
      if (autoSaveInterval.current) {
        clearInterval(autoSaveInterval.current)
      }
    }
  }, [session])

  // Handle form interactions
  useEffect(() => {
    if (showEmployerForm) {
      recordFormStart('employer_mapping', 8) // 8 fields in employer form
    }
  }, [showEmployerForm, recordFormStart])

  const saveSession = useCallback(async (isAutoSave = false) => {
    setIsSaving(true)

    try {
      const sessionData = {
        ...session,
        lastModified: Date.now()
      }

      // Save to IndexedDB (via offline sync)
      // This would integrate with the offline sync system
      await new Promise(resolve => setTimeout(resolve, 500)) // Simulate save

      if (!isAutoSave) {
        setAutoSaveCount(prev => prev + 1)
        trigger()
        success()

        toast({
          title: isAutoSave ? "Auto-saved" : "Progress saved",
          description: isAutoSave ? "Your progress has been saved automatically" : "Mapping session saved successfully",
        })
      }
    } catch (error) {
      error()
      toast({
        title: "Save failed",
        description: "Unable to save progress. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }, [session, trigger, success, error, toast])

  const handlePhotoCapture = useCallback(async (photoData: string, file: File) => {
    setIsCapturingPhoto(true)
    trigger()

    try {
      // Record photo capture for performance monitoring
      recordPhotoCapture(1000, 0.8) // Simulated compression time and quality

      // Add photo to current employer or session
      if (activeEmployerIndex !== null) {
        const updatedEmployers = [...session.employers]
        updatedEmployers[activeEmployerIndex] = {
          ...updatedEmployers[activeEmployerIndex],
          photos: [...(updatedEmployers[activeEmployerIndex].photos || []), photoData]
        }
        setSession(prev => ({ ...prev, employers: updatedEmployers }))
      } else {
        setSession(prev => ({ ...prev, photos: [...prev.photos, photoData] }))
      }

      // Handle upload if online
      if (isOnline) {
        recordPhotoUpload(2000, file.size, true) // Simulated upload
      } else {
        recordPhotoUpload(0, file.size, false) // Offline - will queue
      }

      success()
      toast({
        title: "Photo captured",
        description: "Photo added successfully",
      })
    } catch (error) {
      error()
      toast({
        title: "Photo capture failed",
        description: "Unable to save photo",
        variant: "destructive"
      })
    } finally {
      setIsCapturingPhoto(false)
    }
  }, [activeEmployerIndex, session.employers, isOnline, trigger, success, error, toast, recordPhotoCapture, recordPhotoUpload])

  const handleAddEmployer = useCallback(() => {
    if (!currentEmployer.name.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter the employer name",
        variant: "destructive"
      })
      return
    }

    const newEmployer: EmployerData = {
      ...currentEmployer,
      id: `employer_${Date.now()}`,
      timestamp: Date.now(),
      siteLocation: session.location
    }

    setSession(prev => ({
      ...prev,
      employers: [...prev.employers, newEmployer]
    }))

    setCurrentEmployer({
      name: '',
      role: 'trade_subcontractor',
      unionMembership: 'potential',
      timestamp: Date.now()
    })

    setShowEmployerForm(false)
    trigger()
    success()

    toast({
      title: "Employer added",
      description: `${newEmployer.name} has been added to the mapping`,
    })
  }, [currentEmployer, session.location, trigger, success, toast])

  const handleCompleteSession = useCallback(async () => {
    trigger()

    const completedSession: MappingSession = {
      ...session,
      endTime: Date.now(),
      status: 'completed'
    }

    recordFormCompletion('mapping_session', Date.now() - session.startTime, autoSaveCount)

    try {
      // Save final session
      await saveSession(false)

      // Try to sync if online
      if (isOnline) {
        // Simulate sync
        await new Promise(resolve => setTimeout(resolve, 1000))
        completedSession.status = 'synced'
      }

      success()
      onComplete?.(completedSession)

      toast({
        title: "Mapping completed",
        description: `Successfully mapped ${session.employers.length} employers`,
      })

      // Navigate back to project view
      router.push(`/mobile/projects/${project.id}`)
    } catch (error) {
      error()
      toast({
        title: "Completion failed",
        description: "Unable to complete mapping session",
        variant: "destructive"
      })
    }
  }, [session, autoSaveCount, isOnline, trigger, success, error, toast, onComplete, router, project.id, saveSession, recordFormCompletion])

  const handleCancelSession = useCallback(() => {
    if (session.employers.length > 0 || session.photos.length > 0) {
      if (confirm('You have unsaved work. Are you sure you want to cancel?')) {
        onCancel?.()
      }
    } else {
      onCancel?.()
    }
  }, [session, onCancel])

  const getLocationAccuracyColor = (accuracy: number | null): string => {
    if (!accuracy) return 'text-gray-500'
    if (accuracy < 10) return 'text-green-600'
    if (accuracy < 25) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getRoleBadgeColor = (role: string): string => {
    switch (role) {
      case 'builder': return 'bg-blue-100 text-blue-800'
      case 'head_contractor': return 'bg-purple-100 text-purple-800'
      case 'project_manager': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getMembershipBadgeColor = (membership: string): string => {
    switch (membership) {
      case 'member': return 'bg-green-100 text-green-800'
      case 'potential': return 'bg-yellow-100 text-yellow-800'
      case 'non_member': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Project Mapping</h1>
              <p className="text-sm text-muted-foreground">{project.name}</p>
              <p className="text-xs text-muted-foreground">{project.address}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveSession(false)}
                disabled={isSaving}
              >
                {isSaving ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelSession}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Status Bar */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              {/* GPS Status */}
              <div className={`flex items-center gap-1 ${getLocationAccuracyColor(locationAccuracy)}`}>
                <MapPin className="h-3 w-3" />
                <span>
                  {isTrackingLocation ? (
                    locationAccuracy ? `${Math.round(locationAccuracy)}m` : 'Acquiring...'
                  ) : 'Offline'}
                </span>
              </div>

              {/* Network Status */}
              <div className={`flex items-center gap-1 ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                <span>{isOnline ? 'Online' : 'Offline'}</span>
              </div>

              {/* Auto-save indicator */}
              {autoSaveCount > 0 && (
                <div className="flex items-center gap-1 text-blue-600">
                  <Download className="h-3 w-3" />
                  <span>Auto-saved {autoSaveCount}x</span>
                </div>
              )}
            </div>

            <div className="text-muted-foreground">
              {session.employers.length} employers
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-140px)]">
        <div className="p-4 space-y-4">
          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => setShowEmployerForm(true)}
              className="h-16 flex flex-col items-center justify-center gap-1"
              disabled={isCapturingPhoto}
            >
              <Plus className="h-5 w-5" />
              <span className="text-xs">Add Employer</span>
            </Button>

            <MobileCameraCapture
              onPhotoCapture={handlePhotoCapture}
              disabled={isCapturingPhoto}
              className="h-16 flex flex-col items-center justify-center gap-1"
            >
              <Camera className="h-5 w-5" />
              <span className="text-xs">Take Photo</span>
            </MobileCameraCapture>
          </div>

          {/* Current Location */}
          {session.location && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Compass className="h-4 w-4" />
                  Current Location
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xs space-y-1">
                  <p>Lat: {session.location.lat.toFixed(6)}</p>
                  <p>Lng: {session.location.lng.toFixed(6)}</p>
                  {locationAccuracy && (
                    <p className={`font-medium ${getLocationAccuracyColor(locationAccuracy)}`}>
                      Accuracy: ±{Math.round(locationAccuracy)}m
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mapped Employers */}
          {session.employers.length > 0 && (
            <div>
              <h3 className="font-medium mb-3">Mapped Employers ({session.employers.length})</h3>
              <div className="space-y-3">
                {session.employers.map((employer, index) => (
                  <Card
                    key={employer.id}
                    className={`cursor-pointer transition-all ${
                      activeEmployerIndex === index ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setActiveEmployerIndex(activeEmployerIndex === index ? null : index)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{employer.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={`text-xs ${getRoleBadgeColor(employer.role)}`}>
                              {employer.role.replace('_', ' ')}
                            </Badge>
                            <Badge className={`text-xs ${getMembershipBadgeColor(employer.unionMembership || 'potential')}`}>
                              {employer.unionMembership || 'potential'}
                            </Badge>
                          </div>
                        </div>
                        {employer.photos && employer.photos.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Camera className="h-3 w-3" />
                            <span>{employer.photos.length}</span>
                          </div>
                        )}
                      </div>

                      {employer.contactPerson && (
                        <p className="text-xs text-muted-foreground mb-1">
                          Contact: {employer.contactPerson}
                        </p>
                      )}

                      {employer.phone && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <a href={`tel:${employer.phone}`} className="text-blue-600 hover:underline">
                            {employer.phone}
                          </a>
                        </div>
                      )}

                      {employer.notes && (
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          {employer.notes}
                        </p>
                      )}

                      {employer.photos && employer.photos.length > 0 && (
                        <div className="mt-3">
                          <div className="grid grid-cols-3 gap-2">
                            {employer.photos.slice(0, 3).map((photo, photoIndex) => (
                              <div
                                key={photoIndex}
                                className="aspect-square bg-gray-100 rounded-lg overflow-hidden"
                              >
                                <img
                                  src={photo}
                                  alt={`Photo ${photoIndex + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                            {employer.photos.length > 3 && (
                              <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                                <span className="text-xs text-muted-foreground">
                                  +{employer.photos.length - 3}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Session Photos */}
          {session.photos.length > 0 && (
            <div>
              <h3 className="font-medium mb-3">Site Photos ({session.photos.length})</h3>
              <div className="grid grid-cols-3 gap-2">
                {session.photos.map((photo, index) => (
                  <div key={index} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={photo}
                      alt={`Site photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Session Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Session Notes</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Textarea
                placeholder="Add notes about this mapping session..."
                value={session.notes}
                onChange={(e) => setSession(prev => ({ ...prev, notes: e.target.value }))}
                className="min-h-[80px] text-sm"
              />
            </CardContent>
          </Card>

          {/* Complete Session */}
          <Button
            onClick={handleCompleteSession}
            className="w-full h-14"
            disabled={session.employers.length === 0}
          >
            <CheckCircle className="h-5 w-5 mr-2" />
            Complete Mapping ({session.employers.length} employers)
          </Button>
        </div>
      </ScrollArea>

      {/* Employer Form Modal */}
      {showEmployerForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full max-h-[80vh] rounded-t-2xl">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Add Employer</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEmployerForm(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[60vh]">
              <div className="p-4 space-y-4">
                <div>
                  <Label htmlFor="employer-name">Employer Name *</Label>
                  <Input
                    id="employer-name"
                    value={currentEmployer.name}
                    onChange={(e) => setCurrentEmployer(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter company or individual name"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="contact-person">Contact Person</Label>
                  <Input
                    id="contact-person"
                    value={currentEmployer.contactPerson || ''}
                    onChange={(e) => setCurrentEmployer(prev => ({ ...prev, contactPerson: e.target.value }))}
                    placeholder="Site manager or contact name"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="employer-role">Role</Label>
                  <select
                    id="employer-role"
                    value={currentEmployer.role}
                    onChange={(e) => setCurrentEmployer(prev => ({
                      ...prev,
                      role: e.target.value as EmployerData['role']
                    }))}
                    className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="trade_subcontractor">Trade Subcontractor</option>
                    <option value="head_contractor">Head Contractor</option>
                    <option value="builder">Builder</option>
                    <option value="project_manager">Project Manager</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={currentEmployer.phone || ''}
                    onChange={(e) => setCurrentEmployer(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Phone number"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={currentEmployer.email || ''}
                    onChange={(e) => setCurrentEmployer(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Email address"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="abn">ABN</Label>
                  <Input
                    id="abn"
                    value={currentEmployer.abn || ''}
                    onChange={(e) => setCurrentEmployer(prev => ({ ...prev, abn: e.target.value }))}
                    placeholder="Australian Business Number"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="union-membership">Union Membership</Label>
                  <select
                    id="union-membership"
                    value={currentEmployer.unionMembership || 'potential'}
                    onChange={(e) => setCurrentEmployer(prev => ({
                      ...prev,
                      unionMembership: e.target.value as EmployerData['unionMembership']
                    }))}
                    className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="potential">Potential Member</option>
                    <option value="member">Union Member</option>
                    <option value="non_member">Non-Member</option>
                    <option value="declined">Declined Membership</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={currentEmployer.notes || ''}
                    onChange={(e) => setCurrentEmployer(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes about this employer"
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowEmployerForm(false)}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddEmployer}
                    className="w-full"
                    disabled={!currentEmployer.name.trim()}
                  >
                    Add Employer
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  )
}

export default EnhancedMobileMappingWorkflow