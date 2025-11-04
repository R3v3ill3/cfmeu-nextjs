"use client"

import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { MobileForm } from '@/components/mobile/shared/MobileForm'
import { MobileCameraCapture } from '@/components/mobile/forms/MobileCameraCapture'
import { MobileLocationPicker } from '@/components/mobile/forms/MobileLocationPicker'
import { HapticFeedback } from '@/components/mobile/shared/HapticFeedback'
import { useHapticFeedback } from '@/components/mobile/shared/HapticFeedback'
import {
  Building2,
  Users,
  UserCheck,
  Camera,
  MapPin,
  Plus,
  X,
  Phone,
  Mail,
  HardHat,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Navigation
} from 'lucide-react'

interface ProjectData {
  id: string
  name: string
  address: string
  status: string
  primary_trade?: string
  site_contact?: string
  site_phone?: string
  coordinates?: {
    lat: number
    lng: number
  }
}

interface MappingData {
  employers: Array<{
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
}

interface MobileMappingWorkflowProps {
  projectData: ProjectData
  initialData?: Partial<MappingData>
  onSubmit: (data: Partial<MappingData>) => Promise<void>
  onPartialSave: (data: Partial<MappingData>) => Promise<void>
  submitting: boolean
  isOnline: boolean
  isLowEndDevice: boolean
}

const COMMON_TRADES = [
  'Carpentry',
  'Electrical',
  'Plumbing',
  'Concreting',
  'Steel Fixing',
  'Scaffolding',
  'Painting',
  'Tiling',
  'Bricklaying',
  'Plastering',
  'Demolition',
  'Earthworks',
  'HVAC',
  'Glazing',
  'Landscaping'
]

const AMENITIES = [
  'Toilets',
  'Change Rooms',
  'First Aid',
  'Drinking Water',
  'Shelter',
  'Parking',
  'Canteen',
  'Washing Facilities'
]

const HAZARD_TYPES = [
  'Working at Heights',
  'Heavy Machinery',
  'Electrical Hazards',
  'Confined Spaces',
  'Chemical Exposure',
  'Noise Levels',
  'Dust Control',
  'Traffic Management'
]

export function MobileMappingWorkflow({
  projectData,
  initialData,
  onSubmit,
  onPartialSave,
  submitting,
  isOnline,
  isLowEndDevice
}: MobileMappingWorkflowProps) {
  const [currentData, setCurrentData] = useState<Partial<MappingData>>(initialData || {
    employers: [],
    delegates: [],
    workforce_stats: {
      total_workers: 0,
      union_members: 0,
      union_percentage: 0,
      trades: []
    },
    site_info: {},
    photos: []
  })

  const { trigger, success, error, selection } = useHapticFeedback()

  // Auto-save effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentData && Object.keys(currentData).length > 0) {
        onPartialSave(currentData)
      }
    }, 3000) // Auto-save after 3 seconds of inactivity

    return () => clearTimeout(timer)
  }, [currentData, onPartialSave])

  const updateCurrentData = useCallback((updates: Partial<MappingData>) => {
    setCurrentData(prev => ({ ...prev, ...updates }))
    selection()
  }, [selection])

  // Form Steps
  const steps = [
    {
      id: 'workforce',
      title: 'Workforce Overview',
      description: 'Basic information about the site workforce',
      component: ({ data, onChange }: any) => (
        <div className="space-y-6">
          <div>
            <Label htmlFor="total_workers" className="text-base font-medium">Total Workers</Label>
            <Input
              id="total_workers"
              type="number"
              placeholder="Enter total number of workers"
              value={data.total_workers || ''}
              onChange={(e) => onChange({ total_workers: parseInt(e.target.value) || 0 })}
              className="text-lg h-12 mt-2"
              inputMode="numeric"
            />
          </div>

          <div>
            <Label htmlFor="union_members" className="text-base font-medium">Union Members</Label>
            <Input
              id="union_members"
              type="number"
              placeholder="Enter number of union members"
              value={data.union_members || ''}
              onChange={(e) => {
                const unionMembers = parseInt(e.target.value) || 0
                const totalWorkers = data.total_workers || 0
                const percentage = totalWorkers > 0 ? Math.round((unionMembers / totalWorkers) * 100) : 0
                onChange({
                  union_members: unionMembers,
                  union_percentage: percentage
                })
              }}
              className="text-lg h-12 mt-2"
              inputMode="numeric"
            />
            {data.total_workers > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Union density: {data.union_percentage || 0}%
              </p>
            )}
          </div>

          <div>
            <Label className="text-base font-medium">Workforce by Trade</Label>
            <div className="space-y-3 mt-2">
              {data.trades?.map((trade: any, index: number) => (
                <div key={index} className="flex gap-2 items-center">
                  <Select
                    value={trade.trade}
                    onValueChange={(value) => {
                      const newTrades = [...(data.trades || [])]
                      newTrades[index] = { ...trade, trade: value }
                      onChange({ trades: newTrades })
                    }}
                  >
                    <SelectTrigger className="flex-1 h-11">
                      <SelectValue placeholder="Select trade" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_TRADES.map(tradeName => (
                        <SelectItem key={tradeName} value={tradeName}>{tradeName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="Count"
                    value={trade.count || ''}
                    onChange={(e) => {
                      const newTrades = [...(data.trades || [])]
                      newTrades[index] = { ...trade, count: parseInt(e.target.value) || 0 }
                      onChange({ trades: newTrades })
                    }}
                    className="w-20 h-11"
                    inputMode="numeric"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const newTrades = data.trades?.filter((_: any, i: number) => i !== index) || []
                      onChange({ trades: newTrades })
                    }}
                    className="h-11 w-11"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const newTrades = [...(data.trades || []), { trade: '', count: 0, union_members: 0 }]
                  onChange({ trades: newTrades })
                }}
                className="w-full h-11"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Trade
              </Button>
            </div>
          </div>
        </div>
      ),
      validation: (data: any) => {
        if (!data.total_workers || data.total_workers <= 0) {
          return "Please enter the total number of workers"
        }
        if (data.union_members < 0 || data.union_members > data.total_workers) {
          return "Union members must be between 0 and total workers"
        }
        return true
      }
    },

    {
      id: 'employers',
      title: 'Employers & Contractors',
      description: 'List all employers and contractors on site',
      component: ({ data, onChange }: any) => (
        <div className="space-y-6">
          <div>
            <Label className="text-base font-medium flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Employers on Site
            </Label>
            <div className="space-y-4 mt-3">
              {data.employers?.map((employer: any, index: number) => (
                <Card key={index} className="border-2">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 space-y-3">
                        <Input
                          placeholder="Employer name"
                          value={employer.name || ''}
                          onChange={(e) => {
                            const newEmployers = [...(data.employers || [])]
                            newEmployers[index] = { ...employer, name: e.target.value }
                            onChange({ employers: newEmployers })
                          }}
                          className="h-11"
                        />
                        <div className="flex gap-2">
                          <Input
                            placeholder="ABN (optional)"
                            value={employer.abn || ''}
                            onChange={(e) => {
                              const newEmployers = [...(data.employers || [])]
                              newEmployers[index] = { ...employer, abn: e.target.value }
                              onChange({ employers: newEmployers })
                            }}
                            className="flex-1 h-11"
                          />
                          <Select
                            value={employer.trade}
                            onValueChange={(value) => {
                              const newEmployers = [...(data.employers || [])]
                              newEmployers[index] = { ...employer, trade: value }
                              onChange({ employers: newEmployers })
                            }}
                          >
                            <SelectTrigger className="flex-1 h-11">
                              <SelectValue placeholder="Trade" />
                            </SelectTrigger>
                            <SelectContent>
                              {COMMON_TRADES.map(tradeName => (
                                <SelectItem key={tradeName} value={tradeName}>{tradeName}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder="Workforce size"
                            value={employer.workforce_size || ''}
                            onChange={(e) => {
                              const newEmployers = [...(data.employers || [])]
                              newEmployers[index] = { ...employer, workforce_size: parseInt(e.target.value) || 0 }
                              onChange({ employers: newEmployers })
                            }}
                            className="w-32 h-11"
                            inputMode="numeric"
                          />
                          <Input
                            placeholder="Contact name"
                            value={employer.contact_name || ''}
                            onChange={(e) => {
                              const newEmployers = [...(data.employers || [])]
                              newEmployers[index] = { ...employer, contact_name: e.target.value }
                              onChange({ employers: newEmployers })
                            }}
                            className="flex-1 h-11"
                          />
                        </div>
                        <Input
                          placeholder="Contact phone"
                          value={employer.contact_phone || ''}
                          onChange={(e) => {
                            const newEmployers = [...(data.employers || [])]
                            newEmployers[index] = { ...employer, contact_phone: e.target.value }
                            onChange({ employers: newEmployers })
                          }}
                          className="h-11"
                          type="tel"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const newEmployers = data.employers?.filter((_: any, i: number) => i !== index) || []
                          onChange({ employers: newEmployers })
                        }}
                        className="h-8 w-8 ml-2"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {employer.is_primary_contractor && (
                      <Badge variant="default" className="w-fit">
                        Primary Contractor
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const newEmployers = [...(data.employers || []), {
                    name: '',
                    trade: '',
                    workforce_size: 0,
                    is_primary_contractor: data.employers?.length === 0
                  }]
                  onChange({ employers: newEmployers })
                }}
                className="w-full h-11"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Employer
              </Button>
            </div>
          </div>
        </div>
      ),
      validation: (data: any) => {
        if (!data.employers || data.employers.length === 0) {
          return "Please add at least one employer"
        }
        const hasPrimary = data.employers.some((e: any) => e.is_primary_contractor)
        if (!hasPrimary) {
          return "Please mark one employer as the primary contractor"
        }
        return true
      }
    },

    {
      id: 'delegates',
      title: 'Union Delegates',
      description: 'Information about union delegates on site',
      component: ({ data, onChange }: any) => (
        <div className="space-y-6">
          <div>
            <Label className="text-base font-medium flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Union Delegates
            </Label>
            <div className="space-y-4 mt-3">
              {data.delegates?.map((delegate: any, index: number) => (
                <Card key={index} className="border-2">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 space-y-3">
                        <Input
                          placeholder="Delegate name"
                          value={delegate.name || ''}
                          onChange={(e) => {
                            const newDelegates = [...(data.delegates || [])]
                            newDelegates[index] = { ...delegate, name: e.target.value }
                            onChange({ delegates: newDelegates })
                          }}
                          className="h-11"
                        />
                        <div className="flex gap-2">
                          <Input
                            placeholder="Phone"
                            value={delegate.phone || ''}
                            onChange={(e) => {
                              const newDelegates = [...(data.delegates || [])]
                              newDelegates[index] = { ...delegate, phone: e.target.value }
                              onChange({ delegates: newDelegates })
                            }}
                            className="flex-1 h-11"
                            type="tel"
                          />
                          <Input
                            placeholder="Email (optional)"
                            value={delegate.email || ''}
                            onChange={(e) => {
                              const newDelegates = [...(data.delegates || [])]
                              newDelegates[index] = { ...delegate, email: e.target.value }
                              onChange({ delegates: newDelegates })
                            }}
                            className="flex-1 h-11"
                            type="email"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Select
                            value={delegate.trade}
                            onValueChange={(value) => {
                              const newDelegates = [...(data.delegates || [])]
                              newDelegates[index] = { ...delegate, trade: value }
                              onChange({ delegates: newDelegates })
                            }}
                          >
                            <SelectTrigger className="flex-1 h-11">
                              <SelectValue placeholder="Trade" />
                            </SelectTrigger>
                            <SelectContent>
                              {COMMON_TRADES.map(tradeName => (
                                <SelectItem key={tradeName} value={tradeName}>{tradeName}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`safety-rep-${index}`}
                            checked={delegate.is_safety_rep || false}
                            onChange={(e) => {
                              const newDelegates = [...(data.delegates || [])]
                              newDelegates[index] = { ...delegate, is_safety_rep: e.target.checked }
                              onChange({ delegates: newDelegates })
                            }}
                            className="h-4 w-4"
                          />
                          <Label htmlFor={`safety-rep-${index}`} className="text-sm">
                            Safety Representative
                          </Label>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const newDelegates = data.delegates?.filter((_: any, i: number) => i !== index) || []
                          onChange({ delegates: newDelegates })
                        }}
                        className="h-8 w-8 ml-2"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const newDelegates = [...(data.delegates || []), {
                    name: '',
                    phone: '',
                    trade: '',
                    is_safety_rep: false
                  }]
                  onChange({ delegates: newDelegates })
                }}
                className="w-full h-11"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Delegate
              </Button>
            </div>
          </div>
        </div>
      ),
    },

    {
      id: 'site_info',
      title: 'Site Information',
      description: 'Details about site access, amenities, and safety',
      component: ({ data, onChange }: any) => (
        <div className="space-y-6">
          <div>
            <Label className="text-base font-medium">Site Access & Hours</Label>
            <div className="space-y-3 mt-2">
              <div>
                <Label htmlFor="site_hours" className="text-sm font-medium">Site Hours</Label>
                <Input
                  id="site_hours"
                  placeholder="e.g., 7:00 AM - 5:00 PM, Monday-Friday"
                  value={data.site_hours || ''}
                  onChange={(e) => onChange({ site_hours: e.target.value })}
                  className="h-11 mt-1"
                />
              </div>
              <div>
                <Label htmlFor="safety_briefing" className="text-sm font-medium">Safety Briefing Time</Label>
                <Input
                  id="safety_briefing"
                  placeholder="e.g., 6:45 AM daily"
                  value={data.safety_briefing_time || ''}
                  onChange={(e) => onChange({ safety_briefing_time: e.target.value })}
                  className="h-11 mt-1"
                />
              </div>
              <div>
                <Label htmlFor="access_notes" className="text-sm font-medium">Access Notes</Label>
                <Textarea
                  id="access_notes"
                  placeholder="How to access the site, parking instructions, etc."
                  value={data.access_notes || ''}
                  onChange={(e) => onChange({ access_notes: e.target.value })}
                  className="mt-1 min-h-[80px]"
                />
              </div>
              <div>
                <Label htmlFor="parking_notes" className="text-sm font-medium">Parking Notes</Label>
                <Textarea
                  id="parking_notes"
                  placeholder="Parking availability, restrictions, etc."
                  value={data.parking_notes || ''}
                  onChange={(e) => onChange({ parking_notes: e.target.value })}
                  className="mt-1 min-h-[80px]"
                />
              </div>
            </div>
          </div>

          <div>
            <Label className="text-base font-medium">Available Amenities</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {AMENITIES.map(amenity => (
                <label key={amenity} className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={data.amenities_available?.includes(amenity) || false}
                    onChange={(e) => {
                      const amenities = data.amenities_available || []
                      const newAmenities = e.target.checked
                        ? [...amenities, amenity]
                        : amenities.filter((a: string) => a !== amenity)
                      onChange({ amenities_available: newAmenities })
                    }}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">{amenity}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-base font-medium flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Site Hazards
            </Label>
            <div className="space-y-2 mt-2">
              {HAZARD_TYPES.map(hazard => (
                <label key={hazard} className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={data.hazards?.includes(hazard) || false}
                    onChange={(e) => {
                      const hazards = data.hazards || []
                      const newHazards = e.target.checked
                        ? [...hazards, hazard]
                        : hazards.filter((h: string) => h !== hazard)
                      onChange({ hazards: newHazards })
                    }}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">{hazard}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      ),
    },

    {
      id: 'photos',
      title: 'Site Photos',
      description: 'Capture photos of the site for documentation',
      component: ({ data, onChange }: any) => (
        <div className="space-y-6">
          <div>
            <Label className="text-base font-medium flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Site Documentation Photos
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Take photos to document site conditions, workforce areas, and safety information
            </p>
          </div>

          <div className="space-y-4">
            {[
              { type: 'site_overview', label: 'Site Overview', description: 'Overall view of the construction site' },
              { type: 'workforce_area', label: 'Workforce Areas', description: 'Where workers gather and take breaks' },
              { type: 'safety_signage', label: 'Safety Signage', description: 'Safety notices and information boards' },
              { type: 'amenities', label: 'Site Amenities', description: 'Toilets, change rooms, first aid, etc.' }
            ].map(photoType => (
              <Card key={photoType.type} className="border-2">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium">{photoType.label}</h4>
                      <p className="text-sm text-muted-foreground">{photoType.description}</p>
                    </div>

                    <MobileCameraCapture
                      onPhotoCaptured={(photoData) => {
                        const newPhotos = [
                          ...(data.photos || []),
                          {
                            id: `photo-${Date.now()}`,
                            url: photoData.url,
                            type: photoType.type as any,
                            description: photoData.description,
                            timestamp: new Date().toISOString()
                          }
                        ]
                        onChange({ photos: newPhotos })
                      }}
                      className="w-full"
                    />

                    {/* Display existing photos of this type */}
                    <div className="grid grid-cols-2 gap-2">
                      {data.photos
                        ?.filter((photo: any) => photo.type === photoType.type)
                        ?.map((photo: any, index: number) => (
                          <div key={photo.id} className="relative group">
                            <img
                              src={photo.url}
                              alt={photo.description || photoType.label}
                              className="w-full h-32 object-cover rounded-lg border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              onClick={() => {
                                const newPhotos = data.photos?.filter((p: any) => p.id !== photo.id) || []
                                onChange({ photos: newPhotos })
                              }}
                              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                            {photo.description && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                {photo.description}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ),
    }
  ]

  const handleStepChange = useCallback((stepId: string, data: any) => {
    updateCurrentData({ [stepId]: data })
  }, [updateCurrentData])

  const handleFormSubmit = useCallback(async (formData: any) => {
    // Combine all step data into final mapping data
    const finalData: Partial<MappingData> = {
      workforce_stats: formData.workforce || {},
      employers: formData.employers?.employers || [],
      delegates: formData.delegates?.delegates || [],
      site_info: formData.site_info || {},
      photos: formData.photos?.photos || []
    }

    await onSubmit(finalData)
  }, [onSubmit])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-gray-900">{projectData.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{projectData.address}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <Badge variant={projectData.status === 'active' ? 'default' : 'secondary'}>
                {projectData.status}
              </Badge>
              {projectData.primary_trade && (
                <span className="text-muted-foreground">
                  <HardHat className="h-4 w-4 inline mr-1" />
                  {projectData.primary_trade}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="pb-20">
        <MobileForm
          steps={steps}
          onSubmit={handleFormSubmit}
          onDataChange={handleStepChange}
          showProgress={true}
          allowSkip={false}
          saveOnStepChange={true}
          className="h-full"
        />
      </div>

      {/* Save Status */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <Clock className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-muted-foreground">
              {isOnline ? 'Online - Auto-saving' : 'Offline - Saved locally'}
            </span>
          </div>
          {submitting && (
            <span className="text-blue-600">Submitting...</span>
          )}
        </div>
      </div>
    </div>
  )
}